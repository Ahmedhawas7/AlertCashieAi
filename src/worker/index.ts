import { DB } from './db';
import { HawasFormatter } from './hawas';
import { Env, TelegramUpdate, ScheduledEvent, ExecutionContext, HawasResponse } from './types';
import { generateAuthUrl, exchangeCodeForTokens, getUserInfo } from './carv/oauth';
import { generateState } from './carv/crypto';
import { savePendingSession, validateState, saveConnection, getConnection, cleanupExpiredSessions } from './carv/db';
import { requireOwner, requireLinkedOwner } from './middleware/auth';
import { AgentMemorySystem } from './agent';
import { BrainV2 } from './brain/brain';
import { KnowledgeBase } from './brain/kb';
import { isRateLimited, cleanupRateLimits } from './ratelimit';
import { FreeAiPlanner } from './freeai/planner';
import { FreeAiSearch } from './freeai/search';
import { composeAnswer, formatCitations } from './freeai/answer';
import { FreeAiStore } from './freeai/store';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            const url = new URL(request.url);
            const normalizedPath = url.pathname.replace(/\/$/, '');

            // 1. Health check
            if (normalizedPath === '' || normalizedPath === '/health') {
                await cleanupExpiredSessions(env.DB).catch(console.error);
                cleanupRateLimits();
                return new Response('🤖 Hawas Worker Online (CARV ID Enabled)');
            }

            // 2. FreeAI API Routes
            if (normalizedPath.startsWith('/api/') && request.method === 'POST') {
                const body: any = await request.json().catch(() => ({}));
                if (normalizedPath === '/api/ingest') {
                    if (!body.url) return new Response('{"error":"Missing URL"}', { status: 400 });
                    const planner = new FreeAiPlanner(env.DB);
                    const result = await planner.ingestUrl(body.url, "api");
                    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
                }
                if (normalizedPath === '/api/ask') {
                    if (!body.question) return new Response('{"error":"Missing question"}', { status: 400 });
                    const search = new FreeAiSearch(env.DB);
                    const citations = await search.search(body.question);
                    const aiResult = composeAnswer(body.question, citations);
                    return new Response(JSON.stringify(aiResult), { headers: { 'Content-Type': 'application/json' } });
                }
                if (normalizedPath === '/api/kb/search') {
                    const search = new FreeAiSearch(env.DB);
                    const results = await search.search(body.q || "");
                    return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
                }
            }

            if (normalizedPath === '/api/kb/recent' && request.method === 'GET') {
                const store = new FreeAiStore(env.DB);
                const results = await store.getRecentSources(10);
                return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
            }

            // 3. OAuth Callback Handler
            if (normalizedPath === '/auth/carv/callback' && request.method === 'GET') {
                const code = url.searchParams.get('code');
                const state = url.searchParams.get('state');
                if (!code || !state) return new Response('Missing code/state', { status: 400 });
                const telegramUserId = await validateState(env.DB, state);
                if (!telegramUserId) return new Response('Invalid state', { status: 400 });
                const tokens = await exchangeCodeForTokens(env, code);
                const userInfo = await getUserInfo(env, tokens.access_token);
                await saveConnection(env.DB, env, telegramUserId, userInfo.smart_wallet_address || null, userInfo.signer_wallet_address || null, userInfo.email || null, tokens.access_token, tokens.refresh_token || null, tokens.expires_in || null, 'carv_id_basic_read email_basic_read evm_address_basic_read');
                await sendTelegramMessage(env.BOT_TOKEN, parseInt(telegramUserId), `✅ <b>تم الربط بنجاح!</b>\n\n🆔 Wallet: <code>${userInfo.smart_wallet_address}</code>`);
                return new Response('Success! Return to Telegram.');
            }

            // 4. Telegram Webhook
            if (request.method === 'POST') {
                const update = await request.json() as TelegramUpdate;
                if (update.message || update.callback_query) {
                    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;
                    const userId = update.message?.from.id || update.callback_query?.from.id;
                    const text = update.message?.text || update.callback_query?.data || "";
                    const senderName = update.message?.from.first_name || update.callback_query?.from.first_name || "User";
                    const isOwner = userId?.toString() === env.OWNER_TELEGRAM_ID;

                    if (chatId && userId) {
                        const brain = new BrainV2(env.DB, env);

                        // Commands
                        if (text.startsWith('/')) {
                            const [command, ...argsParts] = text.split(' ');
                            const args = argsParts.join(' ').trim();

                            if (command === '/start') {
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `يا هلا بيك يا ${senderName}! أنا حواس مساعدك الذكي.`, { reply_markup: getMainMenu() });
                            } else if (command === '/connect') {
                                const state = generateState(userId.toString());
                                await savePendingSession(env.DB, state, userId.toString());
                                const authUrl = generateAuthUrl(env, state);
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `اضغط هنا للربط: [Connect CARV ID](${authUrl})`, { parse_mode: 'Markdown' });
                            } else if (command === '/read') {
                                if (!args) {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "ابعت رابط أقرأه.");
                                } else {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ جاري القراءة...");
                                    const planner = new FreeAiPlanner(env.DB);
                                    const result = await planner.ingestUrl(args, `telegram:${userId}`);
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ تم الحفظ: ${result.title}\n\n${result.tldr}`);
                                }
                            } else if (command === '/ask') {
                                if (!args) {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "اسألني حاجة.");
                                } else {
                                    const search = new FreeAiSearch(env.DB);
                                    const citations = await search.search(args);
                                    const result = composeAnswer(args, citations);
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, result.answer + formatCitations(result.citations));
                                }
                            } else if (command === '/status') {
                                const diag = await brain.getAiDiag(userId.toString());
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, diag);
                            } else if (command === '/help') {
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, "أنا حواس، بساعدك في إدارة معاملاتك وقراءة الروابط.", { reply_markup: getMainMenu() });
                            }
                        } else {
                            // Normal message
                            const response = await brain.handleMessage(userId.toString(), senderName, text);
                            if (response) {
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, response, { reply_markup: isOwner ? getMainMenu() : undefined });
                            }
                        }
                    }
                    return new Response('OK');
                }
            }

            return new Response('Not Found', { status: 404 });
        } catch (e: any) {
            console.error('Worker Error:', e);
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        try {
            const agentMemory = new AgentMemorySystem(env.DB, env);
            const digest = await agentMemory.generateDailyDigest();
            const ownerId = parseInt(env.OWNER_TELEGRAM_ID || '0');
            if (ownerId) {
                await sendTelegramMessage(env.BOT_TOKEN, ownerId, `🌅 **ملخص يومي تلقائي**\n\n${digest}`);
            }
        } catch (e) {
            console.error('Scheduled Error:', e);
        }
    }
};

function getMainMenu() {
    return {
        keyboard: [[{ text: "📊 Status" }, { text: "❓ Help" }]],
        resize_keyboard: true
    };
}

async function sendTelegramMessage(token: string, chatId: number, text: string, opts?: any) {
    if (!token) return;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: opts?.parse_mode || 'HTML',
            reply_markup: opts?.reply_markup
        })
    });
}
