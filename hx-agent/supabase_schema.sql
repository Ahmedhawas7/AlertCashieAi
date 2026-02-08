-- Enable pgvector if available (Optional)
create extension if not exists vector;

-- 1. Users Table
create table if not exists users (
  id bigint primary key, -- Telegram User ID
  username text,
  first_name text,
  language_code text,
  role text default 'user', -- 'admin', 'user'
  created_at timestamptz default now()
);

-- 2. Chats Table
create table if not exists chats (
  id bigint primary key, -- Telegram Chat ID
  type text, -- private, group, etc.
  title text,
  created_at timestamptz default now()
);

-- 3. Messages (Short-term Memory)
create table if not exists messages (
  id bigint generated always as identity primary key,
  chat_id bigint, -- references chats(id) but simplified for speed
  user_id bigint, -- references users(id)
  role text, -- 'user', 'assistant', 'system', 'tool'
  content text,
  meta jsonb, -- token usage, tool calls id
  created_at timestamptz default now()
);
create index if not exists idx_messages_chat_created on messages(chat_id, created_at desc);

-- 4. Memories (Long-term / Facts)
create table if not exists memories (
  id bigint generated always as identity primary key,
  user_id bigint,
  type text, -- 'fact', 'preference', 'summary'
  key text, -- 'hobbies', 'job', etc.
  value text,
  embedding vector(1536), -- Optional for semantic search
  created_at timestamptz default now(),
  unique(user_id, key)
);

-- 5. Jobs (Scheduler)
create table if not exists jobs (
  id bigint generated always as identity primary key,
  skill_name text not null,
  schedule text not null, -- cron expression
  params jsonb default '{}',
  target_chat_id bigint,
  active boolean default true,
  created_at timestamptz default now()
);

-- 6. Skills Registry (Synced from code)
create table if not exists skills_registry (
  name text primary key,
  description text,
  parameters jsonb, -- input schema
  updated_at timestamptz default now()
);

-- 7. Approvals (Audit log for safe actions)
-- Note: Active approvals are in-memory (Redis/Map), this is for history
create table if not exists approval_logs (
  id bigint generated always as identity primary key,
  token text,
  user_id bigint,
  action text,
  status text, -- 'approved', 'rejected', 'expired'
  created_at timestamptz default now()
);

-- RLS (Row Level Security) - Basic Setup
alter table users enable row level security;
alter table messages enable row level security;
alter table memories enable row level security;

-- For a simple bot using SERVICE_KEY, RLS is bypassed. 
-- But good practice to have policies if you add a Frontend later.
