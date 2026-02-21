import { IAIProvider, ProcessingContext, BrainResponse, Intent, Env } from '../types';
import { getSystemPrompt } from '../systemPrompt';

export class GroqAIAdapter implements IAIProvider {
    private apiKey: string;
    private baseUrl: string = 'https://api.groq.com/openai/v1/chat/completions';
    private model: string = 'llama3-70b-8192'; // Upgraded to 70b for better intelligence

    constructor(env: Env) {
        this.apiKey = env.GROQ_API_KEY;
    }

    isEnabled(): boolean {
        return !!this.apiKey;
    }

    async generateResponse(ctx: ProcessingContext, prompt: string, intent: Intent): Promise<BrainResponse> {
        if (!this.isEnabled()) {
            console.error('Groq Adapter: API Key missing');
            return { type: 'text', text: 'AI is disabled (Missing Groq Key).' };
        }

        try {
            // ... inside generateResponse ...
            const systemPrompt = getSystemPrompt({ userId: ctx.userId });

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 800 // Increased for smarter responses
                })
            });

            if (!response.ok) {
                const err = await response.text();
                console.error(`Groq API Error (${response.status}): ${err}`);
                throw new Error(`Groq API Error: ${err}`);
            }

            const data: any = await response.json();
            const text = data.choices?.[0]?.message?.content || 'No response generated.';

            return {
                type: 'text',
                text: text
            };

        } catch (error: any) {
            console.error('Groq Adapter Exception:', error);
            return {
                type: 'text',
                text: 'Sorry, my brain froze. 🧊 (Groq Error)'
            };
        }
    }
}
