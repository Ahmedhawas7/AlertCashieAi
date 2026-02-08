const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
    apiKey: process.env.LLM_API_KEY || 'sk-stub',
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
});

const MODEL = process.env.LLM_MODEL || 'gpt-3.5-turbo';

async function generateCompletion(messages, tools = []) {
    try {
        // Filter out system messages if model doesn't support them (DeepSeek usually does)
        const params = {
            model: MODEL,
            messages: messages,
            temperature: 0.7,
        };

        if (tools.length > 0) {
            params.tools = tools;
            params.tool_choice = 'auto';
        }

        const completion = await openai.chat.completions.create(params);
        return completion.choices[0].message;
    } catch (error) {
        logger.error('LLM Generation Error:', error);
        return { content: 'Sorry, my brain is offline momentarily.' };
    }
}

module.exports = {
    generateCompletion,
    openai
};
