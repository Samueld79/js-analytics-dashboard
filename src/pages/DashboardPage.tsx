import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CHART, TOOLTIP_STYLE } from '../lib/chartColors';
import { motion, type Transition } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  DollarSign,
  MessageCircle,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import {
  useAdMetrics,
  useCampaignSummary,
  useMetaSyncRows,
  useMonthlyOperatingKpis,
  useTasks,
} from '../hooks/useData';
import {
  aggregateCampaignKpisByClient,
  sumCampaignMonthAggregates,
} from '../services/adCampaignMetrics';
import { useSocialMonthlyMetrics } from '../hooks/useSocialMonthlyMetrics';
import type { AdMetric, DailySale } from '../lib/supabase';
import {
  formatCop,
  formatNumber,
  formatRoas,
  isAlertSnoozed,
  sumMetrics,
  sumSales,
} from '../lib/utils';
import { buildClientMetaOverviewByClient } from '../services/meta';
import { getMonthKey, getMonthLabel } from '../utils/monthLabel';

const EMPTY_CLIENT_SCOPE = '00000000-0000-0000-0000-000000000000';

function RefreshIndicator() {
  return (
    <motion.span
      style={{
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: 'hsl(180,100%,50%)',
        display: 'inline-block',
        flexShrink: 0,
      }}
      animate={{ opacity: [1, 0.25, 1] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' } as Transition}
      title="Actualizando datos..."
    />
  );
}

type ChartPayloadEntry = {
  dataKey: string;
  name: string;
  value: number;
  color: string;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        ...TOOLTIP_STYLE,
        padding: '10px 14px',
      }}
    >
      <p
        style={{
          fontSize: '0.65rem',
          color: 'hsl(215,15%,55%)',
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: '0 0 6px',
        }}
      >
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ fontSize: '0.72rem', color: entry.color, margin: '2px 0' }}>
          {entry.name}: {entry.value.toLocaleString('es-CO')}
        </p>
      ))}
    </div>
  );
}

export function DashboardPage() {
  // ── Data hooks ──────────────────────────────────────────────────────────────
  const { clients, loading: clientsLoading } = useClients();
  const { isInternal, accessibleClientIds, defaultClientId } = useAuth();
  const { alerts, unreadCount } = useAlerts();
  const { tasks } = useTasks();
  const scopedClientId =
    !isInternal && accessibleClientIds.length <= 1
      ? defaultClientId ?? EMPTY_CLIENT_SCOPE
      : undefined;
  const { monthlyKpis, loading: kpisLoading } = useMonthlyOperatingKpis(scopedClientId, 6);
  const { metrics: rawAdMetrics, loading: metricsLoading } = useAdMetrics(scopedClientId, 180);
  const { sales, loading: salesLoading } = useDailySales({ clientId: scopedClientId, days: 365 });
  const { metrics: socialMonthlyMetrics } = useSocialMonthlyMetrics(scopedClientId, 12);
  const { syncRows } = useMetaSyncRows(scopedClientId);
  // Unified campaign source — primary data for KPIs, chart and top clients
  const { rows: campaignRows, byMonth: campaignByMonth } = useCampaignSummary(scopedClientId);

  // ── Period selector ───────────────────────────────────────────────────────────
  // null = auto-select most recent available month
  const [selectedPeriod, setSelectedPeriod] = useState<string | 'all' | null>(null);
  // activePeriod falls back to the most recent month from campaign data
  const activePeriod = selectedPeriod ?? campaignByMonth[campaignByMonth.length - 1]?.month ?? new Date().toISOString().slice(0, 7);

  // ── Scoping ─────────────────────────────────────────────────────────────────
  const visibleClientIds = useMemo(
    () => new Set(isInternal ? clients.map((c) => c.id) : accessibleClientIds),
    [accessibleClientIds, clients, isInternal],
  );
  const visibleClients = useMemo(
    () =>
      isInternal ? clients : clients.filter((c) => visibleClientIds.has(c.id)),
    [clients, isInternal, visibleClientIds],
  );
  const scopedMonthlyKpis = useMemo(
    () =>
      isInternal
        ? monthlyKpis
        : monthlyKpis.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, monthlyKpis, visibleClientIds],
  );
  const scopedAdMetrics = useMemo(
    () =>
      isInternal
        ? rawAdMetrics
        : rawAdMetrics.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, rawAdMetrics, visibleClientIds],
  );
  const scopedSales = useMemo(
    () =>
      isInternal ? sales : sales.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, sales, visibleClientIds],
  );
  const scopedSocialMonthlyMetrics = useMemo(
    () =>
      isInternal
        ? socialMonthlyMetrics
        : socialMonthlyMetrics.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, socialMonthlyMetrics, visibleClientIds],
  );
  const scopedSyncRows = useMemo(
    () =>
      isInternal ? syncRows : syncRows.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, syncRows, visibleClientIds],
  );
  const scopedAlerts = useMemo(
    () =>
      isInternal
        ? alerts
        : alerts.filter((a) => a.client_id && visibleClientIds.has(a.client_id)),
    [alerts, isInternal, visibleClientIds],
  );
  const scopedTasks = useMemo(
    () =>
      isInternal
        ? tasks
        : tasks.filter((t) => t.client_id && visibleClientIds.has(t.client_id)),
    [isInternal, tasks, visibleClientIds],
  );

  // ── Period labels ─────────────────────────────────────────────────────────────
  const activePeriodLabel =
    activePeriod === 'all' ? 'Año completo' : getMonthLabel(activePeriod);
  const portalClientName =
    !isInternal && visibleClients.length === 1
      ? visibleClients[0]?.name ?? 'Mi empresa'
      : null;
  // executiveMonth kept for operating KPI table (ventas/roas uses monthly KPIs)
  const executiveMonth = activePeriod === 'all'
    ? (campaignByMonth[campaignByMonth.length - 1]?.month ?? new Date().toISOString().slice(0, 7))
    : activePeriod;

  // ── Filtered by executive month ─────────────────────────────────────────────
  const executiveRows = scopedMonthlyKpis.filter(
    (r) => getMonthKey(r.month) === executiveMonth,
  );
  const executiveAdMetrics = scopedAdMetrics.filter(
    (r) => getMonthKey(r.date) === executiveMonth,
  );
  const executiveSales = scopedSales.filter(
    (r) => getMonthKey(r.date) === executiveMonth,
  );
  const executiveSocialMetrics = scopedSocialMonthlyMetrics.filter(
    (r) => getMonthKey(r.month) === executiveMonth,
  );

  // ── Meta overview ────────────────────────────────────────────────────────────
  const metaByClient = useMemo(
    () =>
      buildClientMetaOverviewByClient({
        clientIds: visibleClients.map((c) => c.id),
        monthlyKpis: scopedMonthlyKpis,
        syncRows: scopedSyncRows,
      }),
    [scopedMonthlyKpis, scopedSyncRows, visibleClients],
  );

  // ── Campaign KPIs — canonical source for cards, chart, top clients ────────────
  // Rows filtered to the active period
  const periodCampaignRows = useMemo(
    () =>
      activePeriod === 'all'
        ? campaignRows
        : campaignRows.filter((r) => r.date.startsWith(activePeriod)),
    [campaignRows, activePeriod],
  );

  // Aggregate for KPI cards
  const selectedKpis = useMemo(
    () =>
      activePeriod === 'all'
        ? sumCampaignMonthAggregates(campaignByMonth, 'all')
        : (campaignByMonth.find((m) => m.month === activePeriod) ?? null),
    [campaignByMonth, activePeriod],
  );

  // Per-client breakdown for selected period (used in top-clients chart + table)
  const selectedByClient = useMemo(
    () => aggregateCampaignKpisByClient(periodCampaignRows),
    [periodCampaignRows],
  );

  // ad_metrics (windsor_ai) is the authoritative aggregate — fall back to ad_campaign_metrics
  const adMetricsTotals = sumMetrics(executiveAdMetrics);
  const kpiSpend = adMetricsTotals.spend > 0 ? adMetricsTotals.spend : (selectedKpis?.spend ?? 0);
  const kpiMessages = adMetricsTotals.messages > 0 ? adMetricsTotals.messages : (selectedKpis?.messages ?? 0);
  const kpiReach = adMetricsTotals.reach > 0 ? adMetricsTotals.reach : (selectedKpis?.reach ?? 0);
  const kpiImpressions = adMetricsTotals.impressions > 0 ? adMetricsTotals.impressions : (selectedKpis?.impressions ?? 0);
  const kpiFrequency = selectedKpis?.frequency ?? 0;

  const kpiSalesTotal = useMemo(
    () =>
      activePeriod === 'all'
        ? scopedSales.reduce((sum, s) => sum + s.total_sales, 0)
        : scopedSales
            .filter((s) => s.date.startsWith(activePeriod))
            .reduce((sum, s) => sum + s.total_sales, 0),
    [scopedSales, activePeriod],
  );

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const visibleOpenAlerts = useMemo(
    () =>
      scopedAlerts.filter(
        (a) => ['unread', 'read'].includes(a.status) && !isAlertSnoozed(a),
      ),
    [scopedAlerts],
  );

  const clientAlertCount = new Map<string, number>();
  const clientCriticalAlertCount = new Map<string, number>();
  visibleOpenAlerts.forEach((alert) => {
    if (!alert.client_id) return;
    clientAlertCount.set(
      alert.client_id,
      (clientAlertCount.get(alert.client_id) ?? 0) + 1,
    );
    if (alert.severity === 'critical') {
      clientCriticalAlertCount.set(
        alert.client_id,
        (clientCriticalAlertCount.get(alert.client_id) ?? 0) + 1,
      );
    }
  });

  // ── KPI values ───────────────────────────────────────────────────────────────
  const pendingTasks = scopedTasks.filter((t) => t.status === 'pending').length;

  // ── Client executive rows ────────────────────────────────────────────────────
  const clientExecutiveRows = visibleClients
    .map((client) => {
      const campaignRow = selectedByClient.get(client.id) ?? null;
      const monthRow = executiveRows.find((r) => r.client_id === client.id) ?? null;
      const baseTotals =
        monthRow ??
        buildCombinedMonthTotals(
          executiveAdMetrics.filter((r) => r.client_id === client.id),
          executiveSales.filter((r) => r.client_id === client.id),
        );
      // ad_metrics (via baseTotals) is the authoritative spend source.
      const canonicalSpend = baseTotals.spend > 0 ? baseTotals.spend : (campaignRow?.spend ?? 0);
      const monthTotals = {
        ...baseTotals,
        spend: canonicalSpend,
        real_roas:
          canonicalSpend > 0 && baseTotals.total_sales > 0
            ? baseTotals.total_sales / canonicalSpend
            : 0,
      };
      const meta = metaByClient[client.id] ?? null;
      const socialMetric =
        executiveSocialMetrics.find((r) => r.client_id === client.id) ?? null;
      const alertCount = clientAlertCount.get(client.id) ?? 0;
      const criticalCount = clientCriticalAlertCount.get(client.id) ?? 0;
      return { client, monthTotals, meta, socialMetric, alertCount, criticalCount };
    })
    .filter(
      (e) =>
        e.monthTotals.spend > 0 ||
        e.monthTotals.total_sales > 0 ||
        e.alertCount > 0 ||
        Boolean(e.socialMetric) ||
        Boolean(e.meta?.active_accounts),
    )
    .sort((a, b) => {
      if (b.monthTotals.real_roas !== a.monthTotals.real_roas)
        return b.monthTotals.real_roas - a.monthTotals.real_roas;
      if (b.monthTotals.total_sales !== a.monthTotals.total_sales)
        return b.monthTotals.total_sales - a.monthTotals.total_sales;
      return b.monthTotals.spend - a.monthTotals.spend;
    });

  // ── Chart data ───────────────────────────────────────────────────────────────
  // Monthly chart — replaces old daily area chart (which used ad_metrics)
  const monthlyChartData = useMemo(
    () =>
      campaignByMonth.map((m) => ({
        label: getMonthLabel(m.month),
        spend: Math.round(m.spend),
        messages: m.messages,
        isSelected: m.month === activePeriod,
      })),
    [campaignByMonth, activePeriod],
  );

  const clientSpendData = useMemo(
    () =>
      [...selectedByClient.entries()]
        .map(([cid, kpi]) => {
          const raw = visibleClients.find((c) => c.id === cid)?.name ?? cid.slice(0, 8);
          return { name: raw.length > 14 ? raw.slice(0, 14) + '…' : raw, spend: Math.round(kpi.spend) };
        })
        .filter((e) => e.spend > 0)
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 6),
    [selectedByClient, visibleClients],
  );

  const tableClients = useMemo(
    () =>
      [...clientExecutiveRows]
        .sort((a, b) => b.monthTotals.spend - a.monthTotals.spend)
        .slice(0, 8),
    [clientExecutiveRows],
  );

  // ── Year sales ────────────────────────────────────────────────────────────────
  const currentYear = String(new Date().getFullYear());
  const currentMonthIdx = new Date().getMonth(); // 0-based

  const yearSalesData = useMemo(() => {
    const byMonth = new Map<string, number>();
    scopedSales.forEach((s) => {
      const m = s.date.slice(0, 7);
      if (m.startsWith(currentYear)) {
        byMonth.set(m, (byMonth.get(m) ?? 0) + s.total_sales);
      }
    });
    return Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const key = `${currentYear}-${mm}`;
      return {
        month: key,
        label: new Date(`${currentYear}-${mm}-15`).toLocaleDateString('es-CO', { month: 'short' }),
        sales: byMonth.get(key) ?? 0,
        isFuture: i > currentMonthIdx,
        isCurrent: i === currentMonthIdx,
      };
    });
  }, [scopedSales, currentYear, currentMonthIdx]);

  const yearClientSales = useMemo(() => {
    const byClient = new Map<string, number>();
    scopedSales.forEach((s) => {
      if (s.date.startsWith(currentYear)) {
        byClient.set(s.client_id, (byClient.get(s.client_id) ?? 0) + s.total_sales);
      }
    });
    return [...byClient.entries()]
      .map(([clientId, total]) => ({
        clientId,
        name: visibleClients.find((c) => c.id === clientId)?.name ?? clientId.slice(0, 8),
        total,
      }))
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [scopedSales, currentYear, visibleClients]);

  const yearTotal = yearSalesData.reduce((s, m) => s + m.sales, 0);
  const yearMonthsWithData = yearSalesData.filter((m) => !m.isFuture && m.sales > 0);
  const bestMonth = yearMonthsWithData.reduce<(typeof yearSalesData)[0] | null>(
    (best, m) => (best === null || m.sales > best.sales ? m : best),
    null,
  );
  const monthlyAvg =
    yearMonthsWithData.length > 0 ? yearTotal / yearMonthsWithData.length : 0;
  const yearEstimate =
    currentMonthIdx > 0 && yearTotal > 0 ? (yearTotal / (currentMonthIdx + 1)) * 12 : 0;

  // ── Refresh indicator ────────────────────────────────────────────────────────
  const isRefreshing = clientsLoading || kpisLoading || metricsLoading || salesLoading;
  const hasData =
    clients.length > 0 || monthlyKpis.length > 0 || rawAdMetrics.length > 0 || sales.length > 0;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const currentMonthLabel = new Date()
    .toLocaleString('es-ES', { month: 'long', year: 'numeric' })
    .toUpperCase();

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut', delay } as Transition,
  });

  const kpiItems: Array<{ label: string; value: string; Icon: LucideIcon }> = [
    {
      label: `Inversión ${activePeriodLabel}`,
      value: formatCop(kpiSpend),
      Icon: DollarSign,
    },
    {
      label: `Conversaciones ${activePeriodLabel}`,
      value: formatNumber(kpiMessages),
      Icon: MessageCircle,
    },
    {
      label: `Ventas ${activePeriodLabel}`,
      value: kpiSalesTotal > 0 ? formatCop(kpiSalesTotal) : '—',
      Icon: Banknote,
    },
    {
      label: 'Alcance (Reach)',
      value: formatNumber(kpiReach),
      Icon: TrendingUp,
    },
    {
      label: 'Impresiones',
      value: formatNumber(kpiImpressions),
      Icon: BarChart3,
    },
    {
      label: 'Frecuencia',
      value: kpiFrequency > 0 ? kpiFrequency.toFixed(2) : '—',
      Icon: ShoppingCart,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="page-content dashboard-v3">
      {/* ── Header ── */}
      <motion.div className="page-header" {...fadeUp(0)}>
        <div>
          <h1 className="page-title">
            {portalClientName ? `Resultados de ${portalClientName}` : 'Dashboard General'}
          </h1>
          <p className="page-subtitle">
            {portalClientName
              ? `PANEL DE RESULTADOS · ${currentMonthLabel}`
              : `RESUMEN GENERAL · ${currentMonthLabel}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isRefreshing && hasData && <RefreshIndicator />}
          {pendingTasks > 0 && (
            <span
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                color: 'hsl(215,15%,55%)',
              }}
            >
              {pendingTasks} tarea{pendingTasks !== 1 ? 's' : ''} pendiente
              {pendingTasks !== 1 ? 's' : ''}
            </span>
          )}
          {unreadCount > 0 && (
            <Link to="/alerts" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={13} />
              {unreadCount} alerta{unreadCount !== 1 ? 's' : ''}
            </Link>
          )}
          <Link to="/metrics" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={13} />
            Ver desempeño
          </Link>
        </div>
      </motion.div>

      {/* ── Period Selector ── */}
      {campaignByMonth.length > 0 && (
        <motion.div
          style={{ display: 'flex', gap: '6px', padding: '0 0 4px' }}
          {...fadeUp(0.05)}
        >
          {campaignByMonth.map((m) => (
            <button
              key={m.month}
              onClick={() => setSelectedPeriod(m.month)}
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                padding: '5px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                border: activePeriod === m.month
                  ? '1px solid hsl(180,100%,50%)'
                  : '1px solid hsl(0 0% 100% / 0.1)',
                background: activePeriod === m.month
                  ? 'hsl(180 100% 50% / 0.1)'
                  : 'transparent',
                color: activePeriod === m.month
                  ? 'hsl(180,100%,50%)'
                  : 'hsl(215,15%,55%)',
              }}
            >
              {getMonthLabel(m.month)}
            </button>
          ))}
          <button
            onClick={() => setSelectedPeriod('all')}
            style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              padding: '5px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: activePeriod === 'all'
                ? '1px solid hsl(180,100%,50%)'
                : '1px solid hsl(0 0% 100% / 0.1)',
              background: activePeriod === 'all'
                ? 'hsl(180 100% 50% / 0.1)'
                : 'transparent',
              color: activePeriod === 'all'
                ? 'hsl(180,100%,50%)'
                : 'hsl(215,15%,55%)',
            }}
          >
            Total año
          </button>
        </motion.div>
      )}

      {/* ── KPI Grid ── */}
      <div className="dashboard-kpi-grid">
        {kpiItems.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="card-glass"
            style={{ padding: '14px 18px', minHeight: 100 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' } as Transition}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
              }}
            >
              <span className="number-label">{kpi.label}</span>
              <kpi.Icon size={14} style={{ color: 'hsl(215,15%,40%)' }} />
            </div>
            <div
              className="font-display"
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'hsl(0,0%,98%)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {kpi.value}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '10px',
              }}
            >
              <TrendingUp size={11} style={{ color: 'hsl(180,100%,50%)' }} />
              <span
                style={{
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.62rem',
                  color: 'hsl(215,15%,50%)',
                }}
              >
                vs mes anterior
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="dashboard-charts-row">
        {/* Bar Chart — Inversión & Mensajes por mes (fuente: ad_campaign_metrics) */}
        <motion.div
          className="card-glass"
          style={{ padding: '16px 20px' }}
          {...fadeUp(0.25)}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px',
            }}
          >
            <div>
              <span className="number-label" style={{ display: 'block', marginBottom: '4px' }}>
                Histórico mensual
              </span>
              <h3
                className="font-display"
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: 'hsl(0,0%,98%)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Inversión &amp; Mensajes
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: CHART.cyan }} />
                <span className="number-label">Inversión</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: CHART.violet }} />
                <span className="number-label">Mensajes</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChartData} barGap={4}>
              <defs>
                <linearGradient id="dashSpendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.cyan} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={CHART.cyan} stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="dashMsgsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.violet} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={CHART.violet} stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="spend" name="Inversión" fill="url(#dashSpendGrad)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="messages" name="Mensajes" fill="url(#dashMsgsGrad)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Bar Chart — Inversión por cliente */}
        <motion.div
          className="card-glass"
          style={{ padding: '16px 20px' }}
          {...fadeUp(0.3)}
        >
          <div style={{ marginBottom: '12px' }}>
            <span className="number-label" style={{ display: 'block', marginBottom: '4px' }}>
              Top clientes
            </span>
            <h3
              className="font-display"
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                color: 'hsl(0,0%,98%)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Inversión por cliente
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={clientSpendData} layout="vertical">
              <defs>
                <linearGradient id="dashClientGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={CHART.cyan} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART.cyan} stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="spend"
                name="Inversión"
                fill="url(#dashClientGrad)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── Year Sales ── */}
      <motion.div
        className="card-glass"
        style={{ overflow: 'hidden' }}
        {...fadeUp(0.35)}
      >
        {/* Card header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid hsl(0 0% 100% / 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span className="number-label" style={{ display: 'block', marginBottom: '4px' }}>
              Ventas del año
            </span>
            <h3
              className="font-display"
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                color: 'hsl(0,0%,98%)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Progreso comercial {currentYear}
            </h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="number-label" style={{ display: 'block', marginBottom: '4px' }}>
              Total acumulado
            </span>
            <span
              className="font-display"
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: CHART.green,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {formatCop(yearTotal)}
            </span>
          </div>
        </div>

        {/* Two-column body */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60% 40%',
            gap: '16px',
            padding: '16px 20px',
          }}
        >
          {/* Left: monthly bar chart */}
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={yearSalesData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ventasGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.green} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="sales"
                name="Ventas"
                stroke={CHART.green}
                strokeWidth={2}
                fill="url(#ventasGradient)"
                dot={false}
                activeDot={{ r: 4, fill: CHART.green, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Right: stats + top clients */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Mini stats */}
            {[
              {
                label: 'Mejor mes',
                value: bestMonth ? `${bestMonth.label} — ${formatCop(bestMonth.sales)}` : '—',
              },
              {
                label: 'Promedio mensual',
                value: monthlyAvg > 0 ? formatCop(monthlyAvg) : '—',
              },
              {
                label: 'Meta estimada año',
                value: yearEstimate > 0 ? formatCop(yearEstimate) : '—',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  padding: '12px 16px',
                  borderRadius: '4px',
                  border: '1px solid hsl(0 0% 100% / 0.06)',
                  background: 'hsl(220,18%,9%)',
                }}
              >
                <span className="number-label" style={{ display: 'block', marginBottom: '4px' }}>
                  {stat.label}
                </span>
                <span
                  className="font-display"
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    color: 'hsl(0,0%,98%)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {stat.value}
                </span>
              </div>
            ))}

            {/* Top 3 clients */}
            {yearClientSales.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <span className="number-label" style={{ display: 'block', marginBottom: '12px' }}>
                  Top clientes del año
                </span>
                {yearClientSales.map((entry, i) => (
                  <div key={entry.clientId} style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '5px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'JetBrains Mono',
                          fontSize: '0.72rem',
                          color: 'hsl(0,0%,85%)',
                        }}
                      >
                        {i + 1}. {entry.name}
                      </span>
                      <span
                        style={{
                          fontFamily: 'JetBrains Mono',
                          fontSize: '0.72rem',
                          color: 'hsl(215,15%,55%)',
                        }}
                      >
                        {formatCop(entry.total)}
                      </span>
                    </div>
                    <div
                      style={{
                        height: '3px',
                        background: 'hsl(0 0% 100% / 0.08)',
                        borderRadius: '2px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${yearClientSales[0].total > 0 ? (entry.total / yearClientSales[0].total) * 100 : 0}%`,
                          background: CHART.green,
                          opacity: i === 0 ? 1 : i === 1 ? 0.6 : 0.35,
                          borderRadius: '2px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Client Table ── */}
      <motion.div
        className="card-glass"
        style={{ overflow: 'hidden' }}
        {...fadeUp(0.4)}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid hsl(0 0% 100% / 0.08)',
          }}
        >
          <span className="number-label" style={{ display: 'block', marginBottom: '4px' }}>
            Clientes activos
          </span>
          <h3
            className="font-display"
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'hsl(0,0%,98%)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Rendimiento del mes
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.08)' }}>
                {['Cliente', 'Inversión', 'Ventas', 'ROAS Op.', 'Estado'].map((h) => (
                  <th
                    key={h}
                    className="number-label"
                    style={{ padding: '12px 24px', textAlign: 'left', fontWeight: 400 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableClients.map(({ client, monthTotals, alertCount }) => (
                <tr
                  key={client.id}
                  style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.05)' }}
                >
                  <td style={{ padding: '14px 24px' }}>
                    <Link
                      to={`/clients/${client.id}`}
                      style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'hsl(0,0%,92%)',
                        textDecoration: 'none',
                      }}
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td
                    style={{
                      padding: '14px 24px',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '0.78rem',
                      color: 'hsl(0,0%,85%)',
                    }}
                  >
                    {formatCop(monthTotals.spend)}
                  </td>
                  <td
                    style={{
                      padding: '14px 24px',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '0.78rem',
                      color: 'hsl(0,0%,85%)',
                    }}
                  >
                    {monthTotals.total_sales > 0 ? formatCop(monthTotals.total_sales) : '—'}
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <span className={roasClass(monthTotals.real_roas)}>
                      {formatRoas(monthTotals.real_roas)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono',
                        fontSize: '0.62rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        ...(alertCount > 0
                          ? {
                              background: 'hsl(0 84% 60% / 0.12)',
                              color: 'hsl(0,84%,65%)',
                              border: '1px solid hsl(0 84% 60% / 0.2)',
                            }
                          : {
                              background: 'hsl(145 100% 45% / 0.12)',
                              color: 'hsl(145,100%,45%)',
                              border: '1px solid hsl(145 100% 45% / 0.2)',
                            }),
                      }}
                    >
                      {alertCount > 0
                        ? `${alertCount} alerta${alertCount > 1 ? 's' : ''}`
                        : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
              {tableClients.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: '32px 24px',
                      textAlign: 'center',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '0.72rem',
                      color: 'hsl(215,15%,40%)',
                    }}
                  >
                    No hay clientes con datos para el mes actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

// ── Helper functions ──────────────────────────────────────────────────────────

function buildCombinedMonthTotals(metrics: AdMetric[], sales: DailySale[]) {
  const metricTotals = sumMetrics(metrics);
  const salesTotals = sumSales(sales);
  const spend = metricTotals.spend;
  const totalSales = salesTotals.total;

  return {
    ...metricTotals,
    total_sales: totalSales,
    new_client_sales: salesTotals.newClient,
    repeat_sales: salesTotals.repeat,
    physical_store_sales: salesTotals.physical,
    online_sales: salesTotals.online,
    ad_roas: metricTotals.roas,
    real_roas: spend > 0 ? totalSales / spend : 0,
  };
}

function roasClass(roas: number): string {
  if (roas >= 3) return 'roas-pill roas-good';
  if (roas >= 2) return 'roas-pill roas-ok';
  return 'roas-pill roas-low';
}
