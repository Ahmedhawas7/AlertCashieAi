import { Env } from '../types';
import { encrypt, decrypt } from './crypto';

export interface CarvConnection {
    telegram_user_id: string;
    smart_wallet_address: string | null;
    signer_wallet_address: string | null;
    email_address: string | null;
    access_token_enc: string | null;
    refresh_token_enc: string | null;
    token_expires_at: number | null;
    scope: string | null;
    linked_at: number;
}

/**
 * Save pending OAuth session
 * state TEXT PRIMARY KEY, telegram_user_id TEXT, created_at INTEGER, expires_at INTEGER
 */
export async function savePendingSession(
    db: D1Database,
    telegramUserId: string,
    state: string,
    expiresAt: number
): Promise<void> {
    await db.prepare(`
        INSERT INTO pending_connect_sessions (state, telegram_user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    `).bind(state, telegramUserId, Date.now(), expiresAt).run();
}

/**
 * Validate state and return telegram_user_id if valid
 */
export async function validateState(
    db: D1Database,
    state: string
): Promise<string | null> {
    const result = await db.prepare(`
        SELECT telegram_user_id, expires_at FROM pending_connect_sessions
        WHERE state = ?
    `).bind(state).first<{ telegram_user_id: string, expires_at: number }>();

    if (!result) return null;

    // Check expiration
    if (Date.now() > result.expires_at) {
        await db.prepare(`DELETE FROM pending_connect_sessions WHERE state = ?`).bind(state).run();
        return null;
    }

    // Valid - delete session (one-time use)
    await db.prepare(`DELETE FROM pending_connect_sessions WHERE state = ?`).bind(state).run();

    return result.telegram_user_id;
}

/**
 * Save CARV connection
 */
export async function saveConnection(
    db: D1Database,
    env: Env,
    telegramUserId: string,
    smartWallet: string | null,
    signerWallet: string | null,
    email: string | null,
    accessToken: string | null,
    refreshToken: string | null,
    expiresIn: number | null,
    scope: string | null
): Promise<void> {
    const now = Date.now();
    const tokenExpiresAt = expiresIn ? now + (expiresIn * 1000) : null;

    let accessTokenEnc = null;
    let refreshTokenEnc = null;

    if (accessToken && env.ENCRYPTION_SECRET) {
        accessTokenEnc = await encrypt(accessToken, env.ENCRYPTION_SECRET);
    }

    if (refreshToken && env.ENCRYPTION_SECRET) {
        refreshTokenEnc = await encrypt(refreshToken, env.ENCRYPTION_SECRET);
    }

    await db.prepare(`
        INSERT INTO connections (
            telegram_user_id, smart_wallet_address, signer_wallet_address, 
            email_address, access_token_enc, refresh_token_enc, 
            token_expires_at, scope, linked_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(telegram_user_id) DO UPDATE SET
            smart_wallet_address = excluded.smart_wallet_address,
            signer_wallet_address = excluded.signer_wallet_address,
            email_address = excluded.email_address,
            access_token_enc = excluded.access_token_enc,
            refresh_token_enc = excluded.refresh_token_enc,
            token_expires_at = excluded.token_expires_at,
            scope = excluded.scope,
            linked_at = excluded.linked_at
    `).bind(
        telegramUserId, smartWallet, signerWallet,
        email, accessTokenEnc, refreshTokenEnc,
        tokenExpiresAt, scope, now
    ).run();

    await logAuthEvent(db, telegramUserId, 'LINKED', `Linked to CARV wallet: ${smartWallet}`);
}

/**
 * Get connection by telegram_user_id
 */
export async function getConnection(
    db: D1Database
): Promise<(telegramUserId: number | string) => Promise<CarvConnection | null>> {
    return async (telegramUserId: number | string) => {
        const result = await db.prepare(`
            SELECT * FROM connections
            WHERE telegram_user_id = ?
        `).bind(telegramUserId.toString()).first<CarvConnection>();

        return result || null;
    };
}

/**
 * Log auth event
 */
export async function logAuthEvent(
    db: D1Database,
    telegramUserId: string | number,
    event: string,
    detail: string
): Promise<void> {
    await db.prepare(`
        INSERT INTO auth_logs (id, telegram_user_id, event, detail, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), telegramUserId.toString(), event, detail, Date.now()).run();
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
    await db.prepare(`
        DELETE FROM pending_connect_sessions
        WHERE expires_at < ?
    `).bind(Date.now()).run();
}
