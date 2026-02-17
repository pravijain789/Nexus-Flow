import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { sepolia } from "viem/chains"; // Using Sepolia to match your Aave/Transfer nodes
import { resolveVariable, type ExecutionContext } from "../variableResolver.js";
import { Sanitize } from "../utils/inputSanitizer.js";

type ActionInput = Record<string, any>;

export const walletBalance = async (inputs: ActionInput, context: ExecutionContext) => {
    // 1. Resolve inputs
    const walletAddress = Sanitize.address(resolveVariable(inputs.walletAddress, context));
    const tokenAddressRaw = inputs.tokenAddress ? resolveVariable(inputs.tokenAddress, context) : "";
    const decimals = inputs.decimals ? Number(resolveVariable(inputs.decimals, context)) : 18;

    console.log(`   👛 Executing Wallet Reader: Checking balance for ${walletAddress}...`);

    // 2. Setup Viem Client
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http()
    });

    let rawBalance: bigint;
    let tokenSymbol = "ETH";

    try {
        // 3. Check Native ETH vs ERC-20
        if (!tokenAddressRaw || tokenAddressRaw.toUpperCase() === "ETH" || tokenAddressRaw === "0x0000000000000000000000000000000000000000") {
            // Fetch Native ETH Balance
            rawBalance = await publicClient.getBalance({ 
                address: walletAddress as `0x${string}` 
            });
        } else {
            // Fetch ERC-20 Balance
            const tokenAddress = Sanitize.address(tokenAddressRaw);
            tokenSymbol = "Token"; // Could fetch actual symbol, but keeping it fast
            const erc20Abi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);
            
            rawBalance = await publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [walletAddress as `0x${string}`]
            }) as bigint;
        }

        // 4. Format to readable decimal
        const formattedBalance = formatUnits(rawBalance, decimals);

        console.log(`      -> Balance: ${formattedBalance} ${tokenSymbol}`);

        return {
            "BALANCE": formattedBalance,
            "STATUS": "Success"
        };

    } catch (error: any) {
        throw new Error(`Failed to read wallet balance: ${error.message}`);
    }
};