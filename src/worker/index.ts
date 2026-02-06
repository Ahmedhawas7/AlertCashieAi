import { Env, TelegramUpdate } from './types';
import { DB } from './db';
import { HawasBrain } from './hawas';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // 1. Handle Webhook Setup (Optional convenience)
        const url = new URL(request.url);
        if (url.pathname === '/setup') {
            if (url.searchParams.get('token') !== env.BOT_TOKEN) return new Response('Unauthorized', { status: 401 });
            const webhookUrl = `${url.origin}/telegram`;
            const tgUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`;
            const resp = await fetch(tgUrl);
            return new Response(await resp.text());
        }

        // 2. Handle Telegram Updates
        if (url.pathname === '/telegram' && request.method === 'POST') {
            try {
                const update: TelegramUpdate = await request.json();

                // Only handle messages for now
                if (update.message) {
                    const db = new DB(env);
                    const brain = new HawasBrain(db, env);

                    const responseText = await brain.processMessage(update.message);

                    if (responseText) {
                        const chatId = update.message.chat.id;
                        await sendTelegramMessage(env.BOT_TOKEN, chatId, responseText, update.message.message_id);
                    }
                }

                return new Response('OK');
            } catch (e) {
                console.error('Worker Error:', e);
                return new Response('Error', { status: 500 });
            }
        }

        // 3. Health Check
        return new Response('🤖 Hawas Worker Online');
    }
};

async function sendTelegramMessage(token: string, chatId: number, text: string, replyToMsgId?: number) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            reply_to_message_id: replyToMsgId,
            parse_mode: 'HTML' // Or Markdown
        })
    });
}
