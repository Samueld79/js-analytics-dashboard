import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  LineChart,
  Line,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { motion, type Transition } from 'framer-motion';
import { BarChart3, DollarSign, MessageCircle, Percent, TrendingDown, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMonthlyOperatingKpis, useCampaignSummary } from '../hooks/useData';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import {
  aggregateCampaignKpisByClient,
  aggregateCampaignMetricsByCampaign,
  inferObjectiveFromName,
  sumCampaignMonthAggregates,
} from '../services/adCampaignMetrics';
import type { ClientMonthlyOperatingKpi } from '../lib/supabase';
import { formatCop, formatNumber, toFiniteNumber } from '../lib/utils';
import { getMonthKey, getMonthLabel } from '../utils/monthLabel';
import { CHART, TOOLTIP_STYLE } from '../lib/chartColors';

const EMPTY_CLIENT_SCOPE = '00000000-0000-0000-0000-000000000000';

function shortMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleString('es-CO', { month: 'short' }).replace('.', '') + ' ' + year.slice(2);
}

function formatCopCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

type HealthStatus = 'great' | 'good' | 'warning' | 'bad' | 'neutral';

function costStatus(cost: number): HealthStatus {
  if (cost === 0) return 'neutral';
  if (cost < 3_000) return 'great';
  if (cost < 8_000) return 'good';
  if (cost < 15_000) return 'warning';
  return 'bad';
}

const COST_BADGE: Record<HealthStatus, { label: string; cls: string } | null> = {
  great:   { label: '✓ Excelente', cls: 'badge-great' },
  good:    { label: '~ Bueno',     cls: 'badge-good' },
  warning: { label: '⚠ Regular',   cls: 'badge-warning' },
  bad:     { label: '✗ Alto',      cls: 'badge-bad' },
  neutral: null,
};

function costSub(status: HealthStatus): string {
  if (status === 'warning') return 'Revisar segmentación y creativos';
  if (status === 'bad') return 'Optimizar urgente — revisar públicos';
  return 'Inversión / conversaciones detectadas';
}

function useIntersection(once = true) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) obs.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [once]);
  return [ref, visible] as const;
}

const SpendBarChart = memo(function SpendBarChart({
  data,
}: {
  data: Array<{ month: string; spend: number }>;
}) {
  return (
    <div className="card-glass" style={{ padding: '18px 16px 10px' }}>
      <span className="number-label" style={{ marginBottom: 14, display: 'block' }}>
        INVERSIÓN POR MES
      </span>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="barSpendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.cyan} stopOpacity={0.9} />
              <stop offset="100%" stopColor={CHART.cyan} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={shortMonthLabel}
            tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCopCompact}
            tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            formatter={(v: unknown) => [formatCop(v as number), 'Inversión']}
            labelFormatter={(l: unknown) => shortMonthLabel(String(l))}
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey="spend" fill="url(#barSpendGrad)" radius={[4, 4, 0, 0]} animationDuration={700} animationEasing="ease-out">
            <LabelList
              dataKey="spend"
              position="top"
              formatter={(v: unknown) => formatCopCompact(v as number)}
              style={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: CHART.axis }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

const ConvCpmChart = memo(function ConvCpmChart({
  data,
}: {
  data: Array<{ month: string; messages: number; cpm: number }>;
}) {
  return (
    <div className="card-glass" style={{ padding: '18px 16px 10px' }}>
      <span className="number-label" style={{ marginBottom: 14, display: 'block' }}>
        CONVERSACIONES <span style={{ color: CHART.violet }}>▌</span> vs CPM <span style={{ color: CHART.cyan }}>━</span>
      </span>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 6, right: 52, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cpmAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART.cyan} stopOpacity={0.18} />
              <stop offset="95%" stopColor={CHART.cyan} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={shortMonthLabel}
            tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="msgs"
            tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <YAxis
            yAxisId="cpm"
            orientation="right"
            tickFormatter={formatCopCompact}
            tick={{ fontSize: 10, fill: CHART.cyan, fontFamily: 'JetBrains Mono', opacity: 0.65 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: unknown, name: unknown) => [
              name === 'CPM' ? formatCop(v as number) : formatNumber(v as number),
              String(name),
            ]}
            labelFormatter={(l: unknown) => shortMonthLabel(String(l))}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar yAxisId="msgs" dataKey="messages" name="Mensajes" fill={CHART.violet} fillOpacity={0.6} radius={[4, 4, 0, 0]} animationDuration={700} />
          <Area
            yAxisId="cpm"
            type="monotone"
            dataKey="cpm"
            name="CPM"
            stroke={CHART.cyan}
            strokeWidth={2.5}
            fill="url(#cpmAreaGrad)"
            dot={{ r: 4, fill: CHART.cyan, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: CHART.cyan, stroke: 'rgba(0,229,255,0.4)', strokeWidth: 2 }}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});

const Top5ClientChart = memo(function Top5ClientChart({
  data,
  activePeriod,
}: {
  data: Array<{ name: string; spend: number }>;
  activePeriod: string;
}) {
  return (
    <div className="card-glass" style={{ padding: '18px 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span className="number-label">
          INVERSIÓN POR CLIENTE — TOP {data.length}
        </span>
        <span className="number-label" style={{ opacity: 0.6 }}>
          {activePeriod === 'all' ? 'Total año' : getMonthLabel(activePeriod)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 46)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 88, left: 4, bottom: 4 }}
        >
          <defs>
            <linearGradient id="top5ClientGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART.cyan} stopOpacity={0.4} />
              <stop offset="100%" stopColor={CHART.cyan} stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke={CHART.grid} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={formatCopCompact}
            tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 11, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatCop(v as number), 'Inversión']}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey="spend" fill="url(#top5ClientGrad)" radius={[0, 4, 4, 0]} animationDuration={900} animationBegin={100} animationEasing="ease-out">
            <LabelList
              dataKey="spend"
              position="right"
              formatter={(v: unknown) => formatCopCompact(v as number)}
              style={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: CHART.axis }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export function MetricsPage() {
  const { clients } = useClients();
  const { isInternal, accessibleClientIds, defaultClientId } = useAuth();

  const visibleClients = useMemo(
    () =>
      isInternal
        ? clients
        : clients.filter((client) => accessibleClientIds.includes(client.id)),
    [accessibleClientIds, clients, isInternal],
  );
  const visibleClientIds = useMemo(
    () => new Set(visibleClients.map((client) => client.id)),
    [visibleClients],
  );

  const [selectedClient, setSelectedClient] = useState(
    !isInternal && defaultClientId ? defaultClientId : 'all',
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string | 'all' | null>(null);
  const [chartsRef, chartsVisible] = useIntersection();

  const selectedClientId = selectedClient === 'all' ? undefined : selectedClient;
  const canSelectAllClients = isInternal || visibleClients.length > 1;
  const queryClientId =
    !isInternal && !canSelectAllClients
      ? defaultClientId ?? EMPTY_CLIENT_SCOPE
      : selectedClientId;

  // Primary data source: ad_campaign_metrics
  const { rows: campaignRows, byMonth: campaignByMonth, loading: campaignLoading } = useCampaignSummary(queryClientId, 730);

  // Historical ROAS: monthly KPI rows + manual sales
  const { monthlyKpis } = useMonthlyOperatingKpis(queryClientId, 12);
  const { sales } = useDailySales({ clientId: queryClientId, days: 730 });

  const scopedMonthlyKpis = useMemo(
    () =>
      isInternal
        ? monthlyKpis
        : monthlyKpis.filter((row) => visibleClientIds.has(row.client_id)),
    [isInternal, monthlyKpis, visibleClientIds],
  );
  const scopedSales = useMemo(
    () => (isInternal ? sales : sales.filter((row) => visibleClientIds.has(row.client_id))),
    [isInternal, sales, visibleClientIds],
  );

  useEffect(() => {
    if (!isInternal) {
      if (defaultClientId && !canSelectAllClients) {
        setSelectedClient(defaultClientId);
        return;
      }
      if (selectedClient !== 'all' && !visibleClientIds.has(selectedClient)) {
        setSelectedClient(defaultClientId ?? 'all');
      }
    }
  }, [canSelectAllClients, defaultClientId, isInternal, selectedClient, visibleClientIds]);

  const activePeriod = selectedPeriod ?? campaignByMonth[campaignByMonth.length - 1]?.month ?? '';

  const periodKpi = useMemo(
    () =>
      activePeriod === 'all'
        ? sumCampaignMonthAggregates(campaignByMonth, 'all')
        : (campaignByMonth.find((m) => m.month === activePeriod) ?? null),
    [campaignByMonth, activePeriod],
  );

  const costPerConv =
    periodKpi && periodKpi.messages > 0 ? periodKpi.spend / periodKpi.messages : null;

  // Historical section — last 6 months, spend + messages from campaigns, ROAS from KPI rows
  const historyRows = useMemo(() => {
    const allMonths = new Set<string>([
      ...campaignByMonth.map((m) => m.month),
      ...scopedMonthlyKpis.map((r) => getMonthKey(r.month)),
      ...scopedSales.map((r) => getMonthKey(r.date)),
    ]);
    return [...allMonths]
      .sort()
      .slice(-6)
      .map((monthKey) => {
        const campaign = campaignByMonth.find((m) => m.month === monthKey);
        const spend = campaign?.spend ?? 0;
        const messages = campaign?.messages ?? 0;
        const roas = getMonthRoas({ monthKey, monthlyKpis: scopedMonthlyKpis, campaignSpend: spend });
        return { monthKey, spend, messages, roas };
      })
      .filter((r) => r.spend > 0 || r.messages > 0);
  }, [campaignByMonth, scopedMonthlyKpis, scopedSales]);

  const chartData = historyRows.map((row) => ({ month: row.monthKey, spend: row.spend }));
  const trendData = historyRows.map((row) => ({ month: row.monthKey, Inversión: row.spend, Mensajes: row.messages }));

  // Rows filtered to active period (reused in multiple memos)
  const periodRows = useMemo(
    () =>
      activePeriod === 'all' || activePeriod === ''
        ? campaignRows
        : campaignRows.filter((r) => r.date.startsWith(activePeriod)),
    [campaignRows, activePeriod],
  );

  // Per-client KPIs for selected period (used for top5 + auto-alerts)
  const campaignByClient = useMemo(
    () => aggregateCampaignKpisByClient(periodRows),
    [periodRows],
  );

  // Top-5 clients by spend for the selected period
  const top5ClientData = useMemo(() => {
    return [...campaignByClient.entries()]
      .map(([clientId, kpi]) => {
        const client = clients.find((c) => c.id === clientId);
        return { name: client?.name ?? clientId.slice(0, 8), spend: kpi.spend };
      })
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);
  }, [campaignByClient, clients]);

  // Campaign-level breakdown for campaign table
  const campaignsByCampaign = useMemo(
    () => aggregateCampaignMetricsByCampaign(periodRows).slice(0, 25),
    [periodRows],
  );

  // Auto-metric alerts
  const autoAlerts = useMemo(() => {
    const result: { emoji: string; color: string; msg: string }[] = [];
    if (campaignByClient.size === 0) return result;
    for (const [clientId, kpi] of campaignByClient.entries()) {
      const name = clients.find((c) => c.id === clientId)?.name ?? clientId.slice(0, 8);
      if (kpi.spend === 0) {
        result.push({ emoji: '⚪', color: 'hsl(215,15%,48%)', msg: `Sin datos este mes para ${name}` });
        continue;
      }
      if (kpi.frequency > 3.0)
        result.push({ emoji: '🔴', color: 'hsl(0,84%,60%)', msg: `Frecuencia alta en ${name} — riesgo de fatiga (${kpi.frequency.toFixed(1)}x)` });
      if (kpi.cpm > 15_000)
        result.push({ emoji: '🟠', color: 'hsl(30,100%,55%)', msg: `CPM elevado en ${name} — ${formatCop(kpi.cpm)}` });
      if (kpi.messages < 50)
        result.push({ emoji: '🟡', color: 'hsl(50,100%,55%)', msg: `Bajo volumen de conversaciones en ${name} (${kpi.messages} msgs)` });
    }
    return result;
  }, [campaignByClient, clients]);

  const cStatus: HealthStatus = costPerConv != null ? costStatus(costPerConv) : 'neutral';

  const kpiCards: Array<{
    icon: ReactNode;
    label: string;
    value: string;
    sub: string;
    muted?: boolean;
    badge?: { label: string; cls: string } | null;
  }> = [
    {
      icon: <DollarSign size={15} />,
      label: 'INVERSIÓN',
      value: formatCop(periodKpi?.spend ?? 0),
      sub: activePeriod === 'all' ? 'Total año' : getMonthLabel(activePeriod),
    },
    {
      icon: <MessageCircle size={15} />,
      label: 'CONVERSACIONES',
      value: formatNumber(periodKpi?.messages ?? 0),
      sub: 'Mensajes vía Meta Ads',
    },
    {
      icon: <TrendingDown size={15} />,
      label: 'COSTO/CONV',
      value: costPerConv != null ? formatCop(costPerConv) : '—',
      sub: costPerConv != null ? costSub(cStatus) : 'Sin conversaciones',
      muted: costPerConv == null,
      badge: COST_BADGE[cStatus],
    },
    {
      icon: <BarChart3 size={15} />,
      label: 'CPM',
      value: periodKpi && periodKpi.cpm > 0 ? formatCop(periodKpi.cpm) : '—',
      sub: 'Costo por 1.000 impresiones',
      muted: !periodKpi || periodKpi.cpm === 0,
    },
    {
      icon: <Users size={15} />,
      label: 'REACH',
      value: formatNumber(periodKpi?.reach ?? 0),
      sub: 'Personas únicas alcanzadas',
      muted: !periodKpi || periodKpi.reach === 0,
    },
    {
      icon: <Percent size={15} />,
      label: 'FRECUENCIA',
      value: periodKpi && periodKpi.frequency > 0 ? periodKpi.frequency.toFixed(2) : '—',
      sub: 'Impresiones por persona',
      muted: !periodKpi || periodKpi.frequency === 0,
    },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Métricas Ads</h1>
          <p className="number-label" style={{ marginTop: 4, letterSpacing: '0.08em' }}>
            RENDIMIENTO DE CAMPAÑAS
          </p>
        </div>
        {selectedClient !== 'all' && (
          <Link to={`/clients/${selectedClient}`} className="btn-secondary">
            Ir al cliente
          </Link>
        )}
      </div>

      <div className="metrics-filter-row">
        {canSelectAllClients ? (
          <select
            className="form-input metrics-client-select"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="all">{isInternal ? 'Todos los clientes' : 'Mis empresas'}</option>
            {visibleClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="metrics-client-label">
            {visibleClients[0]?.name ?? 'Sin empresa'}
          </span>
        )}

        {/* Period selector — same pattern as Dashboard / Clientes */}
        {campaignByMonth.length > 0 && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 4 }}>
            {campaignByMonth.map((m) => (
              <button
                key={m.month}
                className={`filter-chip ${activePeriod === m.month ? 'active' : ''}`}
                onClick={() => setSelectedPeriod(m.month)}
              >
                {getMonthLabel(m.month)}
              </button>
            ))}
            <button
              className={`filter-chip ${activePeriod === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedPeriod('all')}
            >
              Total año
            </button>
          </div>
        )}
      </div>

      <div className="metrics-kpi-grid">
        {campaignLoading && campaignByMonth.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ height: 90, borderRadius: 12 }} />
          ))
        ) : kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            className="card-glass metrics-kpi-card"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 } as Transition}
          >
            <div className="metrics-kpi-header">
              <span className={`metrics-kpi-icon ${card.muted ? 'is-muted' : ''}`}>
                {card.icon}
              </span>
              <span className="number-label">{card.label}</span>
            </div>
            <strong className={`font-display metrics-kpi-value ${card.muted ? 'is-muted' : ''}`}>
              {card.value}
            </strong>
            {card.badge && (
              <span className={`metrics-health-badge ${card.badge.cls}`}>{card.badge.label}</span>
            )}
            <span className="metrics-kpi-sub">{card.sub}</span>
          </motion.div>
        ))}
      </div>


      {/* ── Auto-metric alerts ── */}
      {campaignByMonth.length > 0 && (
        <div style={{ padding: '0 24px 12px' }}>
          {autoAlerts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'hsl(145 100% 45% / 0.07)', border: '1px solid hsl(145 100% 45% / 0.2)', fontSize: '0.76rem', color: 'hsl(145,100%,55%)' }}>
              🟢 Todas las métricas en rango normal
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {autoAlerts.map((a, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: `${a.color}10`, border: `1px solid ${a.color}35`, fontSize: '0.76rem' }}
                >
                  <span>{a.emoji}</span>
                  <span style={{ color: 'hsl(215,15%,75%)' }}>{a.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="metrics-main-grid">
        <motion.div
          className="card-glass metrics-chart-card"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.36 } as Transition}
        >
          <span className="number-label">HISTÓRICO</span>
          <h2 className="metrics-chart-title">Inversión mensual</h2>
          {chartData.length === 0 ? (
            <p className="empty-note" style={{ marginTop: 32 }}>
              Sin histórico disponible para este cliente.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART.cyan} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={CHART.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={shortMonthLabel}
                  tick={{ fontSize: 11, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCopCompact}
                  tick={{ fontSize: 11, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  formatter={(v) => [formatCop(v as number), 'Inversión']}
                  labelFormatter={(label: unknown) => shortMonthLabel(String(label))}
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke={CHART.cyan}
                  strokeWidth={2}
                  fill="url(#spendGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: CHART.cyan, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          className="card-glass metrics-table-card"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.44 } as Transition}
        >
          <span className="number-label">TENDENCIA — ÚLTIMOS 6 MESES</span>
          {trendData.length === 0 ? (
            <p className="empty-note" style={{ marginTop: 32 }}>Sin histórico disponible.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData} margin={{ top: 8, right: 52, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={shortMonthLabel}
                  tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="spend"
                  tickFormatter={formatCopCompact}
                  tick={{ fontSize: 10, fill: CHART.cyan, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <YAxis
                  yAxisId="msgs"
                  orientation="right"
                  tick={{ fontSize: 10, fill: CHART.violet, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [
                    name === 'Inversión' ? formatCop(v as number) : formatNumber(v as number),
                    String(name),
                  ]}
                  labelFormatter={(l: unknown) => shortMonthLabel(String(l))}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: CHART.axis }} />
                <Line
                  yAxisId="spend"
                  type="monotone"
                  dataKey="Inversión"
                  stroke={CHART.cyan}
                  strokeWidth={2}
                  dot={{ fill: CHART.cyan, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: CHART.cyan }}
                />
                <Line
                  yAxisId="msgs"
                  type="monotone"
                  dataKey="Mensajes"
                  stroke={CHART.violet}
                  strokeWidth={2}
                  dot={{ fill: CHART.violet, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: CHART.violet }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* ── Comparison Charts ── */}
      {campaignByMonth.length > 0 && (
        <div ref={chartsRef} style={{ padding: '0 24px 24px' }}>
          <p className="number-label" style={{ marginBottom: 12, marginTop: 4, color: 'hsl(215,15%,36%)' }}>
            ANÁLISIS COMPARATIVO
          </p>
          {chartsVisible && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <SpendBarChart data={campaignByMonth} />
                <ConvCpmChart data={campaignByMonth} />
              </div>
              {top5ClientData.length > 0 && (
                <Top5ClientChart data={top5ClientData} activePeriod={activePeriod} />
              )}
            </>
          )}
        </div>
      )}

      {/* ── Campaign table ── */}
      {campaignsByCampaign.length > 0 && (
        <div style={{ padding: '0 24px 32px' }}>
          <p className="number-label" style={{ marginBottom: 10, color: 'hsl(215,15%,36%)' }}>
            CAMPAÑAS — {activePeriod === 'all' ? 'Total año' : getMonthLabel(activePeriod)}
            <span style={{ marginLeft: 8, color: 'hsl(180,100%,50%)' }}>({campaignsByCampaign.length})</span>
          </p>
          <div className="card-glass" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Campaña', 'Tipo', 'Estado', 'Inversión', 'Mensajes', 'Costo/Msg'].map((h, i) => (
                      <th key={h} style={{ padding: '9px 12px', color: 'hsl(215,15%,42%)', fontWeight: 500, textAlign: i >= 3 ? 'right' : 'left', whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const avgCostPerMsg = (() => {
                      const rows = campaignsByCampaign.filter((c) => c.messages > 0);
                      if (!rows.length) return null;
                      const s = rows.reduce((a, c) => a + c.spend, 0);
                      const m = rows.reduce((a, c) => a + c.messages, 0);
                      return m > 0 ? s / m : null;
                    })();
                    return campaignsByCampaign.map((c) => {
                      const tipo = inferObjectiveFromName(c.campaignName);
                      const tipoColors: Record<string, string> = { Interacción: CHART.violet, Tráfico: CHART.cyan, Ventas: CHART.green, Reconocimiento: CHART.amber, Presentación: '#38bdf8', Evaluación: CHART.orange };
                      const tipoColor = tipoColors[tipo] ?? 'rgba(255,255,255,0.3)';
                      const isActive = c.effectiveStatus === 'ACTIVE';
                      const costPerMsg = c.messages > 0 ? c.spend / c.messages : null;
                      const isHighCost = avgCostPerMsg != null && costPerMsg != null && costPerMsg > avgCostPerMsg * 1.5;
                      return (
                        <tr key={c.campaignId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isHighCost ? 'hsl(0 84% 60% / 0.05)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                            {c.campaignName}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: 4, background: `${tipoColor}18`, color: tipoColor, border: `1px solid ${tipoColor}30` }}>{tipo}</span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: 4, background: isActive ? 'hsl(145 100% 45% / 0.1)' : 'rgba(255,255,255,0.05)', color: isActive ? 'hsl(145,100%,50%)' : 'hsl(215,15%,45%)' }}>
                              {isActive ? '🟢 Activa' : (c.effectiveStatus ?? '⚫ —')}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: 'hsl(180,100%,50%)' }}>{formatCop(c.spend)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: 'hsl(215,15%,60%)' }}>{c.messages > 0 ? formatNumber(c.messages) : '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', color: isHighCost ? 'hsl(0,84%,65%)' : 'hsl(215,15%,55%)' }}>
                            {costPerMsg != null ? formatCop(costPerMsg) : '—'}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Returns real_roas for a given month.
 * Uses campaignSpend (from ad_campaign_metrics) as denominator if provided and > 0,
 * because the legacy client_monthly_operating_kpis.spend may be in a different scale.
 */
function getMonthRoas(params: {
  monthKey: string;
  monthlyKpis: ClientMonthlyOperatingKpi[];
  campaignSpend?: number;
}): number {
  const monthRows = params.monthlyKpis.filter(
    (row) => getMonthKey(row.month) === params.monthKey,
  );
  if (monthRows.length === 0) return 0;
  const totalSales = monthRows.reduce((sum, row) => sum + toFiniteNumber(row.total_sales), 0);
  if (totalSales <= 0) return 0;
  const spend =
    params.campaignSpend != null && params.campaignSpend > 0
      ? params.campaignSpend
      : monthRows.reduce((sum, row) => sum + toFiniteNumber(row.spend), 0);
  if (spend <= 0) return 0;
  return Math.round((totalSales / spend) * 100) / 100;
}

