import { DB } from './db';
import { Env, TelegramMessage } from './types';

// DGHM Template Builders
export class HawasFormatter {
    static formatResponse(name: string, summary: string, points: string[], action: string, risk: string, question: string, confidence: string) {
        return `
🔻 ${name} يا غالي...

1) الخلاصة: ${summary}
2) التحليل السريع:
${points.map(p => `• ${p}`).join('\n')}
3) أعمل إيه دلوقتي؟ ${action}
4) المخاطر: ${risk}
5) سؤال ليك: ${question}
6) الثقة: ${confidence}

(مش نصيحة مالية) — ده تحليل عام.
`.trim();
    }

    static formatWelcome() {
        return `
👋 ازيكم يا شباب!
أنا مساعدكم الشخصي اسمي حواس 🇪🇬
أنا هنا علشان أجاوبك على أي سؤال تحبه.
كل اللي عليك: اكتب اسمي (حواس) في رسالتك وهتلاقيني برد عليك.

⚙️ تم بنائي بواسطة @Ahmedhawas7
وبيتم تطويري باستمرار… لو صححتلي حاجة هتعلمها 🤝
`.trim();
    }
}

export class HawasBrain {
    private db: DB;
    private env: Env;

    constructor(db: DB, env: Env) {
        this.db = db;
        this.env = env;
    }

    async processMessage(msg: TelegramMessage): Promise<string | null> {
        const text = msg.text?.trim();
        if (!text) return null;

        const chatId = msg.chat.id;
        const userId = msg.from?.id;
        if (!userId) return null; // Should not happen

        const senderName = msg.from?.first_name || 'يا صديقي';
        const isPrivate = msg.chat.type === 'private';
        const isAdmin = this.env.TELEGRAM_ADMIN_IDS.includes(String(userId));

        // --- 0. Update User State (Lang, Interaction Time) ---
        // Fetch user to check cooldown
        const userState = await this.db.getUser(userId);

        // --- 1. Admin Commands ---
        if (text.startsWith('/')) {
            return this.handleCommand(text, msg, isAdmin);
        }

        // --- 2. Check Auto-Reply (Group) ---
        if (!isPrivate) {
            const settings = await this.db.getGroupSettings(chatId);
            const mode = settings?.mode || this.env.DEFAULT_GROUP_MODE || 'chatty';

            const isMentioned = text.toLowerCase().includes('hawas') || text.includes('حواس');
            const isReplyToBot = msg.reply_to_message?.from?.is_bot === true;
            const hasQuestionMark = text.includes('?') || text.includes('؟');

            let shouldReply = false;
            if (isMentioned || isReplyToBot) shouldReply = true;
            else if (mode === 'chatty' && hasQuestionMark) shouldReply = true;

            if (!shouldReply) {
                // If correction check, always create a "hearing" capability?
                // Correction usually implies replying to the bot.
                // Let's perform correction check even if no direct reply if it starts with pattern.
                if (text.startsWith('تصحيح:') || text.startsWith('الصح:')) {
                    return this.handleCorrection(text, msg, senderName);
                }
                return null;
            }
        }

        // --- 3. Anti-Spam (User Cooldown) ---
        if (!isAdmin && userState?.lastInteractedAt) {
            const lastTime = new Date(userState.lastInteractedAt).getTime();
            const now = Date.now();
            if (now - lastTime < 45 * 1000) {
                // Determine if we should warn or ignore. To avoid spamming warnings, just ignore or react with emoji if possible.
                // But wrapper logic expects text. Let's ignore to strictly stop spam.
                // Or reply privately? In group, ignoring is best.
                console.log(`Spam cooldown for user ${userId}`);
                return null;
            }
        }

        // Update interaction time
        await this.db.updateUser(userId, { lastInteractedAt: new Date().toISOString(), first_name: senderName });

        // --- 4. Correction Flow ---
        if (text.startsWith('تصحيح:') || text.startsWith('الصح:')) {
            return this.handleCorrection(text, msg, senderName);
        }

        // --- 5. Knowledge Retrieval ---
        // Basic normalization
        const query = text.replace(/حواس|Hawas/gi, '').trim();
        if (query.length < 2) return "أيوة يا غالي؟ سامعك.";

        const knowledge = await this.db.searchKnowledge(query);
        if (knowledge) {
            return `🔻 ${senderName}...\n${knowledge.answer}`;
        }

        // --- 6. Fallback: AI or "Teach Me" ---
        const aiEnabled = this.env.AI_ENABLED_DEFAULT === 'true';

        if (!aiEnabled) {
            return `معلش يا ${senderName}، أنا لسه متعلمتش إجابة السؤال ده.\nممكن تعلمني؟ اكتب: \n/teach ${query} | الإجابة`;
        }

        return `(AI Placeholder) ببحث في الموضوع ده...`;
    }

    async handleCorrection(text: string, msg: TelegramMessage, senderName: string): Promise<string> {
        // Extract correction
        const correction = text.replace(/^(تصحيح:|الصح:)/, '').trim();
        if (correction.length < 5) return "التصحيح قصير أوي يا غالي.";

        // If reply, get original context
        let originalText = msg.reply_to_message?.text;
        if (!originalText) originalText = "Context lost";

        // Save tentative knowledge
        // We assume the user is correcting the LAST answer or specific logic.
        // For simplicity, save as: Q: [Correction from X on Y] A: [Correction]
        await this.db.saveKnowledge(
            `Correction by ${senderName}: ${originalText.slice(0, 50)}...`,
            correction,
            true // isTentative
        );

        return `✅ تسلم يا ${senderName}. سجلت التصحيح للمراجعة.`;
    }

    async handleCommand(text: string, msg: TelegramMessage, isAdmin: boolean): Promise<string | null> {
        const parts = text.split(' ');
        const limitCmd = parts[0].toLowerCase(); // e.g., /teach@botname
        const cmd = limitCmd.split('@')[0];
        const args = parts.slice(1).join(' ');

        switch (cmd) {
            case '/start':
                return HawasFormatter.formatWelcome();

            case '/teach':
                if (!isAdmin) return "🚫 للأدمن بس يا كبير.";
                if (!args.includes('|')) return "⚠️ الصيغة غلط. اكتب:\n/teach السؤال | الإجابة";
                const [q, a] = args.split('|').map(s => s.trim());
                await this.db.saveKnowledge(q, a);
                return `✅ تمام يا ريس، حفظت السؤال:\nس: ${q}\nج: ${a}`;

            case '/mode':
                if (!isAdmin) return "🚫 للأدمن بس.";
                if (!['quiet', 'chatty'].includes(args)) return "استخدم: /mode quiet أو /mode chatty";
                await this.db.setGroupSettings(msg.chat.id, { mode: args });
                return `✅ تم تغيير وضع الجروب لـ: ${args}`;

            case '/autolearn':
                if (!isAdmin) return "🚫 للأدمن بس.";
                return `✅ تم تغيير وضع التعلم (محاكاة).`;

            case '/lang':
                const lang = args.trim().toLowerCase();
                if (!['ar', 'en'].includes(lang)) return "Choose: /lang ar or /lang en";
                await this.db.updateUser(msg.from?.id!, { lang });
                return lang === 'ar' ? "✅ تمام، هكلمك مصري." : "✅ Done, I'll speak English with you private.";

            default:
                return null;
        }
    }
}
