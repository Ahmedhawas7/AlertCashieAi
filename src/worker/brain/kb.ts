import { normalizeText, tokenize } from './normalize';

export interface KBDoc {
    id: string;
    title: string;
    content: string;
    tags?: string;
    created_at: number;
    updated_at: number;
}

export class KnowledgeBase {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    /**
     * Add or update a KB document
     */
    async addDoc(title: string, content: string, tags: string = ""): Promise<string> {
        const id = crypto.randomUUID();
        const now = Date.now();
        await this.db.prepare(`
            INSERT INTO kb_docs (id, title, content, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(id, title, content, tags, now, now).run();
        return id;
    }

    /**
     * Search KB docs using a simple keyword-based approach
     * Returns top documents with overlap scores
     */
    async search(query: string, limit: number = 5): Promise<(KBDoc & { score: number })[]> {
        const queryTokens = tokenize(query);
        if (queryTokens.length === 0) return [];

        // Fetch all docs for manual scoring (since BM25 is not built-in to D1)
        // Optimization: In a real app with 1000s of docs, we'd use a FTS extension or pre-tokenize in a separate table.
        const res = await this.db.prepare("SELECT * FROM kb_docs").all<KBDoc>();
        const docs = res.results || [];

        const scored = docs.map((doc: KBDoc) => {
            let score = 0;
            const docText = normalizeText(`${doc.title} ${doc.content} ${doc.tags || ""}`);

            for (const token of queryTokens) {
                if (docText.includes(token)) {
                    // Title match is worth more
                    if (normalizeText(doc.title).includes(token)) {
                        score += 10;
                    } else {
                        score += 2;
                    }
                }
            }
            return { ...doc, score };
        });

        return scored
            .filter((d: KBDoc & { score: number }) => d.score > 0)
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * List all documents (titles and IDs only)
     */
    async listDocs(): Promise<Pick<KBDoc, 'id' | 'title'>[]> {
        const res = await this.db.prepare("SELECT id, title FROM kb_docs ORDER BY title ASC").all<Pick<KBDoc, 'id' | 'title'>>();
        return res.results || [];
    }

    /**
     * Get single document by ID
     */
    async getDoc(id: string): Promise<KBDoc | null> {
        return await this.db.prepare("SELECT * FROM kb_docs WHERE id = ?").bind(id).first<KBDoc>();
    }
}
