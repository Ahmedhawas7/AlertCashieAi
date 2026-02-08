module.exports = {
    spec: {
        name: 'content_studio',
        description: 'Generates drafts for Telegram posts or Tweets based on a topic.',
        parameters: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'Topic to write about'
                },
                platform: {
                    type: 'string',
                    enum: ['telegram', 'twitter'],
                    default: 'telegram'
                }
            },
            required: ['topic']
        }
    },
    run: async (ctx, { topic, platform }) => {
        // In real app, this might call a sub-LLM or specialized prompt
        // For now, we return a structured object for the main brain to present

        const safeTopic = topic.replace(/ /g, '');
        const draftText = `Here is a draft for ${platform} about ${topic}:\n\n🚀 Exciting news about ${topic}!\n\nDon't miss out. #${safeTopic}`;

        return {
            draft: draftText,
            tone: 'Persuasive'
        };
    }
};
