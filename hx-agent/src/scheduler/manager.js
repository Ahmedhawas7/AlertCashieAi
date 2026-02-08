const { scheduleJob } = require('./runner');
const { supabase } = require('../memory/supabase');
const logger = require('../utils/logger');

async function addJob(chatId, skillName, schedule, params = {}) {
    // 1. Add to DB
    if (!supabase) return { success: false, message: 'DB not connected' };

    try {
        const { data, error } = await supabase
            .from('jobs')
            .insert({
                skill_name: skillName,
                schedule,
                params,
                target_chat_id: chatId,
                active: true
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Schedule in memory
        scheduleJob(data);
        return { success: true, jobId: data.id };
    } catch (err) {
        logger.error('Failed to add job', err);
        return { success: false, message: err.message };
    }
}

async function listJobs(chatId) {
    if (!supabase) return [];
    try {
        const { data } = await supabase
            .from('jobs')
            .select('*')
            .eq('target_chat_id', chatId);
        return data || [];
    } catch (err) {
        return [];
    }
}

module.exports = { addJob, listJobs };
