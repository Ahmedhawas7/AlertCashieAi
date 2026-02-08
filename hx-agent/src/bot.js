const { Telegraf } = require('telegraf');
const logger = require('./utils/logger');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Middleware to log incoming messages
bot.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    if (ctx.message) {
        logger.info('Message processed', {
            user_id: ctx.from.id,
            username: ctx.from.username,
            text: ctx.message.text,
            duration: ms
        });
    }
});

// Basic Commands
bot.command('start', (ctx) => {
    ctx.reply('Welcome to HX Agent! 🚀\nI am your always-on assistant.\nType /help to see what I can do.');
});

bot.command('help', (ctx) => {
    ctx.reply(`
Available Commands:
/start - Start the bot
/help - Show this help
/mode <focus|casual|work> - Change my personality
/carv - CARV updates
/scan <url> - Security scan a link
/wallet <chain> <address> - Analyze a wallet
/plan - Weekly task plan
/draft <topic> - Draft content
/skills - List skills
/jobs - specific scheduled jobs
/approve <token> - Approve sensitive actions
    `);
});

// Launch function
async function startBot() {
    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    const { getToolsForLLM, getSkill } = require('./skills/loader');

    // Message Handler (The Brain)
    bot.on('message', async (ctx) => {
        // Ignore non-text messages for now
        if (!ctx.message.text) return;

        // Ignore commands (handled by bot.command)
        if (ctx.message.text.startsWith('/')) return;

        try {
            const userId = ctx.from.id;
            const userMessage = ctx.message.text;

            // 1. Build Context
            const { buildContext } = require('./brain/prompt');
            let messages = await buildContext(userId, userMessage);

            // 2. Get Tools
            const tools = getToolsForLLM();

            // 3. Brain Loop (Max 3 turns)
            const { generateCompletion } = require('./brain/adapter');
            const MAX_TURNS = 3;
            let turn = 0;

            while (turn < MAX_TURNS) {
                turn++;
                const responseMessage = await generateCompletion(messages, tools);

                // If Text content, send it
                if (responseMessage.content) {
                    await ctx.reply(responseMessage.content);
                    // Log assistant message
                    messages.push(responseMessage);

                    // If no tool calls, we are done
                    if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
                        break;
                    }
                }

                // If Tool calls, execute them
                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    messages.push(responseMessage); // Add the assistant's request to history

                    for (const toolCall of responseMessage.tool_calls) {
                        const functionName = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments);

                        logger.info(`🛠 Executing Tool: ${functionName}`, args);
                        await ctx.reply(`⚡ Running ${functionName}...`);

                        const skill = getSkill(functionName);
                        let toolResult;

                        if (skill) {
                            try {
                                // Pass context to skill
                                toolResult = await skill.run(ctx, args);
                            } catch (err) {
                                toolResult = { error: err.message };
                            }
                        } else {
                            toolResult = { error: 'Skill not found' };
                        }

                        // Add tool result to messages
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(toolResult)
                        });
                    }
                } else {
                    // No tool calls, loop ends
                    break;
                }
            }

            // 4. Save Interaction to Memory (Simplified)
            const { saveMessage } = require('./memory/short_term');
            await saveMessage(ctx.chat.id, userId, 'user', userMessage);

        } catch (error) {
            logger.error('Brain processing error:', error);
            ctx.reply('معلش، دماغي وجعاني شوية. جرب تاني بعدين.');
        }
    });

    await bot.launch();
    logger.info('Bot started successfully');
}

module.exports = { startBot, bot };
