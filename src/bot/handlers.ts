import { Telegraf, Context, Markup } from 'telegraf';
import { StorageService } from '../services/storage';
import { MessageFormatter } from '../services/formatter';
import { AIService } from '../services/ai';
import { MemoryStore } from '../memory/memoryStore';
import { MemorySearch } from '../memory/memorySearch';
import { MemorySummaries } from '../memory/memorySummaries';
import { BackupService } from '../services/backup';
import { DailyDigestScheduler } from '../scheduler/dailyDigest';
import fs from 'fs';
import path from 'path';

export function setupHandlers(
    bot: Telegraf,
    storage: StorageService,
    ai: AIService,
    memory: MemoryStore,
    search: MemorySearch,
    summaries: MemorySummaries,
    backup: BackupService,
    scheduler: DailyDigestScheduler
) {
    const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',');

    const isAdmin = (ctx: Context) => adminIds.includes(ctx.from?.id.toString() || '');

    bot.start(async (ctx) => {
        const isUserAdmin = isAdmin(ctx);
        await storage.saveUser(ctx.from.id.toString(), { isAdmin: isUserAdmin });
        await ctx.replyWithMarkdown(MessageFormatter.formatStart(isUserAdmin));
    });

    bot.command('status', async (ctx) => {
        const stats = await storage.getStats();
        const latestError = await storage.getLatestError();
        const focus = await storage.getConfig('admin_focus') || 'both';
        const mode = await storage.getConfig('alert_mode') || 'loud';
        const paused = (await storage.getConfig('watchers_paused')) === 'true';

        let message = `🩺 *AlertAi Health Status*\n\n`;
        message += `📊 *Stats:*\n`;
        message += `- Events Tracking: ${stats.eventCount}\n`;
        message += `- Active Users: ${stats.userCount}\n`;
        message += `- Total Errors: ${stats.errorCount}\n\n`;

        message += `⚙️ *Config:*\n`;
        message += `- Mode: ${mode === 'loud' ? '🔔 Loud' : '🤫 Silent'}\n`;
        message += `- Focus: ${focus.toUpperCase()}\n`;
        message += `- Status: ${paused ? '⏸ Paused' : '▶️ Running'}\n\n`;

        if (latestError) {
            message += `⚠️ *Last Error:*\n\`${latestError.message}\`\n_${latestError.timestamp.toISOString()}_\n`;
        }

        const buttons = [
            [
                Markup.button.callback(mode === 'loud' ? '🤫 Switch to Silent' : '🔔 Switch to Loud', 'toggle_mode'),
                Markup.button.callback(paused ? '▶️ Resume' : '⏸ Pause', 'toggle_pause')
            ],
            [
                Markup.button.callback('🩺 Refresh', 'refresh_status'),
                Markup.button.callback('💾 Backup Now', 'admin_backup_now')
            ]
        ];

        if (isAdmin(ctx)) {
            await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
        } else {
            await ctx.replyWithMarkdown(message);
        }
    });

    // Admin Toggles via Callback
    bot.action('toggle_mode', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.answerCbQuery('Admin only');
        const current = await storage.getConfig('alert_mode') || 'loud';
        const next = current === 'loud' ? 'silent' : 'loud';
        await storage.setConfig('alert_mode', next);
        await memory.append('admin', 'preferences', `Changed alert mode to ${next}`);
        await ctx.answerCbQuery(`Mode set to ${next}`);
        // Optionally update message
    });

    bot.action('toggle_pause', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.answerCbQuery('Admin only');
        const current = (await storage.getConfig('watchers_paused')) === 'true';
        const next = !current;
        await storage.setConfig('watchers_paused', next.toString());
        await memory.append('admin', 'preferences', `Watchers ${next ? 'paused' : 'resumed'}`);
        await ctx.answerCbQuery(`Watchers ${next ? 'paused' : 'resumed'}`);
    });

    bot.action('admin_backup_now', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.answerCbQuery('Admin only');
        await ctx.answerCbQuery('Starting backup...');
        await backup.performBackup();
    });

    bot.command('memory', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const files = memory.getAllMemoryFiles();
        let message = `🧠 *Proactive Memory FS*\n\n`;
        files.forEach(cat => {
            message += `📁 *${cat.category}/*: ${cat.files.length} files\n`;
            cat.files.forEach(f => message += `  - ${f}\n`);
        });
        await ctx.replyWithMarkdown(message);
    });

    bot.command('remember', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const note = ctx.message.text.replace('/remember', '').trim();
        if (!note) return ctx.reply('What should I remember? Usage: /remember <note>');
        await memory.append('admin', 'notes', note);
        await ctx.reply('✅ Note added to memory/admin/notes.md');
    });

    bot.command('forget', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const keyword = ctx.message.text.replace('/forget', '').trim();
        if (!keyword) return ctx.reply('What should I forget? Usage: /forget <keyword>');
        await memory.markDeprecated('admin', 'notes', keyword);
        await ctx.reply(`✅ Marked items containing "${keyword}" as [DEPRECATED]`);
    });

    bot.command('insights', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const content = await memory.read('insights', 'patterns');
        await ctx.replyWithMarkdown(`💡 *Recent Insights:*\n\n${content || 'No insights yet.'}`);
    });

    bot.command('digestnow', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const todayStr = new Date().toISOString().split('T')[0];
        await scheduler.generateAndSendDigest(todayStr);
    });

    bot.command('setfocus', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const focus = ctx.message.text.split(' ')[1] as 'creator' | 'dev' | 'both';
        if (!['creator', 'dev', 'both'].includes(focus)) {
            return ctx.reply('Usage: /setfocus creator|dev|both');
        }
        await storage.setConfig('admin_focus', focus);
        await memory.append('admin', 'preferences', `Admin focus set to ${focus}`);
        await ctx.reply(`🎯 Focus set to ${focus.toUpperCase()}`);
    });

    bot.command('backupnow', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        await backup.performBackup();
    });

    bot.command('backups', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const files = await backup.listBackups();
        await ctx.reply(`💾 *Recent Backups:*\n${files.join('\n')}`);
    });

    bot.command('latest', async (ctx) => {
        const events = await storage.getLatestEvents(5);
        if (events.length === 0) return ctx.reply('No recent events detected.');
        for (const event of events) {
            await ctx.replyWithMarkdown(MessageFormatter.formatEvent(event), { link_preview: { is_disabled: true } } as any);
        }
    });

    // Proactive QA using Memory (Offline-First, Optional AI)
    bot.command('ask', async (ctx) => {
        const query = ctx.message.text.replace('/ask', '').trim();
        if (!query) return ctx.reply('Please provide a question.');

        const offlineKnowledge = await summaries.getOfflineKnowledge(query);
        let response = "";

        // 1. Try Local Retrieval First
        const results = await search.search(query);
        const hasGoodMatch = results.length > 0; // Simple check, can be more sophisticated

        if (hasGoodMatch && !ai.isAIEnabled) {
            response = `🧠 **Local Memory Retrieval**\n\n`;
            results.slice(0, 3).forEach(r => response += `${r}\n\n`);
        } else {
            // 2. Ask AI (if enabled) OR Fallback
            const usage = await storage.getDailyAiUsage();
            response = await ai.ask(query, offlineKnowledge, usage);

            // 3. Auto-learn if valid AI response
            if (ai.isAutolearnEnabled && ai.isAIEnabled && !response.includes('Offline Knowledge Retrieval')) {
                await storage.incrementAiUsage();
                // Heuristic: If response is long enough and structured, save it
                if (response.length > 50) {
                    await memory.learn(query, response);
                    // console.log('Auto-learned new knowledge'); 
                }
            }
        }

        await ctx.replyWithMarkdown(response, { link_preview: { is_disabled: true } } as any);
    });

    bot.command('label', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const args = ctx.message.text.split(' ');
        if (args.length < 3) return ctx.reply('Usage: /label <address> <name>');

        const address = args[1].toLowerCase();
        const name = args.slice(2).join(' ');

        if (!/^0x[a-f0-9]{40}$/.test(address)) {
            return ctx.reply('Invalid EVM address format.');
        }

        await storage.saveLabel(address, name);
        await memory.append('contracts', 'labels', `Labeled ${address} as "${name}"`);
        await ctx.reply(`✅ Labeled \`${address}\` as *${name}*`);
    });

    bot.command('labels', async (ctx) => {
        const labels = await storage.getAllLabels();
        if (labels.length === 0) return ctx.reply('No custom labels yet. Use /label <address> <name>');

        let msg = `🏷 *Known Contract Labels:*\n\n`;
        labels.forEach(l => msg += `- \`${l.address.slice(0, 10)}...\`: ${l.name}\n`);
        await ctx.replyWithMarkdown(msg);
    });

    bot.command('ai', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const arg = ctx.message.text.split(' ')[1]?.toLowerCase();
        if (arg !== 'on' && arg !== 'off') return ctx.reply('Usage: /ai on|off');

        const enabled = arg === 'on';
        await ai.toggleAI(enabled);
        await ctx.reply(`🤖 Gemini AI Mode: *${enabled ? 'ENABLED' : 'DISABLED'}*`);
    });

    bot.command('autolearn', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const arg = ctx.message.text.split(' ')[1]?.toLowerCase();
        if (arg !== 'on' && arg !== 'off') return ctx.reply('Usage: /autolearn on|off');

        const enabled = arg === 'on';
        await ai.toggleAutolearn(enabled);
        await ctx.reply(`🧠 Auto-Learning Mode: *${enabled ? 'ENABLED' : 'DISABLED'}*`);
    });

    bot.command('teach', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Admin only.');
        const content = ctx.message.text.replace('/teach', '').trim();
        const parts = content.split('|');

        if (parts.length < 2) {
            return ctx.reply('⚠️ Usage: /teach <question> | <answer>');
        }

        const question = parts[0].trim();
        const answer = parts.slice(1).join('|').trim();

        const success = await memory.learn(question, answer);
        if (success) {
            await ctx.reply(`✅ Learned:\nQ: ${question}\nA: ${answer}`);
        } else {
            await ctx.reply(`⚠️ I already know this (Duplicate).`);
        }
    });

    // Smart personality with local memory
    bot.on('text', async (ctx) => {
        if (ctx.message.text.startsWith('/')) return;

        const query = ctx.message.text;
        const results = await search.search(query);

        if (results.length > 0) {
            let response = `Bot: I found some relevant information in my memory:\n\n`;
            response += results.slice(0, 2).join('\n');
            await ctx.reply(response);
        }
    });

    bot.command('connect', async (ctx) => {
        const widgetUrl = `https://play.carv.io/profile`;
        await ctx.replyWithMarkdown(
            `🔗 *Connect your CARV ID*\n\nTo link your identity, please visit your CARV Play profile and ensure your accounts are bound correctly.`,
            Markup.inlineKeyboard([[{ text: 'Go to CARV Play', url: widgetUrl }]])
        );
    });

    bot.command('me', async (ctx) => {
        const user = await storage.getUser(ctx.from.id.toString());
        if (!user || (!user.carvId && !user.evmAddress)) {
            return ctx.reply('You haven\'t connected your CARV ID yet. Use /connect to get started.');
        }
        await ctx.replyWithMarkdown(
            `👤 *User Profile*\n\n*CARV ID*: ${user.carvId || 'N/A'}\n*EVM*: \`${user.evmAddress || 'N/A'}\`\n*Admin*: ${user.isAdmin ? 'Yes' : 'No'}`
        );
    });
}
