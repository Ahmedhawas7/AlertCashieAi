-- Migration: Session Agent Tables
CREATE TABLE IF NOT EXISTS session_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    session_public_key TEXT NOT NULL,
    session_private_key TEXT NOT NULL, -- Encrypted locally
    permissions TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_tx (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    recipient TEXT NOT NULL,
    token TEXT NOT NULL,
    amount TEXT NOT NULL,
    data TEXT,
    status TEXT DEFAULT 'pending', -- pending, executed, failed, cancelled
    tx_hash TEXT,
    created_at INTEGER NOT NULL
);
