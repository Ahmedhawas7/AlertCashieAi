import { Env, TelegramUpdate, ProcessingContext, IAIProvider } from './core-v2/types';
import { UnifiedBrain } from './core-v2/brain';
import { GeminiAIAdapter } from './core-v2/adapters/gemini';
import { D1StorageAdapter } from './core-v2/adapters/storage';
import { Logger } from './core-v2/logger';
import { D1RateLimiter, RateLimitConfigs } from './core-v2/ratelimit';
import { D1CSRFProtection } from './core-v2/csrf';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const logger = new Logger();
        const url = new URL(request.url);

        try {
            // 1. Handle Webhook (POST)
            if (request.method === 'POST') {
                const update: any = await request.json();

                // Telegram Update Handling
                if (update.message || update.callback_query) {
                    const message = update.message || update.callback_query.message;
                    const text = update.message?.text || update.callback_query?.data || '';
                    const userId = (message.from?.id || update.callback_query?.from?.id).toString();
                    const chatId = message.chat.id;
                    const userName = message.from?.username || message.from?.first_name;

                    // Context
                    const context: ProcessingContext = {
                        userId,
                        chatId,
                        platform: 'telegram'
                    };

                    // Logger Context
                    const requestLogger = new Logger(context);

                    // Rate Limiting
                    const rateLimiter = new D1RateLimiter(env.DB);
                    const limitConfig = text.startsWith('/') ? RateLimitConfigs.COMMAND : RateLimitConfigs.AI_CHAT;
                    const limitResult = await rateLimiter.check(userId, limitConfig);

                    if (!limitResult.allowed) {
                        await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ Chill! You're messaging too fast.");
                        return new Response('Rate Limited');
                    }

                    // Unified Brain Processing
                    const storage = new D1StorageAdapter(env.DB);

                    // AI Provider Selection (Groq ONLY)
                    let ai: IAIProvider;
                    if (env.GROQ_API_KEY) {
                        const { GroqAIAdapter } = await import('./core-v2/adapters/groq');
                        ai = new GroqAIAdapter(env);
                    } else {
                        // Error if Groq key deemed missing, or try init anyway to trigger internal error
                        const { GroqAIAdapter } = await import('./core-v2/adapters/groq');
                        ai = new GroqAIAdapter(env);
                    }

                    const brain = new UnifiedBrain(storage, ai, requestLogger);

                    const response = await brain.processMessage(context, text);

                    // Send Response
                    if (response.type === 'text') {
                        await sendTelegramMessage(env.BOT_TOKEN, chatId, response.text);
                    } else if (response.type === 'command') {
                        await sendTelegramMessage(env.BOT_TOKEN, chatId, `🤖 Command received: ${response.data.command}`);
                    }

                    return new Response('OK');
                }
            }

            // 2. Health Check
            if (url.pathname === '/health' || url.pathname === '/') {
                return new Response('🤖 Hawas Worker V2 (Unified Brain) Online', { status: 200 });
            }

            return new Response('Not Found', { status: 404 });

        } catch (error: any) {
            logger.error('Worker Error', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};

async function sendTelegramMessage(token: string, chatId: number | string, text: string) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown'
            })
        });
        if (!resp.ok) {
            const err = await resp.text();
            console.error(`Telegram API Error: ${resp.status} ${err}`);
        }
    } catch (e: any) {
        console.error('Failed to send Telegram message', e);
    }
}
