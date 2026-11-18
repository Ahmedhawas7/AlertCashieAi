/**
 * HXFi Profile Helpers
 * Manages user profiles: XP, levels, streaks, stars, badges.
 */

export interface HxfiProfile {
    user_id: string;
    xp: number;
    level: number;
    streak: number;
    stars: number;
    badges: string[];
    last_active: number | null;
    updated_at: number;
}

interface RawProfile {
    user_id: string;
    xp: number;
    level: number;
    streak: number;
    stars: number;
    badges_json: string;
    last_active: number | null;
    updated_at: number;
}

function parseProfile(row: RawProfile): HxfiProfile {
    return {
        ...row,
        badges: JSON.parse(row.badges_json || '[]'),
    };
}

/** Get or create a profile for a wallet address. */
export async function getOrCreateProfile(db: D1Database, userId: string): Promise<HxfiProfile> {
    const existing = await db.prepare(
        `SELECT * FROM hxfi_profiles WHERE user_id = ?`
    ).bind(userId).first<RawProfile>();

    if (existing) return parseProfile(existing);

    const now = Date.now();
    await db.prepare(
        `INSERT INTO hxfi_profiles (user_id, xp, level, streak, stars, badges_json, last_active, updated_at)
         VALUES (?, 0, 1, 0, 0, '[]', NULL, ?)`
    ).bind(userId, now).run();

    return {
        user_id: userId,
        xp: 0,
        level: 1,
        streak: 0,
        stars: 0,
        badges: [],
        last_active: null,
        updated_at: now,
    };
}

/**
 * Level formula: level = floor(sqrt(xp / 100)) + 1
 * Examples: 0 xp → L1, 100 → L2, 400 → L3, 900 → L4, 9900 → L10
 */
function computeLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/** XP required to reach next level from current level. */
function xpForNextLevel(level: number): number {
    return level * level * 100;
}

/** Award XP and stars to a user profile. Returns updated profile. */
export async function awardXP(
    db: D1Database,
    userId: string,
    xpAmount: number,
    starsAmount = 0
): Promise<{ profile: HxfiProfile; leveledUp: boolean; newLevel?: number }> {
    const profile = await getOrCreateProfile(db, userId);
    const newXp = profile.xp + xpAmount;
    const newStars = profile.stars + starsAmount;
    const oldLevel = profile.level;
    const newLevel = computeLevel(newXp);
    const leveledUp = newLevel > oldLevel;

    // Award level-up badge
    let badges = profile.badges;
    if (leveledUp) {
        const badge = `level_${newLevel}`;
        if (!badges.includes(badge)) badges = [...badges, badge];
    }

    const now = Date.now();
    await db.prepare(
        `UPDATE hxfi_profiles SET xp = ?, level = ?, stars = ?, badges_json = ?, updated_at = ? WHERE user_id = ?`
    ).bind(newXp, newLevel, newStars, JSON.stringify(badges), now, userId).run();

    const updated: HxfiProfile = { ...profile, xp: newXp, level: newLevel, stars: newStars, badges, updated_at: now };
    return { profile: updated, leveledUp, newLevel: leveledUp ? newLevel : undefined };
}

/** Update daily streak. Streak increments if last_active was yesterday; resets if older. */
export async function updateStreak(db: D1Database, userId: string): Promise<number> {
    const profile = await getOrCreateProfile(db, userId);
    const now = Date.now();

    // Get midnight UTC of today and yesterday
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);
    const todayMs = todayMidnight.getTime();
    const yesterdayMs = todayMs - 86400000;

    let newStreak = profile.streak;

    if (profile.last_active === null) {
        // First ever login
        newStreak = 1;
    } else if (profile.last_active >= todayMs) {
        // Already active today — no change
        return profile.streak;
    } else if (profile.last_active >= yesterdayMs) {
        // Active yesterday → increment
        newStreak = profile.streak + 1;
    } else {
        // Gap of 2+ days → reset
        newStreak = 1;
    }

    await db.prepare(
        `UPDATE hxfi_profiles SET streak = ?, last_active = ?, updated_at = ? WHERE user_id = ?`
    ).bind(newStreak, now, now, userId).run();

    return newStreak;
}

/** Get profile enriched with completion count and xp-to-next-level. */
export async function getEnrichedProfile(db: D1Database, userId: string) {
    const profile = await getOrCreateProfile(db, userId);
    await updateStreak(db, userId); // ensure streak is fresh

    // Re-fetch after streak update
    const fresh = await db.prepare(`SELECT * FROM hxfi_profiles WHERE user_id = ?`)
        .bind(userId).first<RawProfile>();
    const enriched = fresh ? parseProfile(fresh) : profile;

    const completions = await db.prepare(
        `SELECT COUNT(*) as cnt FROM hxfi_mission_completions WHERE user_id = ?`
    ).bind(userId).first<{ cnt: number }>();

    const ticketCount = await db.prepare(
        `SELECT COALESCE(SUM(qty), 0) as total FROM hxfi_tickets WHERE user_id = ? AND status != 'cancelled'`
    ).bind(userId).first<{ total: number }>();

    return {
        ...enriched,
        missions_completed: completions?.cnt || 0,
        xp_to_next_level: xpForNextLevel(enriched.level) - enriched.xp,
        total_tickets: ticketCount?.total || 0,
    };
}
