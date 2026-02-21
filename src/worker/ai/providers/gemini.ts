import { Env } from '../../types';

export interface GeminiResult {
    text: string;
    provider: string;
    model: string;
    latencyMs: number;
    status: number;
    error?: string;
}

export class GeminiProvider {
    private env: Env;
    private apiKey: string;

    constructor(env: Env) {
        this.env = env;
        this.apiKey = env.GEMINI_API_KEY || '';
    }

    async chat(
        messages: Array<{ role: string; content: string }>,
        options?: {
            temperature?: number;
            maxTokens?: number;
        }
    ): Promise<GeminiResult> {
        if (!this.apiKey) {
            return {
                text: '',
                provider: 'Gemini',
                model: 'none',
                latencyMs: 0,
                status: 401,
                error: 'GEMINI_API_KEY missing'
            };
        }

        const start = Date.now();
        const model = this.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const timeout = parseInt(this.env.AI_TIMEOUT_MS || '15000');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            // Convert messages to Gemini format
            const contents = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: options?.temperature ?? 0.7,
                        maxOutputTokens: options?.maxTokens ?? 1000,
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timer);
            const latency = Date.now() - start;

            if (!response.ok) {
                const err = await response.text();
                return { text: '', provider: 'Gemini', model, latencyMs: latency, status: response.status, error: err.substring(0, 200) };
            }

            const data: any = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            return { text, provider: 'Gemini', model, latencyMs: latency, status: 200 };

        } catch (e: any) {
            clearTimeout(timer);
            return {
                text: '',
                provider: 'Gemini',
                model,
                latencyMs: Date.now() - start,
                status: e.name === 'AbortError' ? 408 : 500,
                error: e.message
            };
        }
    }
}
