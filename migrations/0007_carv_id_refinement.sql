-- Refine CARV ID Integration Tables
-- Migration: 0007_carv_id_refinement.sql

-- Drop existing tables to ensure exact schema match
DROP TABLE IF EXISTS pending_connect_sessions;
DROP TABLE IF EXISTS connections;
DROP TABLE IF EXISTS auth_logs;

-- 1. Pending OAuth sessions
CREATE TABLE pending_connect_sessions (
    state TEXT PRIMARY KEY,
    telegram_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- 2. Persistent CARV ID connections
CREATE TABLE connections (
    telegram_user_id TEXT PRIMARY KEY,
    smart_wallet_address TEXT,
    signer_wallet_address TEXT,
    email_address TEXT,
    access_token_enc TEXT,
    refresh_token_enc TEXT,
    token_expires_at INTEGER,
    scope TEXT,
    linked_at INTEGER NOT NULL
);

-- 3. Audit logs for auth events
CREATE TABLE auth_logs (
    id TEXT PRIMARY KEY,
    telegram_user_id TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT,
    created_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_pending_user ON pending_connect_sessions(telegram_user_id);
CREATE INDEX idx_connections_wallet ON connections(smart_wallet_address);
CREATE INDEX idx_auth_logs_user ON auth_logs(telegram_user_id);
