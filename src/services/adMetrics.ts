import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type AdMetric,
  type HistoricalMonthlyAdMetricInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { getMonthEndDate, toFiniteNumber } from '../lib/utils';
import { getPrimaryActiveMetaAccount } from './meta';

type ListAdMetricsParams = {
  clientId?: string;
  days?: number;
};

function getSinceDate(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString().split('T')[0];
}

export async function listAdMetrics({
  clientId,
  days = 30,
}: ListAdMetricsParams = {}): Promise<AdMetric[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('ad_metrics')
    .select('*')
    .gte('date', getSinceDate(days))
    .order('date', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) {
    console.error('[adMetrics] listAdMetrics', error);
    return [];
  }

  return (data ?? []) as AdMetric[];
}

function normalizeInteger(value: number): number {
  const normalized = toFiniteNumber(value);
  if (normalized <= 0) return 0;
  return Math.round(normalized);
}

function normalizeDecimal(value: number): number {
  const normalized = toFiniteNumber(value);
  if (normalized <= 0) return 0;
  return Math.round(normalized * 10_000) / 10_000;
}

function normalizeMoney(value: number): number {
  const normalized = toFiniteNumber(value);
  if (normalized <= 0) return 0;
  return Math.round(normalized * 100) / 100;
}

export async function upsertHistoricalMonthlyAdMetric(
  input: HistoricalMonthlyAdMetricInput,
): Promise<ServiceMutationResult<AdMetric>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (!input.client_id || !input.month) {
    return { data: null, error: 'Cliente y mes son obligatorios.' };
  }

  const snapshotDate = getMonthEndDate(input.month);
  if (!snapshotDate) {
    return { data: null, error: 'Mes inválido. Usa formato YYYY-MM.' };
  }

  const primaryAccount = await getPrimaryActiveMetaAccount({ clientId: input.client_id });
  if (!primaryAccount) {
    return { data: null, error: 'Este cliente no tiene una cuenta Meta activa primaria para guardar histórico.' };
  }

  const payload = {
    client_id: input.client_id,
    ad_account_id: primaryAccount.id,
    date: snapshotDate,
    spend: normalizeMoney(input.spend),
    reach: normalizeInteger(input.reach),
    impressions: normalizeInteger(input.impressions),
    clicks: normalizeInteger(input.clicks),
    cpm: normalizeDecimal(input.cpm),
    cpc: normalizeDecimal(input.cpc),
    ctr: normalizeDecimal(input.ctr),
    messages: normalizeInteger(input.messages),
    leads: normalizeInteger(input.leads),
    purchases: normalizeInteger(input.purchases),
    purchase_value: normalizeMoney(input.purchase_value),
    roas: normalizeDecimal(input.roas),
    cpr: normalizeDecimal(input.cpr),
    cpl: normalizeDecimal(input.cpl),
    cpa: normalizeDecimal(input.cpa),
    frequency:
      input.frequency == null ? null : normalizeDecimal(input.frequency),
    raw_actions: [],
    source: input.source?.trim() || 'manual_monthly_history',
  };

  const { data, error } = await supabase
    .from('ad_metrics')
    .upsert(payload, { onConflict: 'client_id,ad_account_id,date' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[adMetrics] upsertHistoricalMonthlyAdMetric', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo guardar el histórico mensual de Ads.'),
    };
  }

  return { data: (data ?? null) as AdMetric | null, error: null };
}
