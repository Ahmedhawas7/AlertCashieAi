-- AI Settings and Usage Tracking Migration

-- Store per-owner AI toggle
CREATE TABLE IF NOT EXISTS ai_user_settings (
    user_id TEXT PRIMARY KEY,
    ai_enabled INTEGER DEFAULT 0, -- 0 for OFF, 1 for ON
    updated_at INTEGER NOT NULL
);

-- Track daily AI usage for quota enforcement
CREATE TABLE IF NOT EXISTS ai_usage (
    user_id TEXT,
    usage_date TEXT, -- YYYY-MM-DD
    call_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
);

-- Index for faster usage lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(usage_date);
