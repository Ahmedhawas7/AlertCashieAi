import { D1Database } from '@cloudflare/workers-types';

export interface RateLimitConfig {
    limit: number;
    windowSeconds: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
}

export const RateLimitConfigs = {
    COMMAND: { limit: 10, windowSeconds: 60 },
    AI_CHAT: { limit: 20, windowSeconds: 120 },
    TRANSACTION: { limit: 5, windowSeconds: 300 },
    API: { limit: 60, windowSeconds: 60 }
};

export class D1RateLimiter {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
        const now = Math.floor(Date.now() / 1000);
        const windowStart = now - config.windowSeconds;

        // Cleanup old
        // Note: In production we might use a cron for this to save writes
        await this.db.prepare('DELETE FROM rate_limits WHERE timestamp < ?').bind(windowStart).run();

        // Count existing
        const countResult = await this.db.prepare(
            'SELECT COUNT(*) as count FROM rate_limits WHERE key = ? AND timestamp > ?'
        ).bind(key, windowStart).first<{ count: number }>();

        const count = countResult?.count || 0;

        if (count >= config.limit) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: windowStart + config.windowSeconds
            };
        }

        // Add new
        await this.db.prepare(
            'INSERT INTO rate_limits (key, timestamp) VALUES (?, ?)'
        ).bind(key, now).run();

        return {
            allowed: true,
            remaining: config.limit - (count + 1),
            resetTime: windowStart + config.windowSeconds
        };
    }
}
