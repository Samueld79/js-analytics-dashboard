import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  DollarSign,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import {
  useAdMetrics,
  useMetaSyncRows,
  useMonthlyOperatingKpis,
  useTasks,
} from '../hooks/useData';
import { useSocialMonthlyMetrics } from '../hooks/useSocialMonthlyMetrics';
import type { AdMetric, DailySale } from '../lib/supabase';
import {
  adDataOriginClass,
  adDataOriginLabel,
  alertStateLabel,
  buildMarketingActionSummary,
  buildMonthlySpecialMetricsSummary,
  formatCop,
  formatDateTime,
  formatNumber,
  formatRoas,
  isAlertSnoozed,
  metaSyncStatusClass,
  metaSyncStatusLabel,
  resolveMonthlyProfileVisits,
  sumMetrics,
  sumOperatingKpis,
  sumSales,
  summarizeAdDataOrigin,
} from '../lib/utils';
import { buildClientMetaOverviewByClient } from '../services/meta';
import { getMonthKey, getMonthLabel, listAvailableMonthKeys } from '../utils/monthLabel';

export function DashboardPage() {
  const { clients } = useClients();
  const { alerts, unreadCount } = useAlerts();
  const { tasks } = useTasks();
  const { monthlyKpis } = useMonthlyOperatingKpis(undefined, 6);
  const { metrics: rawAdMetrics } = useAdMetrics(undefined, 180);
  const { sales } = useDailySales({ days: 180 });
  const { metrics: socialMonthlyMetrics } = useSocialMonthlyMetrics(undefined, 12);
  const { syncRows } = useMetaSyncRows();

  const executiveMonth =
    listAvailableMonthKeys([
      ...monthlyKpis.map((row) => row.month),
      ...rawAdMetrics.map((row) => row.date),
      ...sales.map((row) => row.date),
      ...socialMonthlyMetrics.map((row) => row.month),
    ])[0] ?? new Date().toISOString().slice(0, 7);
  const executiveMonthLabel = getMonthLabel(executiveMonth);

  const executiveRows = monthlyKpis.filter((row) => getMonthKey(row.month) === executiveMonth);
  const executiveAdMetrics = rawAdMetrics.filter((row) => getMonthKey(row.date) === executiveMonth);
  const executiveSales = sales.filter((row) => getMonthKey(row.date) === executiveMonth);
  const executiveSocialMetrics = socialMonthlyMetrics.filter(
    (row) => getMonthKey(row.month) === executiveMonth,
  );

  const metaByClient = useMemo(
    () =>
      buildClientMetaOverviewByClient({
        clientIds: clients.map((client) => client.id),
        monthlyKpis,
        syncRows,
      }),
    [clients, monthlyKpis, syncRows],
  );

  const overall = executiveRows.length
    ? sumOperatingKpis(executiveRows)
    : buildCombinedMonthTotals(executiveAdMetrics, executiveSales);
  const marketing = buildMarketingActionSummary(executiveAdMetrics);
  const specialSummary = buildMonthlySpecialMetricsSummary(executiveSocialMetrics);

  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients],
  );

  const openAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) => ['unread', 'read'].includes(alert.status) && !isAlertSnoozed(alert),
      ),
    [alerts],
  );

  const clientAlertCount = new Map<string, number>();
  const clientCriticalAlertCount = new Map<string, number>();

  openAlerts.forEach((alert) => {
    if (!alert.client_id) return;
    clientAlertCount.set(alert.client_id, (clientAlertCount.get(alert.client_id) ?? 0) + 1);

    if (alert.severity === 'critical') {
      clientCriticalAlertCount.set(
        alert.client_id,
        (clientCriticalAlertCount.get(alert.client_id) ?? 0) + 1,
      );
    }
  });

  const recentAlerts = [...openAlerts].sort(sortAlertsBySeverity).slice(0, 5);
  const criticalAlerts = openAlerts.filter((alert) => alert.severity === 'critical');
  const clientsWithAlerts = new Set(openAlerts.map((alert) => alert.client_id).filter(Boolean)).size;
  const pendingTasks = tasks.filter((task) => task.status === 'pending').length;

  const socialRows = clients
    .map((client) => {
      const socialMetric =
        executiveSocialMetrics.find((metric) => metric.client_id === client.id) ?? null;
      const profileVisits = resolveMonthlyProfileVisits({
        socialMetric,
        adMetrics: executiveAdMetrics.filter((metric) => metric.client_id === client.id),
      });

      return {
        clientId: client.id,
        clientName: client.name,
        socialMetric,
        profileVisits,
        followerConversion:
          socialMetric && profileVisits.value && profileVisits.value > 0
            ? (socialMetric.new_followers / profileVisits.value) * 100
            : null,
      };
    })
    .filter((entry) => entry.socialMetric || entry.profileVisits.value != null)
    .sort(
      (left, right) =>
        (right.socialMetric?.new_followers ?? 0) - (left.socialMetric?.new_followers ?? 0),
    );

  const socialFollowersTotal = socialRows.reduce(
    (total, entry) => total + (entry.socialMetric?.new_followers ?? 0),
    0,
  );
  const socialProfileVisitsTotal = socialRows.reduce(
    (total, entry) => total + (entry.profileVisits.value ?? 0),
    0,
  );
  const socialConversion =
    socialFollowersTotal > 0 && socialProfileVisitsTotal > 0
      ? (socialFollowersTotal / socialProfileVisitsTotal) * 100
      : null;

  const clientExecutiveRows = clients
    .map((client) => {
      const monthRow = executiveRows.find((row) => row.client_id === client.id) ?? null;
      const monthTotals =
        monthRow ??
        buildCombinedMonthTotals(
          executiveAdMetrics.filter((row) => row.client_id === client.id),
          executiveSales.filter((row) => row.client_id === client.id),
        );
      const meta = metaByClient[client.id] ?? null;
      const socialMetric = executiveSocialMetrics.find((row) => row.client_id === client.id) ?? null;
      const alertCount = clientAlertCount.get(client.id) ?? 0;
      const criticalCount = clientCriticalAlertCount.get(client.id) ?? 0;

      return {
        client,
        monthTotals,
        meta,
        socialMetric,
        alertCount,
        criticalCount,
      };
    })
    .filter(
      (entry) =>
        entry.monthTotals.spend > 0 ||
        entry.monthTotals.total_sales > 0 ||
        entry.alertCount > 0 ||
        Boolean(entry.socialMetric) ||
        Boolean(entry.meta?.active_accounts),
    )
    .sort((left, right) => {
      if (right.monthTotals.real_roas !== left.monthTotals.real_roas) {
        return right.monthTotals.real_roas - left.monthTotals.real_roas;
      }
      if (right.monthTotals.total_sales !== left.monthTotals.total_sales) {
        return right.monthTotals.total_sales - left.monthTotals.total_sales;
      }
      return right.monthTotals.spend - left.monthTotals.spend;
    });

  const topClients = clientExecutiveRows.slice(0, 5);
  const clientsAtRisk = clientExecutiveRows
    .map((entry) => {
      const reasons: string[] = [];
      let score = 0;

      if (entry.criticalCount > 0) {
        score += 70;
        reasons.push(
          `${entry.criticalCount} alerta${entry.criticalCount !== 1 ? 's críticas' : ' crítica'}`,
        );
      } else if (entry.alertCount > 0) {
        score += Math.min(entry.alertCount * 18, 54);
        reasons.push(`${entry.alertCount} alerta(s) abierta(s)`);
      }

      if (entry.meta?.sync_status === 'stale') {
        score += 26;
        reasons.push('Meta desactualizado');
      } else if (entry.meta?.sync_status === 'no_data' && entry.meta.active_accounts > 0) {
        score += 18;
        reasons.push('Sin sync reciente');
      }

      if (entry.monthTotals.spend > 0 && entry.monthTotals.real_roas > 0 && entry.monthTotals.real_roas < 2) {
        score += entry.monthTotals.real_roas < 1 ? 32 : 18;
        reasons.push(`ROAS ${formatRoas(entry.monthTotals.real_roas)}`);
      }

      if (entry.monthTotals.spend > 0 && entry.monthTotals.total_sales === 0) {
        score += 16;
        reasons.push('Sin ventas reportadas');
      }

      return { ...entry, riskScore: score, reasons };
    })
    .filter((entry) => entry.riskScore > 0)
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 6);

  const metaEntries = clients
    .map((client) => ({
      client,
      meta: metaByClient[client.id] ?? null,
    }))
    .filter((entry) => Boolean(entry.meta))
    .sort((left, right) => {
      const statusWeight =
        getMetaStatusWeight(left.meta?.sync_status) - getMetaStatusWeight(right.meta?.sync_status);
      if (statusWeight !== 0) return statusWeight;
      return left.client.name.localeCompare(right.client.name);
    });
  const metaStaleCount = metaEntries.filter((entry) => entry.meta?.sync_status === 'stale').length;

  const focusFeed = [
    ...criticalAlerts.slice(0, 2).map((alert) => ({
      id: `alert-${alert.id}`,
      href: alert.client_id ? `/clients/${alert.client_id}` : '/alerts',
      title: alert.title,
      subtitle: alert.client_id ? clientNameById.get(alert.client_id) ?? 'Cliente' : 'General',
      statusLabel: alertStateLabel(alert),
      tone: alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'amber' : 'blue',
    })),
    ...clientsAtRisk.slice(0, 3).map((entry) => ({
      id: `risk-${entry.client.id}`,
      href: `/clients/${entry.client.id}`,
      title: entry.client.name,
      subtitle: entry.reasons.join(' · ') || 'Cliente con riesgo operativo',
      statusLabel: `${entry.riskScore} pts`,
      tone: entry.riskScore >= 60 ? 'red' : 'amber',
    })),
  ].slice(0, 5);

  const hasExecutiveSocialData = socialRows.length > 0;
  const hasExecutiveSpecialData = specialSummary.rowsWithData > 0;
  const pendingSourceItems = [
    marketing.profileVisits == null
      ? {
          title: 'Visitas al perfil desde Ads',
          detail: 'La fuente actual no está trayendo profile_visit_view en el mes ejecutivo.',
        }
      : null,
    !hasExecutiveSpecialData
      ? {
          title: 'Métricas especiales mensuales',
          detail:
            'No hay cierres especiales suficientes para destacar WhatsApp, link o clientes nuevos en portada.',
        }
      : null,
    {
      title: 'Distribución de presupuesto por objetivo',
      detail:
        'Sigue pendiente hasta tener spend por campaña u objetivo. ad_metrics hoy agrega por cuenta y fecha.',
    },
  ].filter(Boolean) as Array<{ title: string; detail: string }>;

  return (
    <div className="page-content reporting-page executive-dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard General</h1>
          <p className="page-subtitle">Tablero ejecutivo del mes visible · {executiveMonthLabel}</p>
        </div>
        <div className="header-actions">
          {unreadCount > 0 && (
            <Link to="/alerts" className="alert-banner">
              <AlertTriangle size={14} />
              {unreadCount} alerta{unreadCount !== 1 ? 's' : ''} sin revisar
            </Link>
          )}
          <Link to="/metrics" className="btn-secondary">
            <BarChart3 size={14} />
            Ver desempeño mensual
          </Link>
        </div>
      </div>

      <div className="card section-block period-toolbar-card">
        <div className="period-toolbar">
          <div className="period-toolbar-copy">
            <div className="section-heading">
              <h2>Lectura principal</h2>
            </div>
            <p className="source-note">
              Esta portada prioriza el mes ejecutivo con fuentes reales de Ads, ventas y cierres
              mensuales. Alertas, riesgo y estado Meta siguen leyendo operación actual.
            </p>
            <div className="period-chip-row">
              <span className="meta-chip">{executiveMonthLabel}</span>
              <span className="meta-chip">KPIs y clientes destacados: mensual</span>
              <span className="meta-chip">Alertas y Meta: actual</span>
              <span className="meta-chip">Fuente principal: Supabase</span>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-row executive-kpi-row">
        <KpiBox
          icon={<DollarSign size={18} />}
          label={`Inversión ${executiveMonthLabel}`}
          value={formatCop(overall.spend)}
          color="blue"
        />
        <KpiBox
          icon={<TrendingUp size={18} />}
          label={`Ventas ${executiveMonthLabel}`}
          value={formatCop(overall.total_sales)}
          color="green"
        />
        <KpiBox
          icon={<BarChart3 size={18} />}
          label={`ROAS real ${executiveMonthLabel}`}
          value={formatRoas(overall.real_roas)}
          color="amber"
        />
        <KpiBox
          icon={<MessageSquare size={18} />}
          label={`Conversaciones ${executiveMonthLabel}`}
          value={formatNumber(marketing.messagingStarted)}
          color="purple"
        />
        <KpiBox
          icon={<ShieldAlert size={18} />}
          label="Clientes con alertas"
          value={String(clientsWithAlerts)}
          color="red"
        />
        <KpiBox
          icon={<Users size={18} />}
          label="Meta desactualizado"
          value={String(metaStaleCount)}
          color="blue"
        />
      </div>

      <div className="executive-focus-grid">
        <section className="card section-block executive-spotlight-card">
          <div className="section-heading">
            <h2>Clientes destacados</h2>
            <Link to="/clients" className="link-small">
              Ver clientes <ArrowRight size={12} />
            </Link>
          </div>
          <p className="source-note">
            Ordenados por ventas reales y ROAS del mes visible. La lista no depende del snapshot
            operativo general.
          </p>

          {topClients.length === 0 ? (
            <p className="empty-note">No hay clientes con data suficiente para destacar este mes.</p>
          ) : (
            <div className="executive-client-list">
              {topClients.map(({ client, monthTotals, alertCount, socialMetric, meta }) => (
                <Link key={client.id} to={`/clients/${client.id}`} className="executive-client-row">
                  <div className="executive-client-main">
                    <div className="table-primary-cell">
                      <strong>{client.name}</strong>
                      <span className="table-secondary-note">
                        {client.niche ?? 'Sin nicho'} · {formatCop(monthTotals.spend)} inversión
                      </span>
                    </div>
                    <div className="period-chip-row">
                      {monthTotals.total_sales > 0 && (
                        <span className="status-pill status-green">
                          {formatCop(monthTotals.total_sales)} ventas
                        </span>
                      )}
                      {alertCount > 0 && (
                        <span className="status-pill status-red">{alertCount} alerta(s)</span>
                      )}
                      {socialMetric && socialMetric.new_followers > 0 && (
                        <span className="status-pill status-blue">
                          +{formatNumber(socialMetric.new_followers)} seguidores
                        </span>
                      )}
                      {meta && (
                        <span className={`status-pill ${metaSyncStatusClass(meta.sync_status)}`}>
                          {metaSyncStatusLabel(meta.sync_status)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="executive-client-metrics">
                    <span className={roasClass(monthTotals.real_roas)}>
                      {formatRoas(monthTotals.real_roas)}
                    </span>
                    <span className="table-secondary-note">{formatCop(monthTotals.spend)} invertidos</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card section-block executive-radar-card">
          <div className="section-heading">
            <h2>Radar operativo</h2>
            <Link to="/alerts" className="link-small">
              Ver alertas <ArrowRight size={12} />
            </Link>
          </div>
          <p className="source-note">
            Lo que requiere atención hoy: alertas abiertas, riesgo operativo y estado de
            sincronización.
          </p>

          <div className="executive-micro-grid">
            <MetricBoxMini label="Alertas críticas" value={String(criticalAlerts.length)} />
            <MetricBoxMini label="Clientes en riesgo" value={String(clientsAtRisk.length)} />
            <MetricBoxMini label="Meta desactualizado" value={String(metaStaleCount)} />
            <MetricBoxMini label="Tareas pendientes" value={String(pendingTasks)} />
          </div>

          <div className="task-list-compact">
            {focusFeed.length === 0 ? (
              <p className="empty-note">No hay frentes críticos abiertos ahora mismo.</p>
            ) : (
              focusFeed.map((item) => (
                <Link key={item.id} to={item.href} className="client-risk-row">
                  <div className="task-info-compact">
                    <span className="task-title-compact">{item.title}</span>
                    <span className="task-due">{item.subtitle}</span>
                  </div>
                  <span className={`status-pill status-${item.tone}`}>{item.statusLabel}</span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-secondary-grid">
        <section className="card section-block">
          <div className="section-heading">
            <h2>Clientes en riesgo</h2>
            <span className="badge-count">{clientsAtRisk.length}</span>
          </div>
          <p className="source-note">
            Riesgo operativo combinado: alertas abiertas, estado Meta y señales obvias del mes
            actual.
          </p>
          <div className="task-list-compact">
            {clientsAtRisk.length === 0 ? (
              <p className="empty-note">No hay clientes en riesgo ahora mismo.</p>
            ) : (
              clientsAtRisk.map(({ client, riskScore, reasons }) => (
                <Link key={client.id} to={`/clients/${client.id}`} className="client-risk-row">
                  <div className="task-info-compact">
                    <span className="task-title-compact">{client.name}</span>
                    <span className="task-due">{reasons.join(' · ') || 'Sin detalle'}</span>
                  </div>
                  <span className={`status-pill ${riskScore >= 60 ? 'status-red' : 'status-amber'}`}>
                    {riskScore} pts
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="card section-block">
          <div className="section-heading">
            <h2>Alertas recientes</h2>
            <span className="badge-count">{openAlerts.length}</span>
          </div>
          <p className="source-note">Alertas abiertas ordenadas por severidad y creación.</p>
          <div className="task-list-compact">
            {recentAlerts.length === 0 ? (
              <p className="empty-note">No hay alertas abiertas ahora mismo.</p>
            ) : (
              recentAlerts.map((alert) => (
                <Link
                  key={alert.id}
                  to={alert.client_id ? `/clients/${alert.client_id}` : '/alerts'}
                  className="client-risk-row"
                >
                  <div className="task-info-compact">
                    <span className="task-title-compact">{alert.title}</span>
                    <span className="task-due">
                      {alert.client_id ? clientNameById.get(alert.client_id) ?? 'Cliente' : 'General'}
                    </span>
                  </div>
                  <span
                    className={`status-pill ${
                      alert.severity === 'critical'
                        ? 'status-red'
                        : alert.severity === 'warning'
                          ? 'status-amber'
                          : 'status-blue'
                    }`}
                  >
                    {alertStateLabel(alert)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="card section-block">
          <div className="section-heading">
            <h2>Estado Meta</h2>
            <span className="badge-count">{metaStaleCount}</span>
          </div>
          <p className="source-note">Estado actual de sincronización y lectura MTD por cliente.</p>
          <div className="task-list-compact">
            {metaEntries.length === 0 ? (
              <p className="empty-note">No hay clientes activos para revisar sincronización Meta.</p>
            ) : (
              metaEntries.slice(0, 6).map(({ client, meta }) => (
                <Link key={client.id} to={`/clients/${client.id}`} className="client-risk-row">
                  <div className="task-info-compact">
                    <span className="task-title-compact">{client.name}</span>
                    <span className="task-due">
                      {meta?.last_sync_at
                        ? `Última sync ${formatDateTime(meta.last_sync_at)}`
                        : 'Sin sincronización registrada'}
                    </span>
                  </div>
                  <span className={`status-pill ${metaSyncStatusClass(meta?.sync_status ?? 'no_data')}`}>
                    {metaSyncStatusLabel(meta?.sync_status ?? 'no_data')}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        {hasExecutiveSocialData && (
          <section className="card section-block">
            <div className="section-heading">
              <h2>Crecimiento social</h2>
            </div>
            <p className="source-note">
              Cierre mensual de seguidores y visitas al perfil. No se infieren seguidores desde Ads.
            </p>
            <div className="metric-grid-4">
              <MetricBoxMini label="Nuevos seguidores" value={formatNumber(socialFollowersTotal)} />
              <MetricBoxMini
                label="Visitas al perfil"
                value={socialProfileVisitsTotal > 0 ? formatNumber(socialProfileVisitsTotal) : 'Sin dato'}
              />
              <MetricBoxMini
                label="Conversión visita → seguidor"
                value={socialConversion != null ? `${socialConversion.toFixed(1)}%` : '—'}
              />
              <MetricBoxMini label="Costo por seguidor" value="Pendiente de fuente" />
            </div>
            <div className="special-metrics-list compact-grid-list">
              {socialRows.slice(0, 5).map((entry) => (
                <Link
                  key={entry.clientId}
                  to={`/clients/${entry.clientId}`}
                  className="special-metric-row special-metric-link"
                >
                  <div className="special-metric-main">
                    <strong>{entry.clientName}</strong>
                    <span>
                      Seguidores{' '}
                      {entry.socialMetric ? formatNumber(entry.socialMetric.new_followers) : 'Sin dato'} ·
                      Perfil{' '}
                      {entry.profileVisits.value != null
                        ? formatNumber(entry.profileVisits.value)
                        : 'Sin dato'}
                    </span>
                  </div>
                  <span
                    className={`meta-chip ${
                      entry.socialMetric
                        ? 'source-manual'
                        : adDataOriginClass(entry.profileVisits.sourceOrigin)
                    }`}
                  >
                    {entry.socialMetric ? 'Manual mensual' : entry.profileVisits.sourceLabel}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {hasExecutiveSpecialData && (
          <section className="card section-block">
            <div className="section-heading">
              <h2>Métricas especiales</h2>
            </div>
            <p className="source-note">
              Cierres mensuales manuales para clicks y señales de negocio. Solo suben aquí cuando
              ya existe data real.
            </p>
            <div className="metric-grid-4">
              <MetricBoxMini label="Clicks WhatsApp" value={formatNumber(specialSummary.whatsappClicks)} />
              <MetricBoxMini label="Clicks al link" value={formatNumber(specialSummary.linkClicks)} />
              <MetricBoxMini
                label="Nuevos clientes"
                value={formatNumber(specialSummary.newCustomersReported)}
              />
              <MetricBoxMini
                label="Recompra"
                value={formatNumber(specialSummary.returningCustomersReported)}
              />
              <MetricBoxMini
                label="Visitas a tienda"
                value={formatNumber(specialSummary.storeVisitsReported)}
              />
            </div>
            <p className="source-note">
              Ads visible: {adDataOriginLabel(summarizeAdDataOrigin(executiveAdMetrics.map((row) => row.source)))} ·
              Cierres especiales: manual mensual
            </p>
          </section>
        )}
      </div>

      {pendingSourceItems.length > 0 && (
        <details className="card section-block dashboard-collapsible">
          <summary>
            <Sparkles size={14} />
            Fuentes pendientes y capas secundarias
          </summary>
          <div className="special-metrics-list">
            {pendingSourceItems.map((item) => (
              <PendingItem key={item.title} title={item.title} detail={item.detail} />
            ))}
          </div>
        </details>
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

function sortAlertsBySeverity(left: { severity: string; created_at: string }, right: { severity: string; created_at: string }) {
  const severityWeight = (value: string) =>
    value === 'critical' ? 0 : value === 'warning' ? 1 : 2;
  const severityDiff = severityWeight(left.severity) - severityWeight(right.severity);
  if (severityDiff !== 0) return severityDiff;
  return right.created_at.localeCompare(left.created_at);
}

function getMetaStatusWeight(status?: 'ok' | 'stale' | 'no_data' | null): number {
  switch (status) {
    case 'stale':
      return 0;
    case 'no_data':
      return 1;
    case 'ok':
      return 2;
    default:
      return 1;
  }
}

function roasClass(roas: number): string {
  if (roas >= 3) return 'roas-pill roas-good';
  if (roas >= 2) return 'roas-pill roas-ok';
  return 'roas-pill roas-low';
}

function KpiBox({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`kpi-box kpi-${color}`}>
      <div className="kpi-box-icon">{icon}</div>
      <div>
        <div className="kpi-box-label">{label}</div>
        <div className="kpi-box-value">{value}</div>
      </div>
    </div>
  );
}

function MetricBoxMini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="metric-box">
      <span className="metric-box-label">{label}</span>
      <span className="metric-box-value">{value}</span>
    </div>
  );
}

function PendingItem({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="special-metric-row">
      <div className="special-metric-main">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <span className="status-pill status-gray">Pendiente</span>
    </div>
  );
}
