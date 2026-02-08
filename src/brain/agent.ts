import { AIService } from '../services/ai';
import { StorageService } from '../services/storage';
import { SkillLoader } from '../skills/loader';
import { Context } from 'telegraf';

interface AgentConfig {
    maxTurns?: number;
    model?: string;
}

export class Agent {
    private ai: AIService;
    private storage: StorageService;
    private skillLoader: SkillLoader;
    private config: AgentConfig;

    constructor(
        ai: AIService,
        storage: StorageService,
        skillLoader: SkillLoader,
        config: AgentConfig = { maxTurns: 3 }
    ) {
        this.ai = ai;
        this.storage = storage;
        this.skillLoader = skillLoader;
        this.config = config;
    }

    /**
     * Main reasoning loop (ReAct style)
     */
    async processMessage(ctx: Context, userId: string, message: string): Promise<string> {
        try {
            // 1. Build Context
            // TODO: Fetch profile/memory to inject into system prompt
            let systemPrompt = `You are HX Agent, a proactive assistant for Ahmed Hawas.
You are running on a Telegram Bot.
Time: ${new Date().toISOString()}
User ID: ${userId}

Available Skills:
${this.skillLoader.getSkillsDescription()}

INSTRUCTIONS:
- If the user asks for a skill, execute it.
- If the user asks a question, answer from knowledge or use a tool.
- Be concise.
- Reply in Egyptian Arabic unless asked otherwise.
- NEVER ask for secrets.
`;

            let messages: any[] = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ];

            let turn = 0;
            let finalResponse = '';

            while (turn < (this.config.maxTurns || 3)) {
                turn++;

                // Ask LLM
                // Note: This relies on AIService supporting formatted history or just raw text.
                // Since existing AIService is simple, we might need to adapt it or strictly use text prompting.
                // For now, we assume AIService can take a prompt and return text that might contain a tool call JSON.

                const response = await this.ai.generate(messages); // Need to update AIService to support this
                const toolCall = this.parseToolCall(response);

                if (toolCall) {
                    await ctx.reply(`⚡ Running ${toolCall.name}...`);
                    const result = await this.skillLoader.execute(toolCall.name, toolCall.params, ctx);

                    messages.push({ role: 'assistant', content: response });
                    messages.push({ role: 'user', content: `Tool Output: ${JSON.stringify(result)}` });

                    // If tool returns a direct response request, stop
                    if (result && result.message) {
                        finalResponse = result.message;
                    }
                } else {
                    finalResponse = response;
                    break;
                }
            }

            return finalResponse;

        } catch (error) {
            console.error('Agent error:', error);
            return 'معلش، حصلت مشكلة في التفكير. جرب تاني.';
        }
    }

    private parseToolCall(text: string): { name: string, params: any } | null {
        // Simple regex or JSON extraction for now. 
        // Better to use structured output if model supports it.
        // Format assumption: "RUN_SKILL: name {json}"
        const match = text.match(/RUN_SKILL: (\w+) ({.*})/s);
        if (match) {
            try {
                return { name: match[1], params: JSON.parse(match[2]) };
            } catch (e) {
                return null;
            }
        }
        return null;
    }
}
