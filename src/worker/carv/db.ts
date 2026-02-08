import { Env } from '../types';
import { encrypt, decrypt } from './crypto';

export interface CarvConnection {
    id: number;
    telegram_id: number;
    carv_id: string;
    wallet_address: string | null;
    email: string | null;
    linked_at: number;
}

/**
 * Save pending OAuth session
 */
export async function savePendingSession(
    db: D1Database,
    telegramId: number,
    state: string,
    expiresAt: number
): Promise<void> {
    await db.prepare(`
        INSERT INTO pending_connect_sessions (telegram_id, state, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    `).bind(telegramId, state, Date.now(), expiresAt).run();
}

/**
 * Validate state and return telegram_id if valid
 */
export async function validateState(
    db: D1Database,
    state: string
): Promise<number | null> {
    const result = await db.prepare(`
        SELECT telegram_id, expires_at FROM pending_connect_sessions
        WHERE state = ?
    `).bind(state).first<{ telegram_id: number, expires_at: number }>();

    if (!result) return null;

    // Check expiration
    if (Date.now() > result.expires_at) {
        // Clean up expired session
        await db.prepare(`DELETE FROM pending_connect_sessions WHERE state = ?`).bind(state).run();
        return null;
    }

    // Valid - delete session (one-time use)
    await db.prepare(`DELETE FROM pending_connect_sessions WHERE state = ?`).bind(state).run();

    return result.telegram_id;
}

/**
 * Save CARV connection
 */
export async function saveConnection(
    db: D1Database,
    env: Env,
    telegramId: number,
    carvId: string,
    walletAddress: string | null,
    email: string | null,
    accessToken: string | null,
    refreshToken: string | null
): Promise<void> {
    const now = Date.now();

    // Encrypt tokens if provided
    let accessTokenEnc = null;
    let refreshTokenEnc = null;

    if (accessToken && env.ENCRYPTION_SECRET) {
        accessTokenEnc = await encrypt(accessToken, env.ENCRYPTION_SECRET);
    }

    if (refreshToken && env.ENCRYPTION_SECRET) {
        refreshTokenEnc = await encrypt(refreshToken, env.ENCRYPTION_SECRET);
    }

    // Upsert connection
    await db.prepare(`
        INSERT INTO connections (telegram_id, carv_id, wallet_address, email, access_token_encrypted, refresh_token_encrypted, linked_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(telegram_id) DO UPDATE SET
            carv_id = excluded.carv_id,
            wallet_address = excluded.wallet_address,
            email = excluded.email,
            access_token_encrypted = excluded.access_token_encrypted,
            refresh_token_encrypted = excluded.refresh_token_encrypted,
            updated_at = excluded.updated_at
    `).bind(telegramId, carvId, walletAddress, email, accessTokenEnc, refreshTokenEnc, now, now).run();

    // Log event
    await logAuthEvent(db, telegramId, 'LINKED', `Linked to CARV ID: ${carvId}`);
}

/**
 * Get connection by telegram_id
 */
export async function getConnection(
    db: D1Database
): Promise<(telegramId: number) => Promise<CarvConnection | null>> {
    return async (telegramId: number) => {
        const result = await db.prepare(`
            SELECT id, telegram_id, carv_id, wallet_address, email, linked_at
            FROM connections
            WHERE telegram_id = ?
        `).bind(telegramId).first<CarvConnection>();

        return result || null;
    };
}

/**
 * Log auth event
 */
export async function logAuthEvent(
    db: D1Database,
    telegramId: number,
    eventType: string,
    details: string
): Promise<void> {
    await db.prepare(`
        INSERT INTO auth_logs (telegram_id, event_type, details, timestamp)
        VALUES (?, ?, ?, ?)
    `).bind(telegramId, eventType, details, Date.now()).run();
}

/**
 * Clean up expired sessions (call periodically)
 */
export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
    await db.prepare(`
        DELETE FROM pending_connect_sessions
        WHERE expires_at < ?
    `).bind(Date.now()).run();
}
