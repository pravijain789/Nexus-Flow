import { GoogleGenerativeAI } from "@google/generative-ai";
import { resolveVariable, type ExecutionContext } from "../variableResolver.js";

type ActionInput = Record<string, any>;

export const aiSummarizer = async (inputs: ActionInput, context: ExecutionContext) => {
    const textToSummarize = resolveVariable(inputs.text, context);
    const style = inputs.style ? resolveVariable(inputs.style, context) : "bullet points";
    const length = inputs.length ? resolveVariable(inputs.length, context) : "short";

    const apiKey = inputs.apiKey ? resolveVariable(inputs.apiKey, context) : process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API Key is missing. Please provide it in the node configuration.");

    console.log(`   🧠 Executing AI Summarizer...`);

    const genAI = new GoogleGenerativeAI(apiKey);

    // Hardcode the strict prompt and JSON schema
    const prompt = `You are an expert summarizer. Summarize the following text.
    Length constraint: ${length}.
    Formatting style: ${style}.
    
    Text to summarize:
    ${textToSummarize}
    
    Respond ONLY with a valid JSON object in this exact format:
    { 
      "summary": "A SINGLE STRING containing the entire summary. If the style is bullet points, use text formatting like '\\n- point 1\\n- point 2' inside this single string. NEVER output an array." 
    }`;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(prompt);
        const parsedResponse = JSON.parse(result.response.text());

        console.log(`      -> Summary generated successfully.`);

        return {
            "SUMMARY": parsedResponse.summary,
            "STATUS": "Success"
        };
    } catch (error: any) {
        throw new Error(`AI Summarizer Failed: ${error.message}`);
    }
};