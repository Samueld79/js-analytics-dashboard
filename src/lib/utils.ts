import type {
  AdMetric,
  ClientDailyOperatingKpi,
  ClientMonthlyOperatingKpi,
  DailySale,
  DailySaleValidation,
} from '../lib/supabase';

export const formatCop = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('es-CO')}`;
};

export const formatNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('es-CO');
};

export const formatPct = (value: number): string => `${value.toFixed(2)}%`;
export const formatRoas = (value: number): string => `${value.toFixed(2)}x`;

export const sumMetrics = (metrics: AdMetric[]) => ({
  spend: metrics.reduce((a, m) => a + m.spend, 0),
  reach: metrics.reduce((a, m) => a + m.reach, 0),
  impressions: metrics.reduce((a, m) => a + m.impressions, 0),
  clicks: metrics.reduce((a, m) => a + m.clicks, 0),
  messages: metrics.reduce((a, m) => a + m.messages, 0),
  leads: metrics.reduce((a, m) => a + m.leads, 0),
  purchases: metrics.reduce((a, m) => a + m.purchases, 0),
  purchase_value: metrics.reduce((a, m) => a + m.purchase_value, 0),
  roas: (() => {
    const total_spend = metrics.reduce((a, m) => a + m.spend, 0);
    const total_value = metrics.reduce((a, m) => a + m.purchase_value, 0);
    return total_spend > 0 ? total_value / total_spend : 0;
  })(),
  cpr: (() => {
    const spend = metrics.reduce((a, m) => a + m.spend, 0);
    const msgs = metrics.reduce((a, m) => a + m.messages, 0);
    return msgs > 0 ? spend / msgs : 0;
  })(),
});

export const sumSales = (sales: DailySale[]) => ({
  total: sales.reduce((a, s) => a + s.total_sales, 0),
  newClient: sales.reduce((a, s) => a + s.new_client_sales, 0),
  repeat: sales.reduce((a, s) => a + s.repeat_sales, 0),
  physical: sales.reduce((a, s) => a + s.physical_store_sales, 0),
  online: sales.reduce((a, s) => a + s.online_sales, 0),
});

type OperatingKpiRow = ClientDailyOperatingKpi | ClientMonthlyOperatingKpi;

export const sumOperatingKpis = (rows: OperatingKpiRow[]) => {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const purchaseValue = rows.reduce((sum, row) => sum + row.purchase_value, 0);
  const totalSales = rows.reduce((sum, row) => sum + row.total_sales, 0);

  return {
    spend,
    reach: rows.reduce((sum, row) => sum + row.reach, 0),
    impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
    messages: rows.reduce((sum, row) => sum + row.messages, 0),
    leads: rows.reduce((sum, row) => sum + row.leads, 0),
    purchases: rows.reduce((sum, row) => sum + row.purchases, 0),
    purchase_value: purchaseValue,
    total_sales: totalSales,
    new_client_sales: rows.reduce((sum, row) => sum + row.new_client_sales, 0),
    repeat_sales: rows.reduce((sum, row) => sum + row.repeat_sales, 0),
    physical_store_sales: rows.reduce((sum, row) => sum + row.physical_store_sales, 0),
    online_sales: rows.reduce((sum, row) => sum + row.online_sales, 0),
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
