-- Migration: Agency Enhancements
-- 1. Table for group-specific settings (Silence Mode)
CREATE TABLE IF NOT EXISTS group_settings (
    chat_id TEXT PRIMARY KEY,
    mode TEXT DEFAULT 'CHATTY', -- CHATTY, SILENT, NEWS_ONLY
    updated_at INTEGER
);

-- Note: No specific news table needed yet, as news is research-based on-the-fly.
