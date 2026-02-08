import { Context } from 'telegraf';
import { StorageService } from '../../services/storage';

// We might need to inject storage here or pass it in context
// For now, we assume pure function or context has it

export const spec = {
    name: 'task_planner',
    description: 'Creates or updates a weekly plan.',
    inputSchema: {
        type: 'object',
        properties: {
            goals: { type: 'array', items: { type: 'string' } }
        }
    }
};

export async function run(ctx: Context, { goals }: { goals: string[] }) {
    const plan = goals.map(g => ({
        task: g,
        status: 'pending'
    }));

    return {
        week_plan: plan,
        message: 'Plan created.'
    };
}
