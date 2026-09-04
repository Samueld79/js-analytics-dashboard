import { createClient } from '@supabase/supabase-js';
import type { VercelResponse } from '@vercel/node';

export function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const PIN_PATTERN = /^[0-9]{4}$/;

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && PIN_PATTERN.test(pin);
}

// A client can opt out of the PIN gate entirely (client_portal_settings.pin_required
// = false) — in that case any request is allowed through regardless of what
// pin value (if any) was sent. When required, falls back to the normal
// format + equality check.
export function checkPin(pin: unknown, required: boolean, expected: string): boolean {
  if (!required) return true;
  return isValidPin(pin) && pin === expected;
}

// Sentinel campaign_id for the day-level "Nota del día" row in
// portal_daily_entries — a note isn't tied to any single campaign, but the
// table's grain is (client_id, date, campaign_id). Must match the constant
// of the same name in src/services/portal.ts.
export const PORTAL_NOTE_CAMPAIGN_ID = '__nota_general__';
