import {
  isSupabaseConfigured,
  supabase,
  type AdAccountSyncRow,
  type ClientMetaOverview,
  type ClientMonthlyOperatingKpi,
} from '../lib/supabase';
import {
  getCurrentMonthFloor,
  getMetaSyncStatus,
  isMetaSyncStale,
} from '../lib/utils';

type ListMetaAccountSyncRowsParams = {
  clientId?: string;
};

type GetPrimaryMetaAccountParams = {
  clientId: string;
};

function getLatestSyncAt(rows: AdAccountSyncRow[]): string | null {
  const timestamps = rows
    .map((row) => row.last_sync_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return timestamps[0] ?? null;
}

function hasCurrentMonthData(row?: ClientMonthlyOperatingKpi | null): boolean {
  if (!row) return false;

  return (
    row.spend > 0 ||
    row.impressions > 0 ||
    row.clicks > 0 ||
    row.messages > 0 ||
    row.leads > 0 ||
    row.purchases > 0 ||
    row.purchase_value > 0
  );
}

export async function listMetaAccountSyncRows({
  clientId,
}: ListMetaAccountSyncRowsParams = {}): Promise<AdAccountSyncRow[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('ad_accounts')
    .select('id,client_id,name,meta_account_id,status,is_primary,last_sync_at')
    .eq('platform', 'meta')
    .eq('status', 'active')
    .order('is_primary', { ascending: false })
    .order('name');

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) {
    console.error('[meta] listMetaAccountSyncRows', error);
    return [];
  }

  return (data ?? []) as AdAccountSyncRow[];
}

export async function getPrimaryActiveMetaAccount({
  clientId,
}: GetPrimaryMetaAccountParams): Promise<AdAccountSyncRow | null> {
  if (!isSupabaseConfigured || !supabase || !clientId) return null;

  const { data, error } = await supabase
    .from('ad_accounts')
    .select('id,client_id,name,meta_account_id,status,is_primary,last_sync_at')
    .eq('client_id', clientId)
    .eq('platform', 'meta')
    .eq('status', 'active')
    .order('is_primary', { ascending: false })
    .order('name')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[meta] getPrimaryActiveMetaAccount', error);
    return null;
  }

  return (data ?? null) as AdAccountSyncRow | null;
}

export function buildClientMetaOverviewByClient(params: {
  clientIds?: string[];
  monthlyKpis: ClientMonthlyOperatingKpi[];
  syncRows: AdAccountSyncRow[];
  staleAfterHours?: number;
}): Record<string, ClientMetaOverview> {
  const staleAfterHours = params.staleAfterHours ?? 30;
  const currentMonth = getCurrentMonthFloor();
  const rowsByClient = new Map<string, AdAccountSyncRow[]>();
  const currentMonthKpiByClient = new Map<string, ClientMonthlyOperatingKpi>();

  params.syncRows.forEach((row) => {
    const rows = rowsByClient.get(row.client_id) ?? [];
    rows.push(row);
    rowsByClient.set(row.client_id, rows);
  });

  params.monthlyKpis
    .filter((row) => row.month === currentMonth)
    .forEach((row) => currentMonthKpiByClient.set(row.client_id, row));

  const clientIds = new Set<string>([
    ...(params.clientIds ?? []),
    ...rowsByClient.keys(),
    ...currentMonthKpiByClient.keys(),
  ]);

  return [...clientIds].reduce<Record<string, ClientMetaOverview>>((accumulator, clientId) => {
    const syncRows = rowsByClient.get(clientId) ?? [];
    const currentMonthKpi = currentMonthKpiByClient.get(clientId) ?? null;
    const lastSyncAt = getLatestSyncAt(syncRows);
    const staleAccounts = syncRows.filter(
      (row) => !row.last_sync_at || isMetaSyncStale(row.last_sync_at, staleAfterHours),
    ).length;
    const missingSyncAccounts = syncRows.filter((row) => !row.last_sync_at).length;
    const syncedAccounts = syncRows.filter(
      (row) => row.last_sync_at && !isMetaSyncStale(row.last_sync_at, staleAfterHours),
    ).length;

    accumulator[clientId] = {
      client_id: clientId,
      sync_status: getMetaSyncStatus({
        activeAccounts: syncRows.length,
        lastSyncAt,
        staleAccounts,
      }),
      last_sync_at: lastSyncAt,
      active_accounts: syncRows.length,
      synced_accounts: syncedAccounts,
      stale_accounts: staleAccounts,
      missing_sync_accounts: missingSyncAccounts,
      has_mtd_data: hasCurrentMonthData(currentMonthKpi),
      mtd_spend: currentMonthKpi?.spend ?? 0,
      mtd_messages: currentMonthKpi?.messages ?? 0,
      mtd_leads: currentMonthKpi?.leads ?? 0,
      mtd_purchases: currentMonthKpi?.purchases ?? 0,
      mtd_purchase_value: currentMonthKpi?.purchase_value ?? 0,
      mtd_ad_roas: currentMonthKpi?.ad_roas ?? 0,
      mtd_real_roas: currentMonthKpi?.real_roas ?? 0,
    };

    return accumulator;
  }, {});
}
