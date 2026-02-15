import * as cheerio from "cheerio";
import { resolveVariable, type ExecutionContext } from "../variableResolver.js";

type ActionInput = Record<string, any>;

export const httpScraper = async (inputs: ActionInput, context: ExecutionContext) => {
    const url = resolveVariable(inputs.url, context);
    
    // Optional: Allow the user to target a specific CSS class (e.g., ".article-content")
    const selector = inputs.selector ? resolveVariable(inputs.selector, context) : "body";

    console.log(`   🕸️ Executing Scraper: Fetching ${url}...`);

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 1. Remove the junk (ads, scripts, menus, footers)
        $('script, style, noscript, nav, footer, header, aside, iframe, svg').remove();

        // 2. Extract Title
        const title = $('title').text().trim() || "No Title Found";

        // 3. Extract the targeted text
        let scrapedText = $(selector).text();

        // 4. Clean up the whitespace (replace multiple spaces/newlines with a single space)
        scrapedText = scrapedText.replace(/\s+/g, ' ').trim();

        // Safety limit: Don't return 100MB of text if something goes wrong. Cap at ~15,000 chars.
        if (scrapedText.length > 15000) {
            scrapedText = scrapedText.substring(0, 15000) + "... [Truncated]";
        }

        console.log(`      -> Scraped "${title}" (${scrapedText.length} chars)`);

        return {
            "SCRAPED_TITLE": title,
            "SCRAPED_CONTENT": scrapedText,
            "STATUS": "Success"
        };

    } catch (error: any) {
        throw new Error(`Scraping failed: ${error.message}`);
    }
};