-- Migration number: 0014 	 2026-02-13T09:00:00.000Z
-- PolyAgent Schema: Free-Tier State Management

-- 1. Persistent Settings (Key-Value Store)
CREATE TABLE IF NOT EXISTS poly_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL, -- JSON string or simple value
    updated_at INTEGER
);

-- 2. Optimistic Locking (Mutex replacement for Durable Objects)
CREATE TABLE IF NOT EXISTS poly_locks (
    lock_key TEXT PRIMARY KEY,
    acquired_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    holder_id TEXT NOT NULL
);

-- 3. Pending Operations (OTP execution gates)
CREATE TABLE IF NOT EXISTS poly_ops (
    op_id TEXT PRIMARY KEY,
    otp_code TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON details of the action (e.g. trade params)
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

-- 4. Audit Log (Immutable history)
CREATE TABLE IF NOT EXISTS poly_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL, -- 'SCAN', 'ALERT', 'EXECUTE', 'ERROR'
    details TEXT, -- JSON summary
    timestamp INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_poly_ops_otp ON poly_ops(otp_code);
CREATE INDEX IF NOT EXISTS idx_poly_audit_ts ON poly_audit(timestamp);
