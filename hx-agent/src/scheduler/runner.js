const cron = require('node-cron');
const { supabase } = require('../memory/supabase');
const logger = require('../utils/logger');
const { getSkill } = require('../skills/loader');

// Store active cron tasks in memory
const activeTasks = new Map();

async function initScheduler() {
    logger.info('⏰ Scheduler initializing...');

    // 1. Load jobs from DB
    // Assuming 'jobs' table has: id, schedule, skill_name, params (json), active (bool)
    if (!supabase) return;

    try {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('active', true);

        if (error && error.code !== '42P01') { // Ignore missing table error
            logger.error('Failed to load jobs', error);
            return;
        }

        if (jobs) {
            jobs.forEach(job => scheduleJob(job));
            logger.info(\`Loaded \${jobs.length} scheduled jobs.\`);
        }
    } catch (err) {
        logger.warn('Scheduler load failed:', err);
    }
}

function scheduleJob(job) {
    // 1. Validate schedule
    if (!cron.validate(job.schedule)) {
        logger.error(\`Invalid schedule for job \${job.id}\`);
        return;
    }

    // 2. Schedule
    const task = cron.schedule(job.schedule, async () => {
        logger.info(\`Running scheduled job: \${job.skill_name}\`);
        const skill = getSkill(job.skill_name);
        
        if (skill) {
            try {
                // Mock context for scheduler
                const ctx = {
                    telegram: require('../bot').bot.telegram,
                    reply: (msg) => console.log('Job Output:', msg) // Need channel ID to reply real
                };
                
                // If job has a target_chat_id, use it
                if (job.target_chat_id) {
                    ctx.reply = (msg) => ctx.telegram.sendMessage(job.target_chat_id, msg);
                }

                await skill.run(ctx, job.params || {});
            } catch (err) {
                logger.error(\`Job \${job.id} failed:\`, err);
            }
        }
    });

    activeTasks.set(job.id, task);
}

module.exports = { initScheduler, scheduleJob };
