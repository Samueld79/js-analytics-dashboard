import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type DailySale,
  type DailySaleInput,
  type ServiceMutationResult,
} from '../lib/supabase';

type ListDailySalesParams = {
  clientId?: string;
  days?: number;
};

function getSinceDate(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString().split('T')[0];
}

async function getRegisteredUserId(): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

function normalizeMoney(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

export async function listDailySales({
  clientId,
  days = 30,
}: ListDailySalesParams = {}): Promise<DailySale[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('daily_sales')
    .select('*')
    .gte('date', getSinceDate(days))
    .order('date', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) {
    console.error('[dailySales] listDailySales', error);
    return [];
  }

  return (data ?? []) as DailySale[];
}

export async function upsertDailySale(
  sale: DailySaleInput,
): Promise<ServiceMutationResult<DailySale>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (!sale.client_id || !sale.date) {
    return { data: null, error: 'Cliente y fecha son obligatorios.' };
  }

  if (!Number.isFinite(sale.total_sales) || sale.total_sales <= 0) {
    return { data: null, error: 'Las ventas totales deben ser mayores a 0.' };
  }

  const registeredBy = sale.registered_by ?? (await getRegisteredUserId());
  const payload = {
    ...sale,
    total_sales: normalizeMoney(sale.total_sales),
    new_client_sales: normalizeMoney(sale.new_client_sales),
    repeat_sales: normalizeMoney(sale.repeat_sales),
    physical_store_sales: normalizeMoney(sale.physical_store_sales),
    online_sales: normalizeMoney(sale.online_sales),
    registered_by: registeredBy,
    status: sale.status ?? 'submitted',
  };

  const { data, error } = await supabase
    .from('daily_sales')
    .upsert(payload, { onConflict: 'client_id,date' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[dailySales] upsertDailySale', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar la venta.') };
  }

  const lastSalesEntryAt = `${sale.date}T23:59:59`;
  const { error: clientUpdateError } = await supabase
    .from('clients')
    .update({ last_sales_entry_at: lastSalesEntryAt })
    .eq('id', sale.client_id);

  if (clientUpdateError) {
    console.error('[dailySales] update client last_sales_entry_at', clientUpdateError);
  }

  return { data: (data ?? null) as DailySale | null, error: null };
}
