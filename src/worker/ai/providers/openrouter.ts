import { Env } from '../../types';

export const OPENROUTER_FREE_MODELS = [
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3.5-super-vl:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'baidu/ernie-5.5-flash-preview:free',
    'thinkingmachines/inkling-2-small:free',
    'dots-studio/dots-3-note-preview:free',
    'particle-ai/particle-1:free',
    'liquid/lfm-3-1.7b:free',
    'inclusionai/ling-3.2-flash:free'
];

export class OpenRouterProvider {
    private apiKey: string;
    private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    private envModel?: string;

    constructor(env: Env) {
        this.apiKey = env.OPENROUTER_API_KEY || '';
        this.envModel = env.OPENROUTER_MODEL;
    }

    async chat(messages: any[], options?: any): Promise<any> {
        if (!this.apiKey) return { status: 401, error: 'Missing OPENROUTER_API_KEY', text: '' };

        // Determine list of candidate models to try
        const candidates: string[] = [];
        if (options?.model) {
            candidates.push(options.model);
        } else if (this.envModel) {
            candidates.push(this.envModel);
        }

        // Add default free models avoiding duplicates
        for (const m of OPENROUTER_FREE_MODELS) {
            if (!candidates.includes(m)) candidates.push(m);
        }

        let lastError = '';
        let lastStatus = 500;

        for (const model of candidates) {
            const start = Date.now();
            try {
                const body = {
                    model,
                    messages,
                    max_tokens: options?.maxTokens || 1000,
                    temperature: options?.temperature || 0.7
                };

                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'HTTP-Referer': 'https://hawas-agent.com',
                        'X-Title': 'Hawas Agent',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                const data: any = await response.json();
                const latencyMs = Date.now() - start;

                if (!response.ok) {
                    const errMsg = data.error?.message || `HTTP ${response.status}`;
                    lastError = `[${model}] ${errMsg}`;
                    lastStatus = response.status;
                    console.warn(`OpenRouter model ${model} failed: ${errMsg}. Trying next candidate...`);
                    continue; // Try next model in candidate list
                }

                const content = data.choices?.[0]?.message?.content || '';
                if (!content) {
                    lastError = `[${model}] Empty response content`;
                    continue;
                }

                return {
                    text: content,
                    provider: 'OpenRouter',
                    model: data.model || model,
                    status: 200,
                    latencyMs
                };

            } catch (e: any) {
                lastError = `[${model}] ${e.message}`;
                console.warn(`OpenRouter model ${model} fetch exception: ${e.message}`);
            }
        }

        return {
            text: '',
            provider: 'OpenRouter',
            model: candidates.join(', '),
            status: lastStatus,
            latencyMs: 0,
            error: lastError || 'All OpenRouter models failed'
        };
    }
}
