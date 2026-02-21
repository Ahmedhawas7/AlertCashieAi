import { Env } from '../../types';

export interface DeepSeekResult {
    text: string;
    provider: string;
    model: string;
    latencyMs: number;
    status: number;
    error?: string;
}

export class DeepSeekProvider {
    private env: Env;
    private apiKey: string;
    private baseUrl: string;

    constructor(env: Env) {
        this.env = env;
        this.apiKey = env.DEEPSEEK_API_KEY || '';
        this.baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    }

    async chat(
        messages: Array<{ role: string; content: string }>,
        options?: {
            temperature?: number;
            maxTokens?: number;
        }
    ): Promise<DeepSeekResult> {
        if (!this.apiKey) {
            return {
                text: '',
                provider: 'DeepSeek',
                model: 'none',
                latencyMs: 0,
                status: 401,
                error: 'DEEPSEEK_API_KEY missing'
            };
        }

        const start = Date.now();
        const model = this.env.DEEPSEEK_MODEL || 'deepseek-chat';
        const timeout = parseInt(this.env.AI_TIMEOUT_MS || '20000');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens ?? 1000
                }),
                signal: controller.signal
            });

            clearTimeout(timer);
            const latency = Date.now() - start;

            if (!response.ok) {
                const err = await response.text();
                return { text: '', provider: 'DeepSeek', model, latencyMs: latency, status: response.status, error: err.substring(0, 200) };
            }

            const data: any = await response.json();
            const text = data?.choices?.[0]?.message?.content || '';

            return { text, provider: 'DeepSeek', model, latencyMs: latency, status: 200 };

        } catch (e: any) {
            clearTimeout(timer);
            return {
                text: '',
                provider: 'DeepSeek',
                model,
                latencyMs: Date.now() - start,
                status: e.name === 'AbortError' ? 408 : 500,
                error: e.message
            };
        }
    }
}
