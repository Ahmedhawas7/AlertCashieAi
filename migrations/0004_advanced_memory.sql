-- Migration: Advanced Agent Memory and Persona
-- As per user requirements in Step 497

-- 1. Short-term context (last 20 messages)
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'user', 'bot'
    text TEXT NOT NULL,
    ts INTEGER NOT NULL
);

-- 2. Long-term facts
CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'preference', 'goal', 'fact', 'habit'
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    ts INTEGER NOT NULL,
    deprecated INTEGER DEFAULT 0 -- 1 if forgotten
);

-- 3. Long-term summaries
CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    day TEXT NOT NULL, -- YYYY-MM-DD
    summary TEXT NOT NULL,
    ts INTEGER NOT NULL
);

-- 4. Reply history to avoid repetition
CREATE TABLE IF NOT EXISTS reply_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    reply TEXT NOT NULL,
    ts INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_memories_chat_id ON memories(chat_id);
CREATE INDEX IF NOT EXISTS idx_summaries_chat_id ON summaries(chat_id);
CREATE INDEX IF NOT EXISTS idx_reply_history_chat_id ON reply_history(chat_id);
