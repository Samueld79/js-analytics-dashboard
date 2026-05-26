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
  ChevronDown,
  DollarSign,
  MessageCircle,
  ShoppingCart,
  Target,
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
import { GoalProgressCard } from '../components/GoalProgressCard';
import {
  getCurrentMonthKey,
  getGoalStatus,
  getTodayStr,
  getWeekStart,
} from '../utils/goalHelpers';

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
    <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px' }}>
      <p style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
  const { rows: campaignRows, byMonth: campaignByMonth } = useCampaignSummary(scopedClientId);

  // ── Period selector ─────────────────────────────────────────────────────────
  const [selectedPeriod, setSelectedPeriod] = useState<string | 'all' | null>(null);
  const activePeriod = selectedPeriod ?? campaignByMonth[campaignByMonth.length - 1]?.month ?? new Date().toISOString().slice(0, 7);

  // ── Goal filter ─────────────────────────────────────────────────────────────
  const [goalFilter, setGoalFilter] = useState<'all' | 'red' | 'yellow' | 'green'>('all');

  // ── Scoping ─────────────────────────────────────────────────────────────────
  const visibleClientIds = useMemo(
    () => new Set(isInternal ? clients.map((c) => c.id) : accessibleClientIds),
    [accessibleClientIds, clients, isInternal],
  );
  const visibleClients = useMemo(
    () => isInternal ? clients : clients.filter((c) => visibleClientIds.has(c.id)),
    [clients, isInternal, visibleClientIds],
  );
  const scopedMonthlyKpis = useMemo(
    () => isInternal ? monthlyKpis : monthlyKpis.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, monthlyKpis, visibleClientIds],
  );
  const scopedAdMetrics = useMemo(
    () => isInternal ? rawAdMetrics : rawAdMetrics.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, rawAdMetrics, visibleClientIds],
  );
  const scopedSales = useMemo(
    () => isInternal ? sales : sales.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, sales, visibleClientIds],
  );
  const scopedSocialMonthlyMetrics = useMemo(
    () => isInternal ? socialMonthlyMetrics : socialMonthlyMetrics.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, socialMonthlyMetrics, visibleClientIds],
  );
  const scopedSyncRows = useMemo(
    () => isInternal ? syncRows : syncRows.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, syncRows, visibleClientIds],
  );
  const scopedAlerts = useMemo(
    () => isInternal ? alerts : alerts.filter((a) => a.client_id && visibleClientIds.has(a.client_id)),
    [alerts, isInternal, visibleClientIds],
  );
  const scopedTasks = useMemo(
    () => isInternal ? tasks : tasks.filter((t) => t.client_id && visibleClientIds.has(t.client_id)),
    [isInternal, tasks, visibleClientIds],
  );

  // ── Period labels ─────────────────────────────────────────────────────────────
  const activePeriodLabel = activePeriod === 'all' ? 'Año completo' : getMonthLabel(activePeriod);
  const portalClientName =
    !isInternal && visibleClients.length === 1
      ? visibleClients[0]?.name ?? 'Mi empresa'
      : null;
  const executiveMonth = activePeriod === 'all'
    ? (campaignByMonth[campaignByMonth.length - 1]?.month ?? new Date().toISOString().slice(0, 7))
    : activePeriod;

  // ── Filtered by executive month ─────────────────────────────────────────────
  const executiveRows = scopedMonthlyKpis.filter((r) => getMonthKey(r.month) === executiveMonth);
  const executiveAdMetrics = scopedAdMetrics.filter((r) => getMonthKey(r.date) === executiveMonth);
  const executiveSales = scopedSales.filter((r) => getMonthKey(r.date) === executiveMonth);
  const executiveSocialMetrics = scopedSocialMonthlyMetrics.filter((r) => getMonthKey(r.month) === executiveMonth);

  // ── Meta overview ────────────────────────────────────────────────────────────
  const metaByClient = useMemo(
    () => buildClientMetaOverviewByClient({
      clientIds: visibleClients.map((c) => c.id),
      monthlyKpis: scopedMonthlyKpis,
      syncRows: scopedSyncRows,
    }),
    [scopedMonthlyKpis, scopedSyncRows, visibleClients],
  );

  // ── Campaign KPIs ────────────────────────────────────────────────────────────
  const periodCampaignRows = useMemo(
    () => activePeriod === 'all' ? campaignRows : campaignRows.filter((r) => r.date.startsWith(activePeriod)),
    [campaignRows, activePeriod],
  );
  const selectedKpis = useMemo(
    () => activePeriod === 'all'
      ? sumCampaignMonthAggregates(campaignByMonth, 'all')
      : (campaignByMonth.find((m) => m.month === activePeriod) ?? null),
    [campaignByMonth, activePeriod],
  );
  const selectedByClient = useMemo(
    () => aggregateCampaignKpisByClient(periodCampaignRows),
    [periodCampaignRows],
  );

  const adMetricsTotals = sumMetrics(executiveAdMetrics);
  const kpiSpend      = adMetricsTotals.spend > 0      ? adMetricsTotals.spend      : (selectedKpis?.spend ?? 0);
  const kpiMessages   = adMetricsTotals.messages > 0   ? adMetricsTotals.messages   : (selectedKpis?.messages ?? 0);
  const kpiReach      = adMetricsTotals.reach > 0      ? adMetricsTotals.reach      : (selectedKpis?.reach ?? 0);
  const kpiImpressions = adMetricsTotals.impressions > 0 ? adMetricsTotals.impressions : (selectedKpis?.impressions ?? 0);
  const kpiFrequency  = selectedKpis?.frequency ?? 0;

  const kpiSalesTotal = useMemo(
    () => activePeriod === 'all'
      ? scopedSales.reduce((sum, s) => sum + s.total_sales, 0)
      : scopedSales.filter((s) => s.date.startsWith(activePeriod)).reduce((sum, s) => sum + s.total_sales, 0),
    [scopedSales, activePeriod],
  );

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const visibleOpenAlerts = useMemo(
    () => scopedAlerts.filter((a) => ['unread', 'read'].includes(a.status) && !isAlertSnoozed(a)),
    [scopedAlerts],
  );

  const clientAlertCount = new Map<string, number>();
  const clientCriticalAlertCount = new Map<string, number>();
  visibleOpenAlerts.forEach((alert) => {
    if (!alert.client_id) return;
    clientAlertCount.set(alert.client_id, (clientAlertCount.get(alert.client_id) ?? 0) + 1);
    if (alert.severity === 'critical') {
      clientCriticalAlertCount.set(alert.client_id, (clientCriticalAlertCount.get(alert.client_id) ?? 0) + 1);
    }
  });

  // ── KPI values ───────────────────────────────────────────────────────────────
  const pendingTasks = scopedTasks.filter((t) => t.status === 'pending').length;

  // ── Client executive rows ────────────────────────────────────────────────────
  const clientExecutiveRows = visibleClients
    .map((client) => {
      const campaignRow = selectedByClient.get(client.id) ?? null;
      const monthRow = executiveRows.find((r) => r.client_id === client.id) ?? null;
      const baseTotals = monthRow ?? buildCombinedMonthTotals(
        executiveAdMetrics.filter((r) => r.client_id === client.id),
        executiveSales.filter((r) => r.client_id === client.id),
      );
      const canonicalSpend = baseTotals.spend > 0 ? baseTotals.spend : (campaignRow?.spend ?? 0);
      const monthTotals = {
        ...baseTotals,
        spend: canonicalSpend,
        real_roas: canonicalSpend > 0 && baseTotals.total_sales > 0 ? baseTotals.total_sales / canonicalSpend : 0,
      };
      const meta = metaByClient[client.id] ?? null;
      const socialMetric = executiveSocialMetrics.find((r) => r.client_id === client.id) ?? null;
      const alertCount = clientAlertCount.get(client.id) ?? 0;
      const criticalCount = clientCriticalAlertCount.get(client.id) ?? 0;
      return { client, monthTotals, meta, socialMetric, alertCount, criticalCount };
    })
    .filter((e) =>
      e.monthTotals.spend > 0 ||
      e.monthTotals.total_sales > 0 ||
      e.alertCount > 0 ||
      Boolean(e.socialMetric) ||
      Boolean(e.meta?.active_accounts),
    )
    .sort((a, b) => {
      if (b.monthTotals.real_roas !== a.monthTotals.real_roas) return b.monthTotals.real_roas - a.monthTotals.real_roas;
      if (b.monthTotals.total_sales !== a.monthTotals.total_sales) return b.monthTotals.total_sales - a.monthTotals.total_sales;
      return b.monthTotals.spend - a.monthTotals.spend;
    });

  // ── Chart data ───────────────────────────────────────────────────────────────
  const monthlyChartData = useMemo(
    () => campaignByMonth.map((m) => ({
      label: getMonthLabel(m.month),
      spend: Math.round(m.spend),
      messages: m.messages,
      isSelected: m.month === activePeriod,
    })),
    [campaignByMonth, activePeriod],
  );

  const clientSpendData = useMemo(
    () => [...selectedByClient.entries()]
      .map(([cid, kpi]) => ({
        name: visibleClients.find((c) => c.id === cid)?.name ?? cid.slice(0, 8),
        spend: Math.round(kpi.spend),
      }))
      .filter((e) => e.spend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6),
    [selectedByClient, visibleClients],
  );

  const tableClients = useMemo(
    () => [...clientExecutiveRows].sort((a, b) => b.monthTotals.spend - a.monthTotals.spend).slice(0, 8),
    [clientExecutiveRows],
  );

  // ── Year sales ────────────────────────────────────────────────────────────────
  const currentYear = String(new Date().getFullYear());
  const currentMonthIdx = new Date().getMonth();

  const yearSalesData = useMemo(() => {
    const byMonth = new Map<string, number>();
    scopedSales.forEach((s) => {
      const m = s.date.slice(0, 7);
      if (m.startsWith(currentYear)) byMonth.set(m, (byMonth.get(m) ?? 0) + s.total_sales);
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
      if (s.date.startsWith(currentYear)) byClient.set(s.client_id, (byClient.get(s.client_id) ?? 0) + s.total_sales);
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
    (best, m) => (best === null || m.sales > best.sales ? m : best), null,
  );
  const monthlyAvg = yearMonthsWithData.length > 0 ? yearTotal / yearMonthsWithData.length : 0;
  const yearEstimate = currentMonthIdx > 0 && yearTotal > 0 ? (yearTotal / (currentMonthIdx + 1)) * 12 : 0;

  // ── Goal tracking ─────────────────────────────────────────────────────────────
  const currentMonthKey = getCurrentMonthKey();
  const weekStart = getWeekStart();
  const todayStr = getTodayStr();

  const goalClients = useMemo(
    () => visibleClients.filter((c) => (c.monthly_goal ?? 0) > 0 && c.status === 'active'),
    [visibleClients],
  );

  const monthSalesByClient = useMemo(() => {
    const map = new Map<string, number>();
    scopedSales.forEach((s) => {
      if (s.date.startsWith(currentMonthKey)) map.set(s.client_id, (map.get(s.client_id) ?? 0) + s.total_sales);
    });
    return map;
  }, [scopedSales, currentMonthKey]);

  const weekSalesByClient = useMemo(() => {
    const map = new Map<string, number>();
    scopedSales.forEach((s) => {
      if (s.date >= weekStart && s.date <= todayStr) map.set(s.client_id, (map.get(s.client_id) ?? 0) + s.total_sales);
    });
    return map;
  }, [scopedSales, weekStart, todayStr]);

  const goalRows = useMemo(() => {
    const ORDER = { red: 0, yellow: 1, green: 2 };
    return goalClients
      .map((c) => {
        const monthly = monthSalesByClient.get(c.id) ?? 0;
        const weekly  = weekSalesByClient.get(c.id) ?? 0;
        const goal    = c.monthly_goal ?? 0;
        const status  = getGoalStatus(monthly, goal);
        return { client: c, monthly, weekly, goal, status };
      })
      .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  }, [goalClients, monthSalesByClient, weekSalesByClient]);

  const goalCountByStatus = useMemo(() => ({
    green:  goalRows.filter((r) => r.status === 'green').length,
    yellow: goalRows.filter((r) => r.status === 'yellow').length,
    red:    goalRows.filter((r) => r.status === 'red').length,
  }), [goalRows]);

  const filteredGoalRows = goalFilter === 'all' ? goalRows : goalRows.filter((r) => r.status === goalFilter);

  // ── Refresh indicator ────────────────────────────────────────────────────────
  const isRefreshing = clientsLoading || kpisLoading || metricsLoading || salesLoading;
  const hasData = clients.length > 0 || monthlyKpis.length > 0 || rawAdMetrics.length > 0 || sales.length > 0;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const currentMonthLabel = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  const currentMonthLabelUpper = currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1);

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: 'easeOut', delay } as Transition,
  });

  // ── Primary KPIs ─────────────────────────────────────────────────────────────
  type PrimaryKpi = { label: string; value: string; Icon: LucideIcon; iconColor: string; iconBg: string };
  const primaryKpis: PrimaryKpi[] = [
    { label: `Inversión · ${activePeriodLabel}`, value: formatCop(kpiSpend),   Icon: DollarSign,   iconColor: 'hsl(200,80%,60%)', iconBg: 'hsl(200 80% 55% / 0.15)' },
    { label: `Conversaciones · ${activePeriodLabel}`, value: formatNumber(kpiMessages), Icon: MessageCircle, iconColor: 'hsl(280,70%,65%)', iconBg: 'hsl(280 70% 60% / 0.15)' },
    { label: `Ventas · ${activePeriodLabel}`, value: kpiSalesTotal > 0 ? formatCop(kpiSalesTotal) : '—', Icon: Banknote, iconColor: 'hsl(145,70%,55%)', iconBg: 'hsl(145 65% 45% / 0.15)' },
  ];

  type SecondaryKpi = { label: string; value: string; Icon: LucideIcon };
  const secondaryKpis: SecondaryKpi[] = [
    { label: 'Alcance (Reach)',  value: formatNumber(kpiReach),                        Icon: TrendingUp },
    { label: 'Impresiones',      value: formatNumber(kpiImpressions),                  Icon: BarChart3 },
    { label: 'Frecuencia',       value: kpiFrequency > 0 ? kpiFrequency.toFixed(2) : '—', Icon: ShoppingCart },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="page-content dashboard-v3">

      {/* ── Header ── */}
      <motion.div {...fadeUp(0)} style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        {/* Left: title + breadcrumb */}
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
            {portalClientName ? `Resultados · ${portalClientName}` : 'Dashboard General'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
            Resumen · {currentMonthLabelUpper}
          </p>
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isRefreshing && hasData && <RefreshIndicator />}
          {pendingTasks > 0 && (
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.62rem', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              {pendingTasks} tarea{pendingTasks !== 1 ? 's' : ''} pendiente{pendingTasks !== 1 ? 's' : ''}
            </span>
          )}
          {unreadCount > 0 && (
            <Link to="/alerts" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem' }}>
              <AlertTriangle size={13} />
              {unreadCount} alerta{unreadCount !== 1 ? 's' : ''}
            </Link>
          )}

          {/* Period dropdown */}
          {campaignByMonth.length > 0 && (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <select
                className="dash-period-select"
                value={activePeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {campaignByMonth.map((m) => (
                  <option key={m.month} value={m.month}>{getMonthLabel(m.month)}</option>
                ))}
                <option value="all">Total año</option>
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: 'var(--color-text-muted)' }} />
            </div>
          )}

          <Link to="/metrics" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', padding: '7px 14px' }}>
            <BarChart3 size={13} />
            Ver desempeño
          </Link>
        </div>
      </motion.div>

      {/* ── Primary KPIs (3 larger) ── */}
      <div className="dash-kpi-primary-row">
        {primaryKpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="card-glass"
            style={{ padding: '18px 20px', borderRadius: 12 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' } as Transition}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                {kpi.label}
              </span>
              <div className="dash-kpi-icon" style={{ background: kpi.iconBg }}>
                <kpi.Icon size={15} style={{ color: kpi.iconColor }} />
              </div>
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace', marginBottom: 10 }}>
              {kpi.value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <TrendingUp size={10} style={{ color: 'var(--color-text-muted)' }} />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
                vs mes anterior
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Secondary KPIs (3 compact) ── */}
      <div className="dash-kpi-secondary-row">
        {secondaryKpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="card-glass"
            style={{ padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 + i * 0.05, duration: 0.3, ease: 'easeOut' } as Transition}
          >
            <kpi.Icon size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>
                {kpi.label}
              </p>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                {kpi.value}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Seguimiento de Metas ── */}
      {goalRows.length > 0 && (
        <motion.div {...fadeUp(0.22)}>
          {/* Section header */}
          <div className="dash-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={13} style={{ color: 'var(--color-text-muted)' }} />
              <span className="dash-section-title">
                Seguimiento de Metas · {getMonthLabel(currentMonthKey)}
              </span>
            </div>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                className={`dash-goal-chip${goalFilter === 'all' ? ' active-all' : ''}`}
                onClick={() => setGoalFilter('all')}
              >
                Todos ({goalRows.length})
              </button>
              {goalCountByStatus.red > 0 && (
                <button
                  className={`dash-goal-chip${goalFilter === 'red' ? ' active-red' : ''}`}
                  onClick={() => setGoalFilter(goalFilter === 'red' ? 'all' : 'red')}
                >
                  🚨 Acción inmediata ({goalCountByStatus.red})
                </button>
              )}
              {goalCountByStatus.yellow > 0 && (
                <button
                  className={`dash-goal-chip${goalFilter === 'yellow' ? ' active-yellow' : ''}`}
                  onClick={() => setGoalFilter(goalFilter === 'yellow' ? 'all' : 'yellow')}
                >
                  ⚠️ En riesgo ({goalCountByStatus.yellow})
                </button>
              )}
              {goalCountByStatus.green > 0 && (
                <button
                  className={`dash-goal-chip${goalFilter === 'green' ? ' active-green' : ''}`}
                  onClick={() => setGoalFilter(goalFilter === 'green' ? 'all' : 'green')}
                >
                  ✅ En objetivo ({goalCountByStatus.green})
                </button>
              )}
            </div>
          </div>

          {/* Goal cards grid */}
          <div className="dash-goal-grid">
            {filteredGoalRows.map(({ client, monthly, weekly, goal }) => (
              <GoalProgressCard
                key={client.id}
                clientName={client.name}
                monthlyGoal={goal}
                currentMonthlySales={monthly}
                currentWeeklySales={weekly}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Charts Row ── */}
      <div className="dashboard-charts-row">
        {/* Bar Chart — Inversión & Mensajes por mes */}
        <motion.div className="card-glass" style={{ padding: '16px 20px' }} {...fadeUp(0.25)}>
          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Histórico mensual
              </p>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                Inversión &amp; Mensajes
              </h3>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART.cyan }} />
                <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>Inversión</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART.violet }} />
                <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>Mensajes</span>
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
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="spend" name="Inversión" fill="url(#dashSpendGrad)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="messages" name="Mensajes" fill="url(#dashMsgsGrad)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Bar Chart — Inversión por cliente */}
        <motion.div className="card-glass" style={{ padding: '16px 20px' }} {...fadeUp(0.3)}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 3px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Top clientes
            </p>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
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
              <XAxis type="number" tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="spend" name="Inversión" fill="url(#dashClientGrad)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── Year Sales ── */}
      <motion.div className="card-glass" style={{ overflow: 'hidden' }} {...fadeUp(0.35)}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Ventas del año
            </p>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              Progreso comercial {currentYear}
            </h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 3px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Total acumulado
            </p>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, color: CHART.green, letterSpacing: '-0.03em', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
              {formatCop(yearTotal)}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: 16, padding: '16px 20px' }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={yearSalesData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ventasGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.green} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sales" name="Ventas" stroke={CHART.green} strokeWidth={2} fill="url(#ventasGradient)" dot={false} activeDot={{ r: 4, fill: CHART.green, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Mejor mes',       value: bestMonth ? `${bestMonth.label} — ${formatCop(bestMonth.sales)}` : '—' },
              { label: 'Promedio mensual', value: monthlyAvg > 0 ? formatCop(monthlyAvg) : '—' },
              { label: 'Estimado año',     value: yearEstimate > 0 ? formatCop(yearEstimate) : '—' },
            ].map((stat) => (
              <div key={stat.label} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-input)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  {stat.label}
                </p>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                  {stat.value}
                </span>
              </div>
            ))}

            {yearClientSales.length > 0 && (
              <div style={{ marginTop: 2 }}>
                <p style={{ margin: '0 0 10px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Top clientes del año
                </p>
                {yearClientSales.map((entry, i) => (
                  <div key={entry.clientId} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                        {i + 1}. {entry.name}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                        {formatCop(entry.total)}
                      </span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                      <div style={{
                        height: '100%',
                        width: `${yearClientSales[0].total > 0 ? (entry.total / yearClientSales[0].total) * 100 : 0}%`,
                        background: CHART.green,
                        opacity: i === 0 ? 1 : i === 1 ? 0.6 : 0.35,
                        borderRadius: 2,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Client Table ── */}
      <motion.div className="card-glass" style={{ overflow: 'hidden' }} {...fadeUp(0.4)}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <p style={{ margin: '0 0 3px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Clientes activos
          </p>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            Rendimiento del mes
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Cliente', 'Inversión', 'Ventas', 'ROAS Op.', 'Estado'].map((h) => (
                  <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontFamily: 'JetBrains Mono', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableClients.map(({ client, monthTotals, alertCount }) => (
                <tr key={client.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.12s' }}>
                  <td style={{ padding: '13px 20px' }}>
                    <Link to={`/clients/${client.id}`} style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text-primary)', textDecoration: 'none' }}>
                      {client.name}
                    </Link>
                  </td>
                  <td style={{ padding: '13px 20px', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    {formatCop(monthTotals.spend)}
                  </td>
                  <td style={{ padding: '13px 20px', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    {monthTotals.total_sales > 0 ? formatCop(monthTotals.total_sales) : '—'}
                  </td>
                  <td style={{ padding: '13px 20px' }}>
                    <span className={roasClass(monthTotals.real_roas)}>{formatRoas(monthTotals.real_roas)}</span>
                  </td>
                  <td style={{ padding: '13px 20px' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono', fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '3px 8px', borderRadius: 6,
                      ...(alertCount > 0
                        ? { background: 'hsl(0 84% 60% / 0.12)', color: 'hsl(0,84%,65%)', border: '1px solid hsl(0 84% 60% / 0.2)' }
                        : { background: 'hsl(145 100% 45% / 0.12)', color: 'hsl(145,100%,45%)', border: '1px solid hsl(145 100% 45% / 0.2)' }),
                    }}>
                      {alertCount > 0 ? `${alertCount} alerta${alertCount > 1 ? 's' : ''}` : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
              {tableClients.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
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
  const salesTotals  = sumSales(sales);
  const spend        = metricTotals.spend;
  const totalSales   = salesTotals.total;
  return {
    ...metricTotals,
    total_sales:           totalSales,
    new_client_sales:      salesTotals.newClient,
    repeat_sales:          salesTotals.repeat,
    physical_store_sales:  salesTotals.physical,
    online_sales:          salesTotals.online,
    ad_roas:               metricTotals.roas,
    real_roas:             spend > 0 ? totalSales / spend : 0,
  };
}

function roasClass(roas: number): string {
  if (roas >= 3) return 'roas-pill roas-good';
  if (roas >= 2) return 'roas-pill roas-ok';
  return 'roas-pill roas-low';
}
