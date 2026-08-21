import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type PulseResponse,
  type PulseSettings,
  type ServiceMutationResult,
} from '../lib/supabase';
import { generatePortalSlug } from './portal';

// Reuse the exact same slug scheme as Portal Cliente (name + random token) —
// the generator itself has nothing portal-specific about it.
export const generatePulseSlug = generatePortalSlug;

// ── Admin: settings (internal, authenticated only — RLS enforced) ─────────────

export async function listPulseSettings(): Promise<PulseSettings[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.from('pulse_settings').select('*');
  if (error) {
    console.error('[pulse] listPulseSettings', error);
    return [];
  }

  return (data ?? []) as PulseSettings[];
}

export async function upsertPulseSettings(input: {
  client_id: string;
  enabled: boolean;
  public_slug?: string;
}): Promise<ServiceMutationResult<PulseSettings>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const { data, error } = await supabase
    .from('pulse_settings')
    .upsert(
      { client_id: input.client_id, enabled: input.enabled, public_slug: input.public_slug },
      { onConflict: 'client_id' },
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[pulse] upsertPulseSettings', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar la configuración de Pulso.') };
  }

  return { data: (data ?? null) as PulseSettings | null, error: null };
}

// ── Admin: responses (internal, authenticated only — RLS enforced) ────────────

export async function listPulseResponses(clientId: string): Promise<PulseResponse[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('pulse_responses')
    .select('*')
    .eq('client_id', clientId)
    .order('month', { ascending: false });

  if (error) {
    console.error('[pulse] listPulseResponses', error);
    return [];
  }

  return (data ?? []) as PulseResponse[];
}

export function currentMonthFirstDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// All responses for a given month (first-of-month date), across every
// client — the Satisfacción page does the averaging/tag-tallying itself.
export async function listPulseResponsesByMonth(monthFirstDay: string): Promise<PulseResponse[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('pulse_responses')
    .select('*')
    .eq('month', monthFirstDay);

  if (error) {
    console.error('[pulse] listPulseResponsesByMonth', error);
    return [];
  }

  return (data ?? []) as PulseResponse[];
}

// ── Public page — always via server-side API routes (no direct anon table
// access at all: no PIN here, but the same single-choke-point pattern as the
// rest of the public-portal modules) ───────────────────────────────────────

export type PulseResolveResult = {
  client_id: string;
  name: string;
  logo_url: string | null;
  enabled: boolean;
  already_responded: boolean;
};

export type PulseApiResult<T> = { data: T | null; error: string | null; status: number };

async function pulseApi<T>(path: string, body: Record<string, unknown>): Promise<PulseApiResult<T>> {
  try {
    const res = await fetch(`/api/pulse/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: json.error ?? `Error ${res.status}`, status: res.status };
    }
    return { data: json as T, error: null, status: res.status };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Error de red.', status: 0 };
  }
}

export async function resolvePulseSlug(slug: string): Promise<PulseApiResult<PulseResolveResult>> {
  return pulseApi<PulseResolveResult>('resolve', { slug });
}

export async function submitPulseResponse(input: {
  slug: string;
  mood_score: number;
  liked_tags: string[];
  improve_tags: string[];
  note: string;
}): Promise<PulseApiResult<PulseResponse>> {
  return pulseApi<PulseResponse>('submit', input);
}
