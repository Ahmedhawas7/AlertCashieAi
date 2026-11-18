-- Migration: 0030_hawas_daily_diary.sql
-- Hawas Daily Diary & Self-Reflection System
-- Stores daily learnings, unclear areas Hawas wishes to master, future goals, and human-like inner monologue.

CREATE TABLE IF NOT EXISTS hawas_daily_diaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    diary_date TEXT NOT NULL,          -- Format: YYYY-MM-DD
    summary_learned TEXT NOT NULL,     -- What Hawas learned today about user & world
    unclear_wishes TEXT NOT NULL,      -- Things Hawas found challenging/unclear and wishes to understand with time & effort
    future_goals TEXT NOT NULL,        -- Future goals & plans for upcoming interactions
    inner_reflection TEXT NOT NULL,    -- Human-like self-monologue and daily reflection
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, diary_date)
);

CREATE INDEX IF NOT EXISTS idx_diary_user_date ON hawas_daily_diaries(user_id, diary_date);
