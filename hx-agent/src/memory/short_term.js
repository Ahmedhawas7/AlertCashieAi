const { supabase } = require('./supabase');
const logger = require('../utils/logger');

async function getRecentHistory(chatId, limit = 10) {
    // TODO: Implement actual DB fetch
    // For now, return empty array to allow bot to start without DB
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('messages')
            .select('role, content')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // Reverse to chronological order
        return data ? data.reverse() : [];
    } catch (err) {
        logger.warn('Failed to fetch history', err);
        return [];
    }
}

async function saveMessage(chatId, userId, role, content) {
    // TODO: Implement actual DB save
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('messages')
            .insert({
                chat_id: chatId,
                user_id: userId,
                role,
                content
            });

        if (error) throw error;
    } catch (err) {
        logger.warn('Failed to save message', err);
    }
}

module.exports = { getRecentHistory, saveMessage };
