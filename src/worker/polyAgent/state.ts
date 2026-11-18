import { Env } from '../types';

export type PolyMode = 'OFF' | 'OBSERVE' | 'EXECUTE';

export type PolySettings = {
  mode: PolyMode;
  minMispricingPct: number;   // e.g. 8
  maxRiskPct: number;         // hard cap 6
  lastUpdated: string;
};

const DEFAULT_SETTINGS: PolySettings = {
  mode: 'OBSERVE',
  minMispricingPct: 8,
  maxRiskPct: 3,
  lastUpdated: new Date().toISOString(),
};

export async function getPolySettings(db: D1Database): Promise<PolySettings> {
  // We store in a tiny D1 table. If table doesn't exist yet, fallback defaults.
  try {
    // NOTE: This assumes kv_settings exists. If not, it falls back to defaults.
    const row = await db.prepare(`SELECT value FROM poly_settings WHERE key = 'poly_settings_state'`).first<{ value: string }>();
    if (!row?.value) return DEFAULT_SETTINGS;
    return JSON.parse(row.value) as PolySettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setPolySettings(db: D1Database, settings: PolySettings): Promise<void> {
  const value = JSON.stringify({ ...settings, lastUpdated: new Date().toISOString() });
  await db.prepare(`INSERT INTO poly_settings(key, value) VALUES('poly_settings_state', ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(value).run();
}

export function isOwner(env: Env, telegramUserId: string) {
  return telegramUserId === (env.OWNER_TELEGRAM_ID || '');
}
