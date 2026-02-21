import { Env } from '../types';
import { SYSTEM_PROMPT_EGYPT } from './systemPrompt';
import { GroqProvider } from './providers/groq';
import { GeminiProvider } from './providers/gemini';
import { DeepSeekProvider } from './providers/deepseek';

export interface AiResult {
    text: string;
    provider: string;
    model: string;
    latencyMs: number;
    status: number;
    error?: string;
}

export class AiRouter {
    private env: Env;
    private groq: GroqProvider;
    private gemini: GeminiProvider;
    private deepseek: DeepSeekProvider;

    constructor(env: Env) {
        this.env = env;
        this.groq = new GroqProvider(env);
        this.gemini = new GeminiProvider(env);
        this.deepseek = new DeepSeekProvider(env);
    }

    /**
     * Generate a reply using multi-provider smart routing (Groq -> DeepSeek -> Gemini)
     */
    async generateReply(
        userId: string,
        text: string,
        context: string = "",
        systemPrompt: string = SYSTEM_PROMPT_EGYPT
    ): Promise<AiResult> {
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context ? `CONTEXT:\n${context}\n\nUSER: ${text}` : text }
        ];

        // 1. Try Groq (Primary - Fast & High Intelligence Tier)
        const groqRes = await this.groq.chat(messages);
        if (this.isSuccess(groqRes)) return groqRes;

        console.warn(`Groq failed (${groqRes.status}: ${groqRes.error}). Trying DeepSeek...`);

        // 2. Try DeepSeek (Secondary - Reasoning Heavy)
        const dsRes = await this.deepseek.chat(messages);
        if (this.isSuccess(dsRes)) return dsRes;

        console.warn(`DeepSeek failed (${dsRes.status}: ${dsRes.error}). Trying Gemini Fallback...`);

        // 3. Try Gemini (Tertiary - Reliable Google Tier)
        const geminiRes = await this.gemini.chat(messages);

        return geminiRes;
    }

    private isSuccess(result: any): boolean {
        return result.status === 200 && !!result.text;
    }
}
