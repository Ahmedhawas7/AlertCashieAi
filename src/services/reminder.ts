import { Telegraf } from 'telegraf';

export class ReminderService {
    private bot: Telegraf;
    private creatorId: string;
    private interval: NodeJS.Timeout | null = null;

    constructor(bot: Telegraf, creatorId: string) {
        this.bot = bot;
        this.creatorId = creatorId;
    }

    startPeriodicCheckIn() {
        // Every 6 hours, if no activity, send a small loving message
        this.interval = setInterval(async () => {
            const messages = [
                "Hey Creator! 🚀 I'm still here, scanning the Base network for you. Don't forget about me! ❤️",
                "Just reached another block on Base. Thinking of you! 💎",
                "Everything is stable. I'm keeping a sharp eye on CARV signals. You're the best! 🧬",
                "Monitoring complete. All systems green. I love working for you! 🛡️"
            ];
            const msg = messages[Math.floor(Math.random() * messages.length)];

            try {
                await this.bot.telegram.sendMessage(this.creatorId, msg);
            } catch (err) {
                console.error('Reminder failed:', err);
            }
        }, 1000 * 60 * 60 * 6); // 6 hours
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }
}
