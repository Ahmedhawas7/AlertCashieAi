/**
 * Shared HXFi Utilities
 */

import { awardXP } from './profile';

export async function safeJson(request: Request): Promise<any> {
    try {
        return await request.json();
    } catch {
        return {};
    }
}

export function truncatedAddress(addr: string): string {
    if (addr.length > 10) return addr.slice(0, 6) + '…' + addr.slice(-4);
    return addr;
}

export async function upsertChatSession(db: D1Database, sessionId: string, userId: string): Promise<void> {
    const now = Date.now();
    await db.prepare(
        `INSERT INTO hxfi_chat_sessions (id, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`
    ).bind(sessionId, userId, now, now).run();
}

export async function saveChatMessage(db: D1Database, sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    await db.prepare(
        `INSERT INTO hxfi_chat_messages (id, session_id, role, content, created_at)
         VALUES (?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), sessionId, role, content, Date.now()).run();
}

/** 
 * Internal mission completion helper used by multiple routes.
 */
export async function completeMissionInternal(
    db: D1Database,
    userId: string,
    missionId: string
): Promise<{ ok: boolean; error?: string; xp?: number; stars?: number }> {
    // Check mission exists
    const mission = await db.prepare(
        `SELECT * FROM hxfi_missions WHERE id = ? AND active = 1`
    ).bind(missionId).first<any>();
    if (!mission) return { ok: false, error: 'Mission not found' };

    // Check not already completed
    const existing = await db.prepare(
        `SELECT id FROM hxfi_mission_completions WHERE user_id = ? AND mission_id = ?`
    ).bind(userId, missionId).first();
    if (existing) return { ok: false, error: 'Mission already completed' };

    // Record completion
    await db.prepare(
        `INSERT INTO hxfi_mission_completions (id, user_id, mission_id, completed_at)
         VALUES (?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), userId, missionId, Date.now()).run();

    // Award rewards
    await awardXP(db, userId, mission.reward_xp, mission.reward_stars);

    return { ok: true, xp: mission.reward_xp, stars: mission.reward_stars };
}
