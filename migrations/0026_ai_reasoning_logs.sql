-- AI Reasoning Logs for Diagnostics
CREATE TABLE IF NOT EXISTS ai_reasoning_logs (
    user_id TEXT PRIMARY KEY,
    intent TEXT,
    entities TEXT,
    memory_used_keys TEXT, -- JSON array
    context_count INTEGER,
    tools_used TEXT, -- JSON array
    planner_ran BOOLEAN,
    timestamp INTEGER
);
