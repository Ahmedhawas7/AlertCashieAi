import { StorageService } from '../services/storage';
import { Telegraf } from 'telegraf';
import { MemoryStore } from '../memory/memoryStore';
import cron, { ScheduledTask } from 'node-cron';

export class SchedulerService {
    private storage: StorageService;
    private bot: Telegraf;
    private memory: MemoryStore;
    private tasks: Map<number, ScheduledTask> = new Map();

    constructor(bot: Telegraf, storage: StorageService, memory: MemoryStore) {
        this.bot = bot;
        this.storage = storage;
        this.memory = memory;
    }

    async start() {
        console.log('⏳ Scheduler Service Starting...');

        // Load active jobs from DB
        await this.refreshJobs();

        // Watchdog to refresh jobs every 5 minutes (in case of manual DB updates)
        setInterval(() => this.refreshJobs(), 5 * 60 * 1000);
    }

    async refreshJobs() {
        // Fetch all active jobs
        // Since Prisma was updated, we need to cast or ensure types are generated
        // We use 'any' here if types aren't fully perfectly aligned yet in IDE context
        const jobs = await (this.storage as any).getJobs();

        for (const job of jobs) {
            if (this.tasks.has(job.id)) {
                this.tasks.get(job.id)?.stop();
                this.tasks.delete(job.id);
            }

            if (job.active && job.cron) {
                console.log(`📅 Scheduling Job #${job.id} (${job.type}): ${job.cron}`);
                const task = cron.schedule(job.cron, () => this.executeJob(job));
                this.tasks.set(job.id, task);
            }
        }
    }

    async executeJob(job: any) {
        console.log(`▶️ Executing Job #${job.id} (${job.type})`);

        try {
            if (job.type === 'digest') {
                // Logic from dailyDigest.ts
                const chatId = job.data ? JSON.parse(job.data).chatId : process.env.TELEGRAM_ADMIN_IDS?.split(',')[0];
                if (chatId) {
                    const today = new Date().toISOString().split('T')[0];
                    const insights = await this.memory.read('insights', 'patterns') || "No insights.";
                    await this.bot.telegram.sendMessage(chatId, `🌅 **Daily Digest**\n\n${insights}`, { parse_mode: 'Markdown' });
                }
            }
            // Add other job types here

            // Update last run
            await (this.storage as any).updateJob(job.id, { lastRun: new Date() });

        } catch (e) {
            console.error(`Error executing job #${job.id}`, e);
        }
    }
}
