-- 0012_free_ai_api.sql
-- FreeAI API: sources + notes + passages + events + lightweight index

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS kb_sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  canonical_url TEXT,
  title TEXT,
  site TEXT,
  fetched_at INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT
);

CREATE TABLE IF NOT EXISTS kb_notes (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  tldr TEXT NOT NULL,
  bullets TEXT NOT NULL,
  facts_json TEXT NOT NULL,
  entities_json TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (source_id) REFERENCES kb_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kb_passages (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  heading TEXT,
  excerpt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (source_id) REFERENCES kb_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kb_terms (
  term TEXT NOT NULL,
  passage_id TEXT NOT NULL,
  tf INTEGER NOT NULL,
  PRIMARY KEY (term, passage_id),
  FOREIGN KEY (passage_id) REFERENCES kb_passages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kb_events (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  actor TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_sources_fetched_at ON kb_sources(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_passages_source ON kb_passages(source_id, idx);
CREATE INDEX IF NOT EXISTS idx_kb_terms_term ON kb_terms(term);
