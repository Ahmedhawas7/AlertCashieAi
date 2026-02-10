import { fetchUrl } from './fetcher';
import { extractContent } from './extractor';
import { summarize } from './summarizer';
import { extractEntities } from './entities';
import { FreeAiStore } from './store';
import { KBNote, KBPassage } from './types';

/**
 * High-level planner to execute complex agentic intents.
 */
export class FreeAiPlanner {
    private store: FreeAiStore;

    constructor(db: D1Database) {
        this.store = new FreeAiStore(db);
    }

    async ingestUrl(url: string, actor: string = "api"): Promise<any> {
        // 1. Fetch
        const { text, contentType } = await fetchUrl(url);

        // 2. Extract
        const { title, content, site } = extractContent(text, url);
        const hash = await this.hashContent(content);

        // 3. Summarize
        const { tldr, bullets, facts } = summarize(content);

        // 4. Entities
        const entities = extractEntities(content);

        // 5. Store Source
        const sourceId = await this.store.upsertSource({
            url, title, site, content_hash: hash
        });

        // 6. Store Notes
        const noteId = crypto.randomUUID();
        await this.store.saveNotes({
            id: noteId,
            source_id: sourceId,
            tldr,
            bullets: JSON.stringify(bullets),
            facts_json: JSON.stringify(facts),
            entities_json: JSON.stringify(entities),
            keywords_json: "[]",
            created_at: Date.now()
        });

        // 7. Store Passages (Chunking)
        const passages: KBPassage[] = this.chunkContent(content, sourceId);
        await this.store.savePassages(passages);

        return { sourceId, title, tldr };
    }

    private chunkContent(content: string, sourceId: string): KBPassage[] {
        // Simple chunking by 300 chars or paragraphs
        const paragraphs = content.split('\n\n').filter(p => p.length > 20);
        return paragraphs.map((p, i) => ({
            id: crypto.randomUUID(),
            source_id: sourceId,
            idx: i,
            excerpt: p.substring(0, 300),
            created_at: Date.now()
        }));
    }

    private async hashContent(content: string): Promise<string> {
        const msgUint8 = new TextEncoder().encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
