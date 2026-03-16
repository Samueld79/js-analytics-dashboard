import type { ReactNode } from 'react';
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
import { useAdMetrics } from '../hooks/useData';
import { useDashboard } from '../hooks/useDashboard';
import { useSocialMonthlyMetrics } from '../hooks/useSocialMonthlyMetrics';
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
  healthStatusLabel,
  isAlertSnoozed,
  metaSyncStatusClass,
  metaSyncStatusLabel,
  resolveMonthlyProfileVisits,
  sumOperatingKpis,
  summarizeAdDataOrigin,
} from '../lib/utils';
import { getMonthKey, getMonthLabel, listAvailableMonthKeys } from '../utils/monthLabel';

export function DashboardPage() {
  const {
    clients,
    alerts,
    monthlyKpis,
    tasks,
    healthByClient,
    issuesByClient,
    metaByClient,
    unreadCount,
  } = useDashboardWithCounts();
  const { metrics: rawAdMetrics } = useAdMetrics(undefined, 180);
  const { metrics: socialMonthlyMetrics } = useSocialMonthlyMetrics(undefined, 12);

  const executiveMonth =
    listAvailableMonthKeys([
      ...monthlyKpis.map((row) => row.month),
      ...socialMonthlyMetrics.map((row) => row.month),
      ...rawAdMetrics.map((row) => row.date),
    ])[0] ?? new Date().toISOString().slice(0, 7);
  const executiveMonthLabel = getMonthLabel(executiveMonth);

  const executiveRows = monthlyKpis.filter((row) => getMonthKey(row.month) === executiveMonth);
  const executiveAdMetrics = rawAdMetrics.filter((row) => getMonthKey(row.date) === executiveMonth);
  const executiveSocialMetrics = socialMonthlyMetrics.filter(
    (row) => getMonthKey(row.month) === executiveMonth,
  );
  const overall = sumOperatingKpis(executiveRows);
  const marketing = buildMarketingActionSummary(executiveAdMetrics);
  const specialSummary = buildMonthlySpecialMetricsSummary(executiveSocialMetrics);

  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));
  const clientAlertCount = new Map<string, number>();
  const openAlerts = alerts.filter(
    (alert) => ['unread', 'read'].includes(alert.status) && !isAlertSnoozed(alert),
  );

  openAlerts.forEach((alert) => {
    if (!alert.client_id) return;
    clientAlertCount.set(alert.client_id, (clientAlertCount.get(alert.client_id) ?? 0) + 1);
  });

  const recentAlerts = [...openAlerts].slice(0, 5);
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
    .sort((left, right) => (right.socialMetric?.new_followers ?? 0) - (left.socialMetric?.new_followers ?? 0));

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
      const health = healthByClient[client.id];
      const issues = issuesByClient[client.id] ?? [];
      const socialMetric = executiveSocialMetrics.find((row) => row.client_id === client.id) ?? null;

      return {
        client,
        monthRow,
        health,
        issues,
        socialMetric,
        alertCount: clientAlertCount.get(client.id) ?? 0,
      };
    })
    .filter(
      (entry) =>
        Boolean(entry.monthRow) ||
        entry.alertCount > 0 ||
        Boolean(entry.socialMetric) ||
        Boolean(entry.health),
    )
    .sort((left, right) => {
      const leftRoas = left.monthRow?.real_roas ?? -1;
      const rightRoas = right.monthRow?.real_roas ?? -1;
      if (rightRoas !== leftRoas) return rightRoas - leftRoas;

      const leftSales = left.monthRow?.total_sales ?? 0;
      const rightSales = right.monthRow?.total_sales ?? 0;
      if (rightSales !== leftSales) return rightSales - leftSales;

      return (right.monthRow?.spend ?? 0) - (left.monthRow?.spend ?? 0);
    });

  const topClients = clientExecutiveRows.slice(0, 6);
  const clientsAtRisk = [...clientExecutiveRows]
    .filter((entry) => (entry.health?.status ?? 'healthy') !== 'healthy')
    .sort((left, right) => (left.health?.score ?? 100) - (right.health?.score ?? 100))
    .slice(0, 6);

  const metaEntries = clients
    .map((client) => ({
      client,
      meta: metaByClient[client.id] ?? null,
    }))
    .sort((left, right) => {
      const statusWeight =
        getMetaStatusWeight(left.meta?.sync_status) - getMetaStatusWeight(right.meta?.sync_status);
      if (statusWeight !== 0) return statusWeight;
      return left.client.name.localeCompare(right.client.name);
    });
  const metaStaleCount = metaEntries.filter((entry) => entry.meta?.sync_status === 'stale').length;
  const hasExecutiveSocialData = socialRows.length > 0;
  const hasExecutiveSpecialData = specialSummary.rowsWithData > 0;
  const pendingSourceItems = [
    !hasExecutiveSocialData
      ? {
          title: 'Crecimiento social mensual',
          detail: 'Todavía no hay cierres sociales mensuales suficientes para llevarlo a primer nivel.',
        }
      : null,
    marketing.profileVisits == null
      ? {
          title: 'Visitas al perfil desde Ads',
          detail: 'La fuente actual no está trayendo profile_visit_view en el mes ejecutivo.',
        }
      : null,
    !hasExecutiveSpecialData
      ? {
          title: 'Métricas especiales',
          detail:
            'No hay cierres especiales mensuales suficientes para destacar WhatsApp, link o nuevos clientes en portada.',
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
              Esta portada prioriza el mes ejecutivo y deja la capa técnica abajo. Alertas, riesgo y
              estado Meta siguen leyendo operación actual.
            </p>
            <div className="period-chip-row">
              <span className="meta-chip">{executiveMonthLabel}</span>
              <span className="meta-chip">KPIs y top clientes: mensual</span>
              <span className="meta-chip">Alertas y riesgo: actual</span>
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
          label={`Crecimiento social ${executiveMonthLabel}`}
          value={hasExecutiveSocialData ? formatNumber(socialFollowersTotal) : 'Sin dato'}
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
            Destacados por ROAS real y ventas del mes visible. Si un cliente no tiene data mensual,
            no domina esta lista.
          </p>

          {topClients.length === 0 ? (
            <p className="empty-note">No hay clientes con data suficiente para destacar este mes.</p>
          ) : (
            <div className="executive-client-list">
              {topClients.map(({ client, monthRow, health, alertCount, socialMetric }) => (
                <Link key={client.id} to={`/clients/${client.id}`} className="executive-client-row">
                  <div className="executive-client-main">
                    <div className="table-primary-cell">
                      <strong>{client.name}</strong>
                      <span className="table-secondary-note">
                        {client.niche ?? 'Sin nicho'} · {monthRow ? formatCop(monthRow.spend) : 'Sin Ads'}
                      </span>
                    </div>
                    <div className="period-chip-row">
                      {health && (
                        <span className={`status-pill status-${healthTone(health.status)}`}>
                          Salud {health.score} · {healthStatusLabel(health.status)}
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
                    </div>
                  </div>
                  <div className="executive-client-metrics">
                    <span className={roasClass(monthRow?.real_roas ?? 0)}>
                      {formatRoas(monthRow?.real_roas ?? 0)}
                    </span>
                    <span className="table-secondary-note">
                      {formatCop(monthRow?.total_sales ?? 0)} ventas
                    </span>
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
            Resumen actual de riesgo, alertas y sincronización sin contaminar la cabecera ejecutiva.
          </p>

          <div className="executive-micro-grid">
            <MetricBoxMini label="Alertas críticas" value={String(criticalAlerts.length)} />
            <MetricBoxMini label="Clientes en riesgo" value={String(clientsAtRisk.length)} />
            <MetricBoxMini label="Meta desactualizado" value={String(metaStaleCount)} />
            <MetricBoxMini label="Tareas pendientes" value={String(pendingTasks)} />
          </div>

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
      </div>

      <div className="dashboard-grid dashboard-secondary-grid">
        {hasExecutiveSocialData && (
          <section className="card section-block">
            <div className="section-heading">
              <h2>Crecimiento social</h2>
            </div>
            <p className="source-note">
              Cierre mensual de seguidores y visitas al perfil. No se infieren seguidores desde Ads.
            </p>
            <div className="metric-grid-4">
              <MetricBoxMini
                label="Nuevos seguidores"
                value={formatNumber(socialFollowersTotal)}
              />
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
                      Seguidores {entry.socialMetric ? formatNumber(entry.socialMetric.new_followers) : 'Sin dato'} ·
                      Perfil {entry.profileVisits.value != null ? ` ${formatNumber(entry.profileVisits.value)}` : ' Sin dato'}
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

        <section className="card section-block">
          <div className="section-heading">
            <h2>Clientes en riesgo</h2>
            <span className="badge-count">{clientsAtRisk.length}</span>
          </div>
          <p className="source-note">
            Lectura operativa actual basada en salud, issues y alertas abiertas.
          </p>
          <div className="task-list-compact">
            {clientsAtRisk.length === 0 ? (
              <p className="empty-note">No hay clientes en riesgo ahora mismo.</p>
            ) : (
              clientsAtRisk.map(({ client, health, issues }) => (
                <Link key={client.id} to={`/clients/${client.id}`} className="client-risk-row">
                  <div className="task-info-compact">
                    <span className="task-title-compact">{client.name}</span>
                    <span className="task-due">
                      {healthStatusLabel(health?.status ?? 'warning')} · {health?.score ?? 0} puntos
                    </span>
                  </div>
                  <span className="type-chip">
                    {issues[0]?.title ?? `${issues.length} issue(s)`}
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
              <MetricBoxMini
                label="Clicks WhatsApp"
                value={formatNumber(specialSummary.whatsappClicks)}
              />
              <MetricBoxMini
                label="Clicks al link"
                value={formatNumber(specialSummary.linkClicks)}
              />
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
              Fuente visible: {adDataOriginLabel(summarizeAdDataOrigin(executiveAdMetrics.map((row) => row.source)))} para Ads y manual mensual para señales especiales.
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

function useDashboardWithCounts() {
  const dashboard = useDashboard(30);
  return {
    ...dashboard,
    unreadCount: dashboard.alerts.filter(
      (alert) => alert.status === 'unread' && !isAlertSnoozed(alert),
    ).length,
  };
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

function healthTone(status: 'healthy' | 'warning' | 'critical'): 'green' | 'amber' | 'red' {
  if (status === 'healthy') return 'green';
  if (status === 'warning') return 'amber';
  return 'red';
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
