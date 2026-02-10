-- Migration: Agent Personality and Memory
-- Tables for human-like conversation, context, and anti-repetition

-- 1. Store durable notes, facts, and habits
CREATE TABLE IF NOT EXISTS bot_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    kind TEXT NOT NULL, -- 'fact', 'habit', 'preference', 'note'
    content TEXT NOT NULL,
    tags TEXT, -- comma-separated keywords
    created_at INTEGER NOT NULL,
    deprecated INTEGER DEFAULT 0 -- 1 if forgotten
);

-- 2. Track recent replies to avoid repetition
CREATE TABLE IF NOT EXISTS bot_recent_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    reply TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 3. Context window for conversation
CREATE TABLE IF NOT EXISTS bot_recent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'user', 'bot'
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 4. Persona and settings per chat
CREATE TABLE IF NOT EXISTS bot_settings (
    chat_id INTEGER PRIMARY KEY,
    persona TEXT DEFAULT 'calm', -- 'calm', 'hype', 'strict'
    ai_enabled INTEGER DEFAULT 0,
    daily_ai_limit INTEGER DEFAULT 10,
    ai_calls_today INTEGER DEFAULT 0,
    last_reset_day TEXT -- YYYY-MM-DD
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_bot_memory_chat_id ON bot_memory(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_recent_replies_chat_id ON bot_recent_replies(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_recent_messages_chat_id ON bot_recent_messages(chat_id);
