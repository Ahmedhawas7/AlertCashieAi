/**
 * HXFi Auth Helpers
 * Wallet-based auth: nonce generation → signed message verification → session token
 * Uses viem's verifyMessage for EVM signature verification.
 */

import { verifyMessage } from 'viem';

const NONCE_EXPIRY_MS = 10 * 60 * 1000;   // 10 minutes
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------- Nonce Generation ----------

/**
 * Generate a cryptographically random nonce and store it in D1.
 * Returns the nonce and the human-readable message to sign.
 */
export async function generateNonce(db: D1Database, rawAddress: string): Promise<{ nonce: string; messageToSign: string }> {
    const address = rawAddress.toLowerCase();
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = Date.now() + NONCE_EXPIRY_MS;

    await db.prepare(
        `INSERT INTO hxfi_auth_nonces (address, nonce, expires_at)
         VALUES (?, ?, ?)
         ON CONFLICT(address) DO UPDATE SET nonce = excluded.nonce, expires_at = excluded.expires_at`
    ).bind(address, nonce, expiresAt).run();

    const messageToSign =
        `Welcome to HXFi!\n\nSign this message to verify your wallet ownership.\n\nNonce: ${nonce}\nExpires: ${new Date(expiresAt).toISOString()}`;

    return { nonce, messageToSign };
}

// ---------- Signature Verification ----------

/**
 * Verify an EIP-191 signed message.
 * Returns the normalized (lowercase) wallet address on success, or null on failure.
 */
export async function verifySignature(
    rawAddress: string,
    message: string,
    signature: string
): Promise<boolean> {
    try {
        const address = rawAddress as `0x${string}`;
        const sig = signature as `0x${string}`;
        return await verifyMessage({ address, message, signature: sig });
    } catch {
        return false;
    }
}

/**
 * Consume a nonce (validate it exists and hasn't expired) then delete it.
 */
export async function consumeNonce(db: D1Database, rawAddress: string, nonce: string): Promise<string | null> {
    const address = rawAddress.toLowerCase();
    const row = await db.prepare(
        `SELECT nonce, expires_at FROM hxfi_auth_nonces WHERE address = ?`
    ).bind(address).first<{ nonce: string; expires_at: number }>();

    if (!row) return null;
    if (row.nonce !== nonce) return null;
    if (Date.now() > row.expires_at) {
        await db.prepare(`DELETE FROM hxfi_auth_nonces WHERE address = ?`).bind(address).run();
        return null;
    }

    // Consume (delete) the nonce
    await db.prepare(`DELETE FROM hxfi_auth_nonces WHERE address = ?`).bind(address).run();
    return address;
}

// ---------- Session Token ----------

/**
 * Issue a new session token and store it in D1.
 */
export async function issueToken(db: D1Database, rawAddress: string): Promise<string> {
    const userId = rawAddress.toLowerCase();
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + SESSION_EXPIRY_MS;

    await db.prepare(
        `INSERT INTO hxfi_sessions (token, user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`
    ).bind(token, userId, now, expiresAt).run();

    return token;
}

// ---------- Auth Middleware ----------

export interface HxfiAuthContext {
    userId: string;  // lowercase wallet address
    token: string;
}

/**
 * Validate the Authorization: Bearer <token> header.
 * Returns the auth context or null if invalid/expired.
 */
export async function requireHxfiAuth(request: Request, db: D1Database): Promise<HxfiAuthContext | null> {
    const authHeader = request.headers.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;

    const token = match[1].trim();
    if (!token) return null;

    const row = await db.prepare(
        `SELECT user_id, expires_at FROM hxfi_sessions WHERE token = ?`
    ).bind(token).first<{ user_id: string; expires_at: number }>();

    if (!row) return null;
    if (Date.now() > row.expires_at) {
        await db.prepare(`DELETE FROM hxfi_sessions WHERE token = ?`).bind(token).run();
        return null;
    }

    return { userId: row.user_id, token };
}

// ---------- Helpers ----------

export function unauthorized(message = 'Unauthorized'): Response {
    return jsonResponse({ error: message }, 401);
}

export function badRequest(message: string): Response {
    return jsonResponse({ error: message }, 400);
}

export function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}
