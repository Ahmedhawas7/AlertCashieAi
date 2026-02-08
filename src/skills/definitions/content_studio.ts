import { Context } from 'telegraf';

export const spec = {
    name: 'content_studio',
    description: 'Generates drafts for Telegram posts or user content.',
    inputSchema: {
        type: 'object',
        properties: {
            topic: { type: 'string' },
            platform: { type: 'string', enum: ['telegram', 'twitter'], default: 'telegram' }
        },
        required: ['topic']
    }
};

export async function run(ctx: Context, { topic, platform }: { topic: string, platform: string }) {
    const safeTopic = topic.replace(/ /g, '');
    const draft = `Here is a draft for ${platform} about ${topic}:\n\n🚀 Exciting update on ${topic}!\n\n#${safeTopic}`;
    return {
        draft,
        tone: 'Persuasive'
    };
}
