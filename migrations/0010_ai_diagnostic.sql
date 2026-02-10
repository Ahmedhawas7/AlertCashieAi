-- AI Diagnostic Tracking Migration

CREATE TABLE IF NOT EXISTS ai_diag (
    user_id TEXT PRIMARY KEY,
    last_error TEXT,
    last_status INTEGER,
    last_latency INTEGER,
    updated_at INTEGER NOT NULL,
    today_calls INTEGER DEFAULT 0
);
