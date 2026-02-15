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
    
    // rss-parser standardizes content extraction. 
    // Fallback chain: full content -> description -> empty string
    const rawContent = latest.content || latest.description || "No content provided.";
    
    // Clean, plain-text version (great for Discord/Telegram limits)
    const snippet = latest.contentSnippet || rawContent.substring(0, 300) + "...";

    return {
        "RSS_TITLE": latest.title,
        "RSS_LINK": latest.link,
        "RSS_CONTENT": rawContent,
        "RSS_SNIPPET": snippet,
        "RSS_PUBDATE": latest.pubDate || new Date().toISOString(),
        "STATUS": "Success"
    };
};