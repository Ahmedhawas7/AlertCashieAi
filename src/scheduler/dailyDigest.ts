import { Telegraf } from 'telegraf';
import { StorageService } from '../services/storage';
import { MemoryStore } from '../memory/memoryStore';

export class DailyDigestScheduler {
    private bot: Telegraf;
    private storage: StorageService;
    private memory: MemoryStore;
    private checkInterval: NodeJS.Timeout | null = null;

    constructor(bot: Telegraf, storage: StorageService, memory: MemoryStore) {
        this.bot = bot;
        this.storage = storage;
        this.memory = memory;
    }

    public start() {
        console.log('⏰ Daily Digest Scheduler started (Target: 09:00 Cairo)');
        // Check every minute
        this.checkInterval = setInterval(() => this.tick(), 60 * 1000);
        // Run once immediately to check if we missed today's digest
        this.tick();
    }

    private async tick() {
        const now = new Date();
        // Cairo is UTC+2
        const cairoTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
        const hours = cairoTime.getUTCHours();
        const minutes = cairoTime.getUTCMinutes();
        const todayStr = cairoTime.toISOString().split('T')[0];

        if (hours === 9 && minutes === 0) {
            const lastRun = await this.storage.getConfig('last_daily_digest');
            if (lastRun !== todayStr) {
                await this.generateAndSendDigest(todayStr);
            }
        }
    }

    public async generateAndSendDigest(dateStr: string) {
        console.log(`📊 Generating daily digest for ${dateStr}...`);

        const recentEvents = await this.storage.getLatestEvents(50);
        const stats = await this.storage.getStats();

        // Filter for last 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dailyEvents = recentEvents.filter(e => e.timestamp > yesterday);

        if (dailyEvents.length === 0) {
            console.log('No events to digest today.');
            await this.storage.setConfig('last_daily_digest', dateStr);
            return;
        }

        const top3 = dailyEvents.slice(0, 3);
        const categories = dailyEvents.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        let message = `🌅 *Daily Cashie Digest - ${dateStr}*\n\n`;
        message += `📈 *Summary (24h):*\n`;
        for (const [type, count] of Object.entries(categories)) {
            message += `- ${type}: ${count} events\n`;
        }

        message += `\n🔥 *Top Highlights:*\n`;
        top3.forEach((e, i) => {
            message += `${i + 1}. [${e.title}](${e.sourceUrl || '#'}) (${e.type})\n`;
        });

        message += `\n💡 *Suggested Actions:*\n`;
        message += `- 📝 Creator: Summarize the top highlights into an X thread.\n`;
        message += `- 🛠 Dev: Monitor RPC latency if error counts increased.\n`;

        const chatId = process.env.TELEGRAM_TARGET_CHAT_ID;
        if (chatId) {
            try {
                await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown', link_preview: { is_disabled: true } } as any);
                await this.storage.setConfig('last_daily_digest', dateStr);
                await this.memory.append('events', 'daily-digests', `Sent digest for ${dateStr}. Highlights: ${top3.map(t => t.title).join(', ')}`);
            } catch (e) {
                console.error('Failed to send daily digest:', (e as any).message);
            }
        }
    }
}
