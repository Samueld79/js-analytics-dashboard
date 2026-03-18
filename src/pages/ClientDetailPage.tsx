import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { MonthSelector } from '../components/MonthSelector';
import { SalesModal } from '../components/SalesModal';
import { useAuth } from '../hooks/useAuth';
import { useAdCampaignMetrics, useCampaignMonthlyHistory } from '../hooks/useData';
import { useClientWorkspace } from '../hooks/useClientWorkspace';
import {
  aggregateCampaignMetricsByCampaign,
  aggregateCampaignMetricsByObjective,
} from '../services/adCampaignMetrics';
import { formatCop, formatRoas, formatNumber } from '../lib/utils';
import { getMonthKey, getMonthLabel, listAvailableMonthKeys } from '../utils/monthLabel';

const FADE = { duration: 0.3, ease: 'easeOut' } as Transition;

// Maps result_type / objective raw values → human label + color
type ObjectiveInfo = { label: string; color: string };
function objectiveInfo(raw: string | null | undefined): ObjectiveInfo {
  switch (raw) {
    case 'messages':
      return { label: 'Mensajes', color: 'hsl(280,80%,60%)' };
    case 'profile_visit':
      return { label: 'Tráfico', color: 'hsl(180,100%,50%)' };
    case 'reach':
      return { label: 'Reconocimiento', color: 'hsl(40,90%,55%)' };
    case 'purchases':
      return { label: 'Ventas', color: 'hsl(140,60%,50%)' };
    case 'leads':
      return { label: 'Leads', color: 'hsl(200,80%,55%)' };
    default:
      return { label: raw && raw !== 'Sin objetivo real' ? raw : 'Otro', color: 'hsl(220,15%,45%)' };
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
    metrics,
    monthlyKpis,
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

  // BUG 1 FIX: use useCampaignMonthlyHistory for the area chart (all historical months)
  const { byMonth: campaignByMonth } = useCampaignMonthlyHistory(client?.id);
  // Separate hook for campaign table / pie: only needs recent 90 days
  const { rows: campaignRows } = useAdCampaignMetrics(client?.id, 90);

  // Debug — check what history comes back per client
  console.log('[ClientDetailPage] campaignByMonth:', campaignByMonth, 'clientId:', client?.id);

  const [selectedMonth, setSelectedMonth] = useState('');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);

  const availableMonths = useMemo(
    () =>
      listAvailableMonthKeys([
        ...monthlyKpis.map((r) => r.month),
        ...metrics.map((r) => r.date),
        ...sales.map((r) => r.date),
        ...campaignByMonth.map((m) => m.month),
      ]),
    [metrics, monthlyKpis, sales, campaignByMonth],
  );

  const fallbackMonth = availableMonths[0] ?? new Date().toISOString().slice(0, 7);
  const activeMonth = selectedMonth || fallbackMonth;

  useEffect(() => {
    if (!selectedMonth) {
      setSelectedMonth(fallbackMonth);
    } else if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, fallbackMonth, selectedMonth]);

  // Campaign aggregations for selected month (from 90-day raw rows)
  const selectedMonthCampaignRows = useMemo(
    () => campaignRows.filter((r) => getMonthKey(r.date) === activeMonth),
    [campaignRows, activeMonth],
  );

  const campaignsByCampaign = useMemo(
    () => aggregateCampaignMetricsByCampaign(selectedMonthCampaignRows),
    [selectedMonthCampaignRows],
  );

  const campaignsByObjective = useMemo(
    () => aggregateCampaignMetricsByObjective(selectedMonthCampaignRows),
    [selectedMonthCampaignRows],
  );

  // BUG 2 FIX: KPI spend + messages come from ad_metrics (daily, accurate)
  const selectedMonthAdMetrics = useMemo(
    () => metrics.filter((r) => getMonthKey(r.date) === activeMonth),
    [metrics, activeMonth],
  );

  const kpiSpend = useMemo(
    () => selectedMonthAdMetrics.reduce((sum, r) => sum + r.spend, 0),
    [selectedMonthAdMetrics],
  );

  const kpiMessages = useMemo(
    () => selectedMonthAdMetrics.reduce((sum, r) => sum + r.messages, 0),
    [selectedMonthAdMetrics],
  );

  // ROAS and sales from monthly KPI consolidated row (more authoritative)
  const selectedKpiRow = useMemo(
    () => monthlyKpis.find((r) => getMonthKey(r.month) === activeMonth) ?? null,
    [monthlyKpis, activeMonth],
  );
  const kpiRoas = selectedKpiRow?.real_roas ?? 0;
  const kpiSales = selectedKpiRow?.total_sales ?? 0;

  // Area chart: all historical months from useCampaignMonthlyHistory
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

        {/* BUG 4 FIX: actions flush-right */}
        <div className="portal-header-actions">
          <MonthSelector
            label="Periodo"
            value={activeMonth}
            options={availableMonths.length > 0 ? availableMonths : [fallbackMonth]}
            onChange={setSelectedMonth}
          />
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
          { label: 'Inversión', value: formatCop(kpiSpend), sub: getMonthLabel(activeMonth) },
          { label: 'Conversaciones', value: formatNumber(kpiMessages), sub: 'mensajes iniciados' },
          {
            label: 'ROAS Operativo',
            value: formatRoas(kpiRoas),
            sub:
              kpiRoas >= 3 ? 'Saludable' : kpiRoas >= 1 ? 'Revisar' : kpiRoas > 0 ? 'Bajo' : '—',
          },
          { label: 'Ventas', value: formatCop(kpiSales), sub: getMonthLabel(activeMonth) },
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
        <div className="card-glass" style={{ padding: '20px 24px' }}>
          <div className="number-label" style={{ marginBottom: 16 }}>
            Inversión mensual {new Date().getFullYear()}
          </div>
          {areaChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={areaChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cdpGradSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(180,100%,50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(180,100%,50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cdpGradMsgs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(280,80%,60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(280,80%,60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickFormatter={(v: unknown) => getMonthLabel(String(v)).slice(0, 3)}
                />
                <YAxis
                  yAxisId="spend"
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis yAxisId="msgs" orientation="right" tick={{ fill: '#888', fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(label: unknown) => getMonthLabel(String(label))}
                  formatter={(value: unknown, name: unknown) => [
                    name === 'Inversión' ? formatCop(Number(value)) : formatNumber(Number(value)),
                    String(name),
                  ]}
                  contentStyle={{
                    background: 'hsl(220,20%,8%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                  }}
                />
                <Area
                  yAxisId="spend"
                  type="monotone"
                  dataKey="Inversión"
                  stroke="hsl(180,100%,50%)"
                  fill="url(#cdpGradSpend)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  yAxisId="msgs"
                  type="monotone"
                  dataKey="Mensajes"
                  stroke="hsl(280,80%,60%)"
                  fill="url(#cdpGradMsgs)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-note">Sin datos de campañas todavía.</p>
          )}
        </div>

        {/* BUG 3 FIX: Pie chart uses objectiveInfo for labels + colors */}
        <div className="card-glass" style={{ padding: '20px 24px' }}>
          <div className="number-label" style={{ marginBottom: 16 }}>
            Mix de campañas — {getMonthLabel(activeMonth)}
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
                    contentStyle={{
                      background: 'hsl(220,20%,8%)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                    }}
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

      {/* ── Campaign Table ── */}
      {campaignsByCampaign.length > 0 && (
        <div className="card-glass" style={{ padding: '20px 24px' }}>
          <div className="number-label" style={{ marginBottom: 16 }}>
            Campañas — {getMonthLabel(activeMonth)}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
                const obj = objectiveInfo(c.objective);
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
          </table>
        </div>
      )}

      {/* ── Year Bar Chart: Ventas vs Inversión ── */}
      {yearBarData.length > 0 && (
        <div className="card-glass" style={{ padding: '20px 24px' }}>
          <div className="number-label" style={{ marginBottom: 16 }}>
            Ventas vs Inversión — {new Date().getFullYear()}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={yearBarData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v: unknown) => getMonthLabel(String(v)).slice(0, 3)}
              />
              <YAxis
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v: number) => `$${(v / 1000000).toFixed(0)}M`}
              />
              <Tooltip
                labelFormatter={(label: unknown) => getMonthLabel(String(label))}
                formatter={(value: unknown, name: unknown) => [
                  formatCop(Number(value)),
                  String(name),
                ]}
                contentStyle={{
                  background: 'hsl(220,20%,8%)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Bar
                dataKey="Inversión"
                fill="rgba(0,255,255,0.25)"
                stroke="hsl(180,100%,50%)"
                strokeWidth={1}
                radius={[3, 3, 0, 0]}
              />
              <Bar dataKey="Ventas" fill="hsl(280,80%,60%)" radius={[3, 3, 0, 0]} />
            </BarChart>
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
