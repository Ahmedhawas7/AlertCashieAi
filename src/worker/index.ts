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
import { PolyAgent } from './polyAgent';
import { AgentManifesto } from './agent/manifesto';
import { GroupSettings, GroupMode } from './agent/groupSettings';
import { WhaleExecutor } from './whale/executor';
import { WhaleBalance } from './whale/balance';

// ✅ PolyAgent (MVP)
import { getPolySettings, setPolySettings } from './polyAgent/state';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            const url = new URL(request.url);
            const normalizedPath = url.pathname.replace(/\/$/, '');

            // 1. Health check
            if (normalizedPath === '' || normalizedPath === '/health') {
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
                await saveConnection(
                    env.DB,
                    env,
                    telegramUserId,
                    userInfo.smart_wallet_address || null,
                    userInfo.signer_wallet_address || null,
                    userInfo.email || null,
                    tokens.access_token,
                    tokens.refresh_token || null,
                    tokens.expires_in || null,
                    'carv_id_basic_read email_basic_read evm_address_basic_read'
                );
                await sendTelegramMessage(
                    env.BOT_TOKEN,
                    parseInt(telegramUserId),
                    `✅ <b>تم الربط بنجاح!</b>\n\n🆔 Wallet: <code>${userInfo.smart_wallet_address}</code>`
                );
                return new Response('Success! Return to Telegram.');
            }

            // 4. Telegram Webhook
            if (request.method === 'POST') {
                const update = await request.json() as TelegramUpdate;
                if (update.message || update.callback_query) {
                    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;
                    const userId = update.message?.from.id || update.callback_query?.from.id;
                    const messageThreadId = update.message?.message_thread_id || update.callback_query?.message?.message_thread_id;
                    const text = update.message?.text || update.message?.caption || update.callback_query?.data || "";
                    const senderName = update.message?.from.first_name || update.callback_query?.from.first_name || "User";
                    const isOwner = userId?.toString() === env.OWNER_TELEGRAM_ID;

                    // Handle Callback Queries (Buttons)
                    if (update.callback_query) {
                        const data = update.callback_query.data || "";
                        if (chatId) {
                            if (data.startsWith('tx_confirm:')) {
                                const txId = data.split(':')[1];
                                // Execute transaction (MOCK FOR NOW)
                                await env.DB.prepare("UPDATE pending_tx SET status = 'executed', tx_hash = '0x_MOCK_HASH_' || ? WHERE id = ?").bind(Date.now(), txId).run();
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ **تم تنفيذ التحويل بنجاح!**\n\nHash: \`0x_MOCK_HASH_${Date.now()}\``, { message_thread_id: messageThreadId });
                                return new Response('OK');
                            } else if (data.startsWith('tx_cancel:')) {
                                const txId = data.split(':')[1];
                                await env.DB.prepare("UPDATE pending_tx SET status = 'cancelled' WHERE id = ?").bind(txId).run();
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `❌ **تم إلغاء التحويل.**`, { message_thread_id: messageThreadId });
                                return new Response('OK');
                            }
                        }
                    }

                    if (chatId && userId) {
                        const brain = new BrainV2(env.DB, env);

                        // Commands
                        if (text.startsWith('/')) {
                            const [fullCommand, ...argsParts] = text.split(' ');
                            const command = fullCommand.split('@')[0];
                            const args = argsParts.join(' ').trim();

                            if (command === '/start') {
                                const manifesto = new AgentManifesto(env);
                                const caps = manifesto.getCapabilities().filter(c => c.enabled).map(c => `✅ ${c.name}`).join('\n');
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `يا هلا بيك يا ${senderName}! أنا حواس (HX7 Agent).\n\n📃 **My Active Capabilities:**\n${caps}`, { reply_markup: getMainMenu() });
                            } else if (command === '/agent_status') {
                                const manifesto = new AgentManifesto(env);
                                const caps = manifesto.getCapabilities();
                                const msg = caps.map(c => `${c.enabled ? '🟢' : '🔴'} **${c.name}**: ${c.description}`).join('\n');
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `🤖 **Agent System Status**\n\n${msg}`, { parse_mode: 'Markdown' });
                            } else if (command === '/group_mode') {
                                const gs = new GroupSettings(env.DB);
                                const mode = await gs.getMode(chatId.toString());
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `📊 **Group Mode:** \`${mode}\``, { parse_mode: 'Markdown' });
                            } else if (command === '/set_mode') {
                                if (!isOwner && !env.TELEGRAM_ADMIN_IDS?.includes(userId.toString())) {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ Admin only.");
                                } else {
                                    const mode = args.toUpperCase() as GroupMode;
                                    if (['CHATTY', 'SILENT', 'NEWS_ONLY'].includes(mode)) {
                                        const gs = new GroupSettings(env.DB);
                                        await gs.setMode(chatId.toString(), mode);
                                        await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ Mode set to: \`${mode}\``, { parse_mode: 'Markdown' });
                                    } else {
                                        await sendTelegramMessage(env.BOT_TOKEN, chatId, "❌ Invalid mode. Use: SILENT, CHATTY, or NEWS_ONLY.");
                                    }
                                }
                            } else if (command === '/connect') {
                                // Ensure userId is treated as number
                                const uid = Number(userId);
                                if (!uid) return new Response('Invalid User ID', { status: 400 });

                                const state = generateState();
                                const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
                                await savePendingSession(env.DB, uid.toString(), state, expiresAt);
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
                            } else if (command === '/ai' && isOwner) {
                                if (args === 'test') {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ Testing AI providers...");
                                    const testResult = await brain.testProviders();
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, testResult, { parse_mode: 'Markdown' });
                                }
                            } else if (command === '/memory' && isOwner) {
                                const targetId = args || userId.toString();
                                const summary = await brain.getMemorySummary(targetId);
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, summary, { parse_mode: 'Markdown' });
                            } else if (command === '/poly_status' && isOwner) {
                                const poly = new PolyAgent(env);
                                const settings = await poly.db.getSettings();
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `🛡️ **PolyAgent Status**\nMode: ${settings.mode}\nRisk Cap: ${settings.max_risk_pct * 100}%\nMin Profit: $${settings.min_profit_usd}`, { parse_mode: 'Markdown' });
                            } else if (command === '/poly_scan_now' && isOwner) {
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, "🔍 Scanning markets...");
                                const poly = new PolyAgent(env);
                                const opps = await poly.scanner.scan();
                                if (opps.length > 0) {
                                    const msg = opps.map(o => `💰 **${o.mispricing_pct.toFixed(1)}%** | ${o.question}\n${o.details}`).join('\n\n');
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, `Found ${opps.length} Opportunities:\n\n${msg}`, { parse_mode: 'Markdown' });
                                } else {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "✅ No mispricings found.");
                                }
                            } else if (command === '/poly_mode' && isOwner) {
                                const mode = args.trim().toUpperCase();
                                if (['OFF', 'OBSERVE', 'EXECUTE'].includes(mode)) {
                                    const poly = new PolyAgent(env);
                                    const s = await poly.db.getSettings();
                                    await poly.db.saveSettings({ ...s, mode: mode as any });
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ Mode set to: **${mode}**`, { parse_mode: 'Markdown' });
                                } else {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "Usage: /poly_mode [OFF|OBSERVE|EXECUTE]");
                                }
                            } else if (command === '/poly_confirm' && isOwner) {
                                const otp = args.trim();
                                const poly = new PolyAgent(env);
                                const op = await poly.db.verifyAndClaimOp(otp);
                                if (op) {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "🚀 Executing trade...");
                                    const res = await poly.client.placeOrder(op);
                                    await poly.db.logAudit('EXECUTE', { op, res });
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ Trade Sent! ID: \`${res.orderId}\``, { parse_mode: 'Markdown' });
                                } else {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "❌ Invalid or expired Code.");
                                }
                            } else if (command === '/p') {
                                if (!args) {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "استخدم الأمر كدة: `/p موضوع الخبر`", { parse_mode: 'Markdown' });
                                } else {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, `⏳ جاري البحث والتحضير عن: **${args}**...`, { parse_mode: 'Markdown' });
                                    const brain = new BrainV2(env.DB, env);
                                    // Use deepResearch or specific news flow
                                    const news = await brain.handleMessage(userId.toString(), senderName, `انشر خبر عن ${args}`);
                                    const newsText = typeof news === 'string' ? news : news.text;
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, `📢 **خبر هام من حواس:**\n\n${newsText}`, { parse_mode: 'Markdown' });
                                }
                            } else if (command === '/whale_balance') {
                                if (!isOwner) return new Response("OK");
                                const wb = new WhaleBalance(env);
                                try {
                                    const ex = new WhaleExecutor(env);
                                    const addr = await ex.getAddress();
                                    const b = await wb.getBalances(addr);
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, `🐋 **Whale Balance (Base Mainnet)**\n\nWallet: \`${addr}\`\nETH: \`${b.eth}\`\nUSDC: \`${b.usdc}\``, { parse_mode: 'Markdown' });
                                } catch (e: any) {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, `❌ Error: ${e.message}`);
                                }
                            } else if (command === '/whale_status') {
                                if (!isOwner) return new Response("OK");
                                const mode = await env.DB.prepare("SELECT value FROM poly_settings WHERE key = 'whale_mode'").first<string>('value') || 'OBSERVE';
                                const kill = await env.DB.prepare("SELECT value FROM poly_settings WHERE key = 'whale_kill_switch'").first<string>('value') || 'false';
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `📊 **Whale Status**\nMode: \`${mode}\`\nKill Switch: \`${kill === 'true' ? '🔴 ON' : '🟢 OFF'}\`\nMax Trade: \`2%\``, { parse_mode: 'Markdown' });
                            } else if (command === '/whale_mode') {
                                if (!isOwner) return new Response("OK");
                                const mode = args.trim().toUpperCase();
                                if (['OBSERVE', 'EXECUTE'].includes(mode)) {
                                    await env.DB.prepare("INSERT INTO poly_settings (key, value) VALUES ('whale_mode', ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value").bind(mode).run();
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ Whale Mode set to: **${mode}**`, { parse_mode: 'Markdown' });
                                } else {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "Usage: `/whale_mode [OBSERVE|EXECUTE]`");
                                }
                            } else if (command === '/whale_off') {
                                if (!isOwner) return new Response("OK");
                                await env.DB.prepare("INSERT INTO poly_settings (key, value) VALUES ('whale_mode', 'OFF') ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value").bind().run();
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, "✅ Whale Trading is now **OFF**.");
                            }
                        } else {
                            // 4. Agency Filtering (Groups Only)
                            const chatType = update.message?.chat?.type;
                            const isGroup = chatType === 'group' || chatType === 'supergroup';
                            const isReplyToMe = update.message?.reply_to_message?.from?.id.toString() === env.BOT_TOKEN.split(':')[0];
                            const isMentioned = text.includes('@');
                            const isCommand = text.startsWith('/');

                            if (isGroup && update.message) {
                                const gs = new GroupSettings(env.DB);
                                const mode = await gs.getMode(chatId.toString());

                                if (mode === 'SILENT') {
                                    if (!isCommand && !isMentioned && !isReplyToMe) {
                                        return new Response("OK");
                                    }
                                } else if (mode === 'NEWS_ONLY') {
                                    const newsKeywords = ["خبر", "أخبار", "news", "update"];
                                    const isNewsRequest = newsKeywords.some(kw => text.toLowerCase().includes(kw)) || text.startsWith('/p');
                                    if (!isCommand && !isMentioned && !isReplyToMe && !isNewsRequest) {
                                        return new Response("OK");
                                    }
                                }
                            }

                            const result = await brain.handleMessage(userId.toString(), senderName, text);
                            if (result) {
                                if (typeof result === 'string') {
                                    const manifesto = new AgentManifesto(env);
                                    const systemSuffix = await manifesto.getSystemPromptSuffix();

                                    // Inject strict rules into the brain context
                                    // Note: This assumes BrainV2 has a way to accept system prompts or we append it to the message.
                                    // For now, we prepend it to the context implicitly if the Brain supports it, 
                                    // or just respect it in the logic we build next.

                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, result, {
                                        reply_markup: isOwner ? getMainMenu() : undefined,
                                        message_thread_id: messageThreadId
                                    });
                                } else {
                                    // HawasResponse object
                                    const replyMarkup = result.reply_markup || (isOwner ? getMainMenu() : undefined);
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, result.text, {
                                        reply_markup: replyMarkup,
                                        message_thread_id: messageThreadId
                                    });
                                }
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

        // PolyAgent Scan (Every 5 mins)
        // Note: We check if it's NOT the daily digest (or just run it safely with locking)
        if (event.cron !== "0 9 * * *") {
            try {
                const poly = new PolyAgent(env);
                const settings = await poly.db.getSettings();

                // Only scan if not OFF
                if (settings.mode !== 'OFF') {
                    // Try to acquire lock to prevent double-runs
                    const locked = await poly.db.acquireLock('scan_lock', 'worker', 250000); // 4 min lock
                    if (locked) {
                        const opps = await poly.scanner.scan();
                        if (opps.length > 0) {
                            const msg = opps.map(o => `💰 **${o.mispricing_pct.toFixed(1)}%** | ${o.question}\n${o.details}`).join('\n\n');

                            if (settings.mode === 'EXECUTE') {
                                // Start execution flow (generate OTP)
                                const otp = poly.generateOtp();
                                const payload = { type: 'BUY_ARB', opps }; // simplified payload
                                await poly.db.createOp(otp, payload);
                                const ownerId = parseInt(env.OWNER_TELEGRAM_ID || '0');
                                if (ownerId) await sendTelegramMessage(env.BOT_TOKEN, ownerId, `🚀 **Action Required**\n\n${msg}\n\nReply: \`/poly_confirm ${otp}\``, { parse_mode: 'Markdown' });
                            } else {
                                // OBSERVE only
                                const ownerId = parseInt(env.OWNER_TELEGRAM_ID || '0');
                                if (ownerId) await sendTelegramMessage(env.BOT_TOKEN, ownerId, `👀 **Observation**\n\n${msg}`, { parse_mode: 'Markdown' });
                            }
                            await poly.db.logAudit('ALERT', { opps, mode: settings.mode });
                        }
                        // Release lock not strictly needed if we rely on expiry, but good practice
                        await poly.db.releaseLock('scan_lock', 'worker');
                    }
                }
            } catch (e) {
                console.error('PolyAgent Cron Error:', e);
            }
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
            message_thread_id: opts?.message_thread_id,
            text: text,
            parse_mode: opts?.parse_mode || 'HTML',
            reply_markup: opts?.reply_markup
        })
    });
}
