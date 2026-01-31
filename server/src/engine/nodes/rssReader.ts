import Parser from "rss-parser"; 
import { resolveVariable, type ExecutionContext } from "../variableResolver.js";

type ActionInput = Record<string, any>;

export const readRSS = async (inputs: ActionInput, context: ExecutionContext) => {
    const url = resolveVariable(inputs.url, context);
    console.log(`   📰 Executing RSS Reader: Fetching ${url}...`);

    const parser = new Parser();
    const feed = await parser.parseURL(url);
    
    const latest = feed.items[0];

    if (!latest) {
        throw new Error("RSS Feed is empty.");
    }

    console.log(`      -> Latest Post: "${latest.title}"`);
    
    return {
        "RSS_LATEST_TITLE": latest.title,
        "RSS_LATEST_LINK": latest.link
    };
};