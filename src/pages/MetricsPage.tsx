import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
  BarChart3,
  DollarSign,
  MessageCircle,
  Percent,
  ShoppingCart,
  TrendingDown,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMonthlyOperatingKpis, useAdMetrics, useCampaignMonthlyHistory } from '../hooks/useData';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import type { AdMetric, ClientMonthlyOperatingKpi, DailySale } from '../lib/supabase';
import {
  buildMarketingActionSummary,
  formatCop,
  formatNumber,
  formatPct,
  formatRoas,
  sumMetrics,
  sumOperatingKpis,
  sumSales,
} from '../lib/utils';
import { getMonthKey } from '../utils/monthLabel';

const EMPTY_CLIENT_SCOPE = '00000000-0000-0000-0000-000000000000';

type RangeKey =
  | 'today' | 'yesterday' | 'last7' | 'last14' | 'last28' | 'last30'
  | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'all' | 'custom';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'last7', label: 'Últ. 7 días' },
  { key: 'last14', label: 'Últ. 14 días' },
  { key: 'last28', label: 'Últ. 28 días' },
  { key: 'last30', label: 'Últ. 30 días' },
  { key: 'thisWeek', label: 'Esta semana' },
  { key: 'lastWeek', label: 'Sem. pasada' },
  { key: 'thisMonth', label: 'Este mes' },
  { key: 'lastMonth', label: 'Mes pasado' },
  { key: 'all', label: 'Máximo' },
  { key: 'custom', label: 'Personalizado' },
];

function getRangeDates(
  key: RangeKey,
  customFrom: string,
  customTo: string,
): { start: string; end: string } {
  const todayStr = new Date().toISOString().slice(0, 10);
  const shift = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  switch (key) {
    case 'today': return { start: todayStr, end: todayStr };
    case 'yesterday': { const y = shift(-1); return { start: y, end: y }; }
    case 'last7': return { start: shift(-6), end: todayStr };
    case 'last14': return { start: shift(-13), end: todayStr };
    case 'last28': return { start: shift(-27), end: todayStr };
    case 'last30': return { start: shift(-29), end: todayStr };
    case 'thisWeek': {
      const now = new Date();
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return { start: mon.toISOString().slice(0, 10), end: todayStr };
    }
    case 'lastWeek': {
      const now = new Date();
      const lastMon = new Date(now);
      lastMon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      return { start: lastMon.toISOString().slice(0, 10), end: lastSun.toISOString().slice(0, 10) };
    }
    case 'thisMonth': {
      const now = new Date();
      return { start: `${now.toISOString().slice(0, 7)}-01`, end: todayStr };
    }
    case 'lastMonth': {
      const now = new Date();
      const firstOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: firstOfPrev.toISOString().slice(0, 10), end: lastOfPrev.toISOString().slice(0, 10) };
    }
    case 'all': return { start: '2020-01-01', end: todayStr };
    case 'custom': return { start: customFrom || todayStr, end: customTo || todayStr };
  }
}

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

function roasStatus(roas: number): HealthStatus {
  if (roas === 0) return 'neutral';
  if (roas > 10) return 'great';
  if (roas >= 3) return 'good';
  if (roas >= 1) return 'warning';
  return 'bad';
}

const COST_BADGE: Record<HealthStatus, { label: string; cls: string } | null> = {
  great:   { label: '✓ Excelente', cls: 'badge-great' },
  good:    { label: '~ Bueno',     cls: 'badge-good' },
  warning: { label: '⚠ Regular',   cls: 'badge-warning' },
  bad:     { label: '✗ Alto',      cls: 'badge-bad' },
  neutral: null,
};

const ROAS_BADGE: Record<HealthStatus, { label: string; cls: string } | null> = {
  great:   { label: '✓ Excelente', cls: 'badge-great' },
  good:    { label: '~ Saludable', cls: 'badge-good' },
  warning: { label: '⚠ Bajo',      cls: 'badge-warning' },
  bad:     { label: '✗ Pérdida',   cls: 'badge-bad' },
  neutral: null,
};

function costSub(status: HealthStatus): string {
  if (status === 'warning') return 'Revisar segmentación y creativos';
  if (status === 'bad') return 'Optimizar urgente — revisar públicos';
  return 'Inversión / conversaciones detectadas';
}

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
  const [rangeKey, setRangeKey] = useState<RangeKey>('thisMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const selectedClientId = selectedClient === 'all' ? undefined : selectedClient;
  const canSelectAllClients = isInternal || visibleClients.length > 1;
  const queryClientId =
    !isInternal && !canSelectAllClients
      ? defaultClientId ?? EMPTY_CLIENT_SCOPE
      : selectedClientId;

  const queryDays = rangeKey === 'all' ? 1825 : 450;
  const queryMonths = rangeKey === 'all' ? 36 : 12;

  const { metrics } = useAdMetrics(queryClientId, queryDays);
  const { monthlyKpis } = useMonthlyOperatingKpis(queryClientId, queryMonths);
  const { sales } = useDailySales({ clientId: queryClientId, days: queryDays });
  const { byMonth: campaignByMonth } = useCampaignMonthlyHistory(queryClientId);

  const scopedMetrics = useMemo(
    () =>
      isInternal ? metrics : metrics.filter((row) => visibleClientIds.has(row.client_id)),
    [isInternal, metrics, visibleClientIds],
  );
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

  const { start: rangeStart, end: rangeEnd } = getRangeDates(rangeKey, customFrom, customTo);
  const rangeStartMonth = rangeStart.slice(0, 7);
  const rangeEndMonth = rangeEnd.slice(0, 7);
  const activeMonth = rangeEndMonth;

  const monthMetrics = useMemo(
    () => scopedMetrics.filter((m) => m.date >= rangeStart && m.date <= rangeEnd),
    [rangeStart, rangeEnd, scopedMetrics],
  );
  const monthOperatingRows = useMemo(
    () =>
      scopedMonthlyKpis.filter((row) => {
        const m = getMonthKey(row.month);
        return m >= rangeStartMonth && m <= rangeEndMonth;
      }),
    [rangeStartMonth, rangeEndMonth, scopedMonthlyKpis],
  );
  const monthSales = useMemo(
    () => scopedSales.filter((row) => row.date >= rangeStart && row.date <= rangeEnd),
    [rangeStart, rangeEnd, scopedSales],
  );

  const operatingTotals = monthOperatingRows.length
    ? sumOperatingKpis(monthOperatingRows)
    : buildCombinedMonthTotals(monthMetrics, monthSales);
  const marketingSummary = buildMarketingActionSummary(monthMetrics);

  // Campaign fallback: sum monthly aggregates when ad_metrics has no data for the range
  const campaignRangeFallback = useMemo(() => {
    if (monthMetrics.length > 0) return null;
    let spend = 0;
    let messages = 0;
    let cur = rangeStartMonth;
    while (cur <= rangeEndMonth) {
      const row = campaignByMonth.find((r) => r.month === cur);
      if (row) { spend += row.spend; messages += row.messages; }
      const [y, m] = cur.split('-').map(Number);
      cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
    return spend > 0 || messages > 0 ? { spend, messages } : null;
  }, [monthMetrics, campaignByMonth, rangeStartMonth, rangeEndMonth]);

  const effectiveSpend = operatingTotals.spend > 0 ? operatingTotals.spend : (campaignRangeFallback?.spend ?? 0);
  const effectiveMessages = marketingSummary.messagingStarted > 0 ? marketingSummary.messagingStarted : (campaignRangeFallback?.messages ?? 0);

  const costPerConversation =
    effectiveMessages > 0 ? effectiveSpend / effectiveMessages : null;
  const estimatedCloseRate =
    effectiveMessages > 0 && monthSales.length > 0
      ? (monthSales.length / effectiveMessages) * 100
      : null;

  // Definitive historical merge: ad_campaign_metrics (Excel) + ad_metrics (n8n daily)
  const historyRows = useMemo(() => {
    // Step 1: campaign map from Excel import — most complete for older months
    const campaignMap = new Map<string, { spend: number; messages: number }>();
    for (const row of campaignByMonth) {
      campaignMap.set(row.month, { spend: row.spend, messages: row.messages });
    }

    // Step 2: ad_metrics map — accurate for recent months (n8n daily sync)
    const adMetricsMap = new Map<string, { spend: number; messages: number }>();
    for (const row of scopedMetrics) {
      const key = getMonthKey(row.date);
      const prev = adMetricsMap.get(key) ?? { spend: 0, messages: 0 };
      adMetricsMap.set(key, {
        spend: prev.spend + (row.spend ?? 0),
        messages: prev.messages + (row.messages ?? 0),
      });
    }

    // Step 3: union of all known month keys
    const allMonths = new Set<string>([
      ...campaignMap.keys(),
      ...adMetricsMap.keys(),
      ...scopedMonthlyKpis.map((r) => getMonthKey(r.month)),
      ...scopedSales.map((r) => getMonthKey(r.date)),
    ]);

    return [...allMonths]
      .sort()      // YYYY-MM ascending
      .slice(-6)   // last 6 months
      .map((monthKey) => {
        const campaign = campaignMap.get(monthKey) ?? { spend: 0, messages: 0 };
        const adM = adMetricsMap.get(monthKey) ?? { spend: 0, messages: 0 };

        // Prefer ad_metrics (daily sync) if it has data; else fall back to Excel
        const spend = adM.spend > 0 ? adM.spend : campaign.spend;
        const messages = adM.messages > 0 ? adM.messages : campaign.messages;

        // ROAS from consolidated monthly KPI rows (best available)
        const roas = getMonthOperatingTotals({
          monthKey,
          monthlyKpis: scopedMonthlyKpis,
          metrics: scopedMetrics,
          sales: scopedSales,
        }).real_roas;

        return { monthKey, spend, messages, roas };
      })
      .filter((r) => r.spend > 0 || r.messages > 0);
  }, [campaignByMonth, scopedMetrics, scopedMonthlyKpis, scopedSales]);

  const chartData = historyRows.map((row) => ({ month: row.monthKey, spend: row.spend }));

  const cStatus = costPerConversation != null ? costStatus(costPerConversation) : 'neutral' as HealthStatus;
  const rStatus = roasStatus(operatingTotals.real_roas);

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
      value: formatCop(effectiveSpend),
      sub: 'Inversión real del período',
    },
    {
      icon: <MessageCircle size={15} />,
      label: 'CONVERSACIONES',
      value: formatNumber(effectiveMessages),
      sub: 'Mensajes vía Meta Ads',
    },
    {
      icon: <TrendingDown size={15} />,
      label: 'COSTO POR CONV',
      value: costPerConversation != null ? formatCop(costPerConversation) : '—',
      sub: costPerConversation != null ? costSub(cStatus) : 'Sin conversaciones',
      muted: costPerConversation == null,
      badge: COST_BADGE[cStatus],
    },
    {
      icon: <ShoppingCart size={15} />,
      label: 'VENTAS MANUALES',
      value: formatCop(operatingTotals.total_sales),
      sub: `${monthSales.length} registro(s) del período`,
    },
    {
      icon: <BarChart3 size={15} />,
      label: 'ROAS OPERATIVO',
      value: formatRoas(operatingTotals.real_roas),
      sub: 'Ventas manuales / inversión',
      muted: operatingTotals.real_roas === 0,
      badge: ROAS_BADGE[rStatus],
    },
    {
      icon: <Percent size={15} />,
      label: 'TASA DE CIERRE',
      value: estimatedCloseRate != null ? formatPct(estimatedCloseRate) : '—',
      sub: estimatedCloseRate != null ? 'Registros / conversaciones' : 'Sin datos suficientes',
      muted: estimatedCloseRate == null,
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
        <div className="filter-row" style={{ flexWrap: 'wrap', gap: 4 }}>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`filter-chip ${rangeKey === opt.key ? 'active' : ''}`}
              onClick={() => setRangeKey(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {rangeKey === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 140 }}
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span style={{ color: 'var(--gs-text-soft)' }}>→</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 140 }}
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="metrics-kpi-grid">
        {kpiCards.map((card, i) => (
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
            <p className="empty-note" style={{ marginTop: 32 }}>Sin histórico disponible para este cliente.</p>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(180,100%,50%)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(180,100%,50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,11%)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={shortMonthLabel}
                  tick={{ fontSize: 11, fill: 'hsl(215,15%,48%)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCopCompact}
                  tick={{ fontSize: 11, fill: 'hsl(215,15%,48%)' }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  formatter={(v) => [formatCop(v as number), 'Inversión']}
                  labelFormatter={(label: unknown) => shortMonthLabel(String(label))}
                  contentStyle={{
                    background: 'hsl(220,20%,8%)',
                    border: '1px solid hsl(220,15%,15%)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke="hsl(180,100%,50%)"
                  strokeWidth={2}
                  fill="url(#spendGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(180,100%,50%)' }}
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
          <span className="number-label">ÚLTIMOS 6 MESES</span>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="metrics-history-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num-col">Inversión</th>
                  <th className="num-col">Mensajes</th>
                  <th className="num-col">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ textAlign: 'center', padding: '28px 0', color: 'hsl(215,15%,45%)', fontSize: '0.82rem' }}
                    >
                      Sin histórico disponible
                    </td>
                  </tr>
                ) : (
                  historyRows.map((row) => (
                    <tr key={row.monthKey} className={row.monthKey === activeMonth ? 'is-current-month' : ''}>
                      <td>{shortMonthLabel(row.monthKey)}</td>
                      <td className="num-col">{formatCop(row.spend)}</td>
                      <td className="num-col">{formatNumber(row.messages)}</td>
                      <td className="num-col">
                        <span className={roasClass(row.roas)}>{formatRoas(row.roas)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

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

function getMonthOperatingTotals(params: {
  monthKey: string;
  monthlyKpis: ClientMonthlyOperatingKpi[];
  metrics: AdMetric[];
  sales: DailySale[];
}) {
  const monthRows = params.monthlyKpis.filter(
    (row) => getMonthKey(row.month) === params.monthKey,
  );
  if (monthRows.length > 0) return sumOperatingKpis(monthRows);

  return buildCombinedMonthTotals(
    params.metrics.filter((row) => getMonthKey(row.date) === params.monthKey),
    params.sales.filter((row) => getMonthKey(row.date) === params.monthKey),
  );
}

function roasClass(roas: number): string {
  if (roas >= 3) return 'roas-pill roas-good';
  if (roas >= 2) return 'roas-pill roas-ok';
  return 'roas-pill roas-low';
}
