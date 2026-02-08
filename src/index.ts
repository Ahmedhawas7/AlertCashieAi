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
import { SchedulerService } from './scheduler';
import { Agent } from './brain/agent';
import { SkillLoader } from './skills/loader';

dotenv.config();

async function bootstrap() {
    console.log('🚀 Starting HX Super Agent...');

    const storage = new StorageService();
    const rpc = new RPCService(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
    const bot = new Telegraf(process.env.BOT_TOKEN!);
    // Pass API key if using Gemini default, otherwise AI Service picks up env types
    const ai = new AIService(process.env.GEMINI_API_KEY, storage);

    // Initialize AI
    await ai.init();

    // Skills & Brain
    const skillLoader = new SkillLoader();
    const agent = new Agent(ai, storage, skillLoader);

    // Memory
    const memory = new MemoryStore();
    const search = new MemorySearch(memory);
    const summaries = new MemorySummaries(storage, memory);

    // Infrastructure
    const server = new HealthServer(storage);
    const backup = new BackupService(bot, storage);
    const scheduler = new SchedulerService(bot, storage, memory);

    // Setup Handlers (Injected)
    // We pass scheduler as 'any' or refactor handlers to accept SchedulerService
    setupHandlers(bot, storage, ai, memory, skillLoader, agent);

    // Watchers
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
        ]
    );

    const reminder = new ReminderService(bot, (process.env.TELEGRAM_ADMIN_IDS || '').split(',')[0]);
    reminder.startPeriodicCheckIn();

    // Start Services
    server.start();
    scheduler.start();

    // Polling Logic
    const interval = (parseInt(process.env.POLL_INTERVAL_SECONDS || '60')) * 1000;

    setInterval(async () => {
        try {
            await mediumWatcher.poll();
            await baseWatcher.poll();
        } catch (e) {
            console.error('Polling Error', e);
        }
    }, interval);

    bot.launch();
    console.log('✅ HX Agent is online.');

    // Graceful Stop
    process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
    process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

bootstrap().catch(console.error);
