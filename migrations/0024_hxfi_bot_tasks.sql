-- Migration 0024: Bot Task Progress
CREATE TABLE IF NOT EXISTS hxfi_bot_tasks (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed'
    updated_at INTEGER NOT NULL
);

-- Seed initial tasks
INSERT INTO hxfi_bot_tasks (id, name, status, updated_at) VALUES (1, 'Task 1: Core Message Handling', 'completed', 1740900000000);
INSERT INTO hxfi_bot_tasks (id, name, status, updated_at) VALUES (2, 'Task 2: Speech-to-Text Integration', 'completed', 1740900000000);
INSERT INTO hxfi_bot_tasks (id, name, status, updated_at) VALUES (3, 'Task 3: Text-to-Speech for bot responses', 'completed', 1740900000000);
INSERT INTO hxfi_bot_tasks (id, name, status, updated_at) VALUES (4, 'Task 4: Add command execution capability', 'completed', 1740900000000);
INSERT INTO hxfi_bot_tasks (id, name, status, updated_at) VALUES (5, 'Task 5: Ensure cross‑platform compatibility', 'completed', 1740900000000);
INSERT INTO hxfi_bot_tasks (id, name, status, updated_at) VALUES (6, 'Task 6: Write or update automated tests', 'completed', 1740900000000);
INSERT INTO hxfi_bot_tasks (id, name, status, updated_at) VALUES (7, 'Task 7: Create deployment scripts', 'completed', 1740900000000);
INSERT INTO hxfi_bot_tasks (id, name, status, updated_at) VALUES (8, 'Task 8: Perform end‑to‑end verification', 'completed', 1740900000000);
INSERT INTO hxfi_bot_tasks (id, name, status, updated_at) VALUES (9, 'Task 9: Final code review and cleanup', 'completed', 1740900000000);
