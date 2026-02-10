
export interface UserFact {
    key: string;
    value: string;
    confidence: number;
    updated_at: number;
}

/**
 * Memory Manager: Handles both episodic (logs) and semantic (facts/preferences) memory.
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
}
