import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type DailySale,
  type DailySaleInput,
  type HistoricalMonthlySaleInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { getMonthEndDate } from '../lib/utils';
import { logActivitySafe } from './activityLog';

type ListDailySalesParams = {
  clientId?: string;
  days?: number;
  startDate?: string;
  endDate?: string;
};

type DailySaleDeleteInput = Pick<DailySale, 'id' | 'client_id' | 'date' | 'total_sales'>;

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

async function syncClientLastSalesEntryAt(clientId: string): Promise<void> {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('daily_sales')
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[dailySales] sync client last_sales_entry_at select', error);
    return;
  }

  const lastSalesEntryAt = data?.date ? `${data.date}T23:59:59` : null;
  const { error: updateError } = await supabase
    .from('clients')
    .update({ last_sales_entry_at: lastSalesEntryAt })
    .eq('id', clientId);

  if (updateError) {
    console.error('[dailySales] sync client last_sales_entry_at update', updateError);
  }
}

export async function listDailySales({
  clientId,
  days = 30,
  startDate,
  endDate,
}: ListDailySalesParams = {}): Promise<DailySale[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('daily_sales')
    .select('id,client_id,date,total_sales,new_client_sales,repeat_sales,physical_store_sales,online_sales,observations,status,registered_by')
    .order('date', { ascending: false });

  if (startDate) {
    query = query.gte('date', startDate);
  } else {
    query = query.gte('date', getSinceDate(days));
  }

  if (endDate) {
    query = query.lte('date', endDate);
  }

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

  void syncClientLastSalesEntryAt(sale.client_id);

  if (data) {
    void logActivitySafe({
      client_id: sale.client_id,
      entity_type: 'daily_sale',
      entity_id: (data as DailySale).id,
      action: 'sales_upserted',
      description: `Ventas registradas para ${sale.date} por ${normalizeMoney(sale.total_sales).toLocaleString('es-CO')}.`,
      metadata: {
        date: sale.date,
        total_sales: normalizeMoney(sale.total_sales),
        new_client_sales: normalizeMoney(sale.new_client_sales),
        repeat_sales: normalizeMoney(sale.repeat_sales),
        physical_store_sales: normalizeMoney(sale.physical_store_sales),
        online_sales: normalizeMoney(sale.online_sales),
      },
    });
  }

  return { data: (data ?? null) as DailySale | null, error: null };
}

export async function deleteDailySale(
  sale: DailySaleDeleteInput,
): Promise<ServiceMutationResult<null>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (!sale.id || !sale.client_id) {
    return { data: null, error: 'No se pudo identificar el registro de venta a eliminar.' };
  }

  const { error } = await supabase.from('daily_sales').delete().eq('id', sale.id);

  if (error) {
    console.error('[dailySales] deleteDailySale', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo eliminar el registro de venta.'),
    };
  }

  void syncClientLastSalesEntryAt(sale.client_id);
  void logActivitySafe({
    client_id: sale.client_id,
    entity_type: 'daily_sale',
    entity_id: sale.id,
    action: 'sales_deleted',
    description: `Registro de ventas eliminado para ${sale.date} por ${normalizeMoney(sale.total_sales).toLocaleString('es-CO')}.`,
    metadata: {
      date: sale.date,
      total_sales: normalizeMoney(sale.total_sales),
    },
  });

  return { data: null, error: null };
}

export async function upsertHistoricalMonthlySale(
  sale: HistoricalMonthlySaleInput,
): Promise<ServiceMutationResult<DailySale>> {
  const snapshotDate = getMonthEndDate(sale.month);

  if (!snapshotDate) {
    return { data: null, error: 'Mes inválido. Usa formato YYYY-MM.' };
  }

  return upsertDailySale({
    client_id: sale.client_id,
    date: snapshotDate,
    total_sales: sale.total_sales,
    new_client_sales: sale.new_client_sales,
    repeat_sales: sale.repeat_sales,
    physical_store_sales: sale.physical_store_sales,
    online_sales: sale.online_sales,
    observations: sale.observations ?? `Histórico mensual ${sale.month}`,
    status: sale.status ?? 'submitted',
    registered_by: sale.registered_by ?? null,
  });
}
