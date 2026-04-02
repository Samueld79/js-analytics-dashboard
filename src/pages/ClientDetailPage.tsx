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
import { ClientFileModal } from '../components/ClientFileModal';
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
import { formatCop, formatNumber } from '../lib/utils';
import { getMonthKey, getMonthLabel } from '../utils/monthLabel';
import { CHART, TOOLTIP_STYLE } from '../lib/chartColors';

const FADE = { duration: 0.3, ease: 'easeOut' } as Transition;

// Maps inferred objective label → color for Pie chart
type ObjectiveInfo = { label: string; color: string };
function objectiveInfo(label: string | null | undefined): ObjectiveInfo {
  switch (label) {
    case 'Reconocimiento': return { label, color: CHART.amber };
    case 'Interacción':    return { label, color: CHART.violet };
    case 'Tráfico':        return { label, color: CHART.cyan };
    case 'Ventas':         return { label, color: CHART.green };
    case 'Presentación':   return { label, color: '#38bdf8' };
    case 'Evaluación':     return { label, color: CHART.orange };
    default:               return { label: label || 'Otro', color: 'rgba(255,255,255,0.3)' };
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

  // Single source: ad_campaign_metrics (2 years of history)
  const { rows: campaignRows, byMonth: campaignByMonth } = useCampaignSummary(client?.id, 730);

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

  const avatarInitial = client.name.charAt(0).toUpperCase();
  const statusColor =
    client.status === 'active'
      ? 'hsl(180,100%,50%)'
      : client.status === 'paused'
        ? 'hsl(40,90%,55%)'
        : 'hsl(0,70%,60%)';
  const statusText =
    client.status === 'active' ? 'Activo' : client.status === 'paused' ? 'Pausado' : 'Inactivo';

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="portal-header">
        <div
          className="portal-avatar"
          style={{ background: `${statusColor}22`, border: `2px solid ${statusColor}` }}
        >
          {avatarInitial}
        </div>

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
            <span
              className="status-pill"
              style={{
                background: `${statusColor}22`,
                color: statusColor,
                borderColor: statusColor,
              }}
            >
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
            <div style={{ display: 'flex', gap: '6px' }}>
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
          { label: 'Inversión', value: formatCop(periodKpi?.spend ?? 0), sub: activePeriod === 'all' ? 'Total año' : getMonthLabel(activePeriod) },
          { label: 'Mensajes', value: formatNumber(periodKpi?.messages ?? 0), sub: 'conversaciones iniciadas' },
          { label: 'Alcance', value: formatNumber(periodKpi?.reach ?? 0), sub: 'personas únicas' },
          { label: 'Impresiones', value: formatNumber(periodKpi?.impressions ?? 0), sub: 'veces mostrado' },
          { label: 'CPM', value: periodKpi && periodKpi.cpm > 0 ? formatCop(periodKpi.cpm) : '—', sub: 'costo por 1000 imp.' },
          { label: 'Frecuencia', value: periodKpi && periodKpi.frequency > 0 ? periodKpi.frequency.toFixed(2) : '—', sub: 'imp. por persona' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            className="card-glass portal-kpi-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...FADE, delay: i * 0.06 } as Transition}
          >
            <div className="number-label" style={{ marginBottom: 6 }}>
              {card.label}
            </div>
            <div className="font-display portal-kpi-value">{card.value}</div>
            <div className="number-label" style={{ marginTop: 8, opacity: 0.5 }}>
              {card.sub}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="portal-charts-grid">
        {/* Area chart: spend + messages over all historical months */}
        <div className="card-glass" style={{ padding: '16px 20px' }}>
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

        {/* BUG 3 FIX: Pie chart uses objectiveInfo for labels + colors */}
        <div className="card-glass" style={{ padding: '16px 20px' }}>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {campaignsByObjective.map((o) => {
                  const info = objectiveInfo(o.objective);
                  return (
                    <span
                      key={o.objective}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 11,
                        color: '#aaa',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: info.color,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      {info.label} ({o.shareOfSpend.toFixed(0)}%)
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
        <div className="card-glass" style={{ padding: '16px 20px' }}>
          <div
            className="number-label"
            onClick={() => setTableOpen((o) => !o)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: tableOpen ? 16 : 0,
              userSelect: 'none',
            }}
          >
            <span>
              Campañas — {activePeriod === 'all' ? 'Total año' : getMonthLabel(activePeriod)}
              {' '}({campaignsByCampaign.length})
            </span>
            <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{tableOpen ? '▲' : '▼'}</span>
          </div>
          {tableOpen && <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                {['Campaña', 'Objetivo', 'Inversión', 'Resultados', 'Estado'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 12px',
                      color: '#888',
                      fontWeight: 500,
                      textAlign: i >= 2 && i <= 3 ? 'right' : 'left',
                    }}
                  >
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
                  <tr
                    key={c.campaignId}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td
                      style={{
                        padding: '10px 12px',
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.campaignName}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: `${obj.color}22`,
                          color: obj.color,
                          fontSize: 11,
                        }}
                      >
                        {obj.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {formatCop(c.spend)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#aaa' }}>
                      {results}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background:
                            c.effectiveStatus === 'ACTIVE'
                              ? 'rgba(0,255,0,0.1)'
                              : 'rgba(255,255,255,0.06)',
                          color: c.effectiveStatus === 'ACTIVE' ? '#4ade80' : '#888',
                          fontSize: 11,
                        }}
                      >
                        {c.effectiveStatus ?? '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
        </div>
      )}

      {/* ── Year Line Chart: Inversión vs Ventas ── */}
      {yearBarData.length > 0 && (
        <div className="card-glass" style={{ padding: '16px 20px' }}>
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
