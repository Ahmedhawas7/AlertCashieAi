import { Env } from '../types';
import { SYSTEM_PROMPT_EGYPT } from './systemPrompt';

export interface AiResult {
    text: string;
    provider: string;
    latencyMs: number;
    status: number;
    error?: string;
}

export class AiRouter {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * Generate a reply using multi-provider logic (Groq -> OpenRouter)
     */
    async generateReply(
        userId: string,
        text: string,
        context: string = ""
    ): Promise<AiResult> {
        const startTime = Date.now();
        const timeoutMs = parseInt(this.env.AI_TIMEOUT_MS || "12000");

        // 1. Try Groq Primary
        const groqResult = await this.callGroq(text, context, timeoutMs);
        if (this.isSuccess(groqResult)) return groqResult;

        console.warn(`Groq failed (${groqResult.status}). Trying OpenRouter fallback...`);

        // 2. Try OpenRouter Fallback
        const orResult = await this.callOpenRouter(text, context, timeoutMs);

        return orResult;
    }

    private isSuccess(result: AiResult): boolean {
        return result.status >= 200 && result.status < 300 && !!result.text;
    }

    private async callGroq(text: string, context: string, timeout: number): Promise<AiResult> {
        const apiKey = this.env.GROQ_API_KEY;
        const baseUrl = this.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
        const model = this.env.GROQ_MODEL || "llama-3.3-70b-versatile";
        const start = Date.now();

        if (!apiKey) return { text: "", provider: "Groq", latencyMs: 0, status: 401, error: "Missing API Key" };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT_EGYPT },
                        { role: "user", content: context ? `CONTEXT:\n${context}\n\nUSER: ${text}` : text }
                    ],
                    max_tokens: parseInt(this.env.AI_MAX_TOKENS || "700")
                }),
                signal: controller.signal
            });

            clearTimeout(timer);
            const latency = Date.now() - start;

            if (!response.ok) {
                const errBody = await response.text().catch(() => "Unknown error");
                return { text: "", provider: "Groq", latencyMs: latency, status: response.status, error: errBody.substring(0, 100) };
            }

            const data: any = await response.json();
            const content = data?.choices?.[0]?.message?.content || "";

            return { text: content, provider: "Groq", latencyMs: latency, status: 200 };

        } catch (err: any) {
            clearTimeout(timer);
            return {
                text: "",
                provider: "Groq",
                latencyMs: Date.now() - start,
                status: err.name === 'AbortError' ? 408 : 500,
                error: err.message
            };
        }
    }

    private async callOpenRouter(text: string, context: string, timeout: number): Promise<AiResult> {
        const apiKey = this.env.OPENROUTER_API_KEY;
        const baseUrl = this.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
        const model = this.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free";
        const start = Date.now();

        if (!apiKey) return { text: "", provider: "OpenRouter", latencyMs: 0, status: 401, error: "Missing API Key" };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/Ahmedhawas7/AlertCashieAi',
                    'X-Title': 'Hawas Sovereign Agent'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT_EGYPT },
                        { role: "user", content: context ? `CONTEXT:\n${context}\n\nUSER: ${text}` : text }
                    ],
                    max_tokens: parseInt(this.env.AI_MAX_TOKENS || "700")
                }),
                signal: controller.signal
            });

            clearTimeout(timer);
            const latency = Date.now() - start;

            if (!response.ok) {
                const errBody = await response.text().catch(() => "Unknown error");
                return { text: "", provider: "OpenRouter", latencyMs: latency, status: response.status, error: errBody.substring(0, 100) };
            }

            const data: any = await response.json();
            const content = data?.choices?.[0]?.message?.content || "";

            return { text: content, provider: "OpenRouter", latencyMs: latency, status: 200 };

        } catch (err: any) {
            clearTimeout(timer);
            return {
                text: "",
                provider: "OpenRouter",
                latencyMs: Date.now() - start,
                status: err.name === 'AbortError' ? 408 : 500,
                error: err.message
            };
        }
    }
}
