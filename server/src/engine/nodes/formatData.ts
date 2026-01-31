import { resolveVariable, type ExecutionContext } from "../variableResolver.js";

type ActionInput = Record<string, any>;

export const formatDate = async (inputs: ActionInput, context: ExecutionContext) => {
    const value = resolveVariable(inputs.value, context);
    const format = inputs.format || "YYYY-MM-DD";

    let timestamp = Number(value);
    if (isNaN(timestamp)) {
        timestamp = Date.parse(String(value));
    } else if (timestamp < 10000000000) {
        timestamp *= 1000;
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) throw new Error(`Invalid Date Input: ${value}`);

    const map: Record<string, string> = {
        "YYYY": date.getFullYear().toString(),
        "MM": String(date.getMonth() + 1).padStart(2, '0'),
        "DD": String(date.getDate()).padStart(2, '0'),
        "HH": String(date.getHours()).padStart(2, '0'),
        "mm": String(date.getMinutes()).padStart(2, '0'),
        "ss": String(date.getSeconds()).padStart(2, '0'),
    };

    let result = format;
    for (const key in map) {
        result = result.replace(key, map[key]);
    }

    console.log(`      -> Formatted: ${result}`);
    return { "FORMATTED_DATE": result };
};