import { Env, TelegramUpdate, ScheduledEvent, ExecutionContext } from './types';
import { DB } from './db';
import { HawasBrain } from './hawas';
import { generateAuthUrl, exchangeCodeForTokens, getUserInfo } from './carv/oauth';
import { generateState } from './carv/crypto';
import { savePendingSession, validateState, saveConnection, getConnection, cleanupExpiredSessions } from './carv/db';
import { requireOwner, requireLinkedOwner } from './middleware/auth';
import { AgentMemorySystem } from './agent';
import { isRateLimited, cleanupRateLimits } from './ratelimit';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const agentMemory = new AgentMemorySystem(env.DB, env);

        // 1. OAuth Callback Handler
        if (url.pathname === '/auth/carv/callback' && request.method === 'GET') {
            try {
                const code = url.searchParams.get('code');
                const state = url.searchParams.get('state');

                if (!code || !state) {
                    return new Response('Missing code or state', { status: 400 });
                }

                // Validate state
                const telegramId = await validateState(env.DB, state);
                if (!telegramId) {
                    return new Response('Invalid or expired state', { status: 400 });
                }

                // Exchange code for tokens
                const tokens = await exchangeCodeForTokens(env, code);

                // Get user info
                const userInfo = await getUserInfo(env, tokens.access_token);

                // Save connection
                await saveConnection(
                    env.DB,
                    env,
                    telegramId,
                    userInfo.carv_id,
                    userInfo.wallet_address || null,
                    userInfo.email || null,
                    tokens.access_token,
                    tokens.refresh_token || null
                );

                // Send success message to Telegram
                await sendTelegramMessage(
                    env.BOT_TOKEN,
                    telegramId,
                    `✅ <b>تم الربط بنجاح!</b>\n\n` +
                    `🆔 CARV ID: <code>${userInfo.carv_id}</code>\n` +
                    `${userInfo.wallet_address ? `💼 Wallet: <code>${userInfo.wallet_address}</code>\n` : ''}` +
                    `\nيمكنك الآن استخدام جميع الأوامر الإدارية.`
                );

                return new Response('✅ Authorization successful! You can close this window.', {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });

            } catch (e) {
                console.error('OAuth callback error:', e);
                return new Response(`Error: ${(e as Error).message}`, { status: 500 });
            }
        }

        // 2. Telegram Updates
        // NOTE: Webhook must be set manually via Telegram API or wrangler CLI
        // Never expose BOT_TOKEN in URLs


        if (url.pathname === '/telegram' && request.method === 'POST') {
            try {
                const update: TelegramUpdate = await request.json();

                if (update.message) {
                    const msg = update.message;
                    const chatId = msg.chat.id;
                    const text = msg.text || '';
                    const userId = msg.from?.id || 0;

                    // Handle /connect command
                    if (text === '/connect') {
                        if (!requireOwner(env, userId)) {
                            await sendTelegramMessage(env.BOT_TOKEN, chatId, '⛔ هذا الأمر للمالك فقط.');
                            return new Response('OK');
                        }

                        // Rate limiting
                        if (isRateLimited(`connect:${userId}`, 3, 60000)) {
                            await sendTelegramMessage(env.BOT_TOKEN, chatId, '⏱ يرجى الانتظار قبل المحاولة مرة أخرى.');
                            return new Response('OK');
                        }

                        // Check if already linked
                        const getConn = await getConnection(env.DB);
                        const existing = await getConn(userId);
                        if (existing) {
                            await sendTelegramMessage(
                                env.BOT_TOKEN,
                                chatId,
                                `✅ أنت مربوط بالفعل!\n\n🆔 CARV ID: <code>${existing.carv_id}</code>`
                            );
                            return new Response('OK');
                        }

                        // Generate state
                        const state = generateState();
                        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

                        // Save pending session
                        await savePendingSession(env.DB, userId, state, expiresAt);

                        // Generate auth URL
                        const authUrl = generateAuthUrl(env, state);

                        await sendTelegramMessage(
                            env.BOT_TOKEN,
                            chatId,
                            `🔗 <b>ربط CARV ID</b>\n\n` +
                            `اضغط على الرابط للربط بحسابك:\n\n` +
                            `<a href="${authUrl}">🚀 Connect CARV ID</a>\n\n` +
                            `⏱ الرابط صالح لمدة 10 دقائق.`
                        );

                        return new Response('OK');
                    }

                    // Handle /whoami command
                    if (text === '/whoami') {
                        const getConn = await getConnection(env.DB);
                        const connection = await getConn(userId);

                        if (!connection) {
                            await sendTelegramMessage(
                                env.BOT_TOKEN,
                                chatId,
                                `❌ <b>غير مربوط</b>\n\n` +
                                `استخدم /connect للربط بـ CARV ID.`
                            );
                        } else {
                            await sendTelegramMessage(
                                env.BOT_TOKEN,
                                chatId,
                                `✅ <b>معلومات الربط</b>\n\n` +
                                `👤 Telegram ID: <code>${connection.telegram_id}</code>\n` +
                                `🆔 CARV ID: <code>${connection.carv_id}</code>\n` +
                                `${connection.wallet_address ? `💼 Wallet: <code>${connection.wallet_address}</code>\n` : ''}` +
                                `${connection.email ? `📧 Email: <code>${connection.email}</code>\n` : ''}` +
                                `🕐 Linked: ${new Date(connection.linked_at).toLocaleString('ar-EG')}`
                            );
                        }

                        return new Response('OK');
                    }

                    // Handle /status command (owner only)
                    if (text === '/status') {
                        if (!requireOwner(env, userId)) {
                            await sendTelegramMessage(env.BOT_TOKEN, chatId, '⛔ هذا الأمر للمالك فقط.');
                            return new Response('OK');
                        }

                        const status = await agentMemory.getStatus();
                        await sendTelegramMessage(env.BOT_TOKEN, chatId, status);
                        return new Response('OK');
                    }

                    // Handle /digestnow command (owner only)
                    if (text === '/digestnow') {
                        if (!requireOwner(env, userId)) {
                            await sendTelegramMessage(env.BOT_TOKEN, chatId, '⛔ هذا الأمر للمالك فقط.');
                            return new Response('OK');
                        }

                        const digest = await agentMemory.generateDailyDigest();
                        await sendTelegramMessage(env.BOT_TOKEN, chatId, digest);

                        // Store digest as memory
                        await agentMemory.storeMemory({
                            memory_type: 'daily_digest',
                            content: digest,
                            summary: 'Manual digest generation',
                            telegram_id: userId
                        });

                        return new Response('OK');
                    }

                    // Handle /plan command (owner only)
                    if (text === '/plan') {
                        if (!requireOwner(env, userId)) {
                            await sendTelegramMessage(env.BOT_TOKEN, chatId, '⛔ هذا الأمر للمالك فقط.');
                            return new Response('OK');
                        }

                        const planText = `📋 **خطة الوكيل الذكي**\n\n` +
                            `✅ **الميزات المتاحة:**\n` +
                            `• /connect - ربط CARV ID\n` +
                            `• /whoami - عرض معلومات الربط\n` +
                            `• /status - حالة الوكيل\n` +
                            `• /digestnow - ملخص يومي فوري\n` +
                            `• /plan - هذه الخطة\n\n` +
                            `🔄 **الميزات القادمة:**\n` +
                            `• ملخصات يومية تلقائية (09:00 صباحاً)\n` +
                            `• تحليل ذكي للمعاملات\n` +
                            `• تنبيهات استباقية`;

                        await sendTelegramMessage(env.BOT_TOKEN, chatId, planText);
                        return new Response('OK');
                    }

                    // For other commands, check if admin command requires linking
                    // Example: /admin command requires linked owner
                    if (text.startsWith('/admin')) {
                        const isLinked = await requireLinkedOwner(env, env.DB, userId);
                        if (!isLinked) {
                            await sendTelegramMessage(
                                env.BOT_TOKEN,
                                chatId,
                                '⛔ يجب أن تكون المالك ومربوط بـ CARV ID لاستخدام هذا الأمر.\n\nاستخدم /connect أولاً.'
                            );
                            return new Response('OK');
                        }

                        // Proceed with admin command...
                        await sendTelegramMessage(env.BOT_TOKEN, chatId, '✅ Admin command executed (linked owner).');
                        return new Response('OK');
                    }

                    // Regular message processing
                    const db = new DB(env);
                    const brain = new HawasBrain(db, env);
                    const responseText = await brain.processMessage(msg);

                    if (responseText) {
                        await sendTelegramMessage(env.BOT_TOKEN, chatId, responseText, msg.message_id);
                    }

                    // Log interaction to agent memory
                    await agentMemory.logEvent({
                        event_type: 'message_processed',
                        event_data: text.substring(0, 100),
                        telegram_id: userId,
                        chat_id: chatId
                    });
                }

                return new Response('OK');
            } catch (e) {
                console.error('Worker Error:', e);
                return new Response('Error', { status: 500 });
            }
        }

        // 4. Health check
        if (url.pathname === '/' || url.pathname === '/health') {
            await cleanupExpiredSessions(env.DB).catch(console.error);
            cleanupRateLimits();
            return new Response('🤖 Hawas Worker Online (CARV ID Enabled)');
        }

        return new Response('Not Found', { status: 404 });
    },

    // Cron trigger for daily digest
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        const agentMemory = new AgentMemorySystem(env.DB, env);

        // Generate daily digest
        const digest = await agentMemory.generateDailyDigest();

        // Send to owner
        const ownerId = parseInt(env.OWNER_TELEGRAM_ID || '0');
        if (ownerId) {
            await sendTelegramMessage(env.BOT_TOKEN, ownerId, `🌅 **ملخص يومي تلقائي**\n\n${digest}`);
        }

        // Store digest as memory
        await agentMemory.storeMemory({
            memory_type: 'daily_digest',
            content: digest,
            summary: 'Automated daily digest',
            telegram_id: ownerId
        });
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
            parse_mode: 'HTML'
        })
    });
}
