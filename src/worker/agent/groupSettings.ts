import { Env } from '../types';

export type GroupMode = 'CHATTY' | 'SILENT' | 'NEWS_ONLY';

interface CacheEntry {
    mode: GroupMode;
    expiresAt: number;
}

const CACHE_TTL = 60 * 1000; // 60 seconds
const memoryCache: Map<string, CacheEntry> = new Map();

export class GroupSettings {
    constructor(private db: D1Database) { }

    async getMode(chatId: string): Promise<GroupMode> {
        const now = Date.now();
        const cached = memoryCache.get(chatId);

        if (cached && cached.expiresAt > now) {
            return cached.mode;
        }

        try {
            const result = await this.db.prepare(
                "SELECT mode FROM group_settings WHERE chat_id = ?"
            ).bind(chatId).first<string>('mode');

            const mode = (result as GroupMode) || 'CHATTY';
            memoryCache.set(chatId, { mode, expiresAt: now + CACHE_TTL });
            return mode;
        } catch (e) {
            console.error('Failed to get group mode', e);
            return 'CHATTY';
        }
    }

    async setMode(chatId: string, mode: GroupMode): Promise<void> {
        await this.db.prepare(
            "INSERT INTO group_settings (chat_id, mode, updated_at) VALUES (?, ?, ?) " +
            "ON CONFLICT(chat_id) DO UPDATE SET mode = EXCLUDED.mode, updated_at = EXCLUDED.updated_at"
        ).bind(chatId, mode, Date.now()).run();

        // Update cache immediately
        memoryCache.set(chatId, { mode, expiresAt: Date.now() + CACHE_TTL });
    }
}
