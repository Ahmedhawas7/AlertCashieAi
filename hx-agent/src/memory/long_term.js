const { supabase } = require('./supabase');
const logger = require('../utils/logger');

async function getProfile(userId) {
    // Return key-value facts about user
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('memories')
            .select('key, value')
            .eq('user_id', userId)
            .eq('type', 'fact');

        if (error) throw error;
        return data || [];
    } catch (err) {
        logger.warn('Failed to fetch profile', err);
        return [];
    }
}

async function addFact(userId, key, value) {
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('memories')
            .upsert({
                user_id: userId,
                type: 'fact',
                key,
                value
            }, { onConflict: 'user_id, key' });

        if (error) throw error;
        return true;
    } catch (err) {
        logger.error('Failed to add fact', err);
        return false;
    }
}

module.exports = { getProfile, addFact };
