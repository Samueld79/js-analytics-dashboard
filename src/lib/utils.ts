import type {
  AdMetric,
  ClientDailyOperatingKpi,
  ClientMonthlyOperatingKpi,
  DailySale,
  MetaSyncStatus,
  SocialMonthlyMetric,
} from '../lib/supabase';

export type AdDataOrigin = 'automatic' | 'manual' | 'mixed' | 'unknown';

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

export function getDateKey(date = new Date()): string {
  const current = new Date(date);
  current.setHours(12, 0, 0, 0);
  return current.toISOString().split('T')[0];
}

export function getYesterdayKey(date = new Date()): string {
  const current = new Date(date);
  current.setDate(current.getDate() - 1);
  return getDateKey(current);
}

export function getMonthStartKey(date = new Date()): string {
  const current = new Date(date);
  current.setDate(1);
  return getDateKey(current);
}

export function getYearStartKey(date = new Date()): string {
  const current = new Date(date);
  current.setMonth(0, 1);
  return getDateKey(current);
}

export function isDateWithinRange(date: string, startDate?: string, endDate?: string): boolean {
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
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
  if (!dateStr) return '—';

  const d = new Date(`${dateStr}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return '—';

  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';

  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return '—';

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

export function getAdDataOriginFromSource(source?: string | null): Exclude<AdDataOrigin, 'mixed'> {
  const normalized = source?.trim().toLowerCase() ?? '';

  if (!normalized) return 'unknown';
  if (normalized === 'manual_monthly_history') return 'manual';
  return 'automatic';
}

export function summarizeAdDataOrigin(sources: Array<string | null | undefined>): AdDataOrigin {
  const kinds = new Set(
    sources
      .map((source) => getAdDataOriginFromSource(source))
      .filter((kind) => kind !== 'unknown'),
  );

  if (kinds.size === 0) return 'unknown';
  if (kinds.size > 1) return 'mixed';

  return [...kinds][0] ?? 'unknown';
}

export function adDataOriginLabel(origin: AdDataOrigin): string {
  const map: Record<AdDataOrigin, string> = {
    automatic: 'Sync automático',
    manual: 'Histórico manual',
    mixed: 'Mixto',
    unknown: 'Sin fuente',
  };

  return map[origin];
}

export function adDataOriginClass(origin: AdDataOrigin): string {
  const map: Record<AdDataOrigin, string> = {
    automatic: 'source-automatic',
    manual: 'source-manual',
    mixed: 'source-mixed',
    unknown: 'source-unknown',
  };

  return map[origin];
}

type RawActionEntry = {
  action_type?: string;
  value?: string | number | null;
};

const MARKETING_ACTION_TYPES = {
  messagingStarted: ['onsite_conversion.messaging_conversation_started_7d'],
  messagingFirstReply: ['onsite_conversion.messaging_first_reply'],
  messagingConnections: ['onsite_conversion.total_messaging_connection'],
  profileVisits: ['profile_visit_view', 'profile_visit'],
  thruplays: ['video_thruplay_watched_actions', 'thruplay'],
  videoViews: ['video_view', 'video_play'],
  video25: ['video_p25_watched_actions', 'video_view_25', 'video_25_watched_actions'],
  video50: ['video_p50_watched_actions', 'video_view_50', 'video_50_watched_actions'],
  leads: [
    'lead',
    'onsite_conversion.lead',
    'onsite_web_lead',
    'onsite_conversion.lead_grouped',
  ],
} as const;

function parseRawActions(rawActions: unknown): RawActionEntry[] {
  if (!Array.isArray(rawActions)) return [];

  return rawActions.filter((entry): entry is RawActionEntry => Boolean(entry) && typeof entry === 'object');
}

function sumMetricActionValues(metric: AdMetric, actionTypes: readonly string[]): number {
  return parseRawActions(metric.raw_actions).reduce((total, action) => {
    if (!action.action_type || !actionTypes.includes(action.action_type)) return total;
    return total + toFiniteNumber(action.value);
  }, 0);
}

function hasMetricActionType(metric: AdMetric, actionTypes: readonly string[]): boolean {
  return parseRawActions(metric.raw_actions).some(
    (action) => Boolean(action.action_type) && actionTypes.includes(action.action_type!),
  );
}

function sumObservedActionValues(metrics: AdMetric[], actionTypes: readonly string[]): number | null {
  const observed = metrics.some((metric) => hasMetricActionType(metric, actionTypes));
  if (!observed) return null;

  return metrics.reduce((total, metric) => total + sumMetricActionValues(metric, actionTypes), 0);
}

export type MarketingActionSummary = {
  sourceOrigin: AdDataOrigin;
  spend: number;
  messagingStarted: number;
  messagingConnections: number;
  messagingFirstReply: number | null;
  profileVisits: number | null;
  thruplays: number | null;
  videoViews: number | null;
  video25: number | null;
  video50: number | null;
  leads: number | null;
};

export type MonthlySpecialMetricsSummary = {
  rowsWithData: number;
  whatsappClicks: number;
  linkClicks: number;
  newCustomersReported: number;
  returningCustomersReported: number;
  storeVisitsReported: number;
};

export function buildMarketingActionSummary(metrics: AdMetric[]): MarketingActionSummary {
  return {
    sourceOrigin: summarizeAdDataOrigin(metrics.map((metric) => metric.source)),
    spend: metrics.reduce((total, metric) => total + toFiniteNumber(metric.spend), 0),
    messagingStarted:
      sumObservedActionValues(metrics, MARKETING_ACTION_TYPES.messagingStarted) ??
      metrics.reduce((total, metric) => total + toFiniteNumber(metric.messages), 0),
    messagingConnections: sumObservedActionValues(metrics, MARKETING_ACTION_TYPES.messagingConnections) ?? 0,
    messagingFirstReply: sumObservedActionValues(metrics, MARKETING_ACTION_TYPES.messagingFirstReply),
    profileVisits: sumObservedActionValues(metrics, MARKETING_ACTION_TYPES.profileVisits),
    thruplays: sumObservedActionValues(metrics, MARKETING_ACTION_TYPES.thruplays),
    videoViews: sumObservedActionValues(metrics, MARKETING_ACTION_TYPES.videoViews),
    video25: sumObservedActionValues(metrics, MARKETING_ACTION_TYPES.video25),
    video50: sumObservedActionValues(metrics, MARKETING_ACTION_TYPES.video50),
    leads: sumObservedActionValues(metrics, MARKETING_ACTION_TYPES.leads),
  };
}

function hasMonthlyMetricValue(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value >= 0;
}

export function hasSpecialMonthlyMetricData(metric?: SocialMonthlyMetric | null): boolean {
  if (!metric) return false;

  return [
    metric.whatsapp_clicks,
    metric.link_clicks,
    metric.new_customers_reported,
    metric.returning_customers_reported,
    metric.store_visits_reported,
  ].some(hasMonthlyMetricValue);
}

export function buildMonthlySpecialMetricsSummary(
  metrics: SocialMonthlyMetric[],
): MonthlySpecialMetricsSummary {
  return metrics.reduce<MonthlySpecialMetricsSummary>(
    (summary, metric) => {
      const hasRowData = hasSpecialMonthlyMetricData(metric);

      return {
        rowsWithData: summary.rowsWithData + (hasRowData ? 1 : 0),
        whatsappClicks: summary.whatsappClicks + toSafeInteger(metric.whatsapp_clicks),
        linkClicks: summary.linkClicks + toSafeInteger(metric.link_clicks),
        newCustomersReported:
          summary.newCustomersReported + toSafeInteger(metric.new_customers_reported),
        returningCustomersReported:
          summary.returningCustomersReported +
          toSafeInteger(metric.returning_customers_reported),
        storeVisitsReported:
          summary.storeVisitsReported + toSafeInteger(metric.store_visits_reported),
      };
    },
    {
      rowsWithData: 0,
      whatsappClicks: 0,
      linkClicks: 0,
      newCustomersReported: 0,
      returningCustomersReported: 0,
      storeVisitsReported: 0,
    },
  );
}

export function resolveMonthlyProfileVisits(params: {
  socialMetric?: SocialMonthlyMetric | null;
  adMetrics?: AdMetric[];
}): {
  value: number | null;
  sourceOrigin: AdDataOrigin;
  sourceLabel: string;
} {
  if (params.socialMetric?.profile_visits != null) {
    return {
      value: toFiniteNumber(params.socialMetric.profile_visits),
      sourceOrigin: 'manual',
      sourceLabel: 'Fuente manual mensual',
    };
  }

  const fallback = buildMarketingActionSummary(params.adMetrics ?? []).profileVisits;
  if (fallback != null) {
    return {
      value: fallback,
      sourceOrigin: 'automatic',
      sourceLabel: 'Sync automático',
    };
  }

  return {
    value: null,
    sourceOrigin: 'unknown',
    sourceLabel: 'Sin dato',
  };
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
