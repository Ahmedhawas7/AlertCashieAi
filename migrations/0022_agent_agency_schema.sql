-- Migration number: 0022 	 2026-02-21T18:30:00.000Z
-- Agentic Upgrade: Tasks, Steps, and Experience Memory

-- 1. Agent Tasks (High-level goals)
CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    goal TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, PLANNING, EXECUTING, COMPLETED, FAILED
    plan_json TEXT, -- The overall structured plan
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. Agent Steps (Individual actions within a task)
CREATE TABLE IF NOT EXISTS agent_steps (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    description TEXT NOT NULL,
    action TEXT NOT NULL,
    params_json TEXT,
    result_json TEXT,
    status TEXT DEFAULT 'PENDING', -- PENDING, RUNNING, DONE, ERROR
    error_msg TEXT,
    order_index INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

-- 3. Agent Experience (Long-term learning from successful plans)
CREATE TABLE IF NOT EXISTS agent_experience (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_category TEXT NOT NULL, -- e.g. 'INVESTMENT_SEARCH', 'WALLET_RECOVERY'
    goal_query TEXT NOT NULL,
    successful_plan_json TEXT NOT NULL,
    outcome_summary TEXT,
    usage_count INTEGER DEFAULT 1,
    last_used_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_task ON agent_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_exp_category ON agent_experience(goal_category);
