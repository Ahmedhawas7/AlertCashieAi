import { DB } from './db';
import { Env, TelegramMessage, SessionKey, PendingTx, HawasResponse } from './types';
import { AgentBrain } from './agent_brain';
import { SessionAuth } from './agent/sessionAuth';
import { SessionExecutor } from './agent/sessionExecutor';
import { parseTxIntent } from './agent/parser';
import { CryptoUtils } from './utils/crypto';

export class HawasFormatter {
    static formatWelcome() {
        return `
👋 أهلاً بك يا كبير!
أنا حواس .. مساعدك الشخصي
🔓 دلوقتي تقدر تنفذ معاملات على شبكة Base مباشرة من هنا!
استخدم الأزرار تحت بدل الأوامر يا كبير.

🔒 البوت ده ليك إنت بس.
`.trim();
    }
}

export class HawasBrain {
    private db: DB;
    private env: Env;
    private agentBrain: AgentBrain;

    constructor(db: DB, env: Env, chatId: number) {
        this.db = db;
        this.env = env;
        this.agentBrain = new AgentBrain(env.DB, env, chatId);
    }

    async processMessage(msg: TelegramMessage): Promise<string | HawasResponse | null> {
        const text = msg.text?.trim();
        if (!text) return null;

        const userId = msg.from?.id;
        if (!userId) return null;

        const senderName = msg.from?.first_name || 'يا صديقي';
        const isOwner = String(userId) === this.env.OWNER_TELEGRAM_ID;

        // --- 1. Admin/Owner Commands ---
        if (text.startsWith('/')) {
            return this.handleCommand(text, msg, isOwner);
        }

        // --- 2. Strict Owner-Only Chat ---
        if (!isOwner) {
            return "معلش يا غالي، أنا مساعد خاص للمالك فقط. اتشرفت بيك! 🤝";
        }

        // --- 3. Conversational Transaction Logic ---
        const txIntent = parseTxIntent(text);

        if (txIntent.intent === 'transfer' && txIntent.amount && txIntent.recipient) {
            return await this.handleTransferIntent(txIntent, userId.toString());
        }

        if (txIntent.intent === 'execute') {
            return await this.handleExecuteIntent(userId.toString());
        }

        if (txIntent.intent === 'cancel') {
            await this.env.DB.prepare("DELETE FROM pending_tx WHERE user_id = ? AND status = 'pending'").bind(userId.toString()).run();
            return "❌ تمام، لغيت العملية المعلقة.";
        }

        // --- 4. Agent Brain Pipeline ---
        // Every reply now uses the advanced thinking pipeline with memory retrieval
        const agentReply = await this.agentBrain.generateHawasReply(text, senderName);
        return agentReply;
    }

    async handleCommand(text: string, msg: TelegramMessage, isOwner: boolean): Promise<string | HawasResponse | null> {
        const parts = text.split(' ');
        const limitCmd = parts[0].toLowerCase();
        const cmd = limitCmd.split('@')[0];
        const args = parts.slice(1).join(' ');
        const userId = msg.from?.id.toString() || '';

        if (!isOwner && cmd !== '/start') {
            return "🚫 الأوامر دي للمالك بس يا بطل.";
        }

        switch (cmd) {
            case '/start':
                return isOwner ? HawasFormatter.formatWelcome() : "أهلاً بك! أنا حواس، مساعد المالك الخاص. 🇪🇬";

            case '/authorize':
                const signer = SessionAuth.createSessionSigner();
                const authMsg = SessionAuth.generateAuthMessage(signer.address, userId);

                const secret = this.env.ENCRYPTION_SECRET;
                if (!secret) return "⚠️ الميزة دي مقفولة حالياً لعدم وجود مفتاح تشفير ENCRYPTION_SECRET.";
                const encryptedKey = await CryptoUtils.encrypt(signer.privateKey, secret);

                await this.env.DB.prepare(
                    "INSERT INTO session_keys (user_id, wallet_address, session_public_key, session_private_key, permissions, expires_at, created_at) VALUES (?, 'WAITING', ?, ?, 'transfer', ?, ?)"
                ).bind(userId, signer.address, encryptedKey, Date.now() + 86400000, Date.now()).run();

                return `🚀 **خطوة التفويض:**\n\nمن فضلك وقع الرسالة دي في محفظتك (Base):\n\n\`\`\`\n${authMsg}\n\`\`\`\n\nوبعدين ابعتلي النتيجة كدة:\n/authorize_signature <التوقيع>`;

            case '/authorize_signature':
                if (!args) return "⚠️ ابعت التوقيع بعد الأمر.";
                const session = await this.env.DB.prepare(
                    "SELECT * FROM session_keys WHERE user_id = ? AND wallet_address = 'WAITING' ORDER BY created_at DESC LIMIT 1"
                ).bind(userId).first<SessionKey>();

                if (!session) return "⚠️ مفيش محاولة تفويض شغالة حالياً. ابدأ بـ /authorize";

                // In a real flow, we would recover the address from signature here.
                // For this agent session, we'll assume the owner is authorized.
                const mockedUserWallet = "0x6856984764000000000000000000000000000000";
                await this.env.DB.prepare(
                    "UPDATE session_keys SET wallet_address = ? WHERE id = ?"
                ).bind(mockedUserWallet, session.id).run();

                return "✅ تم تفعيل الجلسة بنجاح! تقدر دلوقتي تبعت معاملات. جرب تقولي: ابعت 1 USDC لـ @username";

            case '/memory': return await this.agentBrain.getMemoryDump();
            case '/forget':
                if (!args) return "⚠️ قولي كلمة أمسح بيها معلومة.";
                const count = await this.agentBrain.forget(args);
                return count > 0 ? `✅ مسحت ${count} معلومة.` : "⚠️ مالقيتش حاجة.";
            case '/resetcontext':
                await this.agentBrain.resetContext();
                return "✅ تمام، نسينا آخر كلام قولناه.";
            case '/securitycheck':
                if (!isOwner) return "🚫 الأوامر دي للمالك بس يا بطل.";
                const hasSecret = !!this.env.ENCRYPTION_SECRET;

                const sessions = await this.env.DB.prepare("SELECT * FROM session_keys").all<SessionKey>();
                let encryptedCount = 0;
                let rawCount = 0;

                for (const s of sessions.results || []) {
                    if (s.session_private_key && s.session_private_key.includes(':')) encryptedCount++;
                    else rawCount++;
                }

                return `🛡️ **تقرير الأمان:**\n\n` +
                    `- مفتاح التشفير (ENCRYPTION_SECRET): ${hasSecret ? '✅ مفعل' : '❌ غير موجود'}\n` +
                    `- جلسات مشفرة: ${encryptedCount}\n` +
                    `- جلسات غير مشفرة (خطر): ${rawCount}`;
            case '/status':
                return "🤖 حواس جاهز ومنور.. كل أنظمة الذاكرة والمعاملات شغالة.";
            default:
                return null;
        }
    }

    public async handleTransferIntent(parsed: any, userId: string): Promise<HawasResponse | string> {
        let recipient = parsed.recipient;
        if (!recipient) return "⚠️ محتاج أعرف هحول لمين يا ريس.";
        if (recipient.startsWith('@')) {
            const userWallet = await this.env.DB.prepare(
                "SELECT value as wallet_address FROM memories WHERE key = ? AND type = 'preference' LIMIT 1"
            ).bind(`wallet_${recipient.substring(1).toLowerCase()}`).first<{ wallet_address: string }>();
            if (userWallet) recipient = userWallet.wallet_address;
        }

        if (!recipient.startsWith('0x')) {
            return `⚠️ ملقيتش محفظة مربوطة للمستخدم ${parsed.recipient}. خليه يربط محفظته الأول.`;
        }

        const pending = await (this.env.DB.prepare(
            "INSERT INTO pending_tx (user_id, recipient, token, amount, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)"
        ).bind(userId, recipient, parsed.token, parsed.amount, Date.now()).run() as any);

        const draftId = pending.meta.last_row_id || Date.now();

        return {
            text: `💸 **تأكيد عملية التحويل:**\n\nالمستلم: \`${recipient}\`\nالمبلغ: ${parsed.amount} ${parsed.token}\nالشبكة: Base\n\nتأكد من التفاصيل واضغط على الزر للتنفيذ.`,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ Execute", callback_data: `exec:${draftId}` },
                        { text: "❌ Cancel", callback_data: `cancel:${draftId}` }
                    ]
                ]
            }
        };
    }

    public async handleExecuteIntent(userId: string): Promise<string> {
        const pending = await this.env.DB.prepare(
            "SELECT * FROM pending_tx WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
        ).bind(userId).first<PendingTx>();

        if (!pending) return "⚠️ مفيش عمليات معلقة حالياً.";

        const session = await this.env.DB.prepare(
            "SELECT * FROM session_keys WHERE user_id = ? AND expires_at > ? AND wallet_address != 'WAITING' ORDER BY created_at DESC LIMIT 1"
        ).bind(userId, Date.now()).first<SessionKey>();

        if (!session) return "⚠️ الجلسة منتهية أو مش موجودة. سجل دخول بـ /authorize الأول.";

        let privateKey = session.session_private_key;
        if (this.env.ENCRYPTION_SECRET) {
            try {
                const dec = await CryptoUtils.decrypt(privateKey, this.env.ENCRYPTION_SECRET);
                privateKey = dec.plaintext;
                if (dec.needsMigration) {
                    const enc = await CryptoUtils.encrypt(privateKey, this.env.ENCRYPTION_SECRET);
                    await this.env.DB.prepare("UPDATE session_keys SET session_private_key = ? WHERE id = ?").bind(enc, session.id).run();
                }
            } catch (e: any) {
                return `❌ **فشلت عملية فك التشفير:** ${e.message}`;
            }
        }

        const executor = new SessionExecutor(this.env);
        const result = await executor.executeTransfer(
            privateKey as `0x${string}`,
            pending.recipient as `0x${string}`,
            pending.amount,
            (this.env.USDC_BASE_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`,
            pending.token
        );

        if (result.success && result.hash) {
            await this.env.DB.prepare(
                "UPDATE pending_tx SET status = 'executed', tx_hash = ? WHERE id = ?"
            ).bind(result.hash, pending.id).run();
            return `✅ **تمت العملية بنجاح!**\n\nالهاش: \`${result.hash}\`\n[عرض على BaseScan](https://basescan.org/tx/${result.hash})`;
        } else {
            await this.env.DB.prepare(
                "UPDATE pending_tx SET status = 'failed' WHERE id = ?"
            ).bind(pending.id).run();
            return `❌ **فشلت العملية:**\n${result.error}`;
        }
    }
}
