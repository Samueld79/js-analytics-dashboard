import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  CircleDollarSign,
  DollarSign,
  Eye,
  MessageSquare,
  Target,
  TrendingUp,
} from 'lucide-react';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { useAuth } from '../hooks/useAuth';
import { useMonthlyOperatingKpis, useAdMetrics } from '../hooks/useData';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import { useSocialMonthlyMetrics } from '../hooks/useSocialMonthlyMetrics';
import { useStrategies } from '../hooks/useStrategies';
import type {
  AdMetric,
  ClientMonthlyOperatingKpi,
  DailySale,
  SocialMonthlyMetric,
  Strategy,
} from '../lib/supabase';
import {
  adDataOriginClass,
  adDataOriginLabel,
  buildMarketingActionSummary,
  buildMonthlySpecialMetricsSummary,
  formatCop,
  formatDate,
  formatNumber,
  formatPct,
  formatRoas,
  resolveMonthlyProfileVisits,
  sumMetrics,
  sumOperatingKpis,
  sumSales,
  summarizeAdDataOrigin,
} from '../lib/utils';
import { getMonthKey, listAvailableMonthKeys } from '../utils/monthLabel';

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
): { start: string; end: string; label: string } {
  const todayStr = new Date().toISOString().slice(0, 10);
  const shift = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  switch (key) {
    case 'today': return { start: todayStr, end: todayStr, label: 'Hoy' };
    case 'yesterday': { const y = shift(-1); return { start: y, end: y, label: 'Ayer' }; }
    case 'last7': return { start: shift(-6), end: todayStr, label: 'Últimos 7 días' };
    case 'last14': return { start: shift(-13), end: todayStr, label: 'Últimos 14 días' };
    case 'last28': return { start: shift(-27), end: todayStr, label: 'Últimos 28 días' };
    case 'last30': return { start: shift(-29), end: todayStr, label: 'Últimos 30 días' };
    case 'thisWeek': {
      const now = new Date();
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return { start: mon.toISOString().slice(0, 10), end: todayStr, label: 'Esta semana' };
    }
    case 'lastWeek': {
      const now = new Date();
      const lastMon = new Date(now);
      lastMon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      return { start: lastMon.toISOString().slice(0, 10), end: lastSun.toISOString().slice(0, 10), label: 'Semana pasada' };
    }
    case 'thisMonth': {
      const now = new Date();
      return { start: `${now.toISOString().slice(0, 7)}-01`, end: todayStr, label: 'Este mes' };
    }
    case 'lastMonth': {
      const now = new Date();
      const firstOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: firstOfPrev.toISOString().slice(0, 10), end: lastOfPrev.toISOString().slice(0, 10), label: 'Mes pasado' };
    }
    case 'all': return { start: '2020-01-01', end: todayStr, label: 'Máximo histórico' };
    case 'custom': {
      const from = customFrom || todayStr;
      const to = customTo || todayStr;
      return { start: from, end: to, label: `${from} → ${to}` };
    }
  }
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
  const { metrics: socialMonthlyMetrics } = useSocialMonthlyMetrics(queryClientId, queryMonths);
  const { strategies } = useStrategies(queryClientId);
  const scopedMetrics = useMemo(
    () =>
      isInternal ? metrics : metrics.filter((metric) => visibleClientIds.has(metric.client_id)),
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
  const scopedSocialMonthlyMetrics = useMemo(
    () =>
      isInternal
        ? socialMonthlyMetrics
        : socialMonthlyMetrics.filter((row) => visibleClientIds.has(row.client_id)),
    [isInternal, socialMonthlyMetrics, visibleClientIds],
  );
  const scopedStrategies = useMemo(
    () =>
      isInternal
        ? strategies
        : strategies.filter((strategy) => visibleClientIds.has(strategy.client_id)),
    [isInternal, strategies, visibleClientIds],
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

  const { start: rangeStart, end: rangeEnd, label: rangeLabel } = getRangeDates(rangeKey, customFrom, customTo);
  const rangeStartMonth = rangeStart.slice(0, 7);
  const rangeEndMonth = rangeEnd.slice(0, 7);
  const activeMonth = rangeEndMonth; // used for buildBudgetSummary compatibility
  const selectedClientName =
    selectedClient === 'all'
      ? (isInternal ? 'Todos los clientes' : visibleClients.length > 0 ? 'Mis empresas' : 'Sin empresa asignada')
      : visibleClients.find((client) => client.id === selectedClient)?.name ?? 'Cliente';

  const monthMetrics = useMemo(
    () => scopedMetrics.filter((m) => m.date >= rangeStart && m.date <= rangeEnd),
    [rangeStart, rangeEnd, scopedMetrics],
  );
  const monthOperatingRows = useMemo(
    () => scopedMonthlyKpis.filter((row) => {
      const m = getMonthKey(row.month);
      return m >= rangeStartMonth && m <= rangeEndMonth;
    }),
    [rangeStartMonth, rangeEndMonth, scopedMonthlyKpis],
  );
  const monthSales = useMemo(
    () => scopedSales.filter((row) => row.date >= rangeStart && row.date <= rangeEnd),
    [rangeStart, rangeEnd, scopedSales],
  );
  const monthSocialMetrics = useMemo(
    () => scopedSocialMonthlyMetrics.filter((row) => {
      const m = getMonthKey(row.month);
      return m >= rangeStartMonth && m <= rangeEndMonth;
    }),
    [rangeStartMonth, rangeEndMonth, scopedSocialMonthlyMetrics],
  );
  const monthStrategies = useMemo(
    () =>
      scopedStrategies.filter((strategy) => {
        const m = getMonthKey(strategy.month ?? '');
        return m >= rangeStartMonth && m <= rangeEndMonth && strategy.status !== 'archived';
      }),
    [rangeStartMonth, rangeEndMonth, scopedStrategies],
  );

  const operatingTotals = monthOperatingRows.length
    ? sumOperatingKpis(monthOperatingRows)
    : buildCombinedMonthTotals(monthMetrics, monthSales);
  const adSourceOrigin = summarizeAdDataOrigin(monthMetrics.map((metric) => metric.source));
  const marketingSummary = buildMarketingActionSummary(monthMetrics);
  const budgetSummary = buildBudgetSummary(monthStrategies, activeMonth);
  const specialSummary = buildMonthlySpecialMetricsSummary(monthSocialMetrics);
  const profileVisitsSummary = buildProfileVisitsSummary({
    selectedClient,
    clients: visibleClients,
    monthMetrics,
    monthSocialMetrics,
  });
  const resultsDistribution = buildResultsDistribution({
    marketingSummary,
    profileVisits: profileVisitsSummary.value,
    specialSummary,
  });
  const averageSalePerRecord =
    monthSales.length > 0 ? operatingTotals.total_sales / monthSales.length : null;
  const costPerConversation =
    marketingSummary.messagingStarted > 0
      ? operatingTotals.spend / marketingSummary.messagingStarted
      : null;
  const estimatedCloseRate =
    marketingSummary.messagingStarted > 0 && monthSales.length > 0
      ? (monthSales.length / marketingSummary.messagingStarted) * 100
      : null;

  const historyMonths = useMemo(
    () =>
      listAvailableMonthKeys([
        ...scopedMonthlyKpis.map((row) => row.month),
        ...scopedMetrics.map((row) => row.date),
        ...scopedSales.map((row) => row.date),
        ...scopedSocialMonthlyMetrics.map((row) => row.month),
        ...scopedStrategies.map((row) => row.month),
      ])
        .slice(0, 6)
        .reverse(),
    [scopedMetrics, scopedMonthlyKpis, scopedSales, scopedSocialMonthlyMetrics, scopedStrategies],
  );
  const historySalesPoints = historyMonths.map((monthKey) => ({
    month: monthKey,
    value: getMonthOperatingTotals({
      monthKey,
      monthlyKpis: scopedMonthlyKpis,
      metrics: scopedMetrics,
      sales: scopedSales,
    }).total_sales,
  }));
  const historyRoasPoints = historyMonths.map((monthKey) => ({
    month: monthKey,
    value: getMonthOperatingTotals({
      monthKey,
      monthlyKpis: scopedMonthlyKpis,
      metrics: scopedMetrics,
      sales: scopedSales,
    }).real_roas,
  }));
  const historyConversationPoints = historyMonths.map((monthKey) => ({
    month: monthKey,
    value: buildMarketingActionSummary(
      scopedMetrics.filter((row) => getMonthKey(row.date) === monthKey),
    ).messagingStarted,
  }));
  const historyProfileVisitPoints = historyMonths.map((monthKey) => ({
    month: monthKey,
    value: buildProfileVisitsSummary({
      selectedClient,
      clients: visibleClients,
      monthMetrics: scopedMetrics.filter((row) => getMonthKey(row.date) === monthKey),
      monthSocialMetrics: scopedSocialMonthlyMetrics.filter((row) => getMonthKey(row.month) === monthKey),
    }).value,
  }));
  const dailySalesRows = buildDailySalesRows(monthSales);

  const clientComparison = useMemo(
    () =>
      visibleClients
        .map((client) => {
          const clientMonthMetrics = monthMetrics.filter((row) => row.client_id === client.id);
          const clientMonthSales = monthSales.filter((row) => row.client_id === client.id);
          const clientMonthRows = monthOperatingRows.filter((row) => row.client_id === client.id);
          const clientBudget = buildBudgetSummary(
            monthStrategies.filter((strategy) => strategy.client_id === client.id),
            activeMonth,
          );
          const profileVisits = buildProfileVisitsSummary({
            selectedClient: client.id,
            clients: visibleClients,
            monthMetrics: clientMonthMetrics,
            monthSocialMetrics: monthSocialMetrics.filter((row) => row.client_id === client.id),
          });
          const totals = clientMonthRows.length
            ? sumOperatingKpis(clientMonthRows)
            : buildCombinedMonthTotals(clientMonthMetrics, clientMonthSales);

          return {
            client,
            totals,
            sourceOrigin: summarizeAdDataOrigin(clientMonthMetrics.map((row) => row.source)),
            conversations: buildMarketingActionSummary(clientMonthMetrics).messagingStarted,
            profileVisits: profileVisits.value,
            budget: clientBudget.totalBudget,
          };
        })
        .filter(
          (row) =>
            row.totals.spend > 0 ||
            row.totals.total_sales > 0 ||
            row.conversations > 0 ||
            row.profileVisits != null,
        )
        .sort((left, right) => {
          if (right.totals.real_roas !== left.totals.real_roas) {
            return right.totals.real_roas - left.totals.real_roas;
          }
          if (right.totals.total_sales !== left.totals.total_sales) {
            return right.totals.total_sales - left.totals.total_sales;
          }
          return right.totals.spend - left.totals.spend;
        }),
    [activeMonth, monthMetrics, monthOperatingRows, monthSales, monthSocialMetrics, monthStrategies, visibleClients],
  );
  const activeClientsThisMonth = clientComparison.length;
  const comparisonLeaderBySales =
    [...clientComparison].sort((left, right) => {
      if (right.totals.total_sales !== left.totals.total_sales) {
        return right.totals.total_sales - left.totals.total_sales;
      }
      return right.totals.real_roas - left.totals.real_roas;
    })[0] ?? null;
  const comparisonLeaderByRoas =
    [...clientComparison]
      .filter((row) => row.totals.spend > 0 && row.totals.total_sales > 0)
      .sort((left, right) => {
        if (right.totals.real_roas !== left.totals.real_roas) {
          return right.totals.real_roas - left.totals.real_roas;
        }
        return right.totals.total_sales - left.totals.total_sales;
      })[0] ?? null;

  const showBudgetExecution = budgetSummary.totalBudget != null && budgetSummary.totalBudget > 0;
  const budgetExecution =
    showBudgetExecution && operatingTotals.spend > 0
      ? (operatingTotals.spend / (budgetSummary.totalBudget ?? 1)) * 100
      : null;
  const hasRealMetrics =
    operatingTotals.spend > 0 ||
    operatingTotals.total_sales > 0 ||
    marketingSummary.messagingStarted > 0 ||
    profileVisitsSummary.value != null ||
    budgetSummary.totalBudget != null ||
    specialSummary.rowsWithData > 0;
  const primaryMetricCards = [
    {
      icon: <DollarSign size={18} />,
      label: 'Inversión del período',
      value: formatCop(operatingTotals.spend),
      note: 'Inversión real del período seleccionado',
    },
    {
      icon: <MessageSquare size={18} />,
      label: 'Conversaciones',
      value: formatNumber(marketingSummary.messagingStarted),
      note: 'Mensajes / conversaciones detectadas en Ads',
    },
    {
      icon: <Target size={18} />,
      label: 'Costo por conversación',
      value: costPerConversation != null ? formatCop(costPerConversation) : 'Sin dato',
      note:
        costPerConversation != null
          ? 'Inversión / conversaciones detectadas'
          : 'Requiere conversaciones reales en el mes',
      tone: costPerConversation != null ? undefined : ('muted' as const),
    },
    ...(profileVisitsSummary.value != null
      ? [
          {
            icon: <Eye size={18} />,
            label: 'Visitas al perfil',
            value: formatNumber(profileVisitsSummary.value),
            note: profileVisitsSummary.sourceLabel,
          },
        ]
      : []),
    {
      icon: <TrendingUp size={18} />,
      label: 'Ventas manuales reportadas',
      value: formatCop(operatingTotals.total_sales),
      note: `${monthSales.length} registro(s) cargados manualmente`,
    },
    {
      icon: <CircleDollarSign size={18} />,
      label: 'Ticket promedio',
      value: averageSalePerRecord != null ? formatCop(averageSalePerRecord) : 'Sin dato',
      note:
        averageSalePerRecord != null
          ? 'Ventas reales / registros del mes'
          : 'Requiere ventas manuales reportadas',
      tone: averageSalePerRecord != null ? undefined : ('muted' as const),
    },
    {
      icon: <BarChart3 size={18} />,
      label: 'Tasa de cierre estimada',
      value: estimatedCloseRate != null ? formatPct(estimatedCloseRate) : 'Sin dato',
      note:
        estimatedCloseRate != null
          ? 'Registros de venta / conversaciones'
          : 'Requiere ventas reportadas y conversaciones',
      tone: estimatedCloseRate != null ? undefined : ('muted' as const),
    },
  ];
  const reportCoverage = [
    operatingTotals.spend > 0 || monthMetrics.length > 0
      ? {
      label: 'Ads del mes',
      value: adDataOriginLabel(adSourceOrigin),
      note:
        operatingTotals.spend > 0
          ? `${formatCop(operatingTotals.spend)} invertidos en el mes visible`
          : 'No hay inversión registrada para este mes',
      className: adDataOriginClass(adSourceOrigin),
    }
      : null,
    budgetSummary.totalBudget != null || monthStrategies.length > 0
      ? {
      label: 'Presupuesto mensual',
      value:
        budgetSummary.totalBudget != null ? formatCop(budgetSummary.totalBudget) : 'Sin presupuesto',
      note: budgetSummary.sourceLabel,
      className: budgetSummary.totalBudget != null ? 'source-manual' : 'source-unknown',
    }
      : null,
    monthSales.length > 0 || operatingTotals.total_sales > 0
      ? {
      label: 'Ventas reportadas',
      value:
        monthSales.length > 0
          ? `${monthSales.length} registro(s)`
          : operatingTotals.total_sales > 0
            ? 'Consolidado mensual'
            : 'Sin ventas reportadas',
      note:
        operatingTotals.total_sales > 0
          ? `${formatCop(operatingTotals.total_sales)} en ventas reales`
          : 'ROAS operativo usa ventas reales reportadas',
      className: operatingTotals.total_sales > 0 ? 'source-automatic' : 'source-unknown',
    }
      : null,
    profileVisitsSummary.value != null
      ? {
      label: 'Visitas al perfil',
      value: formatNumber(profileVisitsSummary.value),
      note: profileVisitsSummary.sourceLabel,
      className:
        profileVisitsSummary.sourceOrigin === 'manual'
          ? 'source-manual'
          : profileVisitsSummary.sourceOrigin === 'automatic'
            ? 'source-automatic'
            : 'source-unknown',
    }
      : null,
    specialSummary.rowsWithData > 0
      ? {
      label: 'Señales especiales',
      value: `${formatNumber(specialSummary.whatsappClicks + specialSummary.linkClicks)} clicks`,
      note:
        `${formatNumber(specialSummary.newCustomersReported)} nuevos clientes reportados`,
      className: 'source-manual',
    }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    note: string;
    className: string;
  }>;

  return (
    <div className="page-content reporting-page campaign-dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BarChart3
              size={20}
              style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }}
            />
            Desempeño mensual de campañas
          </h1>
          <p className="page-subtitle">
            Reporte mensual para revisar pauta a WhatsApp, ventas manuales y señales observadas del mes seleccionado.
          </p>
        </div>
        {selectedClient !== 'all' && (
          <Link to={`/clients/${selectedClient}`} className="btn-secondary">
            Ir al cliente
          </Link>
        )}
      </div>

      <div className="card section-block period-toolbar-card">
        <div className="report-filter-grid">
          {canSelectAllClients ? (
            <label className="form-field">
              <span className="form-label">Cliente</span>
              <select
                className="form-input"
                value={selectedClient}
                onChange={(event) => setSelectedClient(event.target.value)}
              >
                <option value="all">{isInternal ? 'Todos los clientes' : 'Mis empresas'}</option>
                {visibleClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="card section-block metric-box">
              <span className="metric-box-label">Cliente</span>
              <span className="metric-box-value">
                {visibleClients[0]?.name ?? 'Sin empresa asignada'}
              </span>
            </div>
          )}
          <div className="form-field">
            <span className="form-label">Período</span>
            <div className="filter-row" style={{ flexWrap: 'wrap', gap: 6 }}>
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
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <input
                  type="date"
                  className="form-input"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span style={{ color: 'var(--gs-text-soft)' }}>→</span>
                <input
                  type="date"
                  className="form-input"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        <div className="period-chip-row">
          <span className="meta-chip">{rangeLabel}</span>
          <span className="meta-chip">{selectedClientName}</span>
          <span className={`meta-chip ${adDataOriginClass(adSourceOrigin)}`}>
            {adDataOriginLabel(adSourceOrigin)}
          </span>
          <span className="meta-chip">ROAS operativo = ventas manuales / inversión</span>
        </div>
      </div>

      {!hasRealMetrics ? (
        <div className="card section-block">
          <p className="empty-note">
            No hay data suficiente para el mes seleccionado. Ajusta cliente/mes o espera la próxima
            sincronización.
          </p>
        </div>
      ) : (
        <>
          <div className="report-kpi-grid report-kpi-primary-grid">
            {primaryMetricCards.map((card) => (
              <ReportKpiCard
                key={card.label}
                icon={card.icon}
                label={card.label}
                value={card.value}
                note={card.note}
                tone={card.tone}
              />
            ))}
          </div>

          <div className="report-main-grid report-overview-grid">
            <section className="card section-block report-overview-card">
              <div className="section-heading">
                <h2>Lectura comercial del mes</h2>
              </div>
              <p className="source-note">
                Este reporte separa claramente Meta Ads, ventas manuales y métricas operativas del
                mes visible.
              </p>
              {reportCoverage.length > 0 && (
                <div className="report-coverage-list">
                  {reportCoverage.map((item) => (
                    <div key={item.label} className="report-coverage-item">
                      <div className="report-coverage-main">
                        <strong>{item.label}</strong>
                        <span>{item.note}</span>
                      </div>
                      <span className={`meta-chip ${item.className}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="report-inline-summary">
                <MetricBoxInline
                  label="Presupuesto mensual"
                  value={
                    budgetSummary.totalBudget != null
                      ? formatCop(budgetSummary.totalBudget)
                      : 'Sin presupuesto'
                  }
                  muted={budgetSummary.totalBudget == null}
                />
                <MetricBoxInline
                  label="% de ejecución"
                  value={budgetExecution != null ? formatPct(budgetExecution) : 'Sin dato'}
                  muted={budgetExecution == null}
                />
                <MetricBoxInline
                  label="ROAS operativo manual"
                  value={formatRoas(operatingTotals.real_roas)}
                />
                <MetricBoxInline
                  label="Clicks WhatsApp + link"
                  value={formatNumber(specialSummary.whatsappClicks + specialSummary.linkClicks)}
                  muted={specialSummary.rowsWithData === 0}
                />
                <MetricBoxInline
                  label="Nuevos clientes reportados"
                  value={formatNumber(specialSummary.newCustomersReported)}
                  muted={specialSummary.rowsWithData === 0}
                />
                <MetricBoxInline
                  label="Video / thruplay"
                  value={
                    marketingSummary.thruplays != null
                      ? formatNumber(marketingSummary.thruplays)
                      : marketingSummary.videoViews != null
                        ? formatNumber(marketingSummary.videoViews)
                        : 'Sin dato'
                  }
                  muted={
                    marketingSummary.thruplays == null && marketingSummary.videoViews == null
                  }
                />
              </div>
            </section>

            <section className="card section-block">
              <div className="section-heading">
                <h2>Mix del mes</h2>
              </div>
              <p className="source-note">
                Distribución de resultados observados del mes visible. No representa gasto por
                objetivo; solo resultados que hoy sí tienen fuente real.
              </p>
              <div className="report-distribution-grid">
                <DistributionDonutCard
                  title="Mix de resultados observados"
                  totalLabel="Resultados"
                  items={resultsDistribution}
                  emptyMessage="Todavía no hay suficientes resultados clasificados para este mes."
                />
              </div>
            </section>
          </div>

          <div className="report-history-grid">
            <BarChart
              title="Histórico de ventas por mes"
              points={historySalesPoints}
              emptyMessage="Aún no hay histórico mensual de ventas suficiente."
              valueFormatter={(value) => formatCop(value)}
            />
            <LineChart
              title="Histórico de ROAS operativo por mes"
              points={historyRoasPoints}
              emptyMessage="Aún no hay histórico mensual suficiente de ventas / inversión."
              valueFormatter={(value) => formatRoas(value)}
            />
          </div>

          <div className="report-objective-section card section-block">
            <div className="section-heading">
              <h2>Resultados observados del mes</h2>
            </div>
            <p className="source-note">
              Primero se muestran señales con fuente real. Lo que todavía no tiene fuente separada baja al pie del reporte.
            </p>
            <div className="report-objective-grid">
              <ObjectiveMetricCard
                title="Conversaciones del mes"
                value={formatNumber(marketingSummary.messagingStarted)}
                note="Mensajes / conversaciones registradas en Ads"
              />
              <ObjectiveMetricCard
                title="Visitas al perfil del mes"
                value={
                  profileVisitsSummary.value != null
                    ? formatNumber(profileVisitsSummary.value)
                    : 'Sin dato'
                }
                note={profileVisitsSummary.sourceLabel}
                pending={profileVisitsSummary.value == null}
              />
              <ObjectiveMetricCard
                title="Video / thruplay"
                value={
                  marketingSummary.thruplays != null
                    ? formatNumber(marketingSummary.thruplays)
                    : marketingSummary.videoViews != null
                      ? formatNumber(marketingSummary.videoViews)
                      : 'Sin dato'
                }
                note={
                  marketingSummary.thruplays != null
                    ? 'Thruplays detectados en raw_actions'
                    : marketingSummary.videoViews != null
                      ? 'Video views detectados en raw_actions'
                      : 'La fuente actual no trae señal útil de video este mes'
                }
                pending={marketingSummary.thruplays == null && marketingSummary.videoViews == null}
              />
              <ObjectiveMetricCard
                title="Clicks WhatsApp + link"
                value={formatNumber(specialSummary.whatsappClicks + specialSummary.linkClicks)}
                note="Cierres especiales mensuales manuales"
                pending={specialSummary.rowsWithData === 0}
              />
            </div>
            <div className="report-history-grid objective-history-grid">
              <BarChart
                title="Conversaciones por mes"
                points={historyConversationPoints}
                emptyMessage="No hay suficiente histórico de conversaciones."
                valueFormatter={(value) => formatNumber(value)}
              />
              <LineChart
                title="Visitas al perfil por mes"
                points={historyProfileVisitPoints}
                emptyMessage="No hay suficiente histórico de visitas al perfil."
                valueFormatter={(value) => formatNumber(value)}
              />
            </div>
          </div>

          <div className="report-main-grid">
            <section className="card section-block">
              <div className="section-heading">
                <h2>Ventas del mes</h2>
              </div>
              <p className="source-note">
                Ventas manuales reportadas por día. Esta vista no asume ventas web desde Meta.
              </p>
              <div className="report-sales-grid">
                <MetricBoxInline label="Ventas del mes" value={formatCop(operatingTotals.total_sales)} />
                <MetricBoxInline label="Registros del mes" value={String(monthSales.length)} />
                <MetricBoxInline
                  label="Venta promedio por registro"
                  value={averageSalePerRecord != null ? formatCop(averageSalePerRecord) : 'Sin dato'}
                  muted={averageSalePerRecord == null}
                />
              </div>
              <div className="sales-day-list">
                {dailySalesRows.length === 0 ? (
                  <p className="empty-note">No hay ventas reportadas por día en este mes.</p>
                ) : (
                  dailySalesRows.map((row) => (
                    <div key={row.date} className="sales-day-row">
                      <div className="sales-day-copy">
                        <strong>{formatDate(row.date)}</strong>
                        <span>{row.records} registro(s)</span>
                      </div>
                      <div className="sales-day-bar">
                        <div className="sales-day-fill" style={{ width: `${row.intensity}%` }} />
                      </div>
                      <span className="sales-day-value">{formatCop(row.total)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {selectedClient === 'all' ? (
              <section className="card section-block">
                <div className="section-heading">
                  <h2>Comparativa por cliente</h2>
                </div>
                <p className="source-note">
                  Comparativa agregada del mes visible para detectar líderes de ventas, eficiencia
                  operativa y volumen comercial.
                </p>
                <div className="report-inline-summary comparison-summary-grid">
                  <MetricBoxInline label="Clientes con data" value={String(activeClientsThisMonth)} muted={activeClientsThisMonth === 0} />
                  <MetricBoxInline
                    label="Líder en ventas"
                    value={
                      comparisonLeaderBySales
                        ? `${comparisonLeaderBySales.client.name} · ${formatCop(comparisonLeaderBySales.totals.total_sales)}`
                        : 'Sin líder'
                    }
                    muted={!comparisonLeaderBySales}
                  />
                  <MetricBoxInline
                    label="Mejor ROAS operativo"
                    value={
                      comparisonLeaderByRoas
                        ? `${comparisonLeaderByRoas.client.name} · ${formatRoas(comparisonLeaderByRoas.totals.real_roas)}`
                        : 'Sin líder'
                    }
                    muted={!comparisonLeaderByRoas}
                  />
                </div>
                {clientComparison.length === 0 ? (
                  <p className="empty-note">No hay suficiente data para comparar clientes este mes.</p>
                ) : (
                  <div className="table-wrap responsive-card-table">
                    <table className="metrics-summary-table">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Fuente</th>
                          <th className="num-col">Presupuesto</th>
                          <th className="num-col">Inversión</th>
                          <th className="num-col">Ventas</th>
                          <th className="num-col">ROAS operativo</th>
                          <th className="num-col">Conversaciones</th>
                          <th className="num-col">Perfil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientComparison.map((row) => (
                          <tr key={row.client.id}>
                            <td data-label="Cliente">
                              <div className="table-primary-cell">
                                <strong>{row.client.name}</strong>
                                <span className="table-secondary-note">
                                  {row.client.niche ?? 'Sin nicho'}
                                </span>
                              </div>
                            </td>
                            <td data-label="Fuente">
                              <span className={`meta-chip ${adDataOriginClass(row.sourceOrigin)}`}>
                                {adDataOriginLabel(row.sourceOrigin)}
                              </span>
                            </td>
                            <td className="num-col" data-label="Presupuesto">
                              {row.budget != null ? formatCop(row.budget) : '—'}
                            </td>
                            <td className="num-col" data-label="Inversión">
                              {formatCop(row.totals.spend)}
                            </td>
                            <td className="num-col" data-label="Ventas">
                              {formatCop(row.totals.total_sales)}
                            </td>
                            <td className="num-col" data-label="ROAS operativo">
                              <span className={roasClass(row.totals.real_roas)}>
                                {formatRoas(row.totals.real_roas)}
                              </span>
                            </td>
                            <td className="num-col" data-label="Conversaciones">
                              {formatNumber(row.conversations)}
                            </td>
                            <td className="num-col" data-label="Perfil">
                              {row.profileVisits != null ? formatNumber(row.profileVisits) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : (
              <section className="card section-block">
                <div className="section-heading">
                  <h2>Detalle de Ads del mes</h2>
                </div>
                <p className="source-note">
                  Filas diarias o snapshots del cliente seleccionado en el mes visible.
                </p>
                {monthMetrics.length === 0 ? (
                  <p className="empty-note">No hay detalle Ads para este cliente y mes.</p>
                ) : (
                  <div className="table-wrap responsive-card-table">
                    <table className="metrics-detail-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Fuente</th>
                          <th className="num-col">Inversión</th>
                          <th className="num-col">Conversaciones</th>
                          <th className="num-col">Leads</th>
                          <th className="num-col">Clicks</th>
                          <th className="num-col">CTR</th>
                          <th className="num-col">CPC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...monthMetrics]
                          .sort((left, right) => right.date.localeCompare(left.date))
                          .map((row) => {
                            const rowOrigin = summarizeAdDataOrigin([row.source]);
                            return (
                              <tr key={row.id}>
                                <td data-label="Fecha">{row.date}</td>
                                <td data-label="Fuente">
                                  <span className={`meta-chip ${adDataOriginClass(rowOrigin)}`}>
                                    {adDataOriginLabel(rowOrigin)}
                                  </span>
                                </td>
                                <td className="num-col" data-label="Inversión">
                                  {formatCop(row.spend)}
                                </td>
                                <td className="num-col" data-label="Conversaciones">
                                  {formatNumber(row.messages)}
                                </td>
                                <td className="num-col" data-label="Leads">
                                  {formatNumber(row.leads)}
                                </td>
                                <td className="num-col" data-label="Clicks">
                                  {formatNumber(row.clicks)}
                                </td>
                                <td className="num-col" data-label="CTR">
                                  {formatPct(row.ctr)}
                                </td>
                                <td className="num-col" data-label="CPC">
                                  {formatCop(row.cpc)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
        </>
      )}
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

function buildBudgetSummary(strategies: Strategy[], monthKey: string) {
  const rankedByClient = new Map<string, Strategy>();
  const matchingStrategies = strategies.filter(
    (strategy) => getMonthKey(strategy.month ?? '') === monthKey && strategy.status !== 'archived',
  );

  [...matchingStrategies]
    .filter((strategy) => strategy.monthly_budget != null)
    .sort(sortStrategiesForBudget)
    .forEach((strategy) => {
      if (!rankedByClient.has(strategy.client_id)) {
        rankedByClient.set(strategy.client_id, strategy);
      }
    });

  const budgetRows = [...rankedByClient.values()];

  if (budgetRows.length === 0) {
    return {
      totalBudget: null as number | null,
      sourceLabel:
        matchingStrategies.length > 0
          ? 'Hay estrategia del mes, pero sin presupuesto mensual cargado.'
          : 'No hay estrategia vigente del mes para tomar presupuesto.',
    };
  }

  return {
    totalBudget: budgetRows.reduce((total, strategy) => total + (strategy.monthly_budget ?? 0), 0),
    sourceLabel:
      budgetRows.length === 1
        ? 'Presupuesto tomado de la estrategia vigente más confiable del mes'
        : `Presupuesto consolidado desde ${budgetRows.length} estrategia(s) vigentes del mes`,
  };
}

function sortStrategiesForBudget(left: Strategy, right: Strategy) {
  const statusDiff = getStrategyPriority(right.status) - getStrategyPriority(left.status);
  if (statusDiff !== 0) return statusDiff;

  const versionDiff =
    (right.latest_version ?? right.version ?? 0) - (left.latest_version ?? left.version ?? 0);
  if (versionDiff !== 0) return versionDiff;

  return right.updated_at.localeCompare(left.updated_at);
}

function getStrategyPriority(status: Strategy['status']) {
  switch (status) {
    case 'approved':
      return 5;
    case 'reviewed':
      return 4;
    case 'mounted':
      return 3;
    case 'pending':
      return 2;
    case 'draft':
      return 1;
    default:
      return 0;
  }
}

function buildProfileVisitsSummary(params: {
  selectedClient: string;
  clients: Array<{ id: string }>;
  monthMetrics: AdMetric[];
  monthSocialMetrics: SocialMonthlyMetric[];
}) {
  if (params.selectedClient !== 'all') {
    return resolveMonthlyProfileVisits({
      socialMetric:
        params.monthSocialMetrics.find((row) => row.client_id === params.selectedClient) ?? null,
      adMetrics: params.monthMetrics,
    });
  }

  const clientIds = new Set<string>();
  params.clients.forEach((client) => clientIds.add(client.id));
  params.monthMetrics.forEach((metric) => clientIds.add(metric.client_id));
  params.monthSocialMetrics.forEach((metric) => clientIds.add(metric.client_id));

  let total = 0;
  let hasValue = false;
  let hasManual = false;
  let hasAutomatic = false;

  [...clientIds].forEach((clientId) => {
    const resolved = resolveMonthlyProfileVisits({
      socialMetric: params.monthSocialMetrics.find((row) => row.client_id === clientId) ?? null,
      adMetrics: params.monthMetrics.filter((row) => row.client_id === clientId),
    });

    if (resolved.value != null) {
      total += resolved.value;
      hasValue = true;
    }
    if (resolved.sourceOrigin === 'manual') hasManual = true;
    if (resolved.sourceOrigin === 'automatic') hasAutomatic = true;
  });

  return {
    value: hasValue ? total : null,
    sourceOrigin:
      hasManual && hasAutomatic
        ? 'mixed'
        : hasManual
          ? 'manual'
          : hasAutomatic
            ? 'automatic'
            : 'unknown',
    sourceLabel:
      hasManual && hasAutomatic
        ? 'Manual + Ads'
        : hasManual
          ? 'Fuente manual mensual'
          : hasAutomatic
            ? 'Sync automático'
            : 'Sin dato',
  };
}

function buildResultsDistribution(params: {
  marketingSummary: ReturnType<typeof buildMarketingActionSummary>;
  profileVisits: number | null;
  specialSummary: ReturnType<typeof buildMonthlySpecialMetricsSummary>;
}) {
  return [
    {
      label: 'Conversaciones',
      value: params.marketingSummary.messagingStarted,
      color: '#75f0ff',
    },
    {
      label: 'Visitas perfil',
      value: params.profileVisits ?? 0,
      color: '#9974ff',
    },
    {
      label: 'Video / thruplay',
      value: params.marketingSummary.thruplays ?? params.marketingSummary.videoViews ?? 0,
      color: '#66ffd4',
    },
    {
      label: 'WhatsApp + link',
      value: params.specialSummary.whatsappClicks + params.specialSummary.linkClicks,
      color: '#f5c769',
    },
  ].filter((item) => item.value > 0);
}

function getMonthOperatingTotals(params: {
  monthKey: string;
  monthlyKpis: ClientMonthlyOperatingKpi[];
  metrics: AdMetric[];
  sales: DailySale[];
}) {
  const monthRows = params.monthlyKpis.filter((row) => getMonthKey(row.month) === params.monthKey);
  if (monthRows.length > 0) return sumOperatingKpis(monthRows);

  return buildCombinedMonthTotals(
    params.metrics.filter((row) => getMonthKey(row.date) === params.monthKey),
    params.sales.filter((row) => getMonthKey(row.date) === params.monthKey),
  );
}

function buildDailySalesRows(sales: DailySale[]) {
  const grouped = new Map<string, { total: number; records: number }>();

  sales.forEach((sale) => {
    const current = grouped.get(sale.date) ?? { total: 0, records: 0 };
    current.total += sale.total_sales;
    current.records += 1;
    grouped.set(sale.date, current);
  });

  const rows = [...grouped.entries()]
    .map(([date, value]) => ({
      date,
      total: value.total,
      records: value.records,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const maxTotal = Math.max(...rows.map((row) => row.total), 1);

  return rows.map((row) => ({
    ...row,
    intensity: Math.max((row.total / maxTotal) * 100, 6),
  }));
}

function roasClass(roas: number): string {
  if (roas >= 3) return 'roas-pill roas-good';
  if (roas >= 2) return 'roas-pill roas-ok';
  return 'roas-pill roas-low';
}

function ReportKpiCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: 'muted';
}) {
  return (
    <div className={`card section-block report-kpi-card ${tone ? `report-kpi-${tone}` : ''}`}>
      <div className="report-kpi-icon">{icon}</div>
      <span className="report-kpi-label">{label}</span>
      <strong className="report-kpi-value">{value}</strong>
      <span className="report-kpi-note">{note}</span>
    </div>
  );
}

function DistributionDonutCard({
  title,
  totalLabel,
  items,
  emptyMessage,
}: {
  title: string;
  totalLabel: string;
  items: Array<{ label: string; value: number; color: string }>;
  emptyMessage: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return (
      <div className="card section-block distribution-card">
        <div className="section-heading">
          <h2>{title}</h2>
        </div>
        <p className="empty-note">{emptyMessage}</p>
      </div>
    );
  }

  let current = 0;
  const gradient = items
    .map((item) => {
      const start = current;
      const slice = (item.value / total) * 100;
      const end = current + slice;
      current = end;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(', ');

  return (
    <div className="card section-block distribution-card">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="distribution-layout">
        <div
          className="distribution-donut"
          style={{ background: `conic-gradient(${gradient})` }}
          aria-hidden="true"
        >
          <div className="distribution-donut-core">
            <span>{totalLabel}</span>
            <strong>{formatNumber(total)}</strong>
          </div>
        </div>
        <div className="distribution-legend">
          {items.map((item) => {
            const share = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={item.label} className="distribution-legend-row">
                <div className="distribution-legend-copy">
                  <span
                    className="distribution-legend-dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <strong>{item.label}</strong>
                </div>
                <div className="distribution-legend-stats">
                  <span className="distribution-legend-value">{formatNumber(item.value)}</span>
                  <span className="distribution-legend-share">{share.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ObjectiveMetricCard({
  title,
  value,
  note,
  pending,
}: {
  title: string;
  value: string;
  note: string;
  pending?: boolean;
}) {
  return (
    <div className={`card section-block objective-metric-card ${pending ? 'is-pending' : ''}`}>
      <span className="report-kpi-label">{title}</span>
      <strong className="report-kpi-value">{value}</strong>
      <span className="report-kpi-note">{note}</span>
    </div>
  );
}

function MetricBoxInline({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`metric-box report-inline-metric ${muted ? 'is-muted' : ''}`}>
      <span className="metric-box-label">{label}</span>
      <span className="metric-box-value">{value}</span>
    </div>
  );
}
