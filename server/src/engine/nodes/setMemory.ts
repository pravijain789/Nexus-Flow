import { resolveVariable, type ExecutionContext } from "../variableResolver.js";
import { redisConnection } from "../../config/redis.js";

type ActionInput = Record<string, any>;

export const setMemory = async(inputs: ActionInput, context: ExecutionContext) => {
    const key = resolveVariable(inputs.key, context);
    const value = resolveVariable(inputs.value, context); 
    
    const workflowId = context.SYSTEM_WORKFLOW_ID || "global_agent";
    const redisKey = `agent_memory:${workflowId}:${key}`;

    console.log(`   🧠 Agent Memory: Saving [${key}] = ${value}`);

    try {
        const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        await redisConnection.set(redisKey, valueToStore);

        return {
            "SAVED_KEY": key,
            "SAVED_VALUE": value,
            "STATUS": "Success"
        };
    } catch (error: any) {
        throw new Error(`Failed to save memory: ${error.message}`);
    }
}