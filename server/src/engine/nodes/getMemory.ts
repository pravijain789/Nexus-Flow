import { resolveVariable, type ExecutionContext } from "../variableResolver.js";
import { redisConnection } from "../../config/redis.js"; 

type ActionInput = Record<string, any>;

export const getMemory = async (inputs: ActionInput, context: ExecutionContext) => {
    const key = resolveVariable(inputs.key, context);
    const defaultValue = inputs.defaultValue ? resolveVariable(inputs.defaultValue, context) : null;
    
    const workflowId = context.SYSTEM_WORKFLOW_ID || "global_agent";
    const redisKey = `agent_memory:${workflowId}:${key}`;

    console.log(`   🧠 Agent Memory: Recalling [${key}]...`);

    try {
        const storedValue = await redisConnection.get(redisKey);
        
        let finalValue = storedValue !== null ? storedValue : defaultValue;

        if (typeof finalValue === 'string') {
            try {
                finalValue = JSON.parse(finalValue);
            } catch (e) {
                console.log(`      -> Failed to parse JSON: ${e}`);
            }
        }

        console.log(`      -> Recalled: ${finalValue}`);

        return {
            "VALUE": finalValue,
            "STATUS": "Success"
        };
    } catch (error: any) {
        throw new Error(`Failed to retrieve memory: ${error.message}`);
    }
};