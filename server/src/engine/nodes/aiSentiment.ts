import { GoogleGenerativeAI } from "@google/generative-ai";
import { resolveVariable, type ExecutionContext } from "../variableResolver.js";

type ActionInput = Record<string, any>;

export const aiSentiment = async (inputs: ActionInput, context: ExecutionContext) => {
    const textToAnalyze = resolveVariable(inputs.text, context);
    const targetEntity = inputs.target ? resolveVariable(inputs.target, context) : "general cryptocurrency market";

    console.log(`   🧠 Executing AI Sentiment Analysis for: ${targetEntity}...`);

    const apiKey = inputs.apiKey ? resolveVariable(inputs.apiKey, context) : process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API Key is missing. Please provide it in the node configuration.");

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `You are a cryptocurrency and financial market analyst. 
    Analyze the sentiment of the following text, specifically regarding this entity/topic: ${targetEntity}.
    
    Text:
    ${textToAnalyze}
    
    Respond ONLY with a valid JSON object in this exact format:
    { 
      "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
      "confidence": number between 0 and 100,
      "reason": "A 1-sentence explanation of why you chose this sentiment."
    }`;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(prompt);
        const parsedResponse = JSON.parse(result.response.text());

        console.log(`      -> Sentiment: ${parsedResponse.sentiment} (${parsedResponse.confidence}% confidence)`);

        return {
            "SENTIMENT": parsedResponse.sentiment,
            "CONFIDENCE": parsedResponse.confidence,
            "REASON": parsedResponse.reason,
            "STATUS": "Success"
        };
    } catch (error: any) {
        throw new Error(`AI Sentiment Failed: ${error.message}`);
    }
};