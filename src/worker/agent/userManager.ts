export interface UserRecord {
    telegram_id: string;
    username?: string;
    first_name: string;
    last_name?: string;
    is_private: number;
    joined_at: number;
    last_seen: number;
}

export class UserManager {
    constructor(private db: D1Database) { }

    async trackUser(user: { id: number; username?: string; first_name: string; last_name?: string }, isPrivate: boolean): Promise<void> {
        const now = Date.now();
        await this.db.prepare(`
            INSERT INTO users (telegram_id, username, first_name, last_name, is_private, joined_at, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                is_private = CASE WHEN EXCLUDED.is_private = 1 THEN 1 ELSE users.is_private END,
                last_seen = EXCLUDED.last_seen
        `).bind(
            user.id.toString(),
            user.username || null,
            user.first_name,
            user.last_name || null,
            isPrivate ? 1 : 0,
            now,
            now
        ).run();
    }

    async getPrivateUsers(): Promise<UserRecord[]> {
        const res = await this.db.prepare("SELECT * FROM users WHERE is_private = 1 ORDER BY last_seen DESC").all<UserRecord>();
        return res.results || [];
    }

    async getUserCount(): Promise<number> {
        const res = await this.db.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
        return res?.count || 0;
    }
}
