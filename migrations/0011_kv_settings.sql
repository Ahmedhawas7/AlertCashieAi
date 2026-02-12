-- 0011_kv_settings.sql
CREATE TABLE IF NOT EXISTS kv_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
