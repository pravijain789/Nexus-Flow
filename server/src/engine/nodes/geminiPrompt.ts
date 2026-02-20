import { GoogleGenerativeAI } from "@google/generative-ai";
import { resolveVariable, type ExecutionContext } from "../variableResolver.js";

type ActionInput = Record<string, any>;

export const geminiPrompt = async (inputs: ActionInput, context: ExecutionContext) => {
    const promptTemplate = inputs.prompt || "";
    const schemaTemplate = inputs.schema || "{}";

    const userPrompt = resolveVariable(promptTemplate, context);
    const schemaStr = resolveVariable(schemaTemplate, context);

    console.log(`   🧠 Executing Gemini Node...`);

    const apiKey = inputs.apiKey ? resolveVariable(inputs.apiKey, context) : process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please provide it in the node configuration.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const finalPrompt = `${userPrompt}\n\nIMPORTANT INSTRUCTIONS: You must respond with ONLY a valid JSON object. Do not include markdown formatting. The JSON must perfectly adhere to the keys and data types described in this structure:\n${schemaStr}`;

    try {

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const result = await model.generateContent(finalPrompt);
        const responseText = result.response.text();

        
        const parsedResponse = JSON.parse(responseText);

        console.log(`      -> Gemini responded with valid JSON.`);

        return {
            ...parsedResponse,
            "STATUS": "Success"
        };

    } catch (error: any) {
        throw new Error(`Gemini LLM Failed: ${error.message}`);
    }
};