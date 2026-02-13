import { DB } from '../db';
import { Env } from '../types';

export interface PolySettings {
    mode: 'OFF' | 'OBSERVE' | 'EXECUTE';
    min_mispricing_pct: number;
    max_risk_pct: number;
    min_profit_usd: number;
}

export const DEFAULT_SETTINGS: PolySettings = {
    mode: 'OFF',
    min_mispricing_pct: 0.08,
    max_risk_pct: 0.03,
    min_profit_usd: 0.50
};

export class PolyDB {
    constructor(private db: D1Database) { }

    // --- Settings ---
    async getSettings(): Promise<PolySettings> {
        try {
            const result = await this.db.prepare("SELECT value FROM poly_settings WHERE key = 'config'").first<string>('value');
            if (result) {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(result) };
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
        return DEFAULT_SETTINGS;
    }

    async saveSettings(settings: PolySettings): Promise<void> {
        await this.db.prepare(
            "INSERT INTO poly_settings (key, value, updated_at) VALUES ('config', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
        ).bind(JSON.stringify(settings), Date.now()).run();
    }

    // --- Locking ---
    async acquireLock(key: string, holderId: string, durationMs: number): Promise<boolean> {
        const now = Date.now();
        const expiresAt = now + durationMs;

        // Clean up expired locks first
        await this.db.prepare("DELETE FROM poly_locks WHERE expires_at < ?").bind(now).run();

        try {
            await this.db.prepare(
                "INSERT INTO poly_locks (lock_key, acquired_at, expires_at, holder_id) VALUES (?, ?, ?, ?)"
            ).bind(key, now, expiresAt, holderId).run();
            return true;
        } catch (e) {
            // Unique constraint violation means lock is held
            return false;
        }
    }

    async releaseLock(key: string, holderId: string): Promise<void> {
        await this.db.prepare("DELETE FROM poly_locks WHERE lock_key = ? AND holder_id = ?").bind(key, holderId).run();
    }

    // --- Pending Ops (Execution Gates) ---
    async createOp(otp: string, payload: any, durationMs: number = 300000): Promise<string> {
        const id = crypto.randomUUID();
        const now = Date.now();
        await this.db.prepare(
            "INSERT INTO poly_ops (op_id, otp_code, payload, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(id, otp, JSON.stringify(payload), now + durationMs, now).run();
        return id;
    }

    async verifyAndClaimOp(otp: string): Promise<any | null> {
        const now = Date.now();
        const op = await this.db.prepare(
            "SELECT * FROM poly_ops WHERE otp_code = ? AND expires_at > ?"
        ).bind(otp, now).first<{ op_id: string; payload: string }>();

        if (!op) return null;

        // Claim it (delete)
        await this.db.prepare("DELETE FROM poly_ops WHERE op_id = ?").bind(op.op_id).run();

        return JSON.parse(op.payload as string);
    }

    // --- Audit ---
    async logAudit(action: string, details: any): Promise<void> {
        await this.db.prepare(
            "INSERT INTO poly_audit (action_type, details, timestamp) VALUES (?, ?, ?)"
        ).bind(action, JSON.stringify(details), Date.now()).run();
    }
}
