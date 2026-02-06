import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { StorageService } from './services/storage';
import { RPCService } from './services/rpc';
import { MediumWatcher } from './watchers/mediumWatcher';
import { BaseLogsWatcher } from './watchers/baseLogsWatcher';
import { DigestService } from './services/digest';

dotenv.config();

async function run() {
    // 10. Startup Verification Log
    console.log('🤖 AlertAi initialized');

    const start = Date.now();
    const storage = new StorageService();

    // Validate secrets
    const requiredEnvVars = ['BOT_TOKEN', 'TELEGRAM_TARGET_CHAT_ID', 'DATABASE_URL'];
    const missingVars = requiredEnvVars.filter(key => !process.env[key]);

    if (missingVars.length > 0) {
        console.error(`❌ Missing required env vars: ${missingVars.join(', ')}`);
        process.exit(1);
    }

    const bot = new Telegraf(process.env.BOT_TOKEN!);
    const rpc = new RPCService(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
    const targetChatId = process.env.TELEGRAM_TARGET_CHAT_ID!;

    // Heartbeat check
    if (process.env.SEND_HEARTBEAT === '1') {
        try {
            console.log('💓 Sending heartbeat...');
            await bot.telegram.sendMessage(targetChatId, '✅ AlertAi runner is alive (manual test)');
        } catch (e) {
            console.error('❌ Heartbeat failed:', e);
        }
    }

    try {
        console.log('🔌 Database connected');
        console.log('🔌 Runner executing watchers');

        // Initialize Watchers (No user seeding needed, direct send)
        const mediumWatcher = new MediumWatcher(
            bot,
            storage,
            process.env.MEDIUM_RSS_URL || 'https://medium.com/feed/@Carv',
            targetChatId
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
            ],
            targetChatId
        );

        // Digest Service
        const digest = new DigestService(storage, bot, targetChatId);

        // Run polling in parallel (One-Shot)
        await Promise.all([
            mediumWatcher.poll(),
            baseWatcher.poll(),
            digest.runCycles()
        ]);

        console.log('✅ AlertAi online cycle completed successfully');
        console.log('✅ Runner completed successfully');
        console.log(`⏱️ Duration: ${(Date.now() - start) / 1000}s`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Runner failed:', error);
        // Log to console is enough for GitHub Actions visibility
        process.exit(1);
    }
}

run();
