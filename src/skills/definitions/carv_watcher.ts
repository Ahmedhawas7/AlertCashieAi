import { Context } from 'telegraf';

export const spec = {
    name: 'carv_watcher',
    description: 'Analyzes CARV protocol activity/url.',
    inputSchema: {
        type: 'object',
        properties: {
            content: { type: 'string' }
        },
        required: ['content']
    }
};

export async function run(ctx: Context, { content }: { content: string }) {
    return {
        summary: 'CARV Protocol Analysis',
        action_items: [
            'Check Soul Drop',
            'Mint Badge'
        ],
        priority: 'HIGH'
    };
}
