import { StorageService } from './storage';
import { Telegraf } from 'telegraf';
import { Env } from '../worker/types'; // reusing types if possible, or just string

export class DigestService {
    constructor(
        private storage: StorageService,
        private bot: Telegraf,
        private targetChatId: string
    ) { }

    async runCycles() {
        const now = new Date();
        const hour = now.getUTCHours();
        // Run daily brief at 09:00 UTC (approx)
        // Since cron runs every 5 min, we check if we are in the 09:00-09:05 window OR just check DB flag.
        // DB flag is safer.

        await this.checkDailyBrief(now);
        await this.checkWeeklyOutlook(now);
    }

    private async checkDailyBrief(now: Date) {
        const today = now.toISOString().split('T')[0];
        const key = `daily_brief_${today}`;
        const sent = await this.storage.getConfig(key);

        if (sent) return;

        // Only run if it's past 9 AM UTC
        if (now.getUTCHours() < 9) return;

        console.log('Generating Daily Brief...');

        const events = await this.storage.getLatestEvents(20); // Last 20 generated today?
        // Filter for today
        const todaysEvents = events.filter(e => e.timestamp.toISOString().startsWith(today));

        if (todaysEvents.length === 0) {
            // No events, maybe skip or send quiet update
            await this.storage.setConfig(key, 'true'); // mark as handled
            return;
        }

        const summary = `
🌅 *ملخص اليوم في كارڤ (Carv)* 🇪🇬
📅 ${today}

📊 عدد الأحداث: ${todaysEvents.length}

${todaysEvents.slice(0, 5).map(e => `🔹 ${e.title}`).join('\n')}

💡 (للمزيد تابع التحديثات اللحظية)
`.trim();

        await this.bot.telegram.sendMessage(this.targetChatId, summary, { parse_mode: 'Markdown' });
        await this.storage.setConfig(key, 'true');
    }

    private async checkWeeklyOutlook(now: Date) {
        const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday
        if (day !== 1) return; // Only Monday

        const today = now.toISOString().split('T')[0];
        const key = `weekly_outlook_${today}`;
        const sent = await this.storage.getConfig(key);

        if (sent) return;
        if (now.getUTCHours() < 9) return;

        console.log('Generating Weekly Outlook...');

        const summary = `
📅 *النظرة الأسبوعية* 🇪🇬
بداية أسبوع جديد! 🚀

نتوقع نشاط عالي على شبكة Base هذا الأسبوع.
تابعو التحديثات.
`.trim();

        await this.bot.telegram.sendMessage(this.targetChatId, summary, { parse_mode: 'Markdown' });
        await this.storage.setConfig(key, 'true');
    }
}
