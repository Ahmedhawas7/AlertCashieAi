import { Env } from '../types';

/**
 * DeepSeek Chat Client
 * OpenAI-compatible interface for calling DeepSeek API.
 */
export interface DeepSeekResult {
    content: string;
    status: number;
    latency: number;
    error?: string;
}

/**
 * DeepSeek Chat Client
 * OpenAI-compatible interface for calling DeepSeek API.
 */
export async function deepseekChat(
    env: Env,
    userText: string,
    context: string = ""
): Promise<DeepSeekResult> {
    const apiKey = env.DEEPSEEK_API_KEY;
    const baseUrl = env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
    const maxTokens = parseInt(env.AI_MAX_TOKENS || "700");

    if (!apiKey) {
        return { content: "", status: 0, latency: 0, error: "DEEPSEEK_API_KEY_MISSING" };
    }

    const fullUserTask = context
        ? `CONTEXT:\n${context}\n\nUSER REQUEST: ${userText}`
        : userText;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const startTime = Date.now();

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: HAWAS_SYSTEM_PROMPT },
                    { role: "user", content: fullUserTask }
                ],
                temperature: 0.7,
                max_tokens: maxTokens
            }),
            signal: controller.signal
        });

        const latency = Date.now() - startTime;
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = (await response.text()).substring(0, 200);
            return { content: "", status: response.status, latency, error: errText };
        }

        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content || "";

        return { content, status: response.status, latency };

    } catch (err: any) {
        const latency = Date.now() - startTime;
        clearTimeout(timeoutId);
        return {
            content: "",
            status: err.name === 'AbortError' ? 408 : 500,
            latency,
            error: err.message || "Unknown Network Error"
        };
    }
}
