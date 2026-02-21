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
import { UserManager } from './agent/userManager';
import { LiveNews } from './intel/liveNews';
import { IntelFormatter } from './intel/formatter';

// ✅ PolyAgent (MVP)
import { getPolySettings, setPolySettings } from './polyAgent/state';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

            // 4. Telegram Webhook (RESTORED)
            if (url.pathname === '/telegram' && request.method === 'POST') {
                try {
                    const update: any = await request.json();

                    let chatId: number | undefined;
                    let userId: number | undefined;
                    let senderName: string = 'User';
                    let text: string = '';
                    let messageThreadId: number | undefined;

                    if (update.message) {
                        chatId = update.message.chat.id;
                        userId = update.message.from?.id;
                        senderName = update.message.from?.first_name || 'Hustler';
                        text = update.message.text || update.message.caption || '';
                        messageThreadId = update.message.message_thread_id;
                    } else if (update.callback_query) {
                        chatId = update.callback_query.message?.chat.id;
                        userId = update.callback_query.from?.id;
                        senderName = update.callback_query.from?.first_name || 'Hustler';
                        text = update.callback_query.data || '';
                        messageThreadId = update.callback_query.message?.message_thread_id;
                    }

                    if (!userId || !chatId) return new Response('OK'); // No user or chat ID, ignore

                    const isOwner = userId.toString() === env.OWNER_TELEGRAM_ID;

                    // 0. Track User (UserManager)
                    if (update.message?.from || update.callback_query?.from) {
                        const tgUser = (update.message?.from || update.callback_query?.from)!;
                        const um = new UserManager(env.DB);
                        const chatType = update.message?.chat?.type || update.callback_query?.message?.chat?.type;
                        await um.trackUser(tgUser, chatType === 'private');
                    }

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
                            } else if (data === 'panel_whale_toggle' && isOwner) {
                                const mode = await env.DB.prepare("SELECT value FROM poly_settings WHERE key = 'whale_mode'").first<string>('value') || 'OBSERVE';
                                const newMode = mode === 'EXECUTE' ? 'OBSERVE' : 'EXECUTE';
                                await env.DB.prepare("INSERT INTO poly_settings (key, value) VALUES ('whale_mode', ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value").bind(newMode).run();
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `🐋 Whale Mode -> **${newMode}**`);
                                return new Response('OK');
                            } else if (data === 'panel_poly_toggle' && isOwner) {
                                const poly = new PolyAgent(env);
                                const s = await poly.db.getSettings();
                                const newMode = s.mode === 'EXECUTE' ? 'OBSERVE' : 'EXECUTE';
                                await poly.db.saveSettings({ ...s, mode: newMode as any });
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `🛡️ PolyAgent Mode -> **${newMode}**`);
                                return new Response('OK');
                            } else if (data === 'panel_news_push' && isOwner) {
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ جاري تحضير النشرة الفورية...");
                                const intel = await LiveNews.fetchLatest(true);
                                if (intel) {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, IntelFormatter.formatNewsReport(intel), { parse_mode: 'HTML' });
                                }
                                return new Response('OK');
                            } else if (data === 'panel_ai_toggle' && isOwner) {
                                const brain = new BrainV2(env.DB, env);
                                const current = await brain.isAiEnabled(userId.toString());
                                await brain.setAiToggle(userId.toString(), !current);
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ تم ${!current ? 'تفعيل' : 'تعطيل'} الذكاء الاصطناعي بنجاح.`);
                                return new Response('OK');
                            } else if (data === 'panel_users_list' && isOwner) {
                                const um = new UserManager(env.DB);
                                const users = await um.getPrivateUsers();
                                const total = await um.getUserCount();
                                let msg = `👥 <b>قائمة المستخدمين</b>\nإجمالي: ${total}\n\n`;
                                for (const u of users) {
                                    const username = u.username ? `@${u.username}` : 'بدون معرف';
                                    msg += `• <a href="tg://user?id=${u.telegram_id}">${u.first_name}</a> (${username})\n`;
                                }
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, msg, { parse_mode: 'HTML' });
                                return new Response('OK');
                            } else if (data === 'panel_balance_refresh' && isOwner) {
                                const wb = new WhaleBalance(env);
                                const ex = new WhaleExecutor(env);
                                const addr = await ex.getAddress();
                                const b = await wb.getBalances(addr);
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `💰 <b>تم تحديث الأرصدة:</b>\n\nإيثيريوم: <code>${b.eth}</code>\nدولار (USDC): <code>${b.usdc}</code>`, { parse_mode: 'HTML' });
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
                                const uid = Number(userId);
                                if (!uid) return new Response('Invalid User ID', { status: 400 });

                                const state = generateState();
                                const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
                                await savePendingSession(env.DB, uid.toString(), state, expiresAt);
                                const authUrl = generateAuthUrl(env, state);
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, `اضغط هنا للربط: [Connect CARV ID](${authUrl})`, { parse_mode: 'Markdown' });
                            } else if (command === '/news') {
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ جاري جلب آخر الأخبار الموثقة...");
                                const intel = await LiveNews.fetchLatest(true);
                                if (intel) {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, IntelFormatter.formatNewsReport(intel), { parse_mode: 'HTML' });
                                } else {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "لا توجد بيانات حديثة مؤكدة حالياً. جاري البحث والتحديث.");
                                }
                            } else if (command === '/market_status') {
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, "📊 جاري تحليل وضع السوق...");
                                const intel = await LiveNews.fetchLatest(true);
                                if (intel) {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, IntelFormatter.formatMarketStatus(intel), { parse_mode: 'HTML' });
                                } else {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, "لا توجد بيانات حديثة مؤكدة حالياً. جاري البحث والتحديث.");
                                }
                            } else if (command === '/users' && isOwner) {
                                const um = new UserManager(env.DB);
                                const users = await um.getPrivateUsers();
                                const total = await um.getUserCount();
                                let msg = `👥 **قائمة المستخدمين (الخاص)**\nإجمالي: ${total}\n\n`;
                                for (const u of users) {
                                    const username = u.username ? `@${u.username}` : 'No Username';
                                    msg += `• [${u.first_name}](tg://user?id=${u.telegram_id}) (${username})\n`;
                                }
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, msg, { parse_mode: 'Markdown' });
                            } else if (command === '/panel' && isOwner) {
                                const modeWhale = await env.DB.prepare("SELECT value FROM poly_settings WHERE key = 'whale_mode'").first<string>('value') || 'OBSERVE';
                                const poly = new PolyAgent(env);
                                const polyS = await poly.db.getSettings();
                                const aiEnabled = await brain.isAiEnabled(userId.toString());

                                const panel = {
                                    text: `🛠️ <b>لوحة التحكم الشاملة (حواس HX7)</b>\n\n` +
                                        `🐋 <b>محرك الحوت</b>: <code>${modeWhale}</code>\n` +
                                        `🛡️ <b>بولي أيجنت</b>: <code>${polyS.mode}</code>\n` +
                                        `🧠 <b>الذكاء الاصطناعي</b>: <code>${aiEnabled ? 'مفعل' : 'معطل'}</code>\n` +
                                        `📊 <b>الحالة الاستخباراتية</b>: نشط\n\n` +
                                        `إليك كافة التحكمات المتاحة لك يا ريس:`,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: `🐋 تداول الحوت: ${modeWhale === 'EXECUTE' ? '✅' : '🟡'}`, callback_data: 'panel_whale_toggle' },
                                                { text: `🛡️ بولي: ${polyS.mode === 'EXECUTE' ? '✅' : '🟡'}`, callback_data: 'panel_poly_toggle' }
                                            ],
                                            [
                                                { text: `🧠 ذكاء اصطناعي: ${aiEnabled ? '✅' : '❌'}`, callback_data: 'panel_ai_toggle' },
                                                { text: "💰 تحديث الأرصدة", callback_data: 'panel_balance_refresh' }
                                            ],
                                            [
                                                { text: "📢 نشر الأخبار فوراً", callback_data: 'panel_news_push' },
                                                { text: "👥 المستخدمين", callback_data: 'panel_users_list' }
                                            ]
                                        ]
                                    }
                                };
                                await sendTelegramMessage(env.BOT_TOKEN, chatId, panel.text, { ...panel, parse_mode: 'HTML' });
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
                                    const news = await brain.handleMessage(userId.toString(), senderName, `انشر خبر عن ${args}`, chatId.toString());
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
                            // Group filtering logic
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

                            const result = await brain.handleMessage(userId.toString(), senderName, text, chatId.toString());

                            // Trigger Agency Background Loop if needed
                            if (typeof result !== 'string' && result.taskId) {
                                ctx.waitUntil(brain.runAgencyLoop(result.taskId, userId.toString()));
                            }

                            if (result) {
                                if (typeof result === 'string') {
                                    await sendTelegramMessage(env.BOT_TOKEN, chatId, result, {
                                        reply_markup: isOwner ? getMainMenu() : undefined,
                                        message_thread_id: messageThreadId
                                    });
                                } else {
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
                } catch (e: any) {
                    console.error('Telegram Handler Error:', e);
                    try {
                        const ownerId = parseInt(env.OWNER_TELEGRAM_ID || '0');
                        if (ownerId && env.BOT_TOKEN) {
                            await sendTelegramMessage(env.BOT_TOKEN, ownerId, `⚠️ **خطأ في المعالجة:**\n\`${e.message}\``);
                        }
                        await env.DB.prepare("INSERT INTO poly_audit (action_type, details, timestamp) VALUES (?, ?, ?)").bind('ERROR', JSON.stringify({ error: e.message, stack: e.stack }), Date.now()).run();
                    } catch (logErr) {
                        console.error('Failed to report/log error:', logErr);
                    }
                    return new Response('OK');
                }
            }

            return new Response('Not Found', { status: 404 });
        } catch (e: any) {
            console.error('Worker General Error:', e);
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        try {
            const ownerId = parseInt(env.OWNER_TELEGRAM_ID || '0');

            // 1. Daily Digest
            if (event.cron === "0 9 * * *") {
                const agentMemory = new AgentMemorySystem(env.DB, env);
                const digest = await agentMemory.generateDailyDigest();
                if (ownerId) {
                    await sendTelegramMessage(env.BOT_TOKEN, ownerId, `🌅 **ملخص يومي تلقائي**\n\n${digest}`);
                }
            }

            // 2. 12h Intelligence Report
            if (event.cron === "0 */12 * * *") {
                const intel = await LiveNews.fetchLatest(true);
                if (intel && ownerId) {
                    const report = IntelFormatter.formatNewsReport(intel);
                    await sendTelegramMessage(env.BOT_TOKEN, ownerId, `📊 **تحديث استخباراتي (12h)**\n\n${report}`, { parse_mode: 'Markdown' });
                }
            }

            // 3. PolyAgent Scan (Every 5 mins)
            if (event.cron !== "0 9 * * *") {
                const poly = new PolyAgent(env);
                const settings = await poly.db.getSettings();

                if (settings.mode !== 'OFF') {
                    const locked = await poly.db.acquireLock('scan_lock', 'worker', 250000);
                    if (locked) {
                        const opps = await poly.scanner.scan();
                        if (opps.length > 0) {
                            const msg = opps.map(o => `💰 **${o.mispricing_pct.toFixed(1)}%** | ${o.question}\n${o.details}`).join('\n\n');
                            if (settings.mode === 'EXECUTE') {
                                const otp = poly.generateOtp();
                                await poly.db.createOp(otp, { type: 'BUY_ARB', opps });
                                if (ownerId) await sendTelegramMessage(env.BOT_TOKEN, ownerId, `🚀 **Action Required**\n\n${msg}\n\nReply: \`/poly_confirm ${otp}\``, { parse_mode: 'Markdown' });
                            } else {
                                if (ownerId) await sendTelegramMessage(env.BOT_TOKEN, ownerId, `👀 **Observation**\n\n${msg}`, { parse_mode: 'Markdown' });
                            }
                            await poly.db.logAudit('ALERT', { opps, mode: settings.mode });
                        }
                        await poly.db.releaseLock('scan_lock', 'worker');
                    }
                }
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
            message_thread_id: opts?.message_thread_id,
            text: text,
            parse_mode: opts?.parse_mode || 'HTML',
            reply_markup: opts?.reply_markup
        })
    });
}
