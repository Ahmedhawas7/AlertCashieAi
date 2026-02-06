import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { StorageService } from './services/storage';
import { RPCService } from './services/rpc';
import { MediumWatcher } from './watchers/mediumWatcher';
import { BaseLogsWatcher } from './watchers/baseLogsWatcher';
import { setupHandlers } from './bot/handlers';
import { AIService } from './services/ai';
import { ReminderService } from './services/reminder';

import { MemoryStore } from './memory/memoryStore';
import { MemorySearch } from './memory/memorySearch';
import { MemorySummaries } from './memory/memorySummaries';
import { HealthServer } from './server';
import { BackupService } from './services/backup';
import { DailyDigestScheduler } from './scheduler/dailyDigest';

dotenv.config();

async function bootstrap() {
    console.log('🚀 Starting Proactive Cashie Watcher Bot...');

    const storage = new StorageService();
    const rpc = new RPCService(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
    const bot = new Telegraf(process.env.BOT_TOKEN!);
    const ai = new AIService(process.env.GEMINI_API_KEY, storage);

    // Initialize AI (load settings)
    await ai.init();

    // memU-style Memory
    const memory = new MemoryStore();
    const search = new MemorySearch(memory);
    const summaries = new MemorySummaries(storage, memory);

    // Infrastructure
    const server = new HealthServer(storage);
    const backup = new BackupService(bot, storage);
    const scheduler = new DailyDigestScheduler(bot, storage, memory);

    setupHandlers(bot, storage, ai, memory, search, summaries, backup, scheduler);

    const mediumWatcher = new MediumWatcher(
        bot,
        storage,
        process.env.MEDIUM_RSS_URL || 'https://medium.com/feed/@carv_official'
    );

    const baseWatcher = new BaseLogsWatcher(
        bot,
        rpc,
        storage,
        [
            '0xc08Cd26474722cE93F4D0c34D16201461c10AA8C', // CARV token
            '0x584cB7Dae5158be594AA1022Fb38017C791af2A0', // veCARV Airdrop
            '0x1fab4B4B691a86bb16c296cC06E8cf0c12695B8E', // Protocol Service
            '0xa91fF8b606BA57D8c6638Dd8CF3FC7eB15a9c634', // Proxy
        ]
        // targetChatId is undefined in bot mode (broadcasts to all users)
    );

    const reminder = new ReminderService(bot, (process.env.TELEGRAM_ADMIN_IDS || '').split(',')[0]);
    reminder.startPeriodicCheckIn();

    // Start Core Services
    server.start();
    scheduler.start();

    // Initial Insight Generation
    summaries.generateInsights().catch(e => console.error('Initial insights failed:', e));

    // Polling loops
    const interval = (parseInt(process.env.POLL_INTERVAL_SECONDS || '60')) * 1000;
    let lastWatcherSuccess = Date.now();

    // Watchdog
    setInterval(() => {
        if (Date.now() - lastWatcherSuccess > 10 * 60 * 1000) {
            console.error('🚨 Watchdog: No successful cycle for 10m. Exiting.');
            process.exit(1);
        }
    }, 60000);

    setInterval(async () => {
        try {
            const start = Date.now();
            await mediumWatcher.poll();
            const rpcStart = Date.now();
            await baseWatcher.poll();
            const rpcEnd = Date.now();

            lastWatcherSuccess = Date.now();

            await summaries.generateInsights();

            // Update Health Server Metrics
            const rpcState = await storage.getWatcherState('base_logs');
            const mediumState = await storage.getWatcherState('medium_rss');
            server.setMetrics({
                lastBlock: rpcState?.lastBlock || undefined,
                lastRssGuid: mediumState?.lastSeen || undefined,
                rpcLatencyMs: rpcEnd - rpcStart
            });

        } catch (e) {
            await storage.logError('Polling loop error', (e as any).stack);
        }
    }, interval);

    bot.launch();
    console.log('✅ Bot is online and proactive.');

    // Global Error Handling
    process.on('unhandledRejection', (reason, promise) => {
        storage.logError(`Unhandled Rejection`, String(reason));
    });

    process.on('uncaughtException', (error) => {
        storage.logError(`Uncaught Exception`, error.stack).then(() => {
            process.exit(1); // Force restart by host
        });
    });

    // Enable graceful stop
    process.once('SIGINT', () => {
        bot.stop('SIGINT');
        process.exit(0);
    });
    process.once('SIGTERM', () => {
        bot.stop('SIGTERM');
        process.exit(0);
    });
}

bootstrap().catch(console.error);
