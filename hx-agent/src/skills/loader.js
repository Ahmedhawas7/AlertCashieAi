const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Global registry of loaded skills
const skillsRegistry = new Map();

async function initSkills() {
    logger.info('🧩 Loading Skills...');
    const skillsDir = path.join(__dirname, 'definitions');

    try {
        if (!fs.existsSync(skillsDir)) {
            logger.warn('Skills directory not found, creating...');
            fs.mkdirSync(skillsDir, { recursive: true });
        }

        const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.js'));

        for (const file of files) {
            try {
                const skill = require(path.join(skillsDir, file));

                // Validate skill structure
                if (!skill.spec || !skill.spec.name || typeof skill.run !== 'function') {
                    logger.warn(`Skipping invalid skill file: ${file}`);
                    continue;
                }

                skillsRegistry.set(skill.spec.name, skill);
                logger.info(`✅ Loaded skill: ${skill.spec.name}`);
            } catch (err) {
                logger.error(`Failed to load skill ${file}:`, err);
            }
        }

    } catch (err) {
        logger.error('Error initializing skills:', err);
    }
}

function getSkill(name) {
    return skillsRegistry.get(name);
}

function getAllSkills() {
    return Array.from(skillsRegistry.values()).map(s => s.spec);
}

// Convert skills to OpenAI Tool format
function getToolsForLLM() {
    return Array.from(skillsRegistry.values()).map(skill => ({
        type: 'function',
        function: {
            name: skill.spec.name,
            description: skill.spec.description,
            parameters: skill.spec.parameters || { type: 'object', properties: {} }
        }
    }));
}

module.exports = { initSkills, getSkill, getAllSkills, getToolsForLLM };
