import { KBSource, KBNote, KBPassage } from './types';
import { tokenize } from './normalize';

export class FreeAiStore {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async upsertSource(source: Partial<KBSource>): Promise<string> {
        const id = source.id || crypto.randomUUID();
        await this.db.prepare(
            "INSERT INTO kb_sources (id, url, canonical_url, title, site, fetched_at, content_hash, status) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT(url) DO UPDATE SET " +
            "title = EXCLUDED.title, fetched_at = EXCLUDED.fetched_at, " +
            "content_hash = EXCLUDED.content_hash, status = EXCLUDED.status"
        ).bind(
            id, source.url, source.canonical_url || null,
            source.title || null, source.site || null,
            Date.now(), source.content_hash, 'ok'
        ).run();

        // If conflict update happened, retrieve the existing id
        const existing = await this.db.prepare("SELECT id FROM kb_sources WHERE url = ?").bind(source.url).first<{ id: string }>();
        return existing?.id || id;
    }

    async saveNotes(notes: KBNote): Promise<void> {
        await this.db.prepare(
            "INSERT INTO kb_notes (id, source_id, tldr, bullets, facts_json, entities_json, keywords_json, created_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
            notes.id, notes.source_id, notes.tldr, notes.bullets,
            notes.facts_json, notes.entities_json, notes.keywords_json, notes.created_at
        ).run();
    }

    async savePassages(passages: KBPassage[]): Promise<void> {
        const statements = passages.map(p =>
            this.db.prepare(
                "INSERT INTO kb_passages (id, source_id, idx, heading, excerpt, created_at) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(p.id, p.source_id, p.idx, p.heading || null, p.excerpt, p.created_at)
        );
        await this.db.batch(statements);

        // Optional: Index terms for BM25
        await this.indexTerms(passages);
    }

    private async indexTerms(passages: KBPassage[]): Promise<void> {
        const termMap: Map<string, Array<{ passage_id: string; tf: number }>> = new Map();

        for (const p of passages) {
            const tokens = tokenize(p.excerpt);
            const counts: Record<string, number> = {};
            tokens.forEach(t => counts[t] = (counts[t] || 0) + 1);

            for (const [term, tf] of Object.entries(counts)) {
                if (!termMap.has(term)) termMap.set(term, []);
                termMap.get(term)!.push({ passage_id: p.id, tf });
            }
        }

        const statements: D1PreparedStatement[] = [];
        for (const [term, matches] of termMap.entries()) {
            for (const m of matches) {
                statements.push(
                    this.db.prepare("INSERT INTO kb_terms (term, passage_id, tf) VALUES (?, ?, ?)")
                        .bind(term, m.passage_id, m.tf)
                );
            }
        }

        if (statements.length > 0) {
            // Batch inserts in smaller chunks if needed, but for now try bulk
            await this.db.batch(statements);
        }
    }

    async getRecentSources(limit: number = 10): Promise<KBSource[]> {
        const { results } = await this.db.prepare(
            "SELECT * FROM kb_sources ORDER BY fetched_at DESC LIMIT ?"
        ).bind(limit).all<KBSource>();
        return results || [];
    }
}
