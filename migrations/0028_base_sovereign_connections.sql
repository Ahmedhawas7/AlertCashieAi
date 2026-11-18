-- Base Sovereign Link Schema
-- Migration: 0028_base_sovereign_connections.sql

CREATE TABLE IF NOT EXISTS base_connections (
    telegram_user_id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 8453,
    signature TEXT NOT NULL,
    message TEXT NOT NULL,
    linked_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS base_pending_sessions (
    nonce TEXT PRIMARY KEY,
    telegram_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_base_conn_wallet ON base_connections(wallet_address);
CREATE INDEX IF NOT EXISTS idx_base_pending_user ON base_pending_sessions(telegram_user_id);
