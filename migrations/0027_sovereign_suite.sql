-- Migration 0027: Sovereign Suite (Alerts & Paper Trading)
CREATE TABLE IF NOT EXISTS user_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    coin_symbol TEXT,
    condition TEXT, -- 'above', 'below', 'reminder'
    target_value REAL,
    message TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    triggered_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON user_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user ON user_alerts(user_id);

CREATE TABLE IF NOT EXISTS paper_positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    amount REAL NOT NULL,
    entry_price REAL NOT NULL,
    created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_paper_positions_user ON paper_positions(user_id);
