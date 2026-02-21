import { type ExecutionContext, resolveVariable } from "../variableResolver.js";
import { parseUnits, parseAbi, encodeFunctionData } from "viem";
import { encodeSwap, UNISWAP_ROUTER } from "../uniswap.js";
import { createNexusAccount } from "../smartAccount.js";
import { Sanitize } from "../utils/inputSanitizer.js";
import { KNOWN_TOKENS } from "../utils/tokenRegistry.js"; // <-- Import Registry

type ActionInput = Record<string, any>;

export const swapUniswap = async (inputs: ActionInput, context: ExecutionContext) => {
    // 1. Resolve Frontend Selections
    const selectedTokenIn = resolveVariable(inputs.tokenIn, context);
    const selectedTokenOut = resolveVariable(inputs.tokenOut, context);
    
    // 2. Map to Registry or Fallback to Custom
    const tokenInConfig = KNOWN_TOKENS[selectedTokenIn] || {
        address: resolveVariable(inputs.customTokenIn, context),
        decimals: inputs.customDecimals ? Number(resolveVariable(inputs.customDecimals, context)) : 18,
        isNative: inputs.customIsNative === "true"
    };

    const tokenOutConfig = KNOWN_TOKENS[selectedTokenOut] || {
        address: resolveVariable(inputs.customTokenOut, context),
        decimals: 18, // Output decimals don't strictly matter for the swap router amounts, but good to have
        isNative: false // Assume out is ERC20 unless explicitly handled
    };

    const tokenInAddress = Sanitize.address(tokenInConfig.address);
    const tokenOutAddress = Sanitize.address(tokenOutConfig.address);
    const rawAmount = resolveVariable(inputs.amountIn, context);
    const amount = Sanitize.number(rawAmount);
    const recipient = resolveVariable(inputs.recipient, context);

    console.log(`   🦄 Executing Uniswap Node: Swapping ${amount} ${selectedTokenIn} to ${selectedTokenOut}...`);

    const amountBigInt = parseUnits(amount.toString(), tokenInConfig.decimals);
    const calldata = encodeSwap(tokenInAddress, tokenOutAddress, amountBigInt, recipient);
    const nexusClient = await createNexusAccount(0);
    const calls: any[] = [];

    // --- BATCH 1: ERC-20 APPROVAL ---
    if (!tokenInConfig.isNative) {
        console.log(`      -> Not native ETH. Batching ERC-20 Approval...`);
        const erc20Abi = parseAbi(["function approve(address spender, uint256 amount)"]);
        
        const approveData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [UNISWAP_ROUTER as `0x${string}`, amountBigInt]
        });

        calls.push({
            to: tokenInAddress as `0x${string}`,
            value: 0n,
            data: approveData
        });
    }

    // --- BATCH 2: THE SWAP ---
    calls.push({
        to: UNISWAP_ROUTER as `0x${string}`,
        value: tokenInConfig.isNative ? amountBigInt : 0n,
        data: calldata
    });

    const userOpHash = await nexusClient.sendUserOperation({ calls });
    const receipt = await nexusClient.waitForUserOperationReceipt({ hash: userOpHash });
    const txHash = receipt.receipt.transactionHash;

    const explorerLink = `https://sepolia.etherscan.io/tx/${txHash}`;
    console.log(`      ✅ Swap Complete! Hash: ${txHash}`);

    return { 
        "TX_HASH": txHash,
        "EXPLORER_LINK": explorerLink,
        "STATUS": "Success"
    };
};