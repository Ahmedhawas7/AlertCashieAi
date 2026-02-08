const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    logger.warn('Supabase URL or Key is missing. Memory features will be disabled.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Core DB Functions ---

async function connectDB() {
    // Check connection by a simple query
    try {
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        if (error) {
            // If table doesn't exist, we might get an error, but that implies connection is ok-ish.
            // If connection fails, error will be network related.
            if (error.code === 'PGRST116' || error.code === '42P01') {
                // 42P01 is undefined_table, means connection is OK but table missing
                logger.info('✅ Supabase connected (Tables might be missing)');
            } else {
                logger.error('❌ Supabase connection error:', error.message);
                throw error;
            }
        } else {
            logger.info('✅ Supabase connected successfully');
        }
    } catch (err) {
        logger.error('❌ Supabase connection failure:', err.message);
        // We don't crash the bot, just log.
    }
}

module.exports = {
    supabase,
    connectDB
};
