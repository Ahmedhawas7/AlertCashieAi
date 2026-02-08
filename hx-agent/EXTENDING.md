# Extending HX Agent Skills 🧩

HX Agent uses a simple folder-based plugin system.

## 1. Create a Skill File
Create a new `.js` file in `src/skills/definitions/`.
Example: `weather.js`

\`\`\`javascript
module.exports = {
    spec: {
        name: 'get_weather', // Unique name (snake_case)
        description: 'Get current weather for a city',
        parameters: { // JSON Schema for LLM
            type: 'object',
            properties: {
                city: { type: 'string', description: 'City name' }
            },
            required: ['city']
        }
    },
    run: async (ctx, { city }) => {
        // 1. Perform logic (fetch API, etc.)
        const temp = 25; // Mock
        
        // 2. Return JSON result
        return {
            city,
            temperature: temp,
            condition: 'Sunny'
        };
    }
};
\`\`\`

## 2. Restart Bot
The bot loads skills on startup.
\`\`\`bash
npm start
\`\`\`

## 3. Test
Ask the bot: "What's the weather in Cairo?"
The Brain will automatically select your tool! 🧠

## Safety & Approvals
For sensitive actions (like posting content or moving funds), require approval:

\`\`\`javascript
run: async (ctx, args) => {
    const { createApprovalRequest } = require('../../security/approval');
    
    // Generate token
    const token = createApprovalRequest(ctx.from.id, 'move_funds', args);
    
    return {
        status: 'PENDING_APPROVAL',
        message: \`Please type /approve \${token} to confirm this action.\`
    };
}
\`\`\`
