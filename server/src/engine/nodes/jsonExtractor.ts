import { resolveVariable, type ExecutionContext } from "../variableResolver.js";

type ActionInput = Record<string, any>;

export const extractJson = async (inputs: ActionInput, context: ExecutionContext) => {
    const data = resolveVariable(inputs.data, context);
    const path = inputs.path;
    
    console.log(`   ⛏️ Extracting path "${path}" from data...`);

    const result = path.split('.').reduce((obj: any, key: string) => {
        return obj && obj[key] !== 'undefined' ? obj[key] : undefined;
    }, data);

    if (result === undefined) throw new Error(`Path ${path} not found in JSON`);

    const outputName = inputs.outputVar || "EXTRACTED_VALUE"; 
    return { [outputName]: result };
};