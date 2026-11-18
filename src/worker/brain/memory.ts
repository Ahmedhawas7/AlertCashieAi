
export interface UserFact {
    key: string;
    value: string;
    confidence: number;
    updated_at: number;
}

export interface DailyDiaryEntry {
    id?: number;
    user_id: string;
    diary_date: string;
    summary_learned: string;
    unclear_wishes: string;
    future_goals: string;
    inner_reflection: string;
    created_at: number;
}

/**
 * Memory Manager: Handles both episodic (logs) and semantic (facts/preferences) memory,
 * plus daily diaries and self-reflection.
 */
export class MemoryManager {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    /**
     * Log a new interaction episode
     */
    async logEpisode(userId: string, text: string, intent: string, entities: any, outcome: string = ""): Promise<void> {
        const id = crypto.randomUUID();
        await this.db.prepare(`
            INSERT INTO episodic_logs (id, user_id, ts, text, intent, entities_json, outcome)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(id, userId, Date.now(), text, intent, JSON.stringify(entities), outcome).run();
    }

    /**
     * Update a user fact (Sovereign Memory)
     */
    async storeFact(userId: string, key: string, value: string, confidence: number = 1.0): Promise<void> {
        await this.db.prepare(`
            INSERT INTO user_memory (user_id, key, value, confidence, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, key) DO UPDATE SET
                value = excluded.value,
                confidence = excluded.confidence,
                updated_at = excluded.updated_at
        `).bind(userId, key, value, confidence, Date.now()).run();
    }

    /**
     * Recall a specific fact
     */
    async getFact(userId: string, key: string): Promise<UserFact | null> {
        return await this.db.prepare(`
            SELECT value, confidence, updated_at FROM user_memory 
            WHERE user_id = ? AND key = ?
        `).bind(userId, key).first<UserFact>();
    }

    /**
     * Recall all facts about a user
     */
    async getAllFacts(userId: string): Promise<UserFact[]> {
        const res = await this.db.prepare(`
            SELECT key, value, confidence, updated_at FROM user_memory 
            WHERE user_id = ?
        `).bind(userId).all<UserFact>();
        return res.results || [];
    }

    /**
     * Save or update daily diary
     */
    async saveDailyDiary(entry: {
        userId: string;
        diaryDate: string;
        summaryLearned: string;
        unclearWishes: string;
        futureGoals: string;
        innerReflection: string;
    }): Promise<void> {
        await this.db.prepare(`
            INSERT INTO hawas_daily_diaries (user_id, diary_date, summary_learned, unclear_wishes, future_goals, inner_reflection, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, diary_date) DO UPDATE SET
                summary_learned = excluded.summary_learned,
                unclear_wishes = excluded.unclear_wishes,
                future_goals = excluded.future_goals,
                inner_reflection = excluded.inner_reflection,
                created_at = excluded.created_at
        `).bind(
            entry.userId,
            entry.diaryDate,
            entry.summaryLearned,
            entry.unclearWishes,
            entry.futureGoals,
            entry.innerReflection,
            Date.now()
        ).run();
    }

    /**
     * Get latest daily diary for a user
     */
    async getLatestDailyDiary(userId: string): Promise<DailyDiaryEntry | null> {
        return await this.db.prepare(`
            SELECT * FROM hawas_daily_diaries 
            WHERE user_id = ? 
            ORDER BY diary_date DESC LIMIT 1
        `).bind(userId).first<DailyDiaryEntry>();
    }

    /**
     * Get episodes for today or within past N hours
     */
    async getRecentEpisodes(userId: string, limit: number = 15): Promise<Array<{ text: string, outcome: string, ts: number }>> {
        const res = await this.db.prepare(`
            SELECT text, outcome, ts FROM episodic_logs 
            WHERE user_id = ? 
            ORDER BY ts DESC LIMIT ?
        `).bind(userId, limit).all<{ text: string, outcome: string, ts: number }>();
        return (res.results || []).reverse();
    }

    /**
     * Get randomized generalized global wisdom (Strictly ZERO PII)
     */
    async getGlobalWisdom(limit: number = 3): Promise<Array<{ category: string, insight_text: string }>> {
        try {
            const res = await this.db.prepare(`
                SELECT category, insight_text FROM hawas_global_wisdom 
                ORDER BY RANDOM() LIMIT ?
            `).bind(limit).all<{ category: string, insight_text: string }>();
            return res.results || [];
        } catch {
            return [];
        }
    }

    /**
     * Store abstract general wisdom distilled from interactions (Completely anonymized)
     */
    async recordGlobalWisdom(category: string, insightText: string): Promise<void> {
        // Strict privacy sanitization: reject if it contains phone numbers or specific personal identifiers
        if (/\b\d{8,15}\b/.test(insightText) || /اسمه|اسمها|رقم|تليفون/i.test(insightText)) {
            return;
        }
        try {
            await this.db.prepare(`
                INSERT INTO hawas_global_wisdom (category, insight_text, created_at)
                VALUES (?, ?, ?)
            `).bind(category, insightText.trim(), Date.now()).run();
        } catch {}
    }
}
