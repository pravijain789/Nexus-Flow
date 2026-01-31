import { resolveVariable, type ExecutionContext } from "../variableResolver.js";

type ActionInput = Record<string, any>;

export const httpReq = async (inputs: ActionInput, context: ExecutionContext) => {
    const url = resolveVariable(inputs.url, context);
    const method = inputs.method || "GET";
    let body = inputs.body;
    
    if (typeof body === "string" && body.startsWith("{")) {
        try { body = JSON.parse(resolveVariable(body, context)); } catch (e) { }
    }

    let headers = inputs.headers || {};
    if (typeof headers === "string" && headers.startsWith("{")) {
        try { headers = JSON.parse(resolveVariable(headers, context)); } catch (e) { }
    }

    console.log(`   🌐 HTTP ${method}: ${url}`);

    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body ? JSON.stringify(body) : null
    });

    const data = await response.json();
    return { "HTTP_RESPONSE": data };
};