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
import { ArrowLeft } from 'lucide-react';
import { ClientAvatar } from '../components/ClientAvatar';
import { ClientFileModal } from '../components/ClientFileModal';
import { ClientSatisfactionCard } from '../components/ClientSatisfactionCard';
import { HistoricalMonthlyModal } from '../components/HistoricalMonthlyModal';
import { SalesModal } from '../components/SalesModal';
import { MonthlyReport } from '../components/report/MonthlyReport';
import { ClientBillingSummary } from '../components/billing/ClientBillingSummary';
import { ClientDiagnosticTab } from '../components/diagnostics/ClientDiagnosticTab';
import { useAuth } from '../hooks/useAuth';
import { useCampaignSummary } from '../hooks/useData';
import { useClientWorkspace } from '../hooks/useClientWorkspace';
import { aggregateCampaignMetricsByObjective } from '../services/adCampaignMetrics';
import { formatCop, formatNumber } from '../lib/utils';
import { getMonthKey, getMonthLabel } from '../utils/monthLabel';
import { CHART, TOOLTIP_STYLE } from '../lib/chartColors';

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
    reload,
  } = useClientWorkspace(id, 400);

  const [activeTab, setActiveTab] = useState<'resumen' | 'facturacion' | 'diagnostico'>('resumen');

  // Single source: ad_campaign_metrics (1 year of history; wait until client UUID is available)
  const { rows: campaignRows, byMonth: campaignByMonth } = useCampaignSummary(client?.id, 365);

  // Period selector — null = auto-select most recent
  const [selectedPeriod, setSelectedPeriod] = useState<string | 'all' | null>(null);
  const activePeriod = selectedPeriod ?? campaignByMonth[campaignByMonth.length - 1]?.month ?? '';

  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);

  // Rows filtered to active period — solo alimenta el Pie de "Mix de
  // campañas" (Inversión/Mensajes/campaña-por-campaña del mes ya viven en
  // MonthlyReport).
  const periodRows = useMemo(
    () =>
      activePeriod === 'all' || activePeriod === ''
        ? campaignRows
        : campaignRows.filter((r) => r.date.startsWith(activePeriod)),
    [campaignRows, activePeriod],
  );

  const campaignsByObjective = useMemo(
    () => aggregateCampaignMetricsByObjective(periodRows),
    [periodRows],
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

        <div className="portal-header-actions">
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

      {/* Tabs internos — Resumen / Facturación (solo admin) / Diagnóstico.
          En /portal/:id y /cliente/:slug no se muestran: showInternalTools
          ya es false ahí (portalMode), así que el visitante público solo ve
          el contenido de "Resumen" (MonthlyReport + gráficos), nunca
          facturación ni diagnóstico. */}
      {showInternalTools && (
        <div className="portal-period-pills no-print" style={{ padding: '0 24px 16px' }}>
          <button onClick={() => setActiveTab('resumen')} className={`portal-period-pill${activeTab === 'resumen' ? ' active' : ''}`}>
            Resumen
          </button>
          {role === 'admin' && (
            <button onClick={() => setActiveTab('facturacion')} className={`portal-period-pill${activeTab === 'facturacion' ? ' active' : ''}`}>
              Facturación
            </button>
          )}
          <button onClick={() => setActiveTab('diagnostico')} className={`portal-period-pill${activeTab === 'diagnostico' ? ' active' : ''}`}>
            Diagnóstico
          </button>
        </div>
      )}

      {(!showInternalTools || activeTab === 'resumen') && (
        <>
          <MonthlyReport client={client} campaignRows={campaignRows} campaignByMonth={campaignByMonth} sales={sales} />

          {showInternalTools && client && (
            <div style={{ marginTop: 16 }}>
              <ClientSatisfactionCard clientId={client.id} salesByMonth={salesByMonth} />
            </div>
          )}

          {/* ── Charts Row ── */}
          <div className="portal-period-pills" style={{ margin: '16px 0 8px' }}>
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
        </>
      )}

      {showInternalTools && role === 'admin' && activeTab === 'facturacion' && (
        <div style={{ padding: '0 24px' }}>
          <ClientBillingSummary clientId={client.id} />
        </div>
      )}

      {showInternalTools && activeTab === 'diagnostico' && (
        <div style={{ padding: '0 24px' }}>
          <ClientDiagnosticTab
            clientId={client.id}
            clientHasWhatsappApi={client.has_whatsapp_api}
            onWhatsappApiActivated={() => void reload()}
          />
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