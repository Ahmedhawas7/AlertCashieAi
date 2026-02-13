mport { Env } from '../types';

export type PolyMode = 'OFF' | 'OBSERVE' | 'EXECUTE';

export type PolySettings = {
  mode: PolyMode;
  minMispricingPct: number; // default 8
  maxRiskPct: number;       // default 3 (hard cap 6 later)
  updatedAt: string;
};

// Simple in-memory state for MVP (no DB). Resets on cold start.
const STATE: PolySettings = {
  mode: 'OBSERVE',
  minMispricingPct: 8,
  maxRiskPct: 3,
  updatedAt: new Date().toISOString(),
};

export async function getPolySettings(): Promise<PolySettings> {
  return STATE;
}

export async function setPolySettings(next: PolySettings): Promise<void> {
  STATE.mode = next.mode;
  STATE.minMispricingPct = next.minMispricingPct;
  STATE.maxRiskPct = next.maxRiskPct;
  STATE.updatedAt = new Date().toISOString();
}

export function isOwner(env: Env, telegramUserId: string) {
  return telegramUserId === (env.OWNER_TELEGRAM_ID || '');
}import { DB } from '../db';
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

export async function getPolySettings(db: DB): Promise<PolySettings> {
  // We store in a tiny D1 table. If table doesn't exist yet, fallback defaults.
  try {
    const row = await db.prepare(`SELECT value FROM kv_settings WHERE key = 'poly_settings'`).first<{ value: string }>();
    if (!row?.value) return DEFAULT_SETTINGS;
    return JSON.parse(row.value) as PolySettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setPolySettings(db: DB, settings: PolySettings): Promise<void> {
  const value = JSON.stringify({ ...settings, lastUpdated: new Date().toISOString() });
  // kv_settings is expected (many projects have it). If not present, we’ll create it in next step.
  await db.prepare(`INSERT INTO kv_settings(key, value) VALUES('poly_settings', ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(value).run();
}

export function isOwner(env: Env, telegramUserId: string) {
  return telegramUserId === (env.OWNER_TELEGRAM_ID || 

