import { RPCService } from '../services/rpc';
import { StorageService } from '../services/storage';
import { EventClassifier, EventType } from '../services/classifier';
import { Telegraf } from 'telegraf';
import { MessageFormatter } from '../services/formatter';

export class BaseLogsWatcher {
    private rpc: RPCService;
    private storage: StorageService;
    private bot: Telegraf;
    private contracts: string[];
    private consecutiveErrors = 0;
    private pauseUntil = 0;
    private recentEvents: number[] = [];
    public lastSuccess = 0;
    private targetChatId?: string;

    constructor(bot: Telegraf, rpc: RPCService, storage: StorageService, contracts: string[], targetChatId?: string) {
        this.bot = bot;
        this.rpc = rpc;
        this.storage = storage;
        this.contracts = contracts;
        this.targetChatId = targetChatId;
    }

    async poll() {
        const isPaused = (await this.storage.getConfig('watchers_paused')) === 'true';
        if (isPaused) return;

        if (Date.now() < this.pauseUntil) {
            return;
        }

        const state = await this.storage.getWatcherState('base_logs');
        let latestBlock: number;
        try {
            latestBlock = Number(await this.rpc.getLatestBlock());
            this.consecutiveErrors = 0;
            this.lastSuccess = Date.now();
        } catch (e) {
            this.consecutiveErrors++;
            if (this.consecutiveErrors >= 3) {
                this.pauseUntil = Date.now() + 2 * 60 * 1000;
            }
            return;
        }

        const startBlock = state?.lastBlock ? state.lastBlock + 1 : latestBlock - 50;

        if (startBlock > latestBlock) return;

        try {
            const logs = (await this.rpc.getLogs({
                address: this.contracts as `0x${string}`[],
                fromBlock: BigInt(startBlock),
                toBlock: BigInt(latestBlock),
            })) as any[];


            if (logs.length > 0) {
                await this.throttleAndProcess(logs);
            }

            await this.storage.updateWatcherState('base_logs', { lastBlock: latestBlock });
        } catch (error) {
            // Error logging removed as per instruction, but consider adding it back for debugging.
        }
    }

    private async throttleAndProcess(logs: any[]) {
        const now = Date.now();
        this.recentEvents = this.recentEvents.filter(t => t > now - 2 * 60 * 1000);

        // Batching Threshold: > 5 events in 2 minutes
        if (this.recentEvents.length + logs.length > 5) {
            const event = {
                source: 'Base',
                type: EventType.Other,
                severity: 'medium',
                title: `📣 High Activity Detected on Base`,
                summary: `${logs.length} new transactions in tracked contracts.`,
                details: `Bypassing individual notifications. Check latest transactions on BaseScan.`,
                sourceUrl: `https://basescan.org/address/${this.contracts[0]}`,
                tags: JSON.stringify(['onchain', 'spike']),
                entities: JSON.stringify({ contracts: this.contracts }),
                rawRef: `base_spike_${now}_${logs.length}`
            };
            const saved = await this.storage.saveEvent(event);
            await this.sendAlert(saved);
            this.recentEvents.push(...new Array(logs.length).fill(now));
        } else {
            for (const log of logs) {
                await this.processLog(log);
                this.recentEvents.push(now);
            }
        }
    }

    private async processLog(log: any) {
        const label = await this.storage.getLabel(log.address);
        const name = label || `${log.address.slice(0, 8)}...`;

        let type = EventType.ContractChange;
        let severity = 'info';

        if (log.topics && log.topics[0]?.includes('0xddf252ad')) {
            type = EventType.TokenMovement;
            severity = 'medium';
        }

        const event = {
            source: 'Base',
            type,
            severity,
            title: `${EventClassifier.getEmoji(type)} ${name}: ${type}`,
            summary: `Transaction detected on Base for contract ${name}.`,
            details: `Block: ${log.blockNumber}, Hash: ${log.transactionHash?.slice(0, 10)}...`,
            sourceUrl: `https://basescan.org/tx/${log.transactionHash}`,
            tags: JSON.stringify(['onchain', 'base', type.toLowerCase()]),
            entities: JSON.stringify({ contracts: [log.address], txHash: log.transactionHash }),
            rawRef: `base_${log.transactionHash}_${log.logIndex || 0}`
        };

        const saved = await this.storage.saveEvent(event);
        await this.sendAlert(saved);
    }

    private async sendAlert(event: any) {
        const mode = await this.storage.getConfig('alert_mode');
        if (mode === 'silent') return;

        // If running in GitHub Actions Runner mode (One-Shot), send to target only.
        if (this.targetChatId) {
            try {
                await this.bot.telegram.sendMessage(this.targetChatId, MessageFormatter.formatEvent(event), { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } } as any);
            } catch (e) {
                console.error(`Failed to send alert to target ${this.targetChatId}`, e);
            }
            return;
        }

        const users = await this.storage.getAllUsers();
        // For MVP, maybe just send to admin IDs from env or rely on handlers knowing users?
        // Since handlers.ts has ctx, here we need direct telegram access.

        // Better: Send to a specific channel or admin if configured. 
        // For now, I'll iterate known users.
        for (const user of users) {
            try {
                // Determine if we should send based on focus?
                // For now send everything if loud.
                await this.bot.telegram.sendMessage(user.telegramId, MessageFormatter.formatEvent(event), { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } } as any);
            } catch (e) {
                // Ignore blocked users
            }
        }
    }
}
