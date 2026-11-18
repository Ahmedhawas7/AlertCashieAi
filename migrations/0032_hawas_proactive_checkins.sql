-- Migration 0032: Hawas Proactive Check-ins & Milestones Tracker
CREATE TABLE IF NOT EXISTS hawas_proactive_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    checkin_date TEXT NOT NULL,
    topic TEXT,
    message_text TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proactive_user_date ON hawas_proactive_checkins(user_id, checkin_date);
