import Parser from 'rss-parser';
import { StorageService } from '../services/storage';

import { Telegraf } from 'telegraf';
import { MessageFormatter } from '../services/formatter';

export class MediumWatcher {
    private parser: Parser;
    private storage: StorageService;
    private bot: Telegraf;
    private rssUrl: string;
    private consecutiveErrors = 0;
    private pauseUntil = 0;
    private targetChatId?: string;

    constructor(bot: Telegraf, storage: StorageService, rssUrl: string, targetChatId?: string) {
        this.bot = bot;
        this.parser = new Parser();
        this.storage = storage;
        this.rssUrl = rssUrl;
        this.targetChatId = targetChatId;
    }

    async poll() {
        const isPaused = (await this.storage.getConfig('watchers_paused')) === 'true';
        if (isPaused) return;

        if (Date.now() < this.pauseUntil) {
            console.log('Skipping Medium polling due to backoff');
            return;
        }

        console.log('Polling Medium RSS...');
        const state = await this.storage.getWatcherState('medium_rss');

        try {
            const feed = await this.parser.parseURL(this.rssUrl);
            this.consecutiveErrors = 0;
            const newItems = feed.items.filter(item => {
                if (!state?.lastSeen) return true;
                return item.isoDate && new Date(item.isoDate) > new Date(state.lastSeen);
            });

            for (const item of newItems) {
                await this.processItem(item);
            }

            if (feed.items[0]?.isoDate) {
                await this.storage.updateWatcherState('medium_rss', { lastSeen: feed.items[0].isoDate });
            }
        } catch (error) {
            this.consecutiveErrors++;
            await this.storage.logError(`Medium RSS Fetch Failed (${this.consecutiveErrors})`, (error as any).stack);

            if (this.consecutiveErrors >= 3) {
                this.pauseUntil = Date.now() + 5 * 60 * 1000; // 5 minute backoff
                console.warn('Circuit breaker triggered for Medium RSS');
            }
        }
    }

    private async processItem(item: Parser.Item) {
        const keywords = ['Cashie', 'x402', 'creator', 'airdrop', 'verifier', 'node', 'staking', 'SBT', 'CARV ID', 'campaign', 'snapshot', 'season'];
        const content = `${item.title} ${item.contentSnippet || ''}`;

        const containsKeyword = keywords.some(k => content.toLowerCase().includes(k.toLowerCase()));

        if (containsKeyword) {
            const { EventClassifier } = require('../services/classifier');
            const type = EventClassifier.classify(item.title || '', item.contentSnippet || '');
            const emoji = EventClassifier.getEmoji(type);

            const saved = await this.storage.saveEvent({
                source: 'Medium',
                type, // <- EventType
                severity: 'info',
                title: `${emoji} ${item.title || 'New CARV Announcement'}`,
                summary: item.contentSnippet?.slice(0, 220) || '',
                details: item.contentSnippet || null,
                sourceUrl: item.link || null,
                tags: JSON.stringify(['medium', 'announcement', String(type).toLowerCase()]),
                entities: JSON.stringify({
                    url: item.link || null,
                    isoDate: item.isoDate || null
                }),
                rawRef: item.guid ?? item.link ?? `${item.title ?? 'medium'}_${item.isoDate ?? Date.now()}`
            });

            await this.sendAlert(saved);
        }
    }

    private async sendAlert(event: any) {
        const mode = await this.storage.getConfig('alert_mode');
        if (mode === 'silent') return;

        if (this.targetChatId) {
            try {
                await this.bot.telegram.sendMessage(this.targetChatId, MessageFormatter.formatEvent(event), { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } } as any);
            } catch (e) {
                console.error(`Failed to send alert to target ${this.targetChatId}`, e);
            }
            return;
        }

        const users = await this.storage.getAllUsers();
        for (const user of users) {
            try {
                await this.bot.telegram.sendMessage(user.telegramId, MessageFormatter.formatEvent(event), { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } } as any);
            } catch (e) {
                // Ignore blocked users
            }
        }
    }
}
