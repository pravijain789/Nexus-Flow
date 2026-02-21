// Sepolia Testnet Token Registry
export const KNOWN_TOKENS: Record<string, { address: string, decimals: number, isNative: boolean }> = {
    "ETH":  { address: "0x0000000000000000000000000000000000000000", decimals: 18, isNative: true },
    "WETH": { address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", decimals: 18, isNative: false },
    "USDC": { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6,  isNative: false },
    "UNI":  { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, isNative: false },
    "LINK": { address: "0x779877A7B0D9E8603169DdbD7836e478b4624789", decimals: 18, isNative: false },
};