import { Env } from '../types';
import { RESPONDER_SYSTEM_PROMPT_EGYPT } from './systemPrompt';
import { GroqProvider } from './providers/groq';
import { OpenRouterProvider } from './providers/openrouter';
import { FreeAIProvider } from './providers/freeai';
import { GeminiProvider } from './providers/gemini';

export interface AiResult {
    text: string;
    provider: string;
    model: string;
    latencyMs: number;
    status: number;
    error?: string;
}

/**
 * Multi-provider AI Router with smart failover
 * 
 * Priority order:
 *   1. FreeAI (FCC proxy) — if configured
 *   2. Groq — Free tier with 3-tier internal fallback (if key set)
 *   3. Gemini — 100% Free Google AI Studio (if key set)
 *   4. OpenRouter — Multi-model active free models failover
 *   5. Offline — Structured error for caller to handle
 */
export class AiRouter {
    private env: Env;
    private freeai: FreeAIProvider;
    private groq: GroqProvider;
    private gemini: GeminiProvider;
    private openrouter: OpenRouterProvider;

    constructor(env: Env) {
        this.env = env;
        this.freeai = new FreeAIProvider(env);
        this.groq = new GroqProvider(env);
        this.gemini = new GeminiProvider(env);
        this.openrouter = new OpenRouterProvider(env);
    }

    /**
     * Generate a reply using multi-provider smart routing
     */
    async generateReply(
        userId: string,
        text: string,
        context: string = "",
        systemPrompt: string = RESPONDER_SYSTEM_PROMPT_EGYPT
    ): Promise<AiResult> {
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context ? `CONTEXT:\n${context}\n\nUSER: ${text}` : text }
        ];

        return this.chat(messages);
    }

    /**
     * Pass raw messages array for agentic reasoning (with full failover)
     */
    async chat(messages: any[], options?: any): Promise<AiResult> {
        // 1. Try Gemini (Primary — Google AI Studio fast & reliable)
        let geminiError: string | undefined;
        if (this.env.GEMINI_API_KEY) {
            const geminiRes = await this.gemini.chat(messages, options);
            if (this.isSuccess(geminiRes)) return geminiRes;
            geminiError = geminiRes.error;
            console.warn(`Gemini failed (${geminiRes.status}: ${geminiRes.error}). Trying next...`);
        }

        // 2. Try Groq (if GROQ_API_KEY is present)
        let groqError: string | undefined;
        if (this.env.GROQ_API_KEY) {
            const groqRes = await this.groq.chat(messages, options);
            if (this.isSuccess(groqRes)) return groqRes;
            groqError = groqRes.error;
            console.warn(`Groq failed (${groqRes.status}: ${groqRes.error}). Trying next...`);
        }

        // 3. Try FreeAI / FCC proxy (if configured)
        if (this.env.FREEAI_BASE_URL) {
            const freeRes = await this.freeai.chat(messages, options);
            if (this.isSuccess(freeRes)) return freeRes;
            console.warn(`FreeAI failed (${freeRes.status}: ${freeRes.error}). Trying next...`);
        }

        // 4. Try OpenRouter (Multi-model free failover)
        const orRes = await this.openrouter.chat(messages, options);
        if (this.isSuccess(orRes)) return orRes;

        console.warn(`OpenRouter failed (${orRes.status}: ${orRes.error}). All providers exhausted.`);

        // 5. Offline fallback — structured error for caller to handle
        const errors: string[] = [];
        if (this.env.FREEAI_BASE_URL) errors.push('FreeAI: check FCC server');
        if (this.env.GROQ_API_KEY) errors.push(`Groq: ${groqError}`);
        if (this.env.GEMINI_API_KEY) errors.push(`Gemini: ${geminiError}`);
        errors.push(`OpenRouter: ${orRes.error}`);

        return {
            text: '',
            provider: 'Offline',
            model: 'none',
            status: 503,
            latencyMs: 0,
            error: errors.join(' | ')
        };
    }

    /**
     * Run FCC proxy health check — useful for /status admin commands
     */
    async checkFreeAIHealth(): Promise<{ alive: boolean; models?: string[]; error?: string }> {
        return this.freeai.healthCheck();
    }

    private isSuccess(result: any): boolean {
        return result.status >= 200 && result.status < 300 && !!result.text;
    }
}
