const { supabase } = require('../memory/supabase');
const logger = require('../utils/logger');
const { getAllSkills } = require('./loader');

async function syncSkillsToDB() {
    if (!supabase) return;

    const skills = getAllSkills();
    logger.info('Syncing skills to DB...');

    for (const skill of skills) {
        try {
            const { error } = await supabase
                .from('skills_registry')
                .upsert({
                    name: skill.name,
                    description: skill.description,
                    parameters: skill.parameters, // Stored as JSONB
                    updated_at: new Date()
                }, { onConflict: 'name' });

            if (error && error.code !== '42P01') {
                logger.warn(`Failed to sync skill ${skill.name}`, error);
            }
        } catch (err) {
            logger.warn(`Error syncing skill ${skill.name}`, err);
        }
    }
}

module.exports = { syncSkillsToDB };
