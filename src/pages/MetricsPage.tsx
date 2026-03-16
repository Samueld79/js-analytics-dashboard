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
import { MonthSelector } from '../components/MonthSelector';
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
import { getMonthKey, getMonthLabel, listAvailableMonthKeys } from '../utils/monthLabel';

export function MetricsPage() {
  const { clients } = useClients();
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const selectedClientId = selectedClient === 'all' ? undefined : selectedClient;

  const { metrics } = useAdMetrics(selectedClientId, 450);
  const { monthlyKpis } = useMonthlyOperatingKpis(selectedClientId, 11);
  const { sales } = useDailySales({ clientId: selectedClientId, days: 450 });
  const { metrics: socialMonthlyMetrics } = useSocialMonthlyMetrics(selectedClientId, 12);
  const { strategies } = useStrategies(selectedClientId);

  const availableMonths = useMemo(
    () =>
      listAvailableMonthKeys([
        ...monthlyKpis.map((row) => row.month),
        ...metrics.map((row) => row.date),
        ...sales.map((row) => row.date),
        ...socialMonthlyMetrics.map((row) => row.month),
        ...strategies.map((row) => row.month),
      ]),
    [metrics, monthlyKpis, sales, socialMonthlyMetrics, strategies],
  );
  const fallbackMonth = availableMonths[0] ?? new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (!selectedMonth) {
      setSelectedMonth(fallbackMonth);
      return;
    }

    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, fallbackMonth, selectedMonth]);

  const activeMonth = selectedMonth || fallbackMonth;
  const activeMonthLabel = getMonthLabel(activeMonth);
  const selectedClientName =
    selectedClient === 'all'
      ? 'Todos los clientes'
      : clients.find((client) => client.id === selectedClient)?.name ?? 'Cliente';

  const monthMetrics = useMemo(
    () => metrics.filter((metric) => getMonthKey(metric.date) === activeMonth),
    [activeMonth, metrics],
  );
  const monthOperatingRows = useMemo(
    () => monthlyKpis.filter((row) => getMonthKey(row.month) === activeMonth),
    [activeMonth, monthlyKpis],
  );
  const monthSales = useMemo(
    () => sales.filter((row) => getMonthKey(row.date) === activeMonth),
    [activeMonth, sales],
  );
  const monthSocialMetrics = useMemo(
    () => socialMonthlyMetrics.filter((row) => getMonthKey(row.month) === activeMonth),
    [activeMonth, socialMonthlyMetrics],
  );
  const monthStrategies = useMemo(
    () =>
      strategies.filter(
        (strategy) =>
          getMonthKey(strategy.month ?? '') === activeMonth && strategy.status !== 'archived',
      ),
    [activeMonth, strategies],
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
    clients,
    monthMetrics,
    monthSocialMetrics,
  });
  const resultsDistribution = buildResultsDistribution({
    marketingSummary,
    profileVisits: profileVisitsSummary.value,
    specialSummary,
  });
  const historyMonths = useMemo(
    () =>
      listAvailableMonthKeys([
        ...monthlyKpis.map((row) => row.month),
        ...sales.map((row) => row.date),
        ...socialMonthlyMetrics.map((row) => row.month),
        ...strategies.map((row) => row.month),
      ])
        .slice(0, 6)
        .reverse(),
    [monthlyKpis, sales, socialMonthlyMetrics, strategies],
  );
  const historySalesPoints = historyMonths.map((monthKey) => ({
    month: monthKey,
    value: getMonthOperatingTotals({
      monthKey,
      monthlyKpis,
      sales,
    }).total_sales,
  }));
  const historyRoasPoints = historyMonths.map((monthKey) => ({
    month: monthKey,
    value: getMonthOperatingTotals({
      monthKey,
      monthlyKpis,
      sales,
    }).real_roas,
  }));
  const historyConversationPoints = historyMonths.map((monthKey) => ({
    month: monthKey,
    value: buildMarketingActionSummary(
      metrics.filter((row) => getMonthKey(row.date) === monthKey),
    ).messagingStarted,
  }));
  const historyProfileVisitPoints = historyMonths.map((monthKey) => ({
    month: monthKey,
    value: buildProfileVisitsSummary({
      selectedClient,
      clients,
      monthMetrics: metrics.filter((row) => getMonthKey(row.date) === monthKey),
      monthSocialMetrics: socialMonthlyMetrics.filter((row) => getMonthKey(row.month) === monthKey),
    }).value,
  }));
  const dailySalesRows = buildDailySalesRows(monthSales);
  const clientComparison = useMemo(
    () =>
      clients
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
            clients,
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
          return right.totals.total_sales - left.totals.total_sales;
        }),
    [activeMonth, clients, monthMetrics, monthOperatingRows, monthSales, monthSocialMetrics, monthStrategies],
  );

  const showBudgetExecution = budgetSummary.totalBudget != null && budgetSummary.totalBudget > 0;
  const budgetExecution =
    showBudgetExecution && operatingTotals.spend > 0
      ? (operatingTotals.spend / (budgetSummary.totalBudget ?? 1)) * 100
      : null;
  const hasRealMetrics =
    operatingTotals.spend > 0 ||
    operatingTotals.total_sales > 0 ||
    marketingSummary.messagingStarted > 0 ||
    profileVisitsSummary.value != null;
  const pendingMetrics = buildPendingMetrics({
    budgetExecution,
    hasRecognitionData: false,
    hasEngagementData: false,
    hasBudgetDistribution: false,
    hasProfileVisitCost: false,
    hasConversationCost: false,
  });

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
            Reporte ejecutivo del mes seleccionado con Ads, ventas y cierres manuales reales.
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
          <label className="form-field">
            <span className="form-label">Cliente</span>
            <select
              className="form-input"
              value={selectedClient}
              onChange={(event) => setSelectedClient(event.target.value)}
            >
              <option value="all">Todos los clientes</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <MonthSelector
            label="Mes visible"
            value={activeMonth}
            options={availableMonths.length > 0 ? availableMonths : [fallbackMonth]}
            helper="Se listan meses con datos reales en Ads, ventas, estrategias o cierres mensuales."
            onChange={setSelectedMonth}
          />
        </div>
        <div className="period-chip-row">
          <span className="meta-chip">{activeMonthLabel}</span>
          <span className="meta-chip">{selectedClientName}</span>
          <span className={`meta-chip ${adDataOriginClass(adSourceOrigin)}`}>
            {adDataOriginLabel(adSourceOrigin)}
          </span>
          {budgetSummary.totalBudget != null && (
            <span className="meta-chip">Presupuesto cargado desde estrategia</span>
          )}
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
          <div className="report-kpi-grid">
            <ReportKpiCard
              icon={<Eye size={18} />}
              label="Visitas al perfil"
              value={
                profileVisitsSummary.value != null
                  ? formatNumber(profileVisitsSummary.value)
                  : 'Sin dato'
              }
              note={profileVisitsSummary.sourceLabel}
            />
            <ReportKpiCard
              icon={<MessageSquare size={18} />}
              label="Conversaciones"
              value={formatNumber(marketingSummary.messagingStarted)}
              note="Mensajes/conversaciones detectadas en Ads"
            />
            <ReportKpiCard
              icon={<Target size={18} />}
              label="Reconocimiento"
              value="Pendiente"
              note="Falta fuente real separada de awareness"
              tone="muted"
            />
            <ReportKpiCard
              icon={<TrendingUp size={18} />}
              label="Engagement"
              value="Pendiente"
              note="No existe fuente separada de engagement"
              tone="muted"
            />
            <ReportKpiCard
              icon={<CircleDollarSign size={18} />}
              label="Presupuesto mensual"
              value={
                budgetSummary.totalBudget != null
                  ? formatCop(budgetSummary.totalBudget)
                  : 'Sin presupuesto'
              }
              note={
                budgetSummary.totalBudget != null
                  ? budgetSummary.sourceLabel
                  : 'No hay estrategia con presupuesto para este mes'
              }
            />
            <ReportKpiCard
              icon={<DollarSign size={18} />}
              label="Presupuesto gastado"
              value={formatCop(operatingTotals.spend)}
              note="Ads del mes seleccionado"
            />
            <ReportKpiCard
              icon={<BarChart3 size={18} />}
              label="% ejecución"
              value={budgetExecution != null ? formatPct(budgetExecution) : 'Pendiente'}
              note={
                budgetExecution != null
                  ? 'Gasto / presupuesto mensual'
                  : 'Requiere presupuesto mensual real cargado'
              }
              tone={budgetExecution != null ? undefined : 'muted'}
            />
            <ReportKpiCard
              icon={<TrendingUp size={18} />}
              label="Ventas del mes"
              value={formatCop(operatingTotals.total_sales)}
              note={`${monthSales.length} registro(s) de venta en el mes`}
            />
            <ReportKpiCard
              icon={<BarChart3 size={18} />}
              label="ROAS del mes"
              value={formatRoas(operatingTotals.real_roas)}
              note="Ventas reportadas / inversión"
            />
          </div>

          <div className="report-main-grid">
            <section className="card section-block">
              <div className="section-heading">
                <h2>Distribución y lectura del mes</h2>
              </div>
              <p className="source-note">
                La distribución real de presupuesto por objetivo sigue pendiente hasta tener spend por
                campaña. Abajo se muestra el mix de resultados observados del mes.
              </p>
              <div className="report-distribution-grid">
                <DistributionDonutCard
                  title="Mix de resultados observados"
                  totalLabel="Resultados"
                  items={resultsDistribution}
                  emptyMessage="Todavía no hay suficientes resultados clasificados para este mes."
                />
                <PendingObjectiveCard
                  title="Distribución de presupuesto por objetivo"
                  detail="Requiere granularidad por campaña/objetivo. ad_metrics actual agrega por cuenta y fecha."
                />
              </div>
            </section>

            <section className="report-history-grid">
              <BarChart
                title="Histórico de ventas por mes"
                points={historySalesPoints}
                emptyMessage="Aún no hay histórico mensual de ventas suficiente."
                valueFormatter={(value) => formatCop(value)}
              />
              <LineChart
                title="Histórico de ROAS real por mes"
                points={historyRoasPoints}
                emptyMessage="Aún no hay histórico mensual de ROAS suficiente."
                valueFormatter={(value) => formatRoas(value)}
              />
            </section>
          </div>

          <div className="report-objective-section card section-block">
            <div className="section-heading">
              <h2>Rendimiento por objetivo</h2>
            </div>
            <p className="source-note">
              Se muestran primero los objetivos con fuente real. Los costos por objetivo siguen
              abajo si falta spend separado por campaña.
            </p>
            <div className="report-objective-grid">
              <ObjectiveMetricCard
                title="Conversaciones del mes"
                value={formatNumber(marketingSummary.messagingStarted)}
                note="Mensajes/conversaciones registradas en Ads"
              />
              <ObjectiveMetricCard
                title="Visitas al perfil del mes"
                value={
                  profileVisitsSummary.value != null
                    ? formatNumber(profileVisitsSummary.value)
                    : 'Sin dato'
                }
                note={profileVisitsSummary.sourceLabel}
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
                      : 'La fuente actual no trae video útil este mes'
                }
              />
              <ObjectiveMetricCard
                title="Clicks WhatsApp + link"
                value={formatNumber(specialSummary.whatsappClicks + specialSummary.linkClicks)}
                note="Cierres especiales mensuales manuales"
              />
              <ObjectiveMetricCard
                title="Costo por conversación"
                value="Pendiente"
                note="Falta spend separado de campañas de mensajes"
                pending
              />
              <ObjectiveMetricCard
                title="Costo por visita al perfil"
                value="Pendiente"
                note="Falta spend separado de campañas de perfil"
                pending
              />
              <ObjectiveMetricCard
                title="Reconocimiento / awareness"
                value="Pendiente"
                note="No hay fuente real separada de reconocimiento"
                pending
              />
              <ObjectiveMetricCard
                title="Engagement y costo"
                value="Pendiente"
                note="No hay fuente real separada de engagement"
                pending
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
                Aquí se muestran ventas reportadas por día. El conteo de ventas/objetivo comercial
                sigue pendiente si no existe fuente dedicada.
              </p>
              <div className="report-sales-grid">
                <MetricBoxInline label="Ventas del mes" value={formatCop(operatingTotals.total_sales)} />
                <MetricBoxInline label="Registros del mes" value={String(monthSales.length)} />
                <MetricBoxInline label="Objetivo de ventas" value="Pendiente" muted />
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
                        <div
                          className="sales-day-fill"
                          style={{ width: `${row.intensity}%` }}
                        />
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
                  Comparativa agregada del mes visible. Útil para ver qué cliente explica más ventas
                  o ROAS antes de entrar al detalle.
                </p>
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
                          <th className="num-col">ROAS</th>
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
                                <span className="table-secondary-note">{row.client.niche ?? 'Sin nicho'}</span>
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
                            <td className="num-col" data-label="ROAS">
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
                          <th className="num-col">Mensajes</th>
                          <th className="num-col">Leads</th>
                          <th className="num-col">Compras</th>
                          <th className="num-col">Valor</th>
                          <th className="num-col">ROAS Ads</th>
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
                                <td className="num-col" data-label="Mensajes">
                                  {formatNumber(row.messages)}
                                </td>
                                <td className="num-col" data-label="Leads">
                                  {formatNumber(row.leads)}
                                </td>
                                <td className="num-col" data-label="Compras">
                                  {formatNumber(row.purchases)}
                                </td>
                                <td className="num-col" data-label="Valor">
                                  {formatCop(row.purchase_value)}
                                </td>
                                <td className="num-col" data-label="ROAS Ads">
                                  <span className={roasClass(row.roas)}>{formatRoas(row.roas)}</span>
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

          {(pendingMetrics.length > 0 || selectedClient === 'all') && (
            <details className="card section-block dashboard-collapsible">
              <summary>Fuentes pendientes del reporte mensual</summary>
              <div className="special-metrics-list">
                {pendingMetrics.map((item) => (
                  <div key={item.title} className="special-metric-row">
                    <div className="special-metric-main">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <span className="status-pill status-gray">Pendiente</span>
                  </div>
                ))}
              </div>
            </details>
          )}
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
  const latestByClient = new Map<string, Strategy>();

  [...strategies]
    .filter((strategy) => getMonthKey(strategy.month ?? '') === monthKey)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .forEach((strategy) => {
      if (!latestByClient.has(strategy.client_id)) {
        latestByClient.set(strategy.client_id, strategy);
      }
    });

  const budgetRows = [...latestByClient.values()].filter(
    (strategy) => strategy.monthly_budget != null,
  );

  if (budgetRows.length === 0) {
    return {
      totalBudget: null as number | null,
      sourceLabel: 'Sin estrategia con presupuesto mensual',
    };
  }

  return {
    totalBudget: budgetRows.reduce((total, strategy) => total + (strategy.monthly_budget ?? 0), 0),
    sourceLabel:
      budgetRows.length === 1
        ? 'Presupuesto tomado de la estrategia más reciente'
        : `Presupuesto agregado desde ${budgetRows.length} estrategia(s) del mes`,
  };
}

function buildProfileVisitsSummary(params: {
  selectedClient: string;
  clients: Array<{ id: string }>;
  monthMetrics: AdMetric[];
  monthSocialMetrics: SocialMonthlyMetric[];
}) {
  if (params.selectedClient !== 'all') {
    return resolveMonthlyProfileVisits({
      socialMetric: params.monthSocialMetrics.find((row) => row.client_id === params.selectedClient) ?? null,
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
    sourceOrigin: hasManual && hasAutomatic ? 'mixed' : hasManual ? 'manual' : hasAutomatic ? 'automatic' : 'unknown',
    sourceLabel: hasManual && hasAutomatic ? 'Manual + Ads' : hasManual ? 'Fuente manual mensual' : hasAutomatic ? 'Sync automático' : 'Sin dato',
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
  sales: DailySale[];
}) {
  const monthRows = params.monthlyKpis.filter((row) => getMonthKey(row.month) === params.monthKey);
  if (monthRows.length > 0) return sumOperatingKpis(monthRows);

  return buildCombinedMonthTotals(
    [],
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

function buildPendingMetrics(params: {
  hasBudgetDistribution: boolean;
  hasConversationCost: boolean;
  hasProfileVisitCost: boolean;
  hasRecognitionData: boolean;
  hasEngagementData: boolean;
  budgetExecution: number | null;
}) {
  return [
    !params.hasBudgetDistribution
      ? {
          title: 'Distribución real de presupuesto por objetivo',
          detail: 'Falta spend por campaña u objetivo para un gráfico de presupuesto honesto.',
        }
      : null,
    !params.hasConversationCost
      ? {
          title: 'Costo por conversación',
          detail: 'No se puede aislar gasto de campañas de mensajes con la fuente actual.',
        }
      : null,
    !params.hasProfileVisitCost
      ? {
          title: 'Costo por visita al perfil',
          detail: 'No se puede aislar gasto de campañas de perfil con la fuente actual.',
        }
      : null,
    !params.hasRecognitionData
      ? {
          title: 'Reconocimiento / awareness',
          detail: 'No existe fuente separada de awareness en el esquema actual.',
        }
      : null,
    !params.hasEngagementData
      ? {
          title: 'Engagement',
          detail: 'No existe fuente separada de engagement en el esquema actual.',
        }
      : null,
    params.budgetExecution == null
      ? {
          title: 'Ejecución de presupuesto',
          detail: 'Requiere estrategia con presupuesto mensual cargado para el mes visible.',
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string }>;
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
                <span>
                  {formatNumber(item.value)} · {share.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PendingObjectiveCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="card section-block pending-objective-card">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <p className="source-note">{detail}</p>
      <span className="status-pill status-gray">Pendiente de fuente</span>
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
