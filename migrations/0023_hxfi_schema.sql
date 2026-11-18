-- Migration: HXFi Web Platform Schema
-- Run: wrangler d1 execute hawas-db --remote --file=migrations/0023_hxfi_schema.sql

-- 1. HXFi Web User Profiles
CREATE TABLE IF NOT EXISTS hxfi_profiles (
    user_id TEXT PRIMARY KEY,  -- wallet address (lowercase)
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0,
    stars INTEGER DEFAULT 0,
    badges_json TEXT DEFAULT '[]',
    last_active INTEGER,
    updated_at INTEGER NOT NULL
);

-- 2. Missions catalog
CREATE TABLE IF NOT EXISTS hxfi_missions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward_xp INTEGER DEFAULT 0,
    reward_stars INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    category TEXT DEFAULT 'general',
    created_at INTEGER NOT NULL
);

-- 3. Mission completions (each user can complete each mission once)
CREATE TABLE IF NOT EXISTS hxfi_mission_completions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    completed_at INTEGER NOT NULL,
    UNIQUE(user_id, mission_id)
);

-- 4. Tickets (entry ticket purchase records, compliance-friendly)
CREATE TABLE IF NOT EXISTS hxfi_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    price_usd REAL NOT NULL,
    payment_provider TEXT DEFAULT 'stub',
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL
);

-- 5. Web chat sessions
CREATE TABLE IF NOT EXISTS hxfi_chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 6. Web chat messages
CREATE TABLE IF NOT EXISTS hxfi_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,   -- 'user' | 'assistant'
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 7. Wallet auth nonces (expire after 10 min)
CREATE TABLE IF NOT EXISTS hxfi_auth_nonces (
    address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

-- 8. Web session tokens (expire after 7 days)
CREATE TABLE IF NOT EXISTS hxfi_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,        -- wallet address (lowercase)
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- 9. Pending web chat plans (for plan→confirm→execute flow)
CREATE TABLE IF NOT EXISTS hxfi_pending_plans (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    plan_json TEXT NOT NULL,
    status TEXT DEFAULT 'pending',   -- 'pending' | 'executed' | 'cancelled'
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hxfi_completions_user ON hxfi_mission_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_hxfi_tickets_user ON hxfi_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_hxfi_chat_messages_session ON hxfi_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_hxfi_sessions_user ON hxfi_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_hxfi_pending_plans_session ON hxfi_pending_plans(session_id);
