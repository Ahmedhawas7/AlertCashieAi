-- Migration 0025: Real Execution System (agent_tasks)
-- Drop the legacy unused table from 0022 if it exists to replace it with the new standard.
DROP TABLE IF EXISTS agent_steps;
DROP TABLE IF EXISTS agent_tasks;

CREATE TABLE agent_tasks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT,
    type TEXT,
    status TEXT, -- 'pending', 'in_progress', 'completed', 'failed'
    progress_current INTEGER DEFAULT 0,
    progress_total INTEGER DEFAULT 1,
    steps_json TEXT, -- JSON array of steps
    result_json TEXT, -- Final output
    error TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_owner ON agent_tasks(owner_id);
