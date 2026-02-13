-- Migration number: 0009 	 2026-02-10T09:00:00.000Z
-- Table for tracking transaction rate limits (daily volume)

CREATE TABLE IF NOT EXISTS tx_rate_limits (
    user_id TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL, -- Timestamp of the start of the current window (e.g., midnight)
    tx_count INTEGER DEFAULT 0,
    total_volume_usdc REAL DEFAULT 0,
    updated_at INTEGER
);

-- Index for cleanup (optional, but good for identifying old windows)
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON tx_rate_limits(window_start);
