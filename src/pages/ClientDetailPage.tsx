import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { motion, type Transition } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { ClientAvatar } from '../components/ClientAvatar';
import { ClientFileModal } from '../components/ClientFileModal';
import { ClientSatisfactionCard } from '../components/ClientSatisfactionCard';
import { HistoricalMonthlyModal } from '../components/HistoricalMonthlyModal';
import { SalesModal } from '../components/SalesModal';
import { useAuth } from '../hooks/useAuth';
import { useCampaignSummary } from '../hooks/useData';
import { useClientWorkspace } from '../hooks/useClientWorkspace';
import {
  aggregateCampaignMetricsByCampaign,
  aggregateCampaignMetricsByObjective,
  inferObjectiveFromName,
  sumCampaignMonthAggregates,
} from '../services/adCampaignMetrics';
import { formatCop, formatNumber, toFiniteNumber } from '../lib/utils';
import { getMonthKey, getMonthLabel } from '../utils/monthLabel';
import { CHART, TOOLTIP_STYLE } from '../lib/chartColors';

// Portal-only formatter: always shows 2 decimal places (punto miles, coma decimales).
// Does NOT replace the global formatCop — this is only for the public client portal.
function formatCopFull(value: unknown): string {
  const amount = toFiniteNumber(value);
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2).replace('.', ',')} MM`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2).replace('.', ',')}M`;
  return `$${amount.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const FADE = { duration: 0.3, ease: 'easeOut' } as Transition;

// Maps inferred objective label → color for Pie chart
// All colors chosen to have good contrast on both light and dark backgrounds.
type ObjectiveInfo = { label: string; color: string };
function objectiveInfo(label: string | null | undefined): ObjectiveInfo {
  switch (label) {
    case 'Reconocimiento':      return { label, color: '#8b5cf6' };      // violet
    case 'Interacción':         return { label, color: CHART.violet };   // #7c3aed violet
    case 'Tráfico':             return { label, color: CHART.cyan };     // #00e5ff cyan
    case 'Ventas':              return { label, color: CHART.green };    // #00e676 green
    case 'Presentación':        return { label, color: '#38bdf8' };      // sky blue
    case 'Evaluación':          return { label, color: CHART.orange };   // #ff6d00 orange
    case 'Clientes Potenciales': return { label, color: '#f59e0b' };     // amber
    case 'Generación de leads':
    case 'Mensajes':            return { label, color: '#6366f1' };      // indigo — visible in both modes
    default:                    return { label: label || 'Otro', color: '#94a3b8' }; // slate — visible in both modes
  }
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { isInternal, canWriteSales, role } = useAuth();
  const portalMode = location.pathname.startsWith('/portal/');
  const showInternalTools = isInternal && !portalMode;
  const canLoadHistory = role === 'admin' && !portalMode;

  const {
    client,
    sales,
    loading,
    error,
    addSale,
    addHistoricalAds,
    addHistoricalSales,
    addSocialMonthlyMetric,
    addFile,
    strategies,
  } = useClientWorkspace(id, 400);

  // Single source: ad_campaign_metrics (1 year of history; wait until client UUID is available)
  const { rows: campaignRows, byMonth: campaignByMonth } = useCampaignSummary(client?.id, 365);

  // Period selector — null = auto-select most recent
  const [selectedPeriod, setSelectedPeriod] = useState<string | 'all' | null>(null);
  const activePeriod = selectedPeriod ?? campaignByMonth[campaignByMonth.length - 1]?.month ?? '';

  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  // Rows filtered to active period (for campaign table / pie)
  const periodRows = useMemo(
    () =>
      activePeriod === 'all' || activePeriod === ''
        ? campaignRows
        : campaignRows.filter((r) => r.date.startsWith(activePeriod)),
    [campaignRows, activePeriod],
  );

  const campaignsByCampaign = useMemo(
    () => aggregateCampaignMetricsByCampaign(periodRows),
    [periodRows],
  );

  const campaignsByObjective = useMemo(
    () => aggregateCampaignMetricsByObjective(periodRows),
    [periodRows],
  );

  // KPI aggregate for selected period
  const periodKpi = useMemo(
    () =>
      activePeriod === 'all'
        ? sumCampaignMonthAggregates(campaignByMonth, 'all')
        : (campaignByMonth.find((m) => m.month === activePeriod) ?? null),
    [campaignByMonth, activePeriod],
  );

  // Area chart: all historical months
  const areaChartData = useMemo(
    () =>
      [...campaignByMonth]
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12)
        .map((m) => ({ month: m.month, Inversión: m.spend, Mensajes: m.messages })),
    [campaignByMonth],
  );

  // ROAS for selected period (ventas / spend)
  const periodSales = useMemo(() => {
    if (activePeriod === 'all') return sales.reduce((s, r) => s + r.total_sales, 0);
    return sales.filter((r) => r.date.startsWith(activePeriod)).reduce((s, r) => s + r.total_sales, 0);
  }, [sales, activePeriod]);

  const periodRoas = useMemo(() => {
    const spend = periodKpi?.spend ?? 0;
    if (spend <= 0 || periodSales <= 0) return null;
    return periodSales / spend;
  }, [periodKpi, periodSales]);

  // Bar chart: year view combining campaign spend + manual sales
  const salesByMonth = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => {
      const key = getMonthKey(s.date);
      map.set(key, (map.get(key) ?? 0) + s.total_sales);
    });
    return map;
  }, [sales]);

  const yearBarData = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    const allMonths = new Set<string>([
      ...campaignByMonth.filter((m) => m.month.startsWith(currentYear)).map((m) => m.month),
      ...[...salesByMonth.keys()].filter((k) => k.startsWith(currentYear)),
    ]);
    return [...allMonths]
      .sort()
      .map((month) => ({
        month,
        Inversión: campaignByMonth.find((m) => m.month === month)?.spend ?? 0,
        Ventas: salesByMonth.get(month) ?? 0,
      }));
  }, [campaignByMonth, salesByMonth]);

  const canRegisterSales = client ? canWriteSales(client.id) && !portalMode : false;
  const isResolvedClient =
    Boolean(client) && Boolean(id) && (client?.id === id || client?.slug === id);

  if (loading && !isResolvedClient) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <h3>Cargando cliente...</h3>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <h3>{error ? 'No se pudo cargar el cliente' : 'Cliente no encontrado'}</h3>
          <p>
            {error ?? 'Verifica que el cliente exista en Supabase y que tengas acceso a su workspace.'}
          </p>
        </div>
      </div>
    );
  }

  const statusText =
    client.status === 'active' ? 'Activo' : client.status === 'paused' ? 'Pausado' : 'Inactivo';

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="portal-header">
        <ClientAvatar
          clientId={client.id}
          name={client.name}
          logoUrl={client.logo_url}
          size={52}
          borderRadius={14}
        />

        <div className="portal-title-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {!portalMode && isInternal && (
              <Link to="/clients" className="back-link">
                <ArrowLeft size={14} /> Clientes
              </Link>
            )}
            <h1 className="page-title" style={{ margin: 0 }}>
              {client.name}
            </h1>
            <span className={`status-pill status-pill-${client.status}`}>
              {statusText}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {client.niche && <span className="meta-chip">{client.niche}</span>}
            {client.main_city && <span className="meta-chip">{client.main_city}</span>}
          </div>
        </div>

        {/* Period selector */}
        <div className="portal-header-actions">
          {campaignByMonth.length > 0 && (
            <div className="portal-period-pills">
              {campaignByMonth.map((m) => (
                <button
                  key={m.month}
                  onClick={() => setSelectedPeriod(m.month)}
                  className={`portal-period-pill${activePeriod === m.month ? ' active' : ''}`}
                >
                  {getMonthLabel(m.month)}
                </button>
              ))}
              <button
                onClick={() => setSelectedPeriod('all')}
                className={`portal-period-pill${activePeriod === 'all' ? ' active' : ''}`}
              >
                Total año
              </button>
            </div>
          )}
          {canLoadHistory && (
            <button className="btn-secondary" onClick={() => setShowHistoricalModal(true)}>
              + Cargar histórico
            </button>
          )}
          {canRegisterSales && (
            <button className="btn-primary" onClick={() => setShowSalesModal(true)}>
              + Registrar Ventas
            </button>
          )}
          {showInternalTools && (
            <button className="btn-secondary" onClick={() => setShowFileModal(true)}>
              + Archivo
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="portal-kpi-grid">
        {[
          { label: 'Ventas Totales', value: periodSales > 0 ? formatCopFull(periodSales) : 'N/D', sub: activePeriod === 'all' ? 'Total año' : getMonthLabel(activePeriod) },
          { label: 'Inversión', value: formatCop(periodKpi?.spend ?? 0), sub: activePeriod === 'all' ? 'Total año' : getMonthLabel(activePeriod) },
          { label: 'Mensajes', value: formatNumber(periodKpi?.messages ?? 0), sub: 'conversaciones iniciadas' },
          { label: 'Alcance', value: formatNumber(periodKpi?.reach ?? 0), sub: 'personas únicas' },
          { label: 'Impresiones', value: formatNumber(periodKpi?.impressions ?? 0), sub: 'veces mostrado' },
          { label: 'ROAS', value: periodRoas != null ? `${periodRoas.toFixed(1)}x` : 'N/D', sub: 'retorno sobre inversión' },
          { label: 'Frecuencia', value: periodKpi && periodKpi.frequency > 0 ? periodKpi.frequency.toFixed(2) : '—', sub: 'imp. por persona' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            className="card-glass portal-kpi-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...FADE, delay: i * 0.06 } as Transition}
          >
            <p className="portal-kpi-label">{card.label}</p>
            <p className="portal-kpi-value">{card.value}</p>
            <p className="portal-kpi-sub">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {showInternalTools && client && (
        <div style={{ marginTop: 16 }}>
          <ClientSatisfactionCard clientId={client.id} salesByMonth={salesByMonth} />
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="portal-charts-grid">
        {/* Area chart: spend + messages over all historical months */}
        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 16 }}>
            Inversión mensual {new Date().getFullYear()}
          </div>
          {areaChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={areaChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cdpGradSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART.cyan} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART.cyan} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cdpGradMsgs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART.violet} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART.violet} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: CHART.axis, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: unknown) => getMonthLabel(String(v)).slice(0, 3)}
                />
                <YAxis
                  yAxisId="spend"
                  tick={{ fill: CHART.axis, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis yAxisId="msgs" orientation="right" tick={{ fill: CHART.axis, fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={(label: unknown) => getMonthLabel(String(label))}
                  formatter={(value: unknown, name: unknown) => [
                    name === 'Inversión' ? formatCop(Number(value)) : formatNumber(Number(value)),
                    String(name),
                  ]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area
                  yAxisId="spend"
                  type="monotone"
                  dataKey="Inversión"
                  stroke={CHART.cyan}
                  fill="url(#cdpGradSpend)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: CHART.cyan, strokeWidth: 0 }}
                />
                <Area
                  yAxisId="msgs"
                  type="monotone"
                  dataKey="Mensajes"
                  stroke={CHART.violet}
                  fill="url(#cdpGradMsgs)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: CHART.violet, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-note">Sin datos de campañas todavía.</p>
          )}
        </div>

        {/* Pie chart: campaign mix by objective */}
        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 16 }}>
            Mix de campañas — {activePeriod === 'all' ? 'Total año' : getMonthLabel(activePeriod)}
          </div>
          {campaignsByObjective.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={campaignsByObjective.map((o) => ({
                      name: objectiveInfo(o.objective).label,
                      value: o.spend,
                      raw: o.objective,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {campaignsByObjective.map((o, idx) => (
                      <Cell
                        key={`${o.objective}-${idx}`}
                        fill={objectiveInfo(o.objective).color}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => formatCop(Number(value))}
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="portal-pie-legend">
                {campaignsByObjective.map((o) => {
                  const info = objectiveInfo(o.objective);
                  return (
                    <span key={o.objective} className="portal-pie-legend-item">
                      <span className="portal-pie-dot" style={{ background: info.color }} />
                      {info.label} ({(o.shareOfSpend * 100).toFixed(0)}%)
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="empty-note">Sin datos de campañas para este mes.</p>
          )}
        </div>
      </div>

      {/* ── Campaign Table (collapsible) ── */}
      {campaignsByCampaign.length > 0 && (
        <div className="card-glass card-padded">
          <div
            className="portal-table-toggle"
            onClick={() => setTableOpen((o) => !o)}
          >
            <span>
              Campañas — {activePeriod === 'all' ? 'Total año' : getMonthLabel(activePeriod)}
              {' '}({campaignsByCampaign.length})
            </span>
            <span className="portal-table-chevron">{tableOpen ? '▲' : '▼'}</span>
          </div>
          {tableOpen && (
            <table className="portal-campaign-table">
              <thead>
                <tr>
                  {['Campaña', 'Objetivo', 'Inversión', 'Resultados', 'Estado'].map((h, i) => (
                    <th key={h} className={i >= 2 && i <= 3 ? 'num-col' : ''}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignsByCampaign.map((c) => {
                  const obj = objectiveInfo(inferObjectiveFromName(c.campaignName));
                  const results =
                    c.messages > 0
                      ? `${formatNumber(c.messages)} msgs`
                      : c.leads > 0
                        ? `${formatNumber(c.leads)} leads`
                        : c.purchases > 0
                          ? `${formatNumber(c.purchases)} compras`
                          : `${formatNumber(c.clicks)} clics`;
                  return (
                    <tr key={c.campaignId}>
                      <td className="portal-campaign-name">{c.campaignName}</td>
                      <td>
                        <span
                          className="portal-objective-badge"
                          style={{ background: `${obj.color}22`, color: obj.color }}
                        >
                          {obj.label}
                        </span>
                      </td>
                      <td className="num-col">{formatCop(c.spend)}</td>
                      <td className="num-col" style={{ color: 'var(--fg-muted)' }}>{results}</td>
                      <td>
                        <span className={c.effectiveStatus === 'ACTIVE' ? 'portal-status-active' : 'portal-status-inactive'}>
                          {c.effectiveStatus ?? '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Year Line Chart: Inversión vs Ventas ── */}
      {yearBarData.length > 0 && (
        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 16 }}>
            Inversión vs Ventas — {new Date().getFullYear()}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={yearBarData} margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: CHART.axis, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: unknown) => getMonthLabel(String(v)).slice(0, 3)}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: CHART.cyan, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}M`}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: CHART.green, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}M`}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                labelFormatter={(label: unknown) => getMonthLabel(String(label))}
                formatter={(value: unknown, name: unknown) => [
                  formatCop(Number(value)),
                  String(name),
                ]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: CHART.axis }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="Inversión"
                stroke={CHART.cyan}
                strokeWidth={2}
                dot={{ fill: CHART.cyan, r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: CHART.cyan }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="Ventas"
                stroke={CHART.green}
                strokeWidth={2}
                dot={{ fill: CHART.green, r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: CHART.green }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Modals ── */}
      {showSalesModal && (
        <SalesModal
          clientId={client.id}
          clientName={client.name}
          onClose={() => setShowSalesModal(false)}
          onSave={async (data) => {
            const result = await addSale(data);
            if (!result.error) setShowSalesModal(false);
            return result;
          }}
        />
      )}

      {showInternalTools && showFileModal && (
        <ClientFileModal
          clientId={client.id}
          strategies={strategies}
          onClose={() => setShowFileModal(false)}
          onSave={async (data) => {
            const result = await addFile(data);
            if (!result.error) setShowFileModal(false);
            return result;
          }}
        />
      )}

      {canLoadHistory && showHistoricalModal && (
        <HistoricalMonthlyModal
          clientName={client.name}
          onClose={() => setShowHistoricalModal(false)}
          onSaveAds={addHistoricalAds}
          onSaveSales={addHistoricalSales}
          onSaveSocial={addSocialMonthlyMetric}
        />
      )}
    </div>
  );
}