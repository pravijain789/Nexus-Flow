import { isAddress, getAddress } from "viem";

export const Sanitize = {
    address: (input: any): `0x${string}` => {
        if (!input) throw new Error("Address input is empty");
        const clean = String(input).trim();
        if (!isAddress(clean)) throw new Error(`Invalid Ethereum Address: ${clean}`);
        return getAddress(clean); 
    },

    number: (input: any): number => {
        if (typeof input === "number") return input;
        const clean = String(input).replace(/,/g, "").trim();
        const num = parseFloat(clean);
        if (isNaN(num)) throw new Error(`Invalid Number: ${input}`);
        return num;
    },

    array: (input: any): any[] => {
        if (Array.isArray(input)) return input;
        if (!input) return [];
        return [input];
    },

    equals: (a: string, b: string): boolean => {
        return String(a).toLowerCase().trim() === String(b).toLowerCase().trim();
    }
};