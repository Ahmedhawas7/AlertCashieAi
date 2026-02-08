require('dotenv').config();
const { startBot } = require('./bot');
const { initScheduler } = require('./scheduler/runner');
const { initSkills } = require('./skills/loader');
const { syncSkillsToDB } = require('./skills/registry');
const logger = require('./utils/logger');
const { connectDB } = require('./memory/supabase');

async function main() {
    try {
        logger.info('🚀 Starting HX Agent...');

        // 1. Initialize DB
        await connectDB();

        // 2. Load Skills
        await initSkills();
        await syncSkillsToDB();

        // 3. Start Scheduler
        await initScheduler();

        // 4. Start Bot
        await startBot();

        logger.info('✅ HX Agent is online and running!');
    } catch (error) {
        logger.error('❌ Fatal error during startup:', error);
        process.exit(1);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

main();
