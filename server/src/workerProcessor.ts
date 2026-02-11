import { Job } from 'bullmq';
import { readSheet, updateCell } from './engine/sheetWatcher.js';
import { resolveVariable, type ExecutionContext } from './engine/variableResolver.js';
import { NODE_REGISTRY } from './engine/nodes/index.js';
import { evaluateRuleGroup, type RuleGroup, type LogicRule } from './engine/logic.js';

// --- HELPER: RECURSIVE VARIABLE RESOLVER ---
// Traverses the RuleGroup and replaces {{Variables}} with actual values
const resolveRuleGroup = (group: RuleGroup, context: ExecutionContext): RuleGroup => {
    return {
        combinator: group.combinator,
        rules: group.rules.map((rule: any) => {
            // If it's a nested group, recurse
            if ('combinator' in rule) {
                return resolveRuleGroup(rule as RuleGroup, context);
            }
            
            // If it's a rule, resolve inputs
            const r = rule as LogicRule;
            return {
                operator: r.operator,
                valueA: resolveVariable(r.valueA, context),
                valueB: resolveVariable(r.valueB, context)
            };
        })
    };
};

// --- RECURSIVE EXECUTOR ---
const executeChain = async (actions: any[], context: ExecutionContext, spreadsheetId?: string): Promise<ExecutionContext> => {
    
    for (const action of actions) {
        console.log(`   ➡️ Executing: ${action.type}`);

        // A. PARALLEL HANDLING (Fan-Out / Fan-In)
        if (action.type === 'parallel') {
            console.log(`   🔀 Forking into ${action.branches.length} Branches...`);
            const branches = action.branches || [];
            
            const results = await Promise.allSettled(branches.map(async (branch: any[]) => {
                const branchContext = { ...context }; 
                await executeChain(branch, branchContext, spreadsheetId);
                return branchContext; 
            }));

            console.log(`   ⬇️ Merging Branch Data...`);
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    Object.assign(context, result.value);
                } else {
                    console.error(`      🔴 Branch ${index + 1} Failed:`, result.reason);
                }
            });
            console.log(`   ✅ Parallel Sync Complete.`);
            continue; 
        }

        // B. CONDITION HANDLING (The Logic Upgrade)
        if (action.type === 'condition') {
             console.log(`   ⚖️ Evaluating Logic Rules...`);

             // 1. Get Rules (Support Legacy & New Format)
             let rules = action.inputs.rules;
             
             // Fallback for simple/legacy nodes without groups
             if (!rules && action.inputs.variable) {
                 rules = {
                    combinator: 'AND',
                    rules: [{
                        valueA: action.inputs.variable,
                        operator: action.inputs.operator,
                        valueB: action.inputs.value
                    }]
                 };
             }

             if (!rules) {
                 console.warn(`      ⚠️ No rules found in condition node. Skipping.`);
                 continue;
             }

             // 2. Resolve Variables (Recursively)
             // We map {{Column_A}} -> 100 before evaluation
             const resolvedRules = resolveRuleGroup(rules, context);

             // 3. Evaluate Boolean Logic
             const isTrue = evaluateRuleGroup(resolvedRules);
             console.log(`      -> Result: ${isTrue ? "✅ TRUE" : "❌ FALSE"}`);

             // 4. Branch Execution
             // Note: In your deployment logic, the condition node is the End of the current chain.
             // The flow continues inside the trueRoutes or falseRoutes.
             
             if (isTrue) {
                 if (action.trueRoutes && action.trueRoutes.length > 0) {
                     console.log(`      -> Following TRUE Path...`);
                     // We await the sub-chain and return ITS context as the final result
                     return await executeChain(action.trueRoutes, context, spreadsheetId);
                 }
             } else {
                 if (action.falseRoutes && action.falseRoutes.length > 0) {
                     console.log(`      -> Following FALSE Path...`);
                     return await executeChain(action.falseRoutes, context, spreadsheetId);
                 }
             }

             // If the chosen path is empty, we just return the current context
             return context; 
        }

        // C. STANDARD NODE
        const nodeExecutor = NODE_REGISTRY[action.type];
        if (!nodeExecutor) {
            console.error(`   ❌ Critical: Unknown Node ${action.type}`);
            break;
        }

        try {
            const inputs = { ...action.inputs, spreadsheetId };
            const result = await nodeExecutor(inputs, context);
            
            if (result) {
                Object.assign(context, result);
                if (action.id) {
                    context[action.id] = { ...result };
                }
            }
        } catch (err: any) {
            console.error(`   ❌ Error at ${action.type}: ${err.message}`);
            throw err;
        }
    }
    
    return context;
};

// --- WORKER ENTRY POINT ---
export default async function workerProcessor(job: Job) {
    console.log(`\n👷 [PID:${process.pid}] Processing Job ${job.id}`);
    
    const { config, context: initialContext } = job.data;
    let itemsToProcess: any[] = [];

    try {
        if (config.trigger.type === "sheets") {
            const sheetId = config.spreadsheetId;
            if (!sheetId) throw new Error("No Spreadsheet ID");
            const rawRows = await readSheet(sheetId);
            const triggerCol = config.trigger.colIndex !== undefined ? Number(config.trigger.colIndex) : 5;
            const triggerVal = config.trigger.value || "Pending";

            itemsToProcess = rawRows
                .map((row, index) => ({ row, realIndex: index + 2 }))
                .filter(item => item.row[triggerCol] === triggerVal);
                
            console.log(`   📊 [PID:${process.pid}] Sheet Mode: Processing ${itemsToProcess.length} rows.`);
        } else {
            itemsToProcess = [{ row: [], realIndex: -1, initialContext }];
            console.log(`   ⚡ [PID:${process.pid}] Single Mode: Executing 1 run.`);
        }

        for (const item of itemsToProcess) {
            const context = { ...item.initialContext };
            
            if (item.row.length > 0) {
                item.row.forEach((val: any, idx: number) => {
                    const colLetter = String.fromCharCode(65 + idx);
                    context[`Column_${colLetter}`] = val;
                    if (config.columnMapping && config.columnMapping[idx.toString()]) {
                        context[config.columnMapping[idx.toString()]] = val;
                    }
                });
                context["ROW_INDEX"] = item.realIndex;
            }

            await executeChain(config.actions, context, config.spreadsheetId);
        }

        console.log(`🏁 [PID:${process.pid}] Job ${job.id} Completed.`);
        return { status: "success", processed: itemsToProcess.length };

    } catch (error: any) {
        console.error(`💥 [PID:${process.pid}] Job ${job.id} Failed:`, error.message);
        throw error;
    }
}