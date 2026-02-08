-- Agent Memory System Schema
-- Migration: 0002_agent_memory.sql

-- Agent event logs (for memory and context)
CREATE TABLE IF NOT EXISTS agent_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    event_data TEXT,
    telegram_id INTEGER,
    chat_id INTEGER,
    timestamp INTEGER NOT NULL,
    metadata TEXT
);

CREATE INDEX idx_agent_logs_type ON agent_logs(event_type);
CREATE INDEX idx_agent_logs_telegram ON agent_logs(telegram_id);
CREATE INDEX idx_agent_logs_timestamp ON agent_logs(timestamp);

-- Agent memory summaries (daily digests, insights)
CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_type TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    telegram_id INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata TEXT
);

CREATE INDEX idx_agent_memory_type ON agent_memory(memory_type);
CREATE INDEX idx_agent_memory_telegram ON agent_memory(telegram_id);
CREATE INDEX idx_agent_memory_created ON agent_memory(created_at);

-- User state tracking (for cooldowns and preferences)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL UNIQUE,
    first_name TEXT,
    username TEXT,
    lang TEXT DEFAULT 'ar',
    last_interacted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_users_telegram ON users(telegram_id);
CREATE INDEX idx_users_last_interacted ON users(last_interacted_at);
