import { KBPassage, Citation } from './types';
import { tokenize } from './normalize';

export class FreeAiSearch {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    /**
     * Search for relevant passages using BM25-like scoring.
     */
    async search(query: string, limit: number = 3): Promise<Citation[]> {
        const terms = tokenize(query);
        if (terms.length === 0) return [];

        // 1. Get passages that contain any of the terms
        // We use the kb_terms index for efficiency
        const queryTerms = terms.map(t => "'" + t + "'").join(",");
        const { results } = await this.db.prepare(`
            SELECT p.id, p.source_id, p.excerpt, s.title, s.url, SUM(t.tf) as score
            FROM kb_terms t
            JOIN kb_passages p ON t.passage_id = p.id
            JOIN kb_sources s ON p.source_id = s.id
            WHERE t.term IN (${queryTerms})
            GROUP BY p.id
            ORDER BY score DESC
            LIMIT ?
        `).bind(limit).all<any>();

        if (!results || results.length === 0) return [];

        return results.map(r => ({
            source_id: r.source_id,
            title: r.title,
            url: r.url,
            excerpt: r.excerpt
        }));
    }

    /**
     * Fallback search (exact match or simple contains) if terms index is empty
     */
    async fallbackSearch(query: string, limit: number = 3): Promise<Citation[]> {
        const { results } = await this.db.prepare(`
            SELECT p.id, p.source_id, p.excerpt, s.title, s.url
            FROM kb_passages p
            JOIN kb_sources s ON p.source_id = s.id
            WHERE p.excerpt LIKE ?
            ORDER BY p.created_at DESC
            LIMIT ?
        `).bind(`%${query}%`, limit).all<any>();

        return (results || []).map(r => ({
            source_id: r.source_id,
            title: r.title,
            url: r.url,
            excerpt: r.excerpt
        }));
    }
}
