import { Env } from '../types';
import { getConnection } from '../carv/db';

/**
 * Check if telegram_id matches owner
 */
export function requireOwner(env: Env, telegramId: number): boolean {
    const ownerId = parseInt(env.OWNER_TELEGRAM_ID || '0');
    return telegramId === ownerId;
}

/**
 * Check if owner is linked to CARV ID
 */
export async function requireLinkedOwner(
    env: Env,
    db: D1Database,
    telegramId: number
): Promise<boolean> {
    // First check if owner
    if (!requireOwner(env, telegramId)) {
        return false;
    }

    // Then check if linked
    const getConn = await getConnection(db);
    const connection = await getConn(telegramId);

    return connection !== null;
}
