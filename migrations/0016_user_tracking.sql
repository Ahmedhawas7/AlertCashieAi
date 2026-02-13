-- Migration: User Tracking
CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    is_private INTEGER DEFAULT 0,
    joined_at INTEGER,
    last_seen INTEGER
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_is_private ON users(is_private);
