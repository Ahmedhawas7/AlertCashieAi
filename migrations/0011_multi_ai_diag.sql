-- Migration: 0011_multi_ai_diag.sql
-- Description: Updates ai_diag for multi-provider tracking and daily quotas.

-- Drop old table to ensure clean schema update for new requirements
DROP TABLE IF EXISTS ai_diag;

CREATE TABLE ai_diag (
    user_id TEXT PRIMARY KEY,
    today_date TEXT NOT NULL,
    today_calls INTEGER DEFAULT 0,
    last_success_provider TEXT,
    last_error_provider TEXT,
    last_status INTEGER,
    last_error TEXT,
    last_latency INTEGER,
    updated_at INTEGER NOT NULL
);
