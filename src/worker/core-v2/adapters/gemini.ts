import { IAIProvider, ProcessingContext, BrainResponse, Intent, Env } from '../types';
import { getSystemPrompt } from '../systemPrompt';

export class GeminiAIAdapter implements IAIProvider {
    private apiKey: string;
    private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

    constructor(env: Env) {
        this.apiKey = env.GEMINI_API_KEY;
    }

    isEnabled(): boolean {
        return !!this.apiKey;
    }

    async generateResponse(ctx: ProcessingContext, prompt: string, intent: Intent): Promise<BrainResponse> {
        if (!this.isEnabled()) {
            return { type: 'text', text: 'AI is not configured.' };
        }

        try {
            // ... inside generateResponse ...
            const systemPrompt = getSystemPrompt({ userId: ctx.userId });
            const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;

            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500,
                    }
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Gemini API Error: ${err}`);
            }

            const data: any = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

            return {
                type: 'text',
                text: text
            };

        } catch (error: any) {
            console.error('AI Error:', error);
            return {
                type: 'text',
                text: 'Sorry, I encountered an error while thinking. 🤯'
            };
        }
    }
}
