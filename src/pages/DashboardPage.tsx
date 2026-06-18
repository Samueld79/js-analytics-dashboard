import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

const BADGE_CFG = {
  objetivo: { text: 'En objetivo',   bg: 'hsl(145 100% 45% / 0.12)', color: '#22c55e', border: 'hsl(145 100% 45% / 0.25)' },
  riesgo:   { text: 'En riesgo',     bg: 'hsl(38 92% 50% / 0.12)',   color: '#f59e0b', border: 'hsl(38 92% 50% / 0.25)' },
  accion:   { text: 'Acción inmediata', bg: 'hsl(0 84% 60% / 0.12)', color: '#ef4444', border: 'hsl(0 84% 60% / 0.25)' },
  inactivo: { text: 'Sin actividad', bg: 'hsl(215 15% 50% / 0.12)', color: 'hsl(215,15%,55%)', border: 'hsl(215 15% 50% / 0.2)' },
} as const;

type BadgeKey = keyof typeof BADGE_CFG;

const STATUS_ETAPA: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  churned: 'Inactivo',
};

function clientAvatarColor(name: string): string {
  const COLORS = ['#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#10b981'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

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

function WeeklyTooltip({ active, payload, label }: { active?: boolean; payload?: ChartPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-tooltip-bg)',
      border: '1px solid var(--color-tooltip-border)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      color: 'var(--color-tooltip-text)',
    }}>
      <p style={{ margin: '0 0 6px', fontSize: '0.62rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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

  const weekSalesByClient = useMemo(() => {
    const map = new Map<string, number>();
    scopedSales.forEach((s) => {
      if (s.date >= weekStart && s.date <= todayStr) map.set(s.client_id, (map.get(s.client_id) ?? 0) + s.total_sales);
    });
    return map;
  }, [scopedSales, weekStart, todayStr]);

  // ── NEW: week spend per client ────────────────────────────────────────────────
  const weekSpendByClient = useMemo(() => {
    const map = new Map<string, number>();
    campaignRows.forEach((r) => {
      if (r.date >= weekStart && r.date <= todayStr) {
        map.set(r.client_id, (map.get(r.client_id) ?? 0) + r.spend);
      }
    });
    return map;
  }, [campaignRows, weekStart, todayStr]);

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

  // ── NEW: weekly chart data (last 8 weeks) ─────────────────────────────────────
  const weeklyChartData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return Array.from({ length: 8 }, (_, i) => {
      const weeksAgo = 7 - i;
      const wStart = new Date(today);
      wStart.setDate(today.getDate() - daysToMonday - weeksAgo * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      const ws = wStart.toISOString().slice(0, 10);
      const we = wEnd.toISOString().slice(0, 10);
      const weeklySales = scopedSales
        .filter((s) => s.date >= ws && s.date <= we)
        .reduce((acc, s) => acc + s.total_sales, 0);
      const weeklySpend = campaignRows
        .filter((r) => r.date >= ws && r.date <= we)
        .reduce((acc, r) => acc + r.spend, 0);
      const label = wStart.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
      return { label, sales: Math.round(weeklySales), spend: Math.round(weeklySpend) };
    });
  }, [scopedSales, campaignRows]);

  // ── NEW: client grid rows ─────────────────────────────────────────────────────
  const clientGridRows = useMemo(() => {
    return visibleClients
      .filter((c) => c.status !== 'churned')
      .map((c) => {
        const monthlySales = monthSalesByClient.get(c.id) ?? 0;
        const weekSales = weekSalesByClient.get(c.id) ?? 0;
        const weekSpend = weekSpendByClient.get(c.id) ?? 0;
        const monthCamp = monthCampaignByClient.get(c.id);
        const monthSpend = monthCamp?.spend ?? 0;
        const ctr = monthCamp && monthCamp.impressions > 0
          ? (monthCamp.clicks / monthCamp.impressions) * 100 : null;
        const cpm = monthCamp && monthCamp.impressions > 0
          ? (monthCamp.spend / monthCamp.impressions) * 1000 : null;

        const hasData = monthlySales > 0 || monthSpend > 0;
        let badge: BadgeKey;
        if (!hasData) {
          badge = 'inactivo';
        } else if (c.monthly_goal && c.monthly_goal > 0) {
          const pct = monthlySales / c.monthly_goal;
          badge = pct >= 0.8 ? 'objetivo' : pct >= 0.5 ? 'riesgo' : 'accion';
        } else {
          badge = 'objetivo';
        }

        const goalPct = c.monthly_goal && c.monthly_goal > 0
          ? Math.min(100, Math.round((monthlySales / c.monthly_goal) * 100))
          : null;

        return { client: c, monthlySales, weekSales, weekSpend, monthSpend, ctr, cpm, badge, goalPct };
      })
      .sort((a, b) => b.monthlySales - a.monthlySales);
  }, [visibleClients, monthSalesByClient, weekSalesByClient, weekSpendByClient, monthCampaignByClient]);

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
  type PrimaryKpi = { label: string; value: string; Icon: LucideIcon; iconColor: string; iconBg: string };
  const primaryKpis: PrimaryKpi[] = [
    { label: `Inversión · ${activePeriodLabel}`,      value: formatCop(kpiSpend),                           Icon: DollarSign,   iconColor: 'hsl(200,80%,60%)', iconBg: 'hsl(200 80% 55% / 0.15)' },
    { label: `Ventas · ${activePeriodLabel}`,         value: kpiSalesTotal > 0 ? formatCop(kpiSalesTotal) : '—', Icon: Banknote,  iconColor: 'hsl(145,70%,55%)', iconBg: 'hsl(145 65% 45% / 0.15)' },
    { label: `Conversaciones · ${activePeriodLabel}`, value: kpiMessages > 0 ? kpiMessages.toLocaleString('es-CO') : '—', Icon: MessageCircle, iconColor: 'hsl(280,70%,65%)', iconBg: 'hsl(280 70% 60% / 0.15)' },
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
          <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
            Resumen · {currentMonthLabelUpper}
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
        </div>
      </motion.div>

      {/* ── Primary KPIs (3) ── */}
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
                mes actual
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Secondary KPIs (clientes en objetivo / en riesgo) ── */}
      <motion.div
        {...fadeUp(0.18)}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 24px' }}
      >
        {/* Clientes en objetivo */}
        <div className="card-glass" style={{ padding: '14px 18px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'hsl(145 100% 45% / 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle size={17} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '0.6rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Clientes en objetivo
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '1.5rem', fontWeight: 700, color: '#22c55e', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {goalStats.onTarget}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>
                ≥ 80% de meta
              </span>
            </div>
          </div>
        </div>

        {/* Clientes en riesgo */}
        <div className="card-glass" style={{ padding: '14px 18px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'hsl(0 84% 60% / 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={17} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '0.6rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Clientes en riesgo
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {goalStats.atRisk}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>
                {'< 50% de meta'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Weekly Charts Row ── */}
      <motion.div
        {...fadeUp(0.24)}
        style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: 16, padding: '0 24px' }}
      >
        {/* BarChart — ventas semanales */}
        <div className="card-glass" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Últimas 8 semanas
              </p>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                Ventas de la agencia
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#06b6d4' }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>Ventas</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyChartData} barGap={4}>
              <defs>
                <linearGradient id="dashSalesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCop(v)} />
              <Tooltip content={<WeeklyTooltip />} />
              <Bar dataKey="sales" name="Ventas" fill="url(#dashSalesGrad)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LineChart — inversión semanal en ads */}
        <div className="card-glass" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Últimas 8 semanas
              </p>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                Inversión en ads
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>Spend</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCop(v)} />
              <Tooltip content={<WeeklyTooltip />} />
              <Line type="monotone" dataKey="spend" name="Inversión" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#8b5cf6', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Client Cards Grid ── */}
      <motion.div {...fadeUp(0.3)} style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={13} style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Clientes · {getMonthLabel(currentMonthKey)}
            </span>
          </div>
          <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>
            {clientGridRows.length} clientes
          </span>
        </div>

        {clientGridRows.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontFamily: 'JetBrains Mono' }}>
            No hay clientes activos.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}>
            {clientGridRows.map(({ client, monthlySales, weekSales, weekSpend, ctr, cpm, badge, goalPct }) => {
              const color = clientAvatarColor(client.name);
              const initials = clientInitials(client.name);
              const bdg = BADGE_CFG[badge];
              return (
                <div
                  key={client.id}
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 14,
                    padding: '18px 18px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = color + '60'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'; }}
                >
                  {/* Avatar + name + badge */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: color + '22',
                      border: `2px solid ${color}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.88rem', fontWeight: 800, color, fontFamily: 'Outfit, sans-serif',
                    }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
                          {client.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em',
                          padding: '2px 8px', borderRadius: 20,
                          background: bdg.bg, color: bdg.color, border: `1px solid ${bdg.border}`,
                        }}>
                          {bdg.text}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {client.niche ?? '—'} · {STATUS_ETAPA[client.status] ?? ''}
                      </div>
                    </div>
                  </div>

                  {/* Goal progress bar */}
                  {goalPct !== null && client.monthly_goal && client.monthly_goal > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>Meta mensual</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'JetBrains Mono' }}>
                          {goalPct}%
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2 }}>
                        <div style={{
                          height: '100%',
                          width: `${goalPct}%`,
                          borderRadius: 2,
                          background: goalPct >= 80 ? '#22c55e' : goalPct >= 50 ? '#f59e0b' : '#ef4444',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>
                          {formatCop(monthlySales)}
                        </span>
                        <span style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>
                          Meta: {formatCop(client.monthly_goal)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Week stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { icon: '💰', label: 'Ventas sem.', value: weekSales > 0 ? formatCop(weekSales) : '—' },
                      { icon: '📣', label: 'Inversión sem.', value: weekSpend > 0 ? formatCop(weekSpend) : '—' },
                      ...(ctr !== null ? [{ icon: '📊', label: 'CTR mes', value: `${ctr.toFixed(2)}%` }] : []),
                      ...(cpm !== null ? [{ icon: '💸', label: 'CPM mes', value: formatCop(cpm) }] : []),
                    ].map(({ icon, label, value }) => (
                      <div key={label}>
                        <p style={{ margin: '0 0 3px', fontSize: '0.55rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          {icon} {label}
                        </p>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Ver detalle */}
                  <Link
                    to={`/dashboard/cliente/${client.id}`}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      padding: '8px',
                      borderRadius: 8,
                      border: `1px solid ${color}40`,
                      background: color + '10',
                      color,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace',
                      textDecoration: 'none',
                      letterSpacing: '0.04em',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = color + '22'; el.style.borderColor = color + '80'; }}
                    onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = color + '10'; el.style.borderColor = color + '40'; }}
                  >
                    Ver detalle →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ── Open alerts quick summary ── */}
      {visibleOpenAlerts.length > 0 && (
        <motion.div {...fadeUp(0.36)} style={{ padding: '0 24px 24px' }}>
          <Link to="/alerts" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'hsl(0 84% 60% / 0.08)',
              border: '1px solid hsl(0 84% 60% / 0.2)',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
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
