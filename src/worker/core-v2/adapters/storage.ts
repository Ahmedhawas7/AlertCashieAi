import { IStorage, Env } from '../types';
import { D1Database } from '@cloudflare/workers-types';

export class D1StorageAdapter implements IStorage {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async get(key: string): Promise<string | null> {
        const result = await this.db.prepare('SELECT value FROM poly_settings WHERE key = ?')
            .bind(key)
            .first<{ value: string }>();
        return result?.value || null;
    }

    async set(key: string, value: string): Promise<void> {
        await this.db.prepare(
            'INSERT INTO poly_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value'
        )
            .bind(key, value)
            .run();
    }
}
