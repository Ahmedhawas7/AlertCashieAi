import { Env } from '../../types';

/**
 * Free AI Provider - Connects to free-claude-code (FCC) local proxy
 * 
 * FCC acts as an OpenAI-compatible proxy with 61+ free providers:
 * - NVIDIA NIM, OpenRouter free, Groq, ClinePass, GitHub Copilot, xAI, etc.
 * - 1.3B+ free tokens/month across all providers
 * 
 * Setup: Run FCC locally (`fcc-server`) or on a remote server.
 * The proxy runs on http://localhost:3000 by default (OpenAI-compatible API).
 * 
 * Docs: https://github.com/Alishahryar1/free-claude-code
 */

export interface FreeAIResult {
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

export class FreeAIProvider {
    private baseUrl: string;
    private apiKey: string;
    private model: string;
    private timeout: number;

    constructor(env: Env) {
        // FCC proxy URL - defaults to localhost:3000, but can be a remote tunnel (ngrok, Cloudflare Tunnel, etc.)
        this.baseUrl = env.FREEAI_BASE_URL || 'http://localhost:3000/v1';
        // FCC uses "fcc" as default API key when proxy auth is disabled
        this.apiKey = env.FREEAI_API_KEY || 'fcc';
        // Default model - can be any FCC-supported model ID
        this.model = env.FREEAI_MODEL || 'nvidia_nim/nvidia/nemotron-3-super-120b-a12b';
        this.timeout = parseInt(env.AI_TIMEOUT_MS || '15000');
    }

    /**
     * Chat with the FCC proxy using OpenAI-compatible API
     */
    async chat(
        messages: Array<{ role: string; content: string }>,
        options?: {
            temperature?: number;
            maxTokens?: number;
            model?: string;
        }
    ): Promise<FreeAIResult> {
        if (!this.baseUrl) {
            return {
                text: '',
                provider: 'FreeAI',
                model: 'none',
                latencyMs: 0,
                status: 503,
                error: 'FREEAI_BASE_URL not configured. Run FCC server and set the URL.'
            };
        }

        const startTime = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const targetModel = options?.model || this.model;

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-Title': 'Hawas-Bot',
                    'HTTP-Referer': 'https://hawas-alertai.workers.dev'
                },
                body: JSON.stringify({
                    model: targetModel,
                    messages,
                    temperature: options?.temperature ?? 0.6,
                    max_tokens: options?.maxTokens ?? 1200,
                    stream: false
                }),
                signal: controller.signal
            });

            clearTimeout(timer);
            const latencyMs = Date.now() - startTime;

            if (!response.ok) {
                const errText = await response.text().catch(() => 'Unknown error');
                return {
                    text: '',
                    provider: 'FreeAI',
                    model: targetModel,
                    latencyMs,
                    status: response.status,
                    error: `FCC HTTP ${response.status}: ${errText.substring(0, 200)}`
                };
            }

            const data: any = await response.json();
            const content = data?.choices?.[0]?.message?.content || '';
            const usage = data?.usage;

            if (!content) {
                return {
                    text: '',
                    provider: 'FreeAI',
                    model: targetModel,
                    latencyMs,
                    status: 500,
                    error: 'Empty response from FCC proxy'
                };
            }

            return {
                text: content,
                provider: 'FreeAI',
                model: data?.model || targetModel,
                latencyMs,
                status: 200,
                tokensUsed: usage ? {
                    prompt: usage.prompt_tokens || 0,
                    completion: usage.completion_tokens || 0,
                    total: usage.total_tokens || 0
                } : undefined
            };

        } catch (err: any) {
            clearTimeout(timer);
            const latencyMs = Date.now() - startTime;

            const isTimeout = err.name === 'AbortError';
            const isConnectionRefused = err.message?.includes('ECONNREFUSED') || err.message?.includes('Failed to fetch');

            return {
                text: '',
                provider: 'FreeAI',
                model: targetModel,
                latencyMs,
                status: isTimeout ? 408 : 503,
                error: isConnectionRefused
                    ? 'FCC server not reachable. Is it running? Check FREEAI_BASE_URL.'
                    : err.message || 'Network error'
            };
        }
    }

    /**
     * Try multiple FCC models with fallback (useful for quota exhaustion)
     */
    async chatWithFallback(
        messages: Array<{ role: string; content: string }>,
        fallbackModels: string[],
        options?: { temperature?: number; maxTokens?: number }
    ): Promise<FreeAIResult> {
        // Try primary model first
        const primary = await this.chat(messages, options);
        if (primary.status >= 200 && primary.status < 300 && primary.text) {
            return primary;
        }

        console.warn(`FreeAI primary model failed: ${primary.error}. Trying fallbacks...`);

        // Try each fallback model
        for (const fallbackModel of fallbackModels) {
            const result = await this.chat(messages, { ...options, model: fallbackModel });
            if (result.status >= 200 && result.status < 300 && result.text) {
                return result;
            }
            console.warn(`FreeAI fallback ${fallbackModel} failed: ${result.error}`);
        }

        // Return last failed result
        return {
            text: '',
            provider: 'FreeAI',
            model: 'exhausted',
            latencyMs: 0,
            status: 503,
            error: 'All FCC models exhausted'
        };
    }

    /**
     * Health check - verify FCC proxy is running
     */
    async healthCheck(): Promise<{ alive: boolean; models?: string[]; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) {
                return { alive: false, error: `HTTP ${response.status}` };
            }

            const data: any = await response.json();
            const models = data?.data?.map((m: any) => m.id).slice(0, 10) || [];
            return { alive: true, models };

        } catch (err: any) {
            return {
                alive: false,
                error: err.message?.includes('ECONNREFUSED')
                    ? 'FCC server not running'
                    : err.message
            };
        }
    }
}
