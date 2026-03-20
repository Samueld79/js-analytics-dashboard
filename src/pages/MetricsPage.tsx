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
import { BarChart3, DollarSign, MessageCircle, Percent, TrendingDown, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMonthlyOperatingKpis, useCampaignSummary } from '../hooks/useData';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import { sumCampaignMonthAggregates } from '../services/adCampaignMetrics';
import type { ClientMonthlyOperatingKpi } from '../lib/supabase';
import { formatCop, formatNumber, formatRoas, sumOperatingKpis } from '../lib/utils';
import { getMonthKey, getMonthLabel } from '../utils/monthLabel';

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

  const selectedClientId = selectedClient === 'all' ? undefined : selectedClient;
  const canSelectAllClients = isInternal || visibleClients.length > 1;
  const queryClientId =
    !isInternal && !canSelectAllClients
      ? defaultClientId ?? EMPTY_CLIENT_SCOPE
      : selectedClientId;

  // Primary data source: ad_campaign_metrics
  const { byMonth: campaignByMonth } = useCampaignSummary(queryClientId, 730);

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
        const roas = getMonthRoas({ monthKey, monthlyKpis: scopedMonthlyKpis });
        return { monthKey, spend, messages, roas };
      })
      .filter((r) => r.spend > 0 || r.messages > 0);
  }, [campaignByMonth, scopedMonthlyKpis, scopedSales]);

  const chartData = historyRows.map((row) => ({ month: row.monthKey, spend: row.spend }));

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
            <p className="empty-note" style={{ marginTop: 32 }}>
              Sin histórico disponible para este cliente.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(180,100%,50%)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(180,100%,50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(220,15%,11%)"
                  vertical={false}
                />
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
                      style={{
                        textAlign: 'center',
                        padding: '28px 0',
                        color: 'hsl(215,15%,45%)',
                        fontSize: '0.82rem',
                      }}
                    >
                      Sin histórico disponible
                    </td>
                  </tr>
                ) : (
                  historyRows.map((row) => (
                    <tr
                      key={row.monthKey}
                      className={row.monthKey === activePeriod ? 'is-current-month' : ''}
                    >
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

/** Returns real_roas for a given month from consolidated KPI rows; 0 if unavailable. */
function getMonthRoas(params: {
  monthKey: string;
  monthlyKpis: ClientMonthlyOperatingKpi[];
}): number {
  const monthRows = params.monthlyKpis.filter(
    (row) => getMonthKey(row.month) === params.monthKey,
  );
  if (monthRows.length > 0) return sumOperatingKpis(monthRows).real_roas;
  return 0;
}

function roasClass(roas: number): string {
  if (roas >= 3) return 'roas-pill roas-good';
  if (roas >= 2) return 'roas-pill roas-ok';
  return 'roas-pill roas-low';
}
