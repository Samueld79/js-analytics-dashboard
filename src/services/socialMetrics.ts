import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type ServiceMutationResult,
  type SocialMonthlyMetric,
  type SocialMonthlyMetricInput,
} from '../lib/supabase';
import { getMonthKey } from '../utils/monthLabel';

type ListSocialMonthlyMetricsParams = {
  clientId?: string;
  monthsBack?: number;
};

function isMissingSocialSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';

  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === '42P01' ||
    code === '42703' ||
    /social_monthly_metrics/i.test(message) ||
    /whatsapp_clicks|link_clicks|new_customers_reported|returning_customers_reported|store_visits_reported/i.test(
      message,
    )
  );
}

function getMonthFloor(monthsBack: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - monthsBack);
  return date.toISOString().split('T')[0];
}

function normalizeMonthFloor(month: string): string {
  const monthKey = getMonthKey(month);
  return monthKey ? `${monthKey}-01` : '';
}

function normalizeInteger(value: number | null | undefined, allowNull = false): number | null {
  if (value == null) return allowNull ? null : 0;
  if (!Number.isFinite(value) || value < 0) return allowNull ? null : 0;
  return Math.round(value);
}

async function getCreatedUserId(): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;

  return data.user?.id ?? null;
}

export async function listSocialMonthlyMetrics({
  clientId,
  monthsBack = 6,
}: ListSocialMonthlyMetricsParams = {}): Promise<SocialMonthlyMetric[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('v_client_monthly_social_metrics')
    .select('*')
    .gte('month', getMonthKey(getMonthFloor(monthsBack)))
    .order('month', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) {
    if (isMissingSocialSchemaError(error)) {
      return [];
    }
    console.error('[socialMetrics] listSocialMonthlyMetrics', error);
    return [];
  }

  return (data ?? []) as SocialMonthlyMetric[];
}

export async function upsertSocialMonthlyMetric(
  input: SocialMonthlyMetricInput,
): Promise<ServiceMutationResult<SocialMonthlyMetric>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const monthFloor = normalizeMonthFloor(input.month);
  if (!input.client_id || !monthFloor) {
    return { data: null, error: 'Cliente y mes son obligatorios.' };
  }

  const newFollowers = normalizeInteger(input.new_followers);
  const profileVisits = normalizeInteger(input.profile_visits, true);
  const whatsappClicks = normalizeInteger(input.whatsapp_clicks, true);
  const linkClicks = normalizeInteger(input.link_clicks, true);
  const newCustomersReported = normalizeInteger(input.new_customers_reported, true);
  const returningCustomersReported = normalizeInteger(input.returning_customers_reported, true);
  const storeVisitsReported = normalizeInteger(input.store_visits_reported, true);
  if (newFollowers == null || newFollowers < 0) {
    return { data: null, error: 'Los nuevos seguidores no pueden ser negativos.' };
  }
  if (profileVisits != null && profileVisits < 0) {
    return { data: null, error: 'Las visitas al perfil no pueden ser negativas.' };
  }
  if (whatsappClicks != null && whatsappClicks < 0) {
    return { data: null, error: 'Los clicks de WhatsApp no pueden ser negativos.' };
  }
  if (linkClicks != null && linkClicks < 0) {
    return { data: null, error: 'Los clicks al link no pueden ser negativos.' };
  }
  if (newCustomersReported != null && newCustomersReported < 0) {
    return { data: null, error: 'Los nuevos clientes reportados no pueden ser negativos.' };
  }
  if (returningCustomersReported != null && returningCustomersReported < 0) {
    return { data: null, error: 'La recompra reportada no puede ser negativa.' };
  }
  if (storeVisitsReported != null && storeVisitsReported < 0) {
    return { data: null, error: 'Las visitas a tienda reportadas no pueden ser negativas.' };
  }

  const createdBy = input.created_by ?? (await getCreatedUserId());
  const payload = {
    client_id: input.client_id,
    month: monthFloor,
    new_followers: newFollowers ?? 0,
    profile_visits: profileVisits,
    whatsapp_clicks: whatsappClicks,
    link_clicks: linkClicks,
    new_customers_reported: newCustomersReported,
    returning_customers_reported: returningCustomersReported,
    store_visits_reported: storeVisitsReported,
    source: input.source.trim() || 'manual_monthly_followers',
    notes: input.notes?.trim() || null,
    created_by: createdBy,
  };

  const { data, error } = await supabase
    .from('social_monthly_metrics')
    .upsert(payload, { onConflict: 'client_id,month' })
    .select(
      [
        'id',
        'client_id',
        'month',
        'new_followers',
        'profile_visits',
        'whatsapp_clicks',
        'link_clicks',
        'new_customers_reported',
        'returning_customers_reported',
        'store_visits_reported',
        'source',
        'notes',
        'created_by',
        'created_at',
        'updated_at',
      ].join(','),
    )
    .maybeSingle();

  if (error) {
    if (isMissingSocialSchemaError(error)) {
      return {
        data: null,
        error:
          'Falta aplicar la migración supabase/phase-7-social-monthly-special-metrics.sql en Supabase.',
      };
    }
    console.error('[socialMetrics] upsertSocialMonthlyMetric', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo guardar el cierre mensual de seguidores.'),
    };
  }

  const normalized = (() => {
    if (!data || typeof data !== 'object') return data;

    const record = data as Record<string, unknown>;
    if (typeof record.month !== 'string') return data;

    return {
      ...record,
      month: getMonthKey(record.month),
    };
  })();

  return { data: (normalized ?? null) as SocialMonthlyMetric | null, error: null };
}
