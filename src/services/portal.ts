import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type ClientPortalSettings,
  type PortalAdDailyMetric,
  type PortalAssetType,
  type PortalCreativeAsset,
  type PortalDailyEntry,
  type PortalLeadTipo,
  type PortalLeadWithEntry,
  type PortalObjectionTally,
  type PortalTallyTipo,
  type ServiceMutationResult,
} from '../lib/supabase';

// Sentinel campaign_id for the day-level "Nota del día" row in
// portal_daily_entries — must match the constant of the same name in
// api/portal/_lib.ts.
export const PORTAL_NOTE_CAMPAIGN_ID = '__nota_general__';

function slugifyName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join('');
}

export function generatePortalSlug(clientName: string): string {
  return `${slugifyName(clientName)}-${randomToken(8)}`;
}

export function generatePortalPin(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b % 10).join('');
}

// ── Admin: portal settings (internal, authenticated only — RLS enforced) ──────

export async function listClientPortalSettings(): Promise<ClientPortalSettings[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.from('client_portal_settings').select('*');
  if (error) {
    console.error('[portal] listClientPortalSettings', error);
    return [];
  }

  return (data ?? []) as ClientPortalSettings[];
}

type UpsertPortalSettingsInput = {
  client_id: string;
  enabled: boolean;
  public_slug?: string;
  pin_registro?: string;
  pin_ventas?: string;
};

export async function upsertClientPortalSettings(
  input: UpsertPortalSettingsInput,
): Promise<ServiceMutationResult<ClientPortalSettings>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const payload = {
    client_id: input.client_id,
    enabled: input.enabled,
    public_slug: input.public_slug,
    pin_registro: input.pin_registro,
    pin_ventas: input.pin_ventas,
  };

  const { data, error } = await supabase
    .from('client_portal_settings')
    .upsert(payload, { onConflict: 'client_id' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[portal] upsertClientPortalSettings', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar la configuración del portal.') };
  }

  return { data: (data ?? null) as ClientPortalSettings | null, error: null };
}

// ── Admin: creative assets (internal, authenticated only — RLS enforced) ──────

export async function listPortalCreativeAssets(clientId: string): Promise<PortalCreativeAsset[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('portal_creative_assets')
    .select('*')
    .eq('client_id', clientId)
    .order('ad_id', { ascending: true });

  if (error) {
    console.error('[portal] listPortalCreativeAssets', error);
    return [];
  }

  return (data ?? []) as PortalCreativeAsset[];
}

export async function listPortalDailyEntries(clientId: string): Promise<PortalDailyEntry[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('portal_daily_entries')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false });

  if (error) {
    console.error('[portal] listPortalDailyEntries', error);
    return [];
  }

  return (data ?? []) as PortalDailyEntry[];
}

export async function listPortalLeads(clientId: string): Promise<PortalLeadWithEntry[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('portal_leads')
    .select('*, daily_entry:portal_daily_entries(date, campaign_id)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[portal] listPortalLeads', error);
    return [];
  }

  return (data ?? []) as unknown as PortalLeadWithEntry[];
}

export async function listAdIdNameMap(clientId: string): Promise<Record<string, string>> {
  if (!isSupabaseConfigured || !supabase) return {};

  const { data, error } = await supabase
    .from('portal_ad_daily_metrics')
    .select('ad_id, ad_name')
    .eq('client_id', clientId);

  if (error) {
    console.error('[portal] listAdIdNameMap', error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { ad_id: string; ad_name: string }[]) {
    map[row.ad_id] = row.ad_name;
  }
  return map;
}

export type DistinctPortalAd = { ad_id: string; ad_name: string; adset_name: string };

export async function listDistinctAdsForClient(clientId: string): Promise<DistinctPortalAd[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('portal_ad_daily_metrics')
    .select('ad_id, ad_name, adset_name')
    .eq('client_id', clientId)
    .order('date', { ascending: false });

  if (error) {
    console.error('[portal] listDistinctAdsForClient', error);
    return [];
  }

  const byId = new Map<string, DistinctPortalAd>();
  for (const row of (data ?? []) as DistinctPortalAd[]) {
    if (!byId.has(row.ad_id)) byId.set(row.ad_id, row);
  }
  return [...byId.values()].sort((a, b) => a.ad_name.localeCompare(b.ad_name));
}

export async function upsertPortalCreativeAsset(input: {
  client_id: string;
  ad_id: string;
  conjunto_label?: string | null;
  asset_url: string;
  asset_type: PortalAssetType;
}): Promise<ServiceMutationResult<PortalCreativeAsset>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const { data, error } = await supabase
    .from('portal_creative_assets')
    .upsert(
      {
        client_id: input.client_id,
        ad_id: input.ad_id,
        conjunto_label: input.conjunto_label?.trim() || null,
        asset_url: input.asset_url,
        asset_type: input.asset_type,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,ad_id' },
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[portal] upsertPortalCreativeAsset', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar el creativo.') };
  }

  return { data: (data ?? null) as PortalCreativeAsset | null, error: null };
}

export async function uploadPortalCreativeFile(
  clientId: string,
  adId: string,
  file: File,
): Promise<ServiceMutationResult<{ asset_url: string; asset_type: PortalAssetType }>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${clientId}/${slugifyName(adId) || 'creativo'}.${ext}`;
  const asset_type: PortalAssetType = file.type.startsWith('video/') ? 'video' : 'image';

  const { error: uploadError } = await supabase.storage
    .from('portal-creatives')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error('[portal] uploadPortalCreativeFile', uploadError);
    return { data: null, error: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from('portal-creatives').getPublicUrl(path);
  const asset_url = `${urlData.publicUrl}?t=${Date.now()}`;

  return { data: { asset_url, asset_type }, error: null };
}

// ── Public page reads (anon key — allowed by RLS only while portal.enabled) ───

export async function listPublicPortalCreativeAssets(clientId: string): Promise<PortalCreativeAsset[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('portal_creative_assets')
    .select('*')
    .eq('client_id', clientId);

  if (error) {
    console.error('[portal] listPublicPortalCreativeAssets', error);
    return [];
  }

  return (data ?? []) as PortalCreativeAsset[];
}

export async function listPublicPortalDailyEntries(clientId: string): Promise<PortalDailyEntry[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('portal_daily_entries')
    .select('*')
    .eq('client_id', clientId);

  if (error) {
    console.error('[portal] listPublicPortalDailyEntries', error);
    return [];
  }

  return (data ?? []) as PortalDailyEntry[];
}

export async function listPublicPortalAdDailyMetrics(clientId: string): Promise<PortalAdDailyMetric[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('portal_ad_daily_metrics')
    .select('*')
    .eq('client_id', clientId);

  if (error) {
    console.error('[portal] listPublicPortalAdDailyMetrics', error);
    return [];
  }

  return (data ?? []) as PortalAdDailyMetric[];
}

export async function listPublicPortalObjectionTally(clientId: string): Promise<PortalObjectionTally[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('portal_objection_tally')
    .select('*')
    .eq('client_id', clientId);

  if (error) {
    console.error('[portal] listPublicPortalObjectionTally', error);
    return [];
  }

  return (data ?? []) as PortalObjectionTally[];
}

// ── Admin: objection/visit tally breakdown (internal, authenticated) ──────────

export async function listPortalObjectionTally(clientId: string): Promise<PortalObjectionTally[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('portal_objection_tally')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false });

  if (error) {
    console.error('[portal] listPortalObjectionTally', error);
    return [];
  }

  return (data ?? []) as PortalObjectionTally[];
}

// ── Public page writes — always via server-side API routes (PIN revalidated
// on every write; the anon key never has INSERT/UPDATE rights on these tables) ─

export type PortalResolveResult = {
  client_id: string;
  name: string;
  logo_url: string | null;
  enabled: boolean;
};

export type PortalApiResult<T> = { data: T | null; error: string | null; status: number };

async function portalApi<T>(path: string, body: Record<string, unknown>): Promise<PortalApiResult<T>> {
  try {
    const res = await fetch(`/api/portal/${path}`, {
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

export async function resolvePortalSlug(slug: string): Promise<PortalApiResult<PortalResolveResult>> {
  return portalApi<PortalResolveResult>('resolve', { slug });
}

export async function validatePortalPin(
  slug: string,
  pin: string,
  kind: 'registro' | 'ventas',
): Promise<PortalApiResult<{ valid: boolean }>> {
  return portalApi<{ valid: boolean }>('validate-pin', { slug, pin, kind });
}

export async function incrementPortalTally(input: {
  slug: string;
  pin: string;
  client_id: string;
  date: string;
  ad_id: string;
  tipo: PortalTallyTipo;
  categoria: string;
}): Promise<PortalApiResult<PortalObjectionTally>> {
  return portalApi<PortalObjectionTally>('increment-tally', input);
}

export async function decrementPortalTally(input: {
  slug: string;
  pin: string;
  client_id: string;
  date: string;
  ad_id: string;
  tipo: PortalTallyTipo;
  categoria: string;
}): Promise<PortalApiResult<PortalObjectionTally>> {
  return portalApi<PortalObjectionTally>('decrement-tally', input);
}

export async function addPortalLead(input: {
  slug: string;
  pin: string;
  client_id: string;
  date: string;
  campaign_id: string;
  tipo: PortalLeadTipo;
  nombre_cliente: string;
  numero_contacto: string;
  monto: number | null;
}): Promise<PortalApiResult<{ daily_entry: PortalDailyEntry; lead: unknown }>> {
  return portalApi('add-lead', input);
}

export async function removePortalLead(input: {
  slug: string;
  pin: string;
  client_id: string;
  date: string;
  campaign_id: string;
  tipo: PortalLeadTipo;
}): Promise<PortalApiResult<{ daily_entry: PortalDailyEntry; removed_lead_id: string | null }>> {
  return portalApi('remove-last-lead', input);
}

export async function savePortalDailyNote(input: {
  slug: string;
  pin: string;
  client_id: string;
  date: string;
  nota: string;
}): Promise<PortalApiResult<PortalDailyEntry>> {
  return portalApi<PortalDailyEntry>('save-daily-note', input);
}

export async function savePortalSale(input: {
  slug: string;
  pin: string;
  client_id: string;
  date: string;
  total_sales: number;
}): Promise<PortalApiResult<{ id: string }>> {
  return portalApi<{ id: string }>('save-sale', input);
}