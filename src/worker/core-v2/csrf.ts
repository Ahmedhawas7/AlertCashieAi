import { D1Database } from '@cloudflare/workers-types';

export class D1CSRFProtection {
    private db: D1Database;
    private maxAge: number;

    constructor(db: D1Database, maxAgeMinutes: number = 10) {
        this.db = db;
        this.maxAge = maxAgeMinutes * 60 * 1000;
    }

    async generateToken(userId: string, data?: Record<string, any>): Promise<string> {
        const token = crypto.randomUUID();
        const now = Date.now();
        const dataStr = data ? JSON.stringify(data) : '{}';

        await this.db.prepare(
            'INSERT INTO csrf_tokens (token, user_id, data, created_at) VALUES (?, ?, ?, ?)'
        ).bind(token, userId, dataStr, now).run();

        return token;
    }

    async validateToken(token: string, userId: string): Promise<{ valid: boolean; data?: Record<string, any>; error?: string }> {
        const now = Date.now();
        const expiry = now - this.maxAge;

        const result = await this.db.prepare(
            'SELECT * FROM csrf_tokens WHERE token = ? AND user_id = ?'
        ).bind(token, userId).first<{ created_at: number, data: string }>();

        if (!result) {
            return { valid: false, error: 'Token not found or invalid user' };
        }

        if (result.created_at < expiry) {
            await this.revokeToken(token);
            return { valid: false, error: 'Token expired' };
        }

        // Token used (consume it)
        await this.revokeToken(token);

        return { valid: true, data: JSON.parse(result.data) };
    }

    async revokeToken(token: string): Promise<void> {
        await this.db.prepare('DELETE FROM csrf_tokens WHERE token = ?').bind(token).run();
    }
}
