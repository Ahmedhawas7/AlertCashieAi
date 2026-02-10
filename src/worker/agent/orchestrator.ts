import { AGENT_TOOLS } from './tools';
import { Env, AgentMessage, AgentMemoryItem } from '../types';

/**
 * Super Agent Orchestrator driven by Gemini
 * Handles reasoning, tool use, and bilingual Egyptian persona.
 */
export class GeminiOrchestrator {
    private env: Env;
    private apiKey: string;

    constructor(env: Env) {
        this.env = env;
        this.apiKey = env.GEMINI_API_KEY || '';
    }

    private getSystemPrompt(senderName: string): string {
        return `
You are "Hawas" (حواس), a Super Intelligent Egyptian AI Agent.
Persona: Super friendly, extremely smart, street-smart (جدع), and uses Egyptian dialect (Ammiya) combined with perfect English.

Capabilities:
1. Reasoning: Analyze user requests deeply.
2. Tool Use: You can search memory, prepare crypto transfers on Base, and search the web.
3. Bilingual: Respond in Egyptian Arabic by default, but shift to English if the user speaks English or if it's more appropriate for technical topics.

Identity:
- You are a brother to the user (أخوك حواس).
- You are strictly owned by ${this.env.OWNER_TELEGRAM_ID}.

Rules:
- Be concise but powerful.
- Always value the user's trust.
- If a user asks to send money, use the 'prepare_transfer' tool and then ask for confirmation.
- Use 'get_user_memories' to remember historical facts.
`.trim();
    }

    async think(
        userInput: string,
        senderName: string,
        context: AgentMessage[],
        memories: AgentMemoryItem[],
        systemPrompt?: string
    ): Promise<{ text: string, toolCalls?: any[] }> {
        if (!this.apiKey) {
            return { text: "معلش يا غالي، الذكاء الاصطناعي (Gemini) مش متفعل حالياً. كلمني عادي وهحاول أساعدك بذاكرتي المحلية." };
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;

        // Construct visual/context memory for Gemini
        const memoryContext = memories.map(m => `Fact: ${m.key} = ${m.value}`).join('\n');

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [{ text: `User Name: ${senderName}\nStored Memory:\n${memoryContext}\n\nLast Messages:\n${context.map(c => `${c.role}: ${c.text}`).join('\n')}\n\nUser Input: ${userInput}` }]
                }
            ],
            system_instruction: {
                parts: [{ text: systemPrompt || this.getSystemPrompt(senderName) }]
            },
            tools: [{ function_declarations: AGENT_TOOLS }]
        };

        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result: any = await resp.json();
            const candidate = result.candidates?.[0];
            const content = candidate?.content;

            let text = "";
            let toolCalls: any[] = [];

            if (content?.parts) {
                for (const part of content.parts) {
                    if (part.text) text += part.text;
                    if (part.functionCall) toolCalls.push(part.functionCall);
                }
            }

            return { text: text || "حاضر يا ريس، براجع كلامك..", toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
        } catch (err) {
            console.error('Gemini API Error:', err);
            return { text: "حصلت مشكلة وأنا بفكر.. جرب تاني كمان شوية يا بطل." };
        }
    }
}
