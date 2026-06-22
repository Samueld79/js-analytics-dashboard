import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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
  TrendingUp,
  Users,
  CheckCircle,
  AlertCircle,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import {
  useAdMetrics,
  useCampaignSummary,
  useMonthlyOperatingKpis,
  useTasks,
} from '../hooks/useData';
import { sumCampaignMonthAggregates } from '../services/adCampaignMetrics';
import type { AdMetric, DailySale } from '../lib/supabase';
import { ClientCard, ClientCardSkeleton } from '../components/dashboard/ClientCard';
import { SparklineChart } from '../components/dashboard/SparklineChart';
import { useClientDashboardData } from '../hooks/useClientDashboardData';
import {
  formatCop,
  isAlertSnoozed,
  sumMetrics,
  sumSales,
} from '../lib/utils';
import { getMonthKey, getMonthLabel } from '../utils/monthLabel';
import {
  getCurrentMonthKey,
  getTodayStr,
  getWeekStart,
} from '../utils/goalHelpers';

const EMPTY_CLIENT_SCOPE = '00000000-0000-0000-0000-000000000000';

function RefreshIndicator() {
  return (
    <motion.span
      style={{ width: 7, height: 7, borderRadius: '50%', background: 'hsl(180,100%,50%)', display: 'inline-block', flexShrink: 0 }}
      animate={{ opacity: [1, 0.25, 1] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' } as Transition}
    />
  );
}

type ChartPayloadEntry = { dataKey: string; name: string; value: number; color: string };

function AreaTooltip({ active, payload, label }: { active?: boolean; payload?: ChartPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(0,0,0,0.88)',
      border: '1px solid rgba(6,182,212,0.3)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      color: '#fff',
    }}>
      <p style={{ margin: '0 0 6px', fontSize: '0.62rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ margin: '2px 0', color: entry.color, fontSize: '0.72rem' }}>
          {entry.name}: {formatCop(entry.value)}
        </p>
      ))}
    </div>
  );
}


export function DashboardPage() {
  // ── Data hooks ────────────────────────────────────────────────────────────────
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
  const { rows: campaignRows, byMonth: campaignByMonth } = useCampaignSummary(scopedClientId);

  // ── Period selector ───────────────────────────────────────────────────────────
  const [selectedPeriod, setSelectedPeriod] = useState<string | 'all' | null>(null);
  const activePeriod = selectedPeriod ?? campaignByMonth[campaignByMonth.length - 1]?.month ?? new Date().toISOString().slice(0, 7);

  // ── Scoping ───────────────────────────────────────────────────────────────────
  const visibleClientIds = useMemo(
    () => new Set(isInternal ? clients.map((c) => c.id) : accessibleClientIds),
    [accessibleClientIds, clients, isInternal],
  );
  const visibleClients = useMemo(
    () => isInternal ? clients : clients.filter((c) => visibleClientIds.has(c.id)),
    [clients, isInternal, visibleClientIds],
  );
  const scopedAdMetrics = useMemo(
    () => isInternal ? rawAdMetrics : rawAdMetrics.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, rawAdMetrics, visibleClientIds],
  );
  const scopedSales = useMemo(
    () => isInternal ? sales : sales.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, sales, visibleClientIds],
  );
  const scopedAlerts = useMemo(
    () => isInternal ? alerts : alerts.filter((a) => a.client_id && visibleClientIds.has(a.client_id)),
    [alerts, isInternal, visibleClientIds],
  );
  const scopedTasks = useMemo(
    () => isInternal ? tasks : tasks.filter((t) => t.client_id && visibleClientIds.has(t.client_id)),
    [isInternal, tasks, visibleClientIds],
  );

  // ── Period & executive values ─────────────────────────────────────────────────
  const activePeriodLabel = activePeriod === 'all' ? 'Año completo' : getMonthLabel(activePeriod);
  const portalClientName =
    !isInternal && visibleClients.length === 1
      ? visibleClients[0]?.name ?? 'Mi empresa'
      : null;
  const executiveMonth = activePeriod === 'all'
    ? (campaignByMonth[campaignByMonth.length - 1]?.month ?? new Date().toISOString().slice(0, 7))
    : activePeriod;

  const executiveAdMetrics = scopedAdMetrics.filter((r) => getMonthKey(r.date) === executiveMonth);

  // ── Campaign KPIs ─────────────────────────────────────────────────────────────
  const selectedKpis = useMemo(
    () => activePeriod === 'all'
      ? sumCampaignMonthAggregates(campaignByMonth, 'all')
      : (campaignByMonth.find((m) => m.month === activePeriod) ?? null),
    [campaignByMonth, activePeriod],
  );

  const adMetricsTotals = sumMetrics(executiveAdMetrics);
  const kpiSpend    = adMetricsTotals.spend > 0    ? adMetricsTotals.spend    : (selectedKpis?.spend ?? 0);
  const kpiMessages = adMetricsTotals.messages > 0 ? adMetricsTotals.messages : (selectedKpis?.messages ?? 0);

  const kpiSalesTotal = useMemo(
    () => activePeriod === 'all'
      ? scopedSales.reduce((sum, s) => sum + s.total_sales, 0)
      : scopedSales.filter((s) => s.date.startsWith(activePeriod)).reduce((sum, s) => sum + s.total_sales, 0),
    [scopedSales, activePeriod],
  );

  // ── Alerts ────────────────────────────────────────────────────────────────────
  const visibleOpenAlerts = useMemo(
    () => scopedAlerts.filter((a) => ['unread', 'read'].includes(a.status) && !isAlertSnoozed(a)),
    [scopedAlerts],
  );

  // ── Goal tracking ─────────────────────────────────────────────────────────────
  const currentMonthKey = getCurrentMonthKey();
  const weekStart = getWeekStart();
  const todayStr = getTodayStr();
  const pendingTasks = scopedTasks.filter((t) => t.status === 'pending').length;

  const monthSalesByClient = useMemo(() => {
    const map = new Map<string, number>();
    scopedSales.forEach((s) => {
      if (s.date.startsWith(currentMonthKey)) map.set(s.client_id, (map.get(s.client_id) ?? 0) + s.total_sales);
    });
    return map;
  }, [scopedSales, currentMonthKey]);


  // ── NEW: current month campaign stats per client (impressions, clicks, spend) ─
  const monthCampaignByClient = useMemo(() => {
    type Acc = { impressions: number; clicks: number; spend: number };
    const map = new Map<string, Acc>();
    campaignRows.forEach((r) => {
      if (!r.date.startsWith(currentMonthKey)) return;
      const p = map.get(r.client_id) ?? { impressions: 0, clicks: 0, spend: 0 };
      map.set(r.client_id, {
        impressions: p.impressions + r.impressions,
        clicks: p.clicks + r.clicks,
        spend: p.spend + r.spend,
      });
    });
    return map;
  }, [campaignRows, currentMonthKey]);

  // ── NEW: goal stats (en objetivo ≥80%, en riesgo <50%) ───────────────────────
  const goalStats = useMemo(() => {
    let onTarget = 0, atRisk = 0;
    visibleClients.forEach((c) => {
      if (c.status !== 'active' || !c.monthly_goal || c.monthly_goal <= 0) return;
      const s = monthSalesByClient.get(c.id) ?? 0;
      const pct = s / c.monthly_goal;
      if (pct >= 0.8) onTarget++;
      else if (pct < 0.5) atRisk++;
    });
    return { onTarget, atRisk };
  }, [visibleClients, monthSalesByClient]);

  // ── Monthly chart data (last 6 months) ───────────────────────────────────────
  const monthlyChartData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const monthsAgo = 5 - i;
      const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const raw = d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const sales = scopedSales
        .filter((s) => s.date.startsWith(key))
        .reduce((sum, s) => sum + s.total_sales, 0);
      const spend = campaignRows
        .filter((r) => r.date.startsWith(key))
        .reduce((sum, r) => sum + r.spend, 0);
      const msgs = sumMetrics(scopedAdMetrics.filter((r) => getMonthKey(r.date) === key)).messages;
      return { label, sales: Math.round(sales), spend: Math.round(spend), msgs };
    });
  }, [scopedSales, campaignRows, scopedAdMetrics]);


  // ── NEW: today's agency pulse ────────────────────────────────────────────────
  const todayPulse = useMemo(() => {
    const todaySpend = campaignRows.filter((r) => r.date === todayStr).reduce((sum, r) => sum + r.spend, 0);
    const weekSpendTotal = campaignRows.filter((r) => r.date >= weekStart && r.date <= todayStr).reduce((sum, r) => sum + r.spend, 0);
    const activeClients = visibleClients.filter((c) => c.status === 'active').length;
    let bestCtrName = '';
    let bestCtr = 0;
    monthCampaignByClient.forEach((stats, clientId) => {
      const ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
      if (ctr > bestCtr) { bestCtr = ctr; bestCtrName = visibleClients.find((x) => x.id === clientId)?.name ?? ''; }
    });
    return { todaySpend, weekSpendTotal, activeClients, bestCtr, bestCtrName };
  }, [campaignRows, todayStr, weekStart, visibleClients, monthCampaignByClient]);

  // ── Client card data (computed by hook) ──────────────────────────────────────
  const clientCards = useClientDashboardData({ visibleClients, scopedSales, campaignRows });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const isRefreshing = clientsLoading || kpisLoading || metricsLoading || salesLoading;
  const hasData = clients.length > 0 || monthlyKpis.length > 0 || rawAdMetrics.length > 0 || sales.length > 0;
  const currentMonthLabelUpper = (() => {
    const s = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: 'easeOut', delay } as Transition,
  });

  // ── Primary KPIs ──────────────────────────────────────────────────────────────
  type PrimaryKpi = { label: string; value: string; Icon: LucideIcon; iconColor: string; iconBg: string; sparkKey: 'spend' | 'sales' | 'msgs'; sparkColor: string };
  const primaryKpis: PrimaryKpi[] = [
    { label: `INVERSIÓN · ${activePeriodLabel.toUpperCase()}`,      value: formatCop(kpiSpend),                                                              Icon: DollarSign,    iconColor: '#06b6d4', iconBg: 'rgba(6,182,212,0.15)',   sparkKey: 'spend', sparkColor: '#06b6d4' },
    { label: `VENTAS · ${activePeriodLabel.toUpperCase()}`,         value: kpiSalesTotal > 0 ? formatCop(kpiSalesTotal) : '—',                              Icon: Banknote,      iconColor: '#22c55e', iconBg: 'rgba(34,197,94,0.15)',   sparkKey: 'sales', sparkColor: '#22c55e' },
    { label: `CONVERSACIONES · ${activePeriodLabel.toUpperCase()}`, value: kpiMessages > 0 ? kpiMessages.toLocaleString('es-CO') : '—',                    Icon: MessageCircle, iconColor: '#8b5cf6', iconBg: 'rgba(139,92,246,0.15)', sparkKey: 'msgs', sparkColor: '#8b5cf6' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="page-content dashboard-v3">

      {/* ── Header ── */}
      <motion.div {...fadeUp(0)} style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
            {portalClientName ? `Resultados · ${portalClientName}` : 'Dashboard General'}
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: '0.67rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em' }}>
            {currentMonthLabelUpper} · {todayPulse.activeClients} clientes activos
            {kpiSalesTotal > 0 && <> · <strong style={{ color: 'var(--color-text-secondary)' }}>{formatCop(kpiSalesTotal)}</strong> en ventas</>}
          </p>
        </div>

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
          {campaignByMonth.length > 0 && (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <select className="dash-period-select" value={activePeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                {campaignByMonth.map((m) => (
                  <option key={m.month} value={m.month}>{getMonthLabel(m.month)}</option>
                ))}
                <option value="all">Total año</option>
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: 'var(--color-text-muted)' }} />
            </div>
          )}
          <Link
            to="/ai-tools"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
              background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
              color: '#06b6d4', fontSize: '0.72rem', fontWeight: 700,
              fontFamily: 'JetBrains Mono', textDecoration: 'none', letterSpacing: '0.04em',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = 'rgba(6,182,212,0.18)'; el.style.borderColor = 'rgba(6,182,212,0.5)'; }}
            onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = 'rgba(6,182,212,0.1)'; el.style.borderColor = 'rgba(6,182,212,0.25)'; }}
          >
            <Zap size={12} />
            Área de Trabajo
          </Link>
        </div>
      </motion.div>

      {/* ── Primary KPIs (3) ── */}
      <div className="dash-kpi-primary-row">
        {primaryKpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            style={{
              padding: '20px 22px', borderRadius: 16, overflow: 'hidden',
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' } as Transition}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: '0.56rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {kpi.label}
              </span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: kpi.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <kpi.Icon size={14} style={{ color: kpi.iconColor }} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace' }}>
              {kpi.value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <TrendingUp size={10} style={{ color: 'var(--color-text-muted)' }} />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.58rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>mes actual</span>
            </div>
            <SparklineChart data={monthlyChartData.map((d) => d[kpi.sparkKey])} color={kpi.sparkColor} height={44} filled={false} />
          </motion.div>
        ))}
      </div>

      {/* ── Secondary KPIs ── */}
      <motion.div {...fadeUp(0.18)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 24px' }}>
        <div style={{ padding: '14px 18px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle size={17} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Clientes en objetivo
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '1.5rem', fontWeight: 700, color: '#22c55e', letterSpacing: '-0.02em', lineHeight: 1 }}>{goalStats.onTarget}</span>
              <span style={{ fontSize: '0.63rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>≥ 80% de meta</span>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 18px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={17} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Clientes en riesgo
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', letterSpacing: '-0.02em', lineHeight: 1 }}>{goalStats.atRisk}</span>
              <span style={{ fontSize: '0.63rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>{'< 50% de meta'}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Area Charts Row ── */}
      <motion.div {...fadeUp(0.24)} style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: 16, padding: '0 24px' }}>

        {/* AreaChart — ventas mensuales */}
        <div style={{ padding: '20px 22px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {(() => {
            const cur = monthlyChartData[monthlyChartData.length - 1]?.sales ?? 0;
            const prev = monthlyChartData[monthlyChartData.length - 2]?.sales ?? 0;
            const delta = prev > 0 ? ((cur - prev) / prev) * 100 : null;
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: '0.56rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>VENTAS TOTALES</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'JetBrains Mono', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {cur > 0 ? formatCop(cur) : '—'}
                      </span>
                      {delta !== null && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: delta >= 0 ? '#22c55e' : '#ef4444' }}>
                          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#06b6d4' }} />
                    <span style={{ fontSize: '0.56rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>Ventas</span>
                  </div>
                </div>
                <p style={{ margin: '4px 0 14px', fontSize: '0.6rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>vs mes anterior · Últimos 6 meses</p>
              </>
            );
          })()}
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}M`} width={42} />
              <Tooltip content={<AreaTooltip />} />
              <Area type="monotone" dataKey="sales" name="Ventas" stroke="#06b6d4" strokeWidth={2} fill="url(#salesAreaGrad)" dot={{ r: 3, fill: '#06b6d4', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#06b6d4' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AreaChart — inversión mensual */}
        <div style={{ padding: '20px 22px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {(() => {
            const cur = monthlyChartData[monthlyChartData.length - 1]?.spend ?? 0;
            const prev = monthlyChartData[monthlyChartData.length - 2]?.spend ?? 0;
            const delta = prev > 0 ? ((cur - prev) / prev) * 100 : null;
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: '0.56rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>INVERSIÓN EN ADS</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'JetBrains Mono', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {cur > 0 ? formatCop(cur) : '—'}
                      </span>
                      {delta !== null && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: delta >= 0 ? '#22c55e' : '#ef4444' }}>
                          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#8b5cf6' }} />
                    <span style={{ fontSize: '0.56rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>Spend</span>
                  </div>
                </div>
                <p style={{ margin: '4px 0 14px', fontSize: '0.6rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>vs mes anterior · Últimos 6 meses</p>
              </>
            );
          })()}
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}M`} width={42} />
              <Tooltip content={<AreaTooltip />} />
              <Area type="monotone" dataKey="spend" name="Inversión" stroke="#8b5cf6" strokeWidth={2} fill="url(#spendAreaGrad)" dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#8b5cf6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Activity Pulse ── */}
      <motion.div {...fadeUp(0.28)} style={{ padding: '0 24px' }}>
        <div style={{
          padding: '10px 16px', borderRadius: 8, flexWrap: 'wrap',
          background: 'var(--surface)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.span
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4', display: 'inline-block', flexShrink: 0 }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' } as Transition}
            />
            <span style={{ fontSize: '0.56rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              ACTIVIDAD DE HOY
            </span>
          </div>
          {([
            todayPulse.todaySpend > 0
              ? `${formatCop(todayPulse.todaySpend)} invertidos hoy`
              : todayPulse.weekSpendTotal > 0
              ? `${formatCop(todayPulse.weekSpendTotal)} invertidos esta semana`
              : null,
            `${todayPulse.activeClients} clientes activos`,
            `${goalStats.onTarget} en objetivo`,
            todayPulse.bestCtrName ? `Mejor CTR: ${todayPulse.bestCtrName} ${todayPulse.bestCtr.toFixed(2)}%` : null,
          ] as (string | null)[]).filter(Boolean).map((text, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--border)', fontSize: '0.8rem' }}>·</span>
              <span style={{ fontSize: '0.63rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>{text}</span>
            </span>
          ))}
        </div>
      </motion.div>

      {/* ── Client Cards Grid ── */}
      <motion.div {...fadeUp(0.3)} style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={13} style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Clientes · {getMonthLabel(currentMonthKey)}
            </span>
          </div>
          <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>{clientCards.length} clientes</span>
        </div>

        {clientsLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {[0, 1, 2].map((i) => <ClientCardSkeleton key={i} />)}
          </div>
        ) : clientCards.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontFamily: 'JetBrains Mono' }}>
            No hay clientes activos.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {clientCards.map((cardData) => (
              <ClientCard key={cardData.client.id} data={cardData} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Open alerts quick summary ── */}
      {visibleOpenAlerts.length > 0 && (
        <motion.div {...fadeUp(0.36)} style={{ padding: '0 24px 24px' }}>
          <Link to="/alerts" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontFamily: 'JetBrains Mono' }}>
                <strong style={{ color: '#ef4444' }}>{visibleOpenAlerts.length}</strong> {visibleOpenAlerts.length === 1 ? 'alerta abierta' : 'alertas abiertas'} — revisar
              </span>
              <BarChart3 size={12} style={{ color: 'var(--color-text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
            </div>
          </Link>
        </motion.div>
      )}

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

// Keep for potential use in other components
export { buildCombinedMonthTotals };
