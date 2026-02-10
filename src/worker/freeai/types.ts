export interface KBSource {
    id: string;
    url: string;
    canonical_url?: string;
    title?: string;
    site?: string;
    fetched_at: number;
    content_hash: string;
    status: 'ok' | 'error';
    error?: string;
}

export interface KBNote {
    id: string;
    source_id: string;
    tldr: string;
    bullets: string; // JSON string in DB
    facts_json: string;
    entities_json: string;
    keywords_json: string;
    created_at: number;
}

export interface KBPassage {
    id: string;
    source_id: string;
    idx: number;
    heading?: string;
    excerpt: string;
    created_at: number;
}

export interface MemoryFact {
    user_id: string;
    key: string;
    value: string;
    confidence: number;
    updated_at: number;
}

export interface FreeAiResult {
    answer: string;
    citations: Citation[];
    confidence: number;
}

export interface Citation {
    source_id: string;
    title: string;
    url: string;
    excerpt: string;
}

export interface IngestResult {
    source_id: string;
    title: string;
    tldr: string;
}
