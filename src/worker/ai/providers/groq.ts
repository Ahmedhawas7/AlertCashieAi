import { Env } from '../../types';

/**
 * Groq Provider with 3-Tier Fallback System
 * 
 * Tier 1: openai/gpt-oss-120b (Maximum Intelligence)
 * Tier 2: llama-3.3-70b-versatile (Reliable Backup)
 * Tier 3: llama-3.1-8b-instant (Emergency Fast Mode)
 */

export interface GroqResult {
    text: string;
    provider: string;
    model: string;
    latencyMs: number;
    status: number;
    error?: string;
    tokensUsed?: {
        prompt: number;
        completion: number;
        total: number;
    };
}

export class GroqProvider {
    private env: Env;
    private baseUrl: string;
    private apiKey: string;

    constructor(env: Env) {
        this.env = env;
        this.baseUrl = env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
        this.apiKey = env.GROQ_API_KEY || '';
    }

    /**
     * Call Groq with automatic 3-tier fallback
     */
    async chat(
        messages: Array<{ role: string; content: string }>,
        options?: {
            temperature?: number;
            maxTokens?: number;
            topP?: number;
        }
    ): Promise<GroqResult> {
        if (!this.apiKey) {
            return {
                text: '',
                provider: 'Groq',
                model: 'none',
                latencyMs: 0,
                status: 401,
                error: 'GROQ_API_KEY missing'
            };
        }

        const timeout = parseInt(this.env.AI_TIMEOUT_MS || '12000');

        // Tier 1: Primary (Maximum Intelligence)
        const primaryModel = this.env.GROQ_MODEL_PRIMARY || 'openai/gpt-oss-120b';
        const tier1 = await this.callModel(primaryModel, messages, options, timeout);
        if (this.isSuccess(tier1)) return tier1;

        console.warn(`Groq Primary (${primaryModel}) failed: ${tier1.error}. Trying fallback...`);

        // Tier 2: Fallback (Reliable)
        const fallbackModel = this.env.GROQ_MODEL_FALLBACK || 'llama-3.3-70b-versatile';
        const tier2 = await this.callModel(fallbackModel, messages, options, timeout);
        if (this.isSuccess(tier2)) return tier2;

        console.warn(`Groq Fallback (${fallbackModel}) failed: ${tier2.error}. Trying emergency...`);

        // Tier 3: Emergency (Fast)
        const emergencyModel = this.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant';
        const tier3 = await this.callModel(
            emergencyModel,
            messages,
            { ...options, maxTokens: Math.min(options?.maxTokens || 500, 500) }, // Limit tokens for fast model
            timeout
        );

        return tier3; // Return even if failed (caller will handle)
    }

    /**
     * Call a specific Groq model
     */
    private async callModel(
        model: string,
        messages: Array<{ role: string; content: string }>,
        options?: {
            temperature?: number;
            maxTokens?: number;
            topP?: number;
        },
        timeout: number = 12000
    ): Promise<GroqResult> {
        const startTime = Date.now();
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
                    temperature: options?.temperature ?? parseFloat(this.env.AI_TEMPERATURE || '0.55'),
                    max_tokens: options?.maxTokens ?? parseInt(this.env.AI_MAX_TOKENS || '900'),
                    top_p: options?.topP ?? parseFloat(this.env.AI_TOP_P || '0.9')
                }),
                signal: controller.signal
            });

            clearTimeout(timer);
            const latency = Date.now() - startTime;

            if (!response.ok) {
                const errBody = await response.text().catch(() => 'Unknown error');
                return {
                    text: '',
                    provider: 'Groq',
                    model,
                    latencyMs: latency,
                    status: response.status,
                    error: errBody.substring(0, 200)
                };
            }

            const data: any = await response.json();
            const content = data?.choices?.[0]?.message?.content || '';
            const usage = data?.usage;

            return {
                text: content,
                provider: 'Groq',
                model,
                latencyMs: latency,
                status: 200,
                tokensUsed: usage ? {
                    prompt: usage.prompt_tokens || 0,
                    completion: usage.completion_tokens || 0,
                    total: usage.total_tokens || 0
                } : undefined
            };

        } catch (err: any) {
            clearTimeout(timer);
            const latency = Date.now() - startTime;
            return {
                text: '',
                provider: 'Groq',
                model,
                latencyMs: latency,
                status: err.name === 'AbortError' ? 408 : 500,
                error: err.message || 'Network error'
            };
        }
    }

    /**
     * Check if result is successful
     */
    private isSuccess(result: GroqResult): boolean {
        return result.status >= 200 && result.status < 300 && !!result.text;
    }

    /**
     * Test all tiers (for diagnostics)
     */
    async testAllTiers(): Promise<{
        primary: GroqResult;
        fallback: GroqResult;
        emergency: GroqResult;
    }> {
        const testMessages = [{ role: 'user', content: 'Say OK' }];
        const timeout = 5000; // Shorter timeout for tests

        const primary = await this.callModel(
            this.env.GROQ_MODEL_PRIMARY || 'openai/gpt-oss-120b',
            testMessages,
            { maxTokens: 10 },
            timeout
        );

        const fallback = await this.callModel(
            this.env.GROQ_MODEL_FALLBACK || 'llama-3.3-70b-versatile',
            testMessages,
            { maxTokens: 10 },
            timeout
        );

        const emergency = await this.callModel(
            this.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant',
            testMessages,
            { maxTokens: 10 },
            timeout
        );

        return { primary, fallback, emergency };
    }
}
