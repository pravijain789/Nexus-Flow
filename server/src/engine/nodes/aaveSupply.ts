import { 
    encodeFunctionData, 
    parseAbi, 
    parseUnits, 
    formatUnits, 
    createPublicClient,
    http                
} from "viem"; 
import { sepolia } from "viem/chains"; 
import { type ExecutionContext, resolveVariable } from "../variableResolver.js";
import { createNexusAccount } from "../smartAccount.js";
import { Sanitize } from "../utils/inputSanitizer.js";

type ActionInput = Record<string, any>;

export const getAaveSupply = async (inputs: ActionInput, context: ExecutionContext) => {
    let asset = Sanitize.address(resolveVariable(inputs.asset, context));
    const rawAmount = resolveVariable(inputs.amount, context);
    const amount = Sanitize.number(rawAmount);
   
    const nexusClient = await createNexusAccount(0);
    const smartAccountAddress = nexusClient.account.address; 
    const onBehalfOf = inputs.onBehalfOf ? Sanitize.address(resolveVariable(inputs.onBehalfOf, context)) : smartAccountAddress;
    
    const AAVE_POOL = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951";
    // WETH address on Sepolia
    const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http() 
    });

    const calls: any[] = [];
    let assetToSupply = asset;
    let decimals = inputs.decimals !== undefined ? Number(inputs.decimals) : 18;

    const erc20Abi = parseAbi([
        "function approve(address spender, uint256 amount)",
        "function balanceOf(address account) view returns (uint256)"
    ]);
    const aaveAbi = parseAbi(["function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"]);

    // --- HANDLE NATIVE ETH (OR WETH) ---
    // If the user inputs the zero address or 'ETH', we treat it as native ETH.
    // Aave requires WETH, so we must batch a deposit transaction first.
    if (asset === "0x0000000000000000000000000000000000000000" || asset.toUpperCase() === "ETH") {
        console.log(`   👻 Native ETH detected. Automatically wrapping to WETH...`);
        assetToSupply = WETH_ADDRESS;
        decimals = 18;

        const wethAbi = parseAbi(["function deposit() payable"]);
        const amountBigInt = parseUnits(amount.toString(), decimals);

        // 1. Guardrail for Native ETH
        const ethBalance = await publicClient.getBalance({ address: smartAccountAddress as `0x${string}` });
        if (ethBalance < amountBigInt) {
             throw new Error(`Insufficient ETH Balance. Have ${formatUnits(ethBalance, 18)}, Need ${amount}`);
        }

        // Add WETH Deposit to batch
        calls.push({
            to: WETH_ADDRESS as `0x${string}`,
            value: amountBigInt,
            data: encodeFunctionData({ abi: wethAbi, functionName: "deposit" })
        });

    } else {
        // --- GUARDRAIL FOR ERC20 ---
        const amountBigInt = parseUnits(amount.toString(), decimals);
        const currentBalance = await publicClient.readContract({
            address: assetToSupply as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [smartAccountAddress as `0x${string}`]
        }) as bigint;

        if (currentBalance < amountBigInt) {
            throw new Error(`Insufficient Token Balance. Have ${formatUnits(currentBalance, decimals)}, Need ${amount}`);
        }
    }

    const amountBigIntFinal = parseUnits(amount.toString(), decimals);

    // --- PREPARE AAVE CALLS ---
    const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [AAVE_POOL as `0x${string}`, amountBigIntFinal]
    });
    
    const supplyData = encodeFunctionData({
        abi: aaveAbi,
        functionName: "supply",
        args: [
            assetToSupply as `0x${string}`,
            amountBigIntFinal,
            onBehalfOf as `0x${string}`,
            0 
        ]
    });

    console.log(`      -> Batching Calls into a single UserOperation...`);
    
    // Add Approve and Supply to batch
    calls.push({ to: assetToSupply as `0x${string}`, value: 0n, data: approveData });
    calls.push({ to: AAVE_POOL as `0x${string}`, value: 0n, data: supplyData });

    const userOpHash = await nexusClient.sendUserOperation({ calls });

    console.log(`      -> UserOp Sent (Hash: ${userOpHash}). Waiting for bundler...`);

    const receipt = await nexusClient.waitForUserOperationReceipt({ hash: userOpHash });
    const txHash = receipt.receipt.transactionHash;

    const explorerLink = `https://sepolia.etherscan.io/tx/${txHash}`;

    console.log(`      ✅ Supplied to Aave! Hash: ${txHash}`);
    console.log(`      🔗 View on Etherscan: ${explorerLink}`);

    return { 
        "TX_HASH": txHash,
        "EXPLORER_LINK": explorerLink,
        "STATUS": "Success"
    };
};