import express from "express";
import bodyParser from "body-parser";
import cors from "cors"; // <--- Critical for Frontend-Backend communication
import { readSheet, updateCell } from "../engine/sheetWatcher.js";
import { resolveVariable, type ExecutionContext } from "../engine/variableResolver.js";
import { NODE_REGISTRY } from "../engine/nodes/index.js";
import { type RuleGroup, evaluateRuleGroup } from "../engine/logic.js";

// Keep these for the standalone testing route /webhook/:userId
import { createNexusAccount, sendTestTransaction } from "../engine/smartAccount.js";
import { validateBalance } from "../engine/guardRails.js";

const app: express.Application = express();

// 1. ENABLE CORS & JSON PARSING
// This allows requests from 'http://localhost:3000' (your frontend)
app.use(cors({ origin: "*" })); 
app.use(bodyParser.json());

// 2. RUN ON PORT 3001
// This prevents conflict with Next.js which uses 3000 by default
const PORT: number = 3001;

// --- LEGACY / TEST ROUTE (Kept for manual testing) ---
app.post("/webhook/:userId", async (req, res) => {
    const userId = req.params.userId;
    console.log(`\n[Test Webhook] Triggered by User: ${userId}`);

    try {
        const nexusClient = await createNexusAccount(0);
        const accountAddress = nexusClient.account.address;
        
        const check = await validateBalance(
            accountAddress,
            req.body.amount,
            req.body.currency as 'ETH' | 'USDC'
        );

        if (!check.success) {
            console.error(`🛑 STOP: ${check.reason}`);
            return res.send({ error: check.reason });
        }

        console.log(`🤖 Smart Account Active: ${accountAddress}`);
        
        const response = await sendTestTransaction(
            nexusClient,
            req.body.toAddress,
            req.body.amount,
            req.body.currency
        );

        if (!response.success) {
            return res.status(500).send({ error: "Transaction failed" });
        }

        res.status(200).send({ 
            status: "Success", 
            account: accountAddress, 
            txHash: response.hash 
        });
    } catch (error: any) {
        console.error("❌ Execution Failed:", error);
        res.status(500).send({ error: error.message || "Transaction failed" });
    }
});

// --- THE ROBUST WORKFLOW ENGINE ---
app.post("/trigger-workflow", async (req, res) => {
    // 1. Get Configuration & Context
    const workflowConfig = req.body.config;
    // Manual context comes from Webhook triggers (e.g. { "event_type": "sale", "amount": 100 })
    const manualContext = req.body.context || {}; 

    if (!workflowConfig) {
        return res.status(400).send({ error: "Missing workflow configuration." });
    }

    console.log(`\n⚙️ Triggering Workflow: ${workflowConfig.trigger.type.toUpperCase()}`);

    try {
        let itemsToProcess: any[] = [];

        // 2. DETERMINE MODE (Batch vs Single)
        
        // --- MODE A: GOOGLE SHEETS (Batch) ---
        if (workflowConfig.trigger.type === "sheets") {
            const sheetId = workflowConfig.spreadsheetId;
            // Only enforce sheetId if the trigger is actually a SHEET
            if (!sheetId) throw new Error("Spreadsheet ID required for Sheet triggers.");

            const rawRows = await readSheet(sheetId);
            
            // Default to Column F (Index 5) if not specified
            const triggerCol = workflowConfig.trigger.colIndex !== undefined ? workflowConfig.trigger.colIndex : 5;
            const triggerVal = workflowConfig.trigger.value || "Pending";

            // Map rows to objects and filter
            itemsToProcess = rawRows
                .map((row, index) => ({ row, realIndex: index + 2 })) // +2 for header offset
                .filter(item => item.row[triggerCol] === triggerVal);

            console.log(`   📊 Sheet Mode: Found ${itemsToProcess.length} pending items.`);
        } 
        
        // --- MODE B: SINGLE (Webhook / Timer / Manual) ---
        else {
            // We treat this as a single "item" with no sheet row, but with initial context
            itemsToProcess = [{ 
                row: [], 
                realIndex: -1, 
                initialContext: manualContext 
            }];
            console.log(`   ⚡ Single Mode: Executing 1 run.`);
        }

        if (itemsToProcess.length === 0) {
            return res.send({ status: "No items to process." });
        }

        // 3. EXECUTION LOOP
        let processedCount = 0;

        for (const item of itemsToProcess) {
            // A. Build Context
            const context: ExecutionContext = { ...item.initialContext };
            
            // If it's a sheet row, map columns to variables (Column_A, Column_B...)
            if (item.row.length > 0) {
                item.row.forEach((val: any, idx: number) => {
                    const colLetter = String.fromCharCode(65 + idx); 
                    context[`Column_${colLetter}`] = val;
                });
                context["ROW_INDEX"] = item.realIndex;
            }

            // Log start of this item
            const identifier = item.realIndex !== -1 ? `Row ${item.realIndex}` : `Webhook Event`;
            console.log(`\n▶️ Processing ${identifier}...`);
            
            // B. Run Actions
            for (const action of workflowConfig.actions) {
                
                // --- LOGIC GATE (If/Else Rules) ---
                if (action.rules) {
                    const resolvedRules = JSON.parse(JSON.stringify(action.rules));
                    
                    const resolveRecursive = (group: RuleGroup) => {
                        group.rules.forEach((rule: any) => {
                            if (rule.combinator) resolveRecursive(rule);
                            else {
                                rule.valueA = resolveVariable(rule.valueA, context);
                                rule.valueB = resolveVariable(rule.valueB, context);
                            }
                        });
                    };

                    resolveRecursive(resolvedRules);

                    const isAllowed = evaluateRuleGroup(resolvedRules);
                    if (!isAllowed) {
                        console.log(`   ⛔ Logic Blocked Action ${action.type}. Skipping.`);
                        // Logic skipping implies we move to the NEXT action, 
                        // NOT break the whole chain (unless you want strict gating).
                        // Usually, we just skip this action.
                        continue; 
                    }
                }

                // --- NODE EXECUTION ---
                const nodeExecutor = NODE_REGISTRY[action.type];

                if (!nodeExecutor) {
                    console.error(`   ❌ Critical: Unknown Node Type ${action.type}`);
                    // Unknown node is a critical config error, stop this item.
                    break;
                }

                try {
                    // Inject spreadsheetId into inputs (nodes like 'update_row' need it)
                    // We only inject it IF it exists in the config
                    const inputs = { 
                        ...action.inputs, 
                        spreadsheetId: workflowConfig.spreadsheetId || undefined
                    };

                    const result = await nodeExecutor(inputs, context);
                    
                    // Update Context with results (e.g. { TX_HASH: "0x..." })
                    if (result) {
                        Object.assign(context, result);
                    }

                    // Check for "Soft Failures" returned by nodes (if they don't throw)
                    if (result && result.STATUS === "Failed") {
                        throw new Error("Node returned failure status");
                    }

                } catch (err: any) {
                    console.error(`   ❌ Workflow Aborted at ${action.type}: ${err.message}`);
                    
                    // --- FAIL-STOP MECHANISM ---
                    // If a node crashes, we STOP processing this specific item (Row/Webhook).
                    
                    // Optional: Write error back to sheet if possible
                    if (context["ROW_INDEX"] && workflowConfig.spreadsheetId) {
                        const colLetter = "F"; // Assumes Col F is Status
                        const rowIndex = context["ROW_INDEX"];
                        updateCell(workflowConfig.spreadsheetId, `Sheet1!${colLetter}${rowIndex}`, `Error: ${err.message}`)
                            .catch(e => console.error("   ⚠️ Could not write error to sheet"));
                    }
                    
                    break; // Breaks the Action Loop, moves to next Item
                }
            }
            processedCount++;
        }

        res.send({ status: "Workflow Complete", processed: processedCount });

    } catch (error: any) {
        console.error("❌ Critical Workflow Error:", error);
        res.status(500).send({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Nexus Flow Engine running on http://localhost:${PORT}`);
});