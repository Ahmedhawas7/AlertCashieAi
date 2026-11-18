import { Env } from '../types';
import { MemoryManager } from '../brain/memory';
import { AiRouter } from '../ai/router';

export class ProactiveCompanion {
    private db: D1Database;
    private env: Env;
    private memory: MemoryManager;
    private aiRouter: AiRouter;

    constructor(db: D1Database, env: Env) {
        this.db = db;
        this.env = env;
        this.memory = new MemoryManager(db);
        this.aiRouter = new AiRouter(env);
    }

    /**
     * Run morning proactive check-ins for active users
     */
    async runMorningCheckins(sendWa: (to: string, msg: string) => Promise<void>): Promise<number> {
        const today = new Date().toISOString().split('T')[0];
        let sentCount = 0;

        try {
            // Find users who talked to Hawas in the last 48 hours (excluding system/group ids)
            const sinceTs = Date.now() - 48 * 60 * 60 * 1000;
            const activeUsers = await this.db.prepare(
                `SELECT DISTINCT user_id FROM episodic_logs 
                 WHERE ts > ? AND user_id NOT LIKE '-%' AND user_id NOT LIKE 'group%' 
                 LIMIT 25`
            ).bind(sinceTs).all<{ user_id: string }>();

            for (const row of activeUsers.results || []) {
                const userId = row.user_id;

                // Check if already checked in today
                const alreadySent = await this.db.prepare(
                    `SELECT id FROM hawas_proactive_checkins WHERE user_id = ? AND checkin_date = ? LIMIT 1`
                ).bind(userId, today).first();

                if (alreadySent) continue;

                // Get user identity
                const nameFact = await this.memory.getFact(userId, 'name');
                const genderFact = await this.memory.getFact(userId, 'gender');
                const userName = nameFact?.value || '';
                const isFemale = genderFact?.value === 'female';

                // Get latest context (daily diary or last episodes)
                const latestDiary = await this.memory.getLatestDailyDiary(userId);
                const recentEpisodes = await this.memory.getRecentEpisodes(userId, 4);

                const recentTopics = recentEpisodes.map(e => e.text).join(' - ');
                const diaryContext = latestDiary ? latestDiary.summary_learned : '';

                // Prompt AI to generate a warm, natural, human Egyptian morning message
                const prompt = [
                    {
                        role: 'system',
                        content: `أنت "حواس" الصديق المصري الأصيل الوفي.
تريد أن تبادر بالاطمئنان الصباحي على صديقك (${userName ? userName : (isFemale ? 'أخت وصديقة' : 'صاحب وجدع')}) دون أن يطلب منك ذلك.
اكتب رسالة صباحية لطيفة جداً، دافئة ومختصرة (سطرين فقط)، تسأله فيها عن حاله وتتمنى له يوماً رايقاً.
- إذا كان في سياق أمس حزن أو ضيق أو فراق أو تعب، اسأله باهتمام حنون إن كان مزاجه أحسن اليوم.
- إذا كانت دردشة عادية، أرسل له تحية صباحية مصرية تفرح القلب.
- لا تطلب منه شيئاً ولا تحقق معه، فقط اترك له طاقة إيجابية صادقة.
- أخرج نص الرسالة فقط بدون أي مقدمات أو علامات تنصيص.`
                    },
                    {
                        role: 'user',
                        content: `اسم المستخدم: ${userName || 'غير محدد'} | الجنس: ${isFemale ? 'أنثى' : 'ذكر'}
ما عرفته عنه في مذكرتك أو كلام أمس: ${diaryContext || recentTopics || 'صديق جديد'}
اكتب رسالة الصباح الخاصة به الآن:`
                    }
                ];

                const aiRes = await this.aiRouter.chat(prompt, { maxTokens: 150, temperature: 0.7 });
                const messageText = aiRes.text ? aiRes.text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() : '';

                if (messageText && messageText.length > 10) {
                    // Send to WhatsApp if phone number
                    if (/^\d{8,15}$/.test(userId)) {
                        await sendWa(userId, messageText);
                    }

                    // Record checkin to prevent duplicate messages
                    await this.db.prepare(
                        `INSERT INTO hawas_proactive_checkins (user_id, checkin_date, topic, message_text, created_at)
                         VALUES (?, ?, ?, ?, ?)`
                    ).bind(userId, today, diaryContext.substring(0, 50), messageText, Date.now()).run();

                    sentCount++;
                }
            }
        } catch (e) {
            console.error('[ProactiveCompanion] Error during morning checkins:', e);
        }

        return sentCount;
    }
}
