module.exports = {
    spec: {
        name: 'task_planner',
        description: 'Creates or updates a weekly plan.',
        parameters: {
            type: 'object',
            properties: {
                goals: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of goals for the week'
                }
            }
        }
    },
    run: async (ctx, { goals }) => {
        const plan = goals.map(g => ({
            task: g,
            status: 'pending',
            day: 'Flexible'
        }));

        return {
            week_plan: plan,
            message: 'Plan created successfully. Use /plan to view.'
        };
    }
};
