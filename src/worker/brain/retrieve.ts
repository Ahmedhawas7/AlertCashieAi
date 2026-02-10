import { KnowledgeBase, KBDoc } from './kb';
import { normalizeText, tokenize } from './normalize';

export interface SearchResult {
    source: 'kb' | 'log';
    title?: string;
    text: string;
    score: number;
    ts?: number;
}

/**
 * Retrieval Engine: Combines KB and Episodic Logs for grounded answers.
 */
export class RetrievalEngine {
    private kb: KnowledgeBase;
    private db: D1Database;

    constructor(kb: KnowledgeBase, db: D1Database) {
        this.kb = kb;
        this.db = db;
    }

    /**
     * Retrieve relevant context from both KB and user's episodic logs
     */
    async retrieve(userId: string, query: string): Promise<SearchResult[]> {
        const queryTokens = tokenize(query);
        if (queryTokens.length === 0) return [];

        // 1. Search KB
        const kbDocs = await this.kb.search(query, 5);
        const kbResults: SearchResult[] = kbDocs.map(doc => ({
            source: 'kb',
            title: doc.title,
            text: doc.content,
            score: doc.score
        }));

        // 2. Search Episodic Logs (Past interactions)
        // We look for similar queries or responses in the last 50 interactions
        const logRes = await this.db.prepare(`
            SELECT text, intent, outcome, ts FROM episodic_logs 
            WHERE user_id = ? 
            ORDER BY ts DESC LIMIT 50
        `).bind(userId).all<{ text: string, intent: string, outcome: string, ts: number }>();

        const logs = logRes.results || [];
        const logResults: SearchResult[] = logs.map(log => {
            let score = 0;
            const logText = normalizeText(`${log.text} ${log.intent || ""} ${log.outcome || ""}`);

            for (const token of queryTokens) {
                if (logText.includes(token)) {
                    score += 5;
                }
            }

            // Recency boost: +1 for every day recent (max 10)
            const daysAgo = (Date.now() - log.ts) / (1000 * 60 * 60 * 24);
            const recencyBoost = Math.max(0, 10 - daysAgo);

            return {
                source: 'log',
                text: log.text,
                score: score > 0 ? score + recencyBoost : 0,
                ts: log.ts
            } as SearchResult;
        }).filter(r => r.score > 0);

        // 3. Merge and Sort
        return [...kbResults, ...logResults].sort((a, b) => b.score - a.score).slice(0, 7);
    }
}
