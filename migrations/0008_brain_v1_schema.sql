-- Migration: Hawas Brain v1 Schema
-- Tables for offline-first memory, knowledge, and skills

-- 1. Persistent User Memory
CREATE TABLE IF NOT EXISTS user_memory (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
);

-- 2. Episodic Interaction Logs
CREATE TABLE IF NOT EXISTS episodic_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    text TEXT NOT NULL,
    intent TEXT,
    entities_json TEXT, -- Store parsed entities as JSON
    outcome TEXT
);

-- 3. Knowledge Base Documents
CREATE TABLE IF NOT EXISTS kb_docs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 4. Skills Registry
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    triggers_json TEXT NOT NULL, -- Keywords/Phrases to trigger
    steps_md TEXT NOT NULL,       -- Procedural markdown steps
    safety_rules_md TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 5. Skill Proposals (Self-Improvement)
CREATE TABLE IF NOT EXISTS skill_proposals (
    id TEXT PRIMARY KEY,
    proposal_md TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_episodic_user ON episodic_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_episodic_ts ON episodic_logs(ts);
CREATE INDEX IF NOT EXISTS idx_kb_title ON kb_docs(title);
