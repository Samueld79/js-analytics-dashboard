import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type Client,
  type ClientInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { getCurrentUserId, normalizeOptionalText } from './serviceHelpers';

function normalizeTargetCities(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
}

function slugifyClientName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function slugExists(slug: string): Promise<boolean> {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[clients] slugExists', error);
    return false;
  }

  return Boolean(data);
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  if (!baseSlug) return '';

  let candidate = baseSlug;
  let suffix = 2;

  while (await slugExists(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function toClientPayload(input: ClientInput, createdBy: string | null) {
  return {
    name: input.name.trim(),
    slug: input.slug?.trim() || null,
    niche: normalizeOptionalText(input.niche),
    logo_url: normalizeOptionalText(input.logo_url),
    drive_folder_url: normalizeOptionalText(input.drive_folder_url),
    ad_account_id: normalizeOptionalText(input.ad_account_id),
    status: input.status ?? 'active',
    currency_code: input.currency_code?.trim() || 'COP',
    reporting_timezone: input.reporting_timezone?.trim() || 'America/Bogota',
    main_city: normalizeOptionalText(input.main_city),
    target_cities: normalizeTargetCities(input.target_cities),
    notes: normalizeOptionalText(input.notes),
    created_by: input.created_by ?? createdBy,
  };
}

export async function listClients(): Promise<Client[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.from('clients').select('*').order('name');
  if (error) {
    console.error('[clients] listClients', error);
    return [];
  }

  return (data ?? []) as Client[];
}

export async function getClientByIdOrSlug(identifier: string): Promise<Client | null> {
  if (!identifier || !isSupabaseConfigured || !supabase) return null;

  const byId = await supabase.from('clients').select('*').eq('id', identifier).maybeSingle();
  if (byId.data) return byId.data as Client;

  const bySlug = await supabase.from('clients').select('*').eq('slug', identifier).maybeSingle();
  if (bySlug.error) {
    console.error('[clients] getClientByIdOrSlug', bySlug.error);
    return null;
  }

  return (bySlug.data ?? null) as Client | null;
}

export async function createClient(
  input: ClientInput,
): Promise<ServiceMutationResult<Client>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const name = input.name.trim();
  if (!name) {
    return { data: null, error: 'El nombre del cliente es obligatorio.' };
  }

  const createdBy = await getCurrentUserId();
  const payload = toClientPayload(input, createdBy);
  const baseSlug = slugifyClientName(payload.slug ?? name);

  if (!baseSlug) {
    return { data: null, error: 'No se pudo generar un slug valido para este cliente.' };
  }

  payload.slug = await ensureUniqueSlug(baseSlug);
  payload.target_cities = normalizeTargetCities(payload.target_cities);

  const { data, error } = await supabase
    .from('clients')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[clients] createClient', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo crear el cliente.'),
    };
  }

  return {
    data: (data ?? null) as Client | null,
    error: null,
  };
}
