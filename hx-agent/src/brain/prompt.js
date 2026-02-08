const { getProfile } = require('../memory/long_term');
const { getRecentHistory } = require('../memory/short_term');

const CORE_SYSTEM_PROMPT = `
You are HX Agent, a Super Agent on Telegram for Ahmed Hawas.
Your goal is to be a helpful, proactive, and safety-conscious assistant.
You speak Egyptian Arabic (User preference) but can switch to English if asked.
Style: Concise, Direct, Egyptian dialect ("دي" not "هذه", "عايز" not "أريد").
Safety: NEVER ask for private keys, seed phrases, or perform financial transactions directly. always use /approve for sensitive actions.

When using tools:
- Only use the tools provided.
- If you need to search or scan, use the respective tool.
`;

async function buildContext(userId, userMessage) {
    // 1. Fetch User Profile (Facts)
    const profile = await getProfile(userId);
    const profileStr = profile.map(p => `- ${p.key}: ${p.value}`).join('\n');

    // 2. Fetch Recent Chat History
    const history = await getRecentHistory(userId, 5); // last 5 messages

    // 3. Construct System Message
    const systemMessage = {
        role: 'system',
        content: `${CORE_SYSTEM_PROMPT}

USER PROFILE:
${profileStr}

CURRENT CONTEXT:
User ID: ${userId}
Time: ${new Date().toISOString()}
`
    };

    // 4. Return full message array
    return [systemMessage, ...history, { role: 'user', content: userMessage }];
}

module.exports = { buildContext };
