import type {
  AdMetric,
  ClientDailyOperatingKpi,
  ClientMonthlyOperatingKpi,
  DailySale,
  DailySaleValidation,
  MetaSyncStatus,
} from '../lib/supabase';

export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/,/g, '');
    if (!normalized) return fallback;

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function toSafeInteger(value: unknown): number {
  const parsed = toFiniteNumber(value);
  if (parsed <= 0) return 0;
  return Math.round(parsed);
}

export const formatCop = (value: unknown): string => {
  const amount = toFiniteNumber(value);

  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString('es-CO')}`;
};

export const formatNumber = (value: unknown): string => {
  const amount = toFiniteNumber(value);

  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString('es-CO');
};

export const formatPct = (value: unknown): string => `${toFiniteNumber(value).toFixed(2)}%`;
export const formatRoas = (value: unknown): string => `${toFiniteNumber(value).toFixed(2)}x`;

export function getMonthEndDate(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return '';
  }

  return new Date(year, month, 0).toISOString().split('T')[0];
}

export const sumMetrics = (metrics: AdMetric[]) => ({
  spend: metrics.reduce((a, m) => a + toFiniteNumber(m.spend), 0),
  reach: metrics.reduce((a, m) => a + toSafeInteger(m.reach), 0),
  impressions: metrics.reduce((a, m) => a + toSafeInteger(m.impressions), 0),
  clicks: metrics.reduce((a, m) => a + toSafeInteger(m.clicks), 0),
  messages: metrics.reduce((a, m) => a + toSafeInteger(m.messages), 0),
  leads: metrics.reduce((a, m) => a + toSafeInteger(m.leads), 0),
  purchases: metrics.reduce((a, m) => a + toSafeInteger(m.purchases), 0),
  purchase_value: metrics.reduce((a, m) => a + toFiniteNumber(m.purchase_value), 0),
  roas: (() => {
    const total_spend = metrics.reduce((a, m) => a + toFiniteNumber(m.spend), 0);
    const total_value = metrics.reduce((a, m) => a + toFiniteNumber(m.purchase_value), 0);
    return total_spend > 0 ? total_value / total_spend : 0;
  })(),
  cpr: (() => {
    const spend = metrics.reduce((a, m) => a + toFiniteNumber(m.spend), 0);
    const msgs = metrics.reduce((a, m) => a + toSafeInteger(m.messages), 0);
    return msgs > 0 ? spend / msgs : 0;
  })(),
});

export const sumSales = (sales: DailySale[]) => ({
  total: sales.reduce((a, s) => a + toFiniteNumber(s.total_sales), 0),
  newClient: sales.reduce((a, s) => a + toFiniteNumber(s.new_client_sales), 0),
  repeat: sales.reduce((a, s) => a + toFiniteNumber(s.repeat_sales), 0),
  physical: sales.reduce((a, s) => a + toFiniteNumber(s.physical_store_sales), 0),
  online: sales.reduce((a, s) => a + toFiniteNumber(s.online_sales), 0),
});

type OperatingKpiRow = ClientDailyOperatingKpi | ClientMonthlyOperatingKpi;

export const sumOperatingKpis = (rows: OperatingKpiRow[]) => {
  const spend = rows.reduce((sum, row) => sum + toFiniteNumber(row.spend), 0);
  const purchaseValue = rows.reduce((sum, row) => sum + toFiniteNumber(row.purchase_value), 0);
  const totalSales = rows.reduce((sum, row) => sum + toFiniteNumber(row.total_sales), 0);

  return {
    spend,
    reach: rows.reduce((sum, row) => sum + toSafeInteger(row.reach), 0),
    impressions: rows.reduce((sum, row) => sum + toSafeInteger(row.impressions), 0),
    clicks: rows.reduce((sum, row) => sum + toSafeInteger(row.clicks), 0),
    messages: rows.reduce((sum, row) => sum + toSafeInteger(row.messages), 0),
    leads: rows.reduce((sum, row) => sum + toSafeInteger(row.leads), 0),
    purchases: rows.reduce((sum, row) => sum + toSafeInteger(row.purchases), 0),
    purchase_value: purchaseValue,
    total_sales: totalSales,
    new_client_sales: rows.reduce((sum, row) => sum + toFiniteNumber(row.new_client_sales), 0),
    repeat_sales: rows.reduce((sum, row) => sum + toFiniteNumber(row.repeat_sales), 0),
    physical_store_sales: rows.reduce((sum, row) => sum + toFiniteNumber(row.physical_store_sales), 0),
    online_sales: rows.reduce((sum, row) => sum + toFiniteNumber(row.online_sales), 0),
    ad_roas: spend > 0 ? purchaseValue / spend : 0,
    real_roas: spend > 0 ? totalSales / spend : 0,
  };
};

export function validateDailySale(values: {
  total_sales: number;
  new_client_sales: number;
  repeat_sales: number;
  physical_store_sales: number;
  online_sales: number;
}): DailySaleValidation {
  const totalsBreakdown = values.new_client_sales + values.repeat_sales;
  const channelsBreakdown = values.physical_store_sales + values.online_sales;
  const hasTotalsBreakdown = values.new_client_sales > 0 || values.repeat_sales > 0;
  const hasChannelsBreakdown = values.physical_store_sales > 0 || values.online_sales > 0;

  return {
    totalsMismatch: hasTotalsBreakdown && totalsBreakdown !== values.total_sales,
    channelsMismatch: hasChannelsBreakdown && channelsBreakdown !== values.total_sales,
  };
}

export const last7Days = (items: { date: string }[]) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return items.filter(i => new Date(i.date) >= cutoff);
};

export const last30Days = (items: { date: string }[]) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return items.filter(i => new Date(i.date) >= cutoff);
};

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getCurrentMonthFloor(date = new Date()): string {
  const current = new Date(date);
  current.setDate(1);
  current.setHours(12, 0, 0, 0);
  return current.toISOString().split('T')[0];
}

export function isMetaSyncStale(
  lastSyncAt?: string | null,
  staleAfterHours = 30,
): boolean {
  if (!lastSyncAt) return true;

  const timestamp = new Date(lastSyncAt).getTime();
  if (!Number.isFinite(timestamp)) return true;

  return Date.now() - timestamp > staleAfterHours * 60 * 60 * 1000;
}

export function getMetaSyncStatus(params: {
  activeAccounts: number;
  lastSyncAt?: string | null;
  staleAccounts: number;
}): MetaSyncStatus {
  if (params.activeAccounts === 0 || !params.lastSyncAt) return 'no_data';
  if (params.staleAccounts > 0 || isMetaSyncStale(params.lastSyncAt)) return 'stale';
  return 'ok';
}

export function metaSyncStatusLabel(status: MetaSyncStatus): string {
  const map: Record<MetaSyncStatus, string> = {
    ok: 'OK',
    stale: 'Desactualizado',
    no_data: 'Sin datos',
  };

  return map[status];
}

export function metaSyncStatusClass(status: MetaSyncStatus): string {
  const map: Record<MetaSyncStatus, string> = {
    ok: 'status-green',
    stale: 'status-amber',
    no_data: 'status-gray',
  };

  return map[status];
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Borrador',
    pending: 'Pendiente',
    mounted: 'Montada',
    reviewed: 'Revisada',
    approved: 'Aprobada',
    archived: 'Archivada',
    in_progress: 'En proceso',
    done: 'Lista',
    skipped: 'Omitida',
    active: 'Activo',
    paused: 'Pausado',
    churned: 'Cancelado',
  };
  return map[status] ?? status;
}

export function priorityLabel(p: string): string {
  const map: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
  return map[p] ?? p;
}

export function typeLabel(t: string): string {
  const map: Record<string, string> = {
    optimization: 'Optimización',
    review: 'Revisión',
    budget: 'Presupuesto',
    creative: 'Creativo',
    sales_followup: 'Ventas',
    alert: 'Alerta',
    general: 'General',
  };
  return map[t] ?? t;
}

export function healthStatusLabel(status: string): string {
  const map: Record<string, string> = {
    healthy: 'Al día',
    warning: 'Con riesgo',
    critical: 'Crítico',
  };
  return map[status] ?? status;
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: 'Admin',
    team: 'Equipo',
    strategist: 'Estratega',
    operator: 'Operador',
    partner: 'Socio',
    client: 'Cliente',
    anonymous: 'Anonimo',
  };
  return map[role] ?? role;
}

export function activityActionLabel(action: string): string {
  const map: Record<string, string> = {
    sales_upserted: 'Ventas registradas',
    strategy_created: 'Estrategia creada',
    strategy_updated: 'Estrategia actualizada',
    strategy_status_changed: 'Estado de estrategia actualizado',
    strategy_tasks_generated: 'Tareas generadas desde estrategia',
    strategy_memory_synced: 'Memoria del cliente actualizada',
    task_created: 'Tarea creada',
    task_updated: 'Tarea actualizada',
    task_completed: 'Tarea completada',
    task_reopened: 'Tarea reabierta',
    file_registered: 'Archivo registrado',
    draft_memory_saved: 'Memoria guardada desde IA',
    alert_resolved: 'Alerta resuelta',
    alert_dismissed: 'Alerta descartada',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}
