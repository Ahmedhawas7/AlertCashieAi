-- CARV ID Integration Schema
-- Migration: 0001_carv_integration.sql

-- Pending OAuth sessions (CSRF protection)
CREATE TABLE IF NOT EXISTS pending_connect_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    state TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX idx_pending_sessions_telegram ON pending_connect_sessions(telegram_id);
CREATE INDEX idx_pending_sessions_state ON pending_connect_sessions(state);
CREATE INDEX idx_pending_sessions_expires ON pending_connect_sessions(expires_at);

-- Persistent CARV ID connections
CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL UNIQUE,
    carv_id TEXT NOT NULL,
    wallet_address TEXT,
    email TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    linked_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_connections_telegram ON connections(telegram_id);
CREATE INDEX idx_connections_carv ON connections(carv_id);

-- Audit logs for auth events
CREATE TABLE IF NOT EXISTS auth_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    details TEXT,
    timestamp INTEGER NOT NULL
);

CREATE INDEX idx_auth_logs_telegram ON auth_logs(telegram_id);
CREATE INDEX idx_auth_logs_timestamp ON auth_logs(timestamp);
