/**
 * HXFi Mission Seeds
 * Import and call `seedMissions(db)` once after applying migration 0023.
 */

import { jsonResponse } from './auth';

export const INITIAL_MISSIONS = [
    {
        id: 'm1',
        title: 'Connect Your Wallet',
        description: 'Link your EVM wallet to get started with HXFi.',
        reward_xp: 100,
        reward_stars: 10,
        category: 'onboarding',
    },
    {
        id: 'm2',
        title: 'Complete Your Profile',
        description: 'Explore your profile page and see your identity stats.',
        reward_xp: 150,
        reward_stars: 15,
        category: 'onboarding',
    },
    {
        id: 'm3',
        title: 'Send Your First Chat',
        description: 'Have a conversation with the HXFi AI assistant.',
        reward_xp: 200,
        reward_stars: 20,
        category: 'engagement',
    },
    {
        id: 'm4',
        title: 'Buy Your First Ticket',
        description: 'Purchase at least 1 entry ticket to join the rewards pool.',
        reward_xp: 300,
        reward_stars: 30,
        category: 'tickets',
    },
    {
        id: 'm5',
        title: '7-Day Streak',
        description: 'Log in for 7 consecutive days to show your commitment.',
        reward_xp: 500,
        reward_stars: 50,
        category: 'streak',
    },
];

export async function seedMissions(db: D1Database): Promise<{ seeded: number }> {
    let seeded = 0;
    const now = Date.now();
    for (const m of INITIAL_MISSIONS) {
        const result = await db.prepare(
            `INSERT OR IGNORE INTO hxfi_missions (id, title, description, reward_xp, reward_stars, active, category, created_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
        ).bind(m.id, m.title, m.description, m.reward_xp, m.reward_stars, m.category, now).run();
        if (result.success) seeded++;
    }
    return { seeded };
}

/** Admin-only seed endpoint handler */
export async function handleSeedRequest(request: Request, db: D1Database, ownerTelegramId: string): Promise<Response> {
    const adminKey = request.headers.get('X-Admin-Key');
    if (!adminKey || adminKey !== ownerTelegramId) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }
    const result = await seedMissions(db);
    return jsonResponse({ ok: true, ...result });
}
