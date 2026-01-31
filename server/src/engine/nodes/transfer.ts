import { resolveVariable, type ExecutionContext } from "../variableResolver.js";
import { createNexusAccount, sendTestTransaction } from "../smartAccount.js";
import { validateBalance } from "../guardRails.js";
import { Sanitize } from "../utils/inputSanitizer.js";

type ActionInput = Record<string, any>;

export const transfer = async (inputs: ActionInput, context: ExecutionContext) => {
    const to = Sanitize.address(resolveVariable(inputs.toAddress, context));
    const rawAmt = resolveVariable(inputs.amount, context);
    const amt = Sanitize.number(rawAmt);
    const curr = resolveVariable(inputs.currency, context);
    const name = resolveVariable(inputs.name, context);

    let decimals = 18;
    if (Sanitize.equals(curr, "USDC") || Sanitize.equals(curr, "USDT")) decimals = 6;
    if (Sanitize.equals(curr, "WBTC")) decimals = 8;
    if (inputs.decimals) decimals = Number(inputs.decimals);

    console.log(`   ➡️ Transfer: Sending ${amt} ${curr} to ${name} (${to})`);

    if (!to || !to.startsWith("0x")) {
        console.error(`   ❌ Invalid Address. Skipping.`);
        return { "STATUS": "Failed" };
    }

    try {
        const nexusClient = await createNexusAccount(0);
        const accountAddress = nexusClient.account.address;
        
        const check = await validateBalance(accountAddress, amt.toString(), curr);
        if (!check.success) {
            console.error(`   🛑 STOP: ${check.reason}`);
            return { "STATUS": "Failed" };
        }

        const response = await sendTestTransaction(nexusClient, to, amt.toString(), curr);
        
        if (!response.success) {
            return new Error("Transaction failed");
        }

        const txHash = response.hash;
        context["TX_HASH"] = txHash; 
        console.log(`   ✅ Transaction complete: ${txHash}`);

        return { "TX_HASH": txHash, "STATUS": "Success" };

    } catch (err: any) {
        console.error(`   ❌ Transfer Failed: ${err.message}`);
        return { "STATUS": "Failed" };
    }
}