import { Telegraf, Context, Markup } from 'telegraf';
import { StorageService } from '../services/storage';
import { AIService } from '../services/ai';
import { MemoryStore } from '../memory/memoryStore';
import { Agent } from '../brain/agent';
import { SkillLoader } from '../skills/loader';

export function setupHandlers(
    bot: Telegraf,
    storage: StorageService,
    ai: AIService,
    memory: MemoryStore,
    skillLoader: SkillLoader,
    agent: Agent
) {
    const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',');
    const isAdmin = (ctx: Context) => adminIds.includes(ctx.from?.id.toString() || '');

    // --- Core Commands ---

    bot.start(async (ctx) => {
        await ctx.reply("🚀 HX Agent Online. I am your Super Agent.\nTry /help or ask me anything.");
    });

    bot.command('help', async (ctx) => {
        await ctx.reply(`
commands:
/scan <url> - Security check
/wallet <chain> <addr> - Risk check
/plan - Weekly plan
/brain - AI status
/skills - List skills
/status - System Health
        `);
    });

    // --- Agent Turn ---

    bot.on('text', async (ctx) => {
        if (ctx.message.text.startsWith('/')) return; // Ignore commands

        try {
            await ctx.sendChatAction('typing');

            // Pass to Agent
            const response = await agent.processMessage(ctx, ctx.from.id.toString(), ctx.message.text);

            await ctx.reply(response, { parse_mode: 'Markdown' });

            // Auto-memorize interaction (Simplified)
            // await memory.append('history', `chat_${ctx.from.id}`, `User: ${ctx.message.text}\nAgent: ${response}`);

        } catch (e) {
            console.error(e);
            await ctx.reply("⚠️ Error processing request.");
        }
    });

    // --- Skills & Admin ---

    bot.command('skills', (ctx) => {
        const desc = skillLoader.getSkillsDescription();
        ctx.reply(`🧩 *Available Skills:*\n\n${desc}`, { parse_mode: 'Markdown' });
    });

    bot.command('scan', async (ctx) => {
        const url = ctx.message.text.split(' ')[1];
        if (!url) return ctx.reply("Usage: /scan <url>");
        // Trigger agent specific skill or direct
        const result = await skillLoader.execute('link_scanner', { url }, ctx);
        ctx.reply(`🔍 Scan Result:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    });

    bot.command('wallet', async (ctx) => {
        const parts = ctx.message.text.split(' ');
        if (parts.length < 3) return ctx.reply("Usage: /wallet <chain> <address>");
        const result = await skillLoader.execute('wallet_readonly_analyzer', { chain: parts[1], address: parts[2] }, ctx);
        ctx.reply(`🏦 Wallet Analysis:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    });

    // --- Legacy / Status ---

    bot.command('status', async (ctx) => {
        const stats = await storage.getStats();
        ctx.reply(`📊 *Status*\nEvents: ${stats.eventCount}\nAI: ${ai.isAIEnabled}`, { parse_mode: 'Markdown' });
    });

    bot.command('brain', async (ctx) => {
        if (!isAdmin(ctx)) return;
        const arg = ctx.message.text.split(' ')[1];
        if (arg === 'on') await ai.toggleAI(true);
        else if (arg === 'off') await ai.toggleAI(false);
        ctx.reply(`🧠 Brain is now ${ai.isAIEnabled ? 'ON' : 'OFF'}`);
    });
}
