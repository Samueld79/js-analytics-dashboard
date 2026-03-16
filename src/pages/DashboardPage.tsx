import { useDashboard } from '../hooks/useDashboard';
import { useAdMetrics, useClients } from '../hooks/useData';
import { useSocialMonthlyMetrics } from '../hooks/useSocialMonthlyMetrics';
import {
  adDataOriginClass,
  adDataOriginLabel,
  buildMarketingActionSummary,
  formatCop,
  formatDateTime,
  formatNumber,
  formatRoas,
  healthStatusLabel,
  metaSyncStatusClass,
  metaSyncStatusLabel,
  resolveMonthlyProfileVisits,
  sumOperatingKpis,
} from '../lib/utils';
import { Link } from 'react-router-dom';
import { TrendingUp, MessageSquare, DollarSign, BarChart3, AlertTriangle, ArrowRight } from 'lucide-react';
import { getMonthKey, getMonthLabel, listAvailableMonthKeys } from '../utils/monthLabel';

export function DashboardPage() {
  const {
    clients,
    alerts,
    dailyKpis,
    monthlyKpis,
    tasks,
    healthByClient,
    issuesByClient,
    metaByClient,
    unreadCount,
  } = useDashboardWithCounts();
  const { metrics: rawAdMetrics } = useAdMetrics(undefined, 120);
  const { clients: listedClients } = useClients();
  const { metrics: socialMonthlyMetrics } = useSocialMonthlyMetrics(undefined, 12);
  const monthlyExecutiveMonths = listAvailableMonthKeys(monthlyKpis.map((row) => row.month));
  const socialExecutiveMonths = listAvailableMonthKeys(socialMonthlyMetrics.map((row) => row.month));
  const executiveMonth =
    monthlyExecutiveMonths[0] ?? socialExecutiveMonths[0] ?? new Date().toISOString().slice(0, 7);
  const executiveMonthLabel = getMonthLabel(executiveMonth);
  const executiveRows = monthlyKpis.filter((row) => getMonthKey(row.month) === executiveMonth);
  const executiveAdMetrics = rawAdMetrics.filter((row) => getMonthKey(row.date) === executiveMonth);
  const executiveMarketing = buildMarketingActionSummary(executiveAdMetrics);
  const clientNameById = new Map(listedClients.map((client) => [client.id, client.name]));
  const executiveSocialClientIds = new Set<string>();
  socialMonthlyMetrics
    .filter((metric) => getMonthKey(metric.month) === executiveMonth)
    .forEach((metric) => executiveSocialClientIds.add(metric.client_id));
  executiveAdMetrics.forEach((metric) => executiveSocialClientIds.add(metric.client_id));
  const executiveSocialRows = [...executiveSocialClientIds]
    .map((clientId) => {
      const socialMetric =
        socialMonthlyMetrics.find(
          (metric) =>
            metric.client_id === clientId && getMonthKey(metric.month) === executiveMonth,
        ) ?? null;
      const profileVisits = resolveMonthlyProfileVisits({
        socialMetric,
        adMetrics: executiveAdMetrics.filter((metric) => metric.client_id === clientId),
      });

      return {
        clientId,
        clientName: clientNameById.get(clientId) ?? 'Cliente sin nombre',
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
  const socialFollowersTotal = executiveSocialRows.reduce(
    (total, entry) => total + (entry.socialMetric?.new_followers ?? 0),
    0,
  );
  const socialProfileVisitsRows = executiveSocialRows.filter((entry) => entry.profileVisits.value != null);
  const socialProfileVisitsTotal = socialProfileVisitsRows.reduce(
    (total, entry) => total + (entry.profileVisits.value ?? 0),
    0,
  );
  const hasFollowerData = executiveSocialRows.some((entry) => entry.socialMetric);
  const socialConversion =
    socialFollowersTotal > 0 && socialProfileVisitsTotal > 0
      ? (socialFollowersTotal / socialProfileVisitsTotal) * 100
      : null;
  const overall = sumOperatingKpis(executiveRows);
  const rollingOverall = sumOperatingKpis(dailyKpis);
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && a.status === 'unread');
  const healthEntries = clients.map((client) => ({
    client,
    health: healthByClient[client.id],
    issues: issuesByClient[client.id] ?? [],
  }));
  const healthyClients = healthEntries.filter((entry) => entry.health?.status === 'healthy').length;
  const clientsAtRisk = healthEntries
    .filter((entry) => (entry.health?.status ?? 'healthy') !== 'healthy')
    .sort((a, b) => (a.health?.score ?? 100) - (b.health?.score ?? 100));
  const metaEntries = clients
    .map((client) => ({
      client,
      meta: metaByClient[client.id] ?? null,
    }))
    .sort((a, b) => {
      const statusWeight = getMetaStatusWeight(a.meta?.sync_status) - getMetaStatusWeight(b.meta?.sync_status);
      if (statusWeight !== 0) return statusWeight;
      return a.client.name.localeCompare(b.client.name);
    });
  const metaOkCount = metaEntries.filter((entry) => entry.meta?.sync_status === 'ok').length;
  const metaStaleCount = metaEntries.filter((entry) => entry.meta?.sync_status === 'stale').length;
  const metaNoDataCount = metaEntries.filter(
    (entry) => !entry.meta || entry.meta.sync_status === 'no_data',
  ).length;

  const clientSummaries = clients.map(c => {
    const monthRow = monthlyKpis.find(
      (kpi) => kpi.client_id === c.id && getMonthKey(kpi.month) === executiveMonth,
    ) ?? null;
    return { client: c, monthRow, health: healthByClient[c.id] };
  }).sort((a, b) => (b.monthRow?.ad_roas ?? 0) - (a.monthRow?.ad_roas ?? 0));

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard General</h1>
          <p className="page-subtitle">Resumen ejecutivo · {executiveMonthLabel}</p>
        </div>
        <div className="header-actions">
          {unreadCount > 0 && (
            <Link to="/alerts" className="alert-banner">
              <AlertTriangle size={14} />
              {unreadCount} alerta{unreadCount !== 1 ? 's' : ''} sin revisar
            </Link>
          )}
        </div>
      </div>

      <div className="operational-summary-row dashboard-period-legend">
        <span className="meta-chip">KPIs y ranking: {executiveMonthLabel}</span>
        <span className="meta-chip">Riesgo, tareas y alertas: lectura operativa actual</span>
        <span className="meta-chip">Meta: sync actual + MTD del mes en curso</span>
      </div>

      {/* Global KPIs */}
      <div className="kpi-row">
        <KpiBox icon={<DollarSign size={18} />} label={`Ads ${executiveMonthLabel}`} value={formatCop(overall.spend)} color="blue" />
        <KpiBox icon={<TrendingUp size={18} />} label={`Ventas ${executiveMonthLabel}`} value={formatCop(overall.total_sales)} color="green" />
        <KpiBox icon={<BarChart3 size={18} />} label={`ROAS Ads ${executiveMonthLabel}`} value={formatRoas(overall.ad_roas)} color="amber" />
        <KpiBox icon={<MessageSquare size={18} />} label={`Mensajes ${executiveMonthLabel}`} value={formatNumber(overall.messages)} color="purple" />
        <KpiBox icon={<BarChart3 size={18} />} label="Clientes al día" value={String(healthyClients)} color="green" />
        <KpiBox icon={<AlertTriangle size={18} />} label="Clientes en riesgo" value={String(clientsAtRisk.length)} color="amber" />
      </div>

      <div className="dashboard-grid">
        {/* Client rankings */}
        <div className="card section-block">
          <div className="section-heading">
            <h2>Clientes por ROAS Ads</h2>
            <Link to="/clients" className="link-small">Ver todos <ArrowRight size={12} /></Link>
          </div>
          <p className="source-note">Ranking del mes ejecutivo: {executiveMonthLabel}.</p>
          <div className="client-ranking">
            {clientSummaries.length === 0 ? (
              <p className="empty-note">No hay clientes o metricas cargadas todavia.</p>
            ) : (
              clientSummaries.map(({ client, monthRow, health }, i) => (
                <Link key={client.id} to={`/clients/${client.id}`} className="client-rank-row">
                  <span className={`rank-num ${i === 0 ? 'rank-top' : ''}`}>#{i + 1}</span>
                  <div className="rank-info">
                    <span className="rank-name">{client.name}</span>
                    <span className="rank-niche">{client.niche}</span>
                    {health && (
                      <span className={`health-badge status-${health.status}`}>
                        Salud {health.score} · {healthStatusLabel(health.status)}
                      </span>
                    )}
                  </div>
                  <div className="rank-metrics">
                    <span className={`roas-pill ${(monthRow?.ad_roas ?? 0) >= 3 ? 'roas-good' : (monthRow?.ad_roas ?? 0) >= 2 ? 'roas-ok' : 'roas-low'}`}>
                      {formatRoas(monthRow?.ad_roas ?? 0)}
                    </span>
                    <span className="rank-spend">{formatCop(monthRow?.spend ?? 0)}</span>
                    {(monthRow?.total_sales ?? 0) > 0 && (
                      <span className="rank-sales">↳ {formatCop(monthRow?.total_sales ?? 0)}</span>
                    )}
                  </div>
                  <ArrowRight size={14} className="rank-arrow" />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="card section-block">
          <div className="section-heading">
            <h2>Clientes en riesgo</h2>
            <span className="badge-count">{clientsAtRisk.length}</span>
          </div>
          <p className="source-note">Lectura operativa actual sobre salud, tareas y alertas.</p>
          <div className="task-list-compact">
            {clientsAtRisk.length === 0 ? (
              <p className="empty-note">Todos los clientes estan al dia.</p>
            ) : (
              clientsAtRisk.slice(0, 6).map(({ client, health, issues }) => (
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
        </div>

        <div className="card section-block">
          <div className="section-heading">
            <h2>Estado Meta</h2>
            <span className="badge-count">{metaStaleCount}</span>
          </div>
          <p className="source-note">Sync actual por cuenta y KPI MTD del mes en curso.</p>
          <div className="task-list-compact">
            {metaEntries.length === 0 ? (
              <p className="empty-note">No hay clientes activos para revisar sincronización Meta.</p>
            ) : (
              metaEntries.map(({ client, meta }) => (
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
                  <span className="type-chip">
                    {meta?.has_mtd_data ? formatCop(meta.mtd_spend) : 'MTD vacío'}
                  </span>
                  <span className="type-chip">
                    {meta?.has_mtd_data ? formatRoas(meta.mtd_ad_roas) : 'ROAS —'}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Pending tasks */}
        <div className="card section-block">
          <div className="section-heading">
            <h2>Tareas Pendientes</h2>
            <span className="badge-count">{pendingTasks}</span>
          </div>
          <p className="source-note">Tareas abiertas hoy. No depende del mes ejecutivo.</p>
          <div className="task-list-compact">
            {tasks.filter(t => t.status === 'pending').slice(0, 5).map(task => (
              <div key={task.id} className="task-item-compact">
                <span className={`priority-dot priority-${task.priority}`} />
                <div className="task-info-compact">
                  <span className="task-title-compact">{task.title}</span>
                  {task.due_date && <span className="task-due">{new Date(task.due_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>}
                </div>
                <span className={`type-chip type-${task.type}`}>{task.type}</span>
              </div>
            ))}
            {pendingTasks === 0 && <p className="empty-note">No hay tareas pendientes 🎉</p>}
          </div>
        </div>

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <div className="card section-block alert-card-section">
            <div className="section-heading">
              <h2>⚠️ Alertas Críticas</h2>
            </div>
            {criticalAlerts.map(a => (
              <div key={a.id} className="alert-item critical">
                <strong>{a.title}</strong>
                {a.body && <p>{a.body}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Agency insight */}
        <div className="card section-block">
          <div className="section-heading">
            <h2>Objetivos especiales</h2>
          </div>
          <p className="source-note">
            Lectura del mes ejecutivo con la fuente actual de Ads. No mezcla mensajes, perfil y video
            como el mismo resultado.
          </p>
          <div className="operational-summary-row">
            <span className="meta-chip">{executiveMonthLabel}</span>
            <span className={`meta-chip ${adDataOriginClass(executiveMarketing.sourceOrigin)}`}>
              {adDataOriginLabel(executiveMarketing.sourceOrigin)}
            </span>
            <span className="meta-chip">Fuente base: raw_actions agregados por cuenta/día</span>
          </div>
          <div className="metric-grid-4">
            <MetricBoxMini
              label="Mensajes iniciados"
              value={formatNumber(executiveMarketing.messagingStarted)}
            />
            <MetricBoxMini
              label="Primeras respuestas"
              value={formatNullableMetric(executiveMarketing.messagingFirstReply)}
            />
            <MetricBoxMini
              label="Conexiones de mensaje"
              value={formatNumber(executiveMarketing.messagingConnections)}
            />
            <MetricBoxMini
              label="Visualizaciones de video"
              value={formatNullableMetric(executiveMarketing.videoViews)}
            />
            <MetricBoxMini
              label="Visitas al perfil"
              value={formatNullableMetric(executiveMarketing.profileVisits, 'Sin dato')}
            />
            <MetricBoxMini
              label="Thruplays"
              value={formatNullableMetric(executiveMarketing.thruplays, 'Sin dato')}
            />
            <MetricBoxMini
              label="Video 25%"
              value={formatNullablePct(executiveMarketing.video25, executiveMarketing.videoViews)}
            />
            <MetricBoxMini
              label="Video 50%"
              value={formatNullablePct(executiveMarketing.video50, executiveMarketing.videoViews)}
            />
          </div>
          <div className="special-metrics-list">
            <SpecialMetricRow
              title="Mix de inversión por objetivo"
              status="Pendiente de fuente"
              detail="Requiere spend por campaña y clasificación de objetivo. Hoy ad_metrics agrega por cuenta y día."
            />
            <SpecialMetricRow
              title="CPR ponderado de mensajes"
              status="Pendiente de fuente"
              detail={`Mensajes iniciados detectados: ${formatNumber(executiveMarketing.messagingStarted)}. Falta gasto aislado de campañas de mensajes.`}
            />
            <SpecialMetricRow
              title="Costo por visita al perfil"
              status={executiveMarketing.profileVisits == null ? 'Sin dato' : 'Pendiente de fuente'}
              detail={
                executiveMarketing.profileVisits == null
                  ? 'La fuente actual no está trayendo profile_visit_view.'
                  : 'Hay visitas detectadas, pero falta gasto separado de campañas de perfil.'
              }
            />
            <SpecialMetricRow
              title="Costo por thruplay"
              status={executiveMarketing.thruplays == null ? 'Sin dato' : 'Pendiente de fuente'}
              detail={
                executiveMarketing.thruplays == null
                  ? 'La fuente actual no está trayendo video_thruplay_watched_actions.'
                  : 'Hay thruplays detectados, pero falta gasto separado de campañas de video.'
              }
            />
            <SpecialMetricRow
              title="Top campañas y concentración de gasto"
              status="Pendiente de fuente"
              detail="Requiere campaign_id / campaign_name y spend por campaña para ranking y top 3."
            />
          </div>
        </div>

        <div className="card section-block">
          <div className="section-heading">
            <h2>Crecimiento social</h2>
          </div>
          <p className="source-note">
            Seguidores cargados al cierre mensual. No se infieren desde Ads. Las visitas al perfil
            usan cierre manual y, si falta, fallback desde Ads solo cuando existe `profile_visit_view`.
          </p>
          <div className="operational-summary-row">
            <span className="meta-chip">{executiveMonthLabel}</span>
            <span className="meta-chip source-manual">Seguidores: fuente manual mensual</span>
            <span className="meta-chip source-unknown">Costo por seguidor: pendiente de fuente</span>
          </div>
          <div className="metric-grid-4">
            <MetricBoxMini
              label="Nuevos seguidores del mes"
              value={hasFollowerData ? formatNumber(socialFollowersTotal) : 'Sin dato'}
            />
            <MetricBoxMini
              label="Visitas al perfil del mes"
              value={
                socialProfileVisitsRows.length > 0
                  ? formatNumber(socialProfileVisitsTotal)
                  : 'Sin dato'
              }
            />
            <MetricBoxMini
              label="Conversión visita → seguidor"
              value={socialConversion != null ? `${socialConversion.toFixed(1)}%` : '—'}
            />
            <MetricBoxMini label="Costo por seguidor" value="Pendiente de fuente" />
          </div>
          {executiveSocialRows.length === 0 ? (
            <p className="empty-note">Todavía no hay cierres sociales mensuales para el mes ejecutivo.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Fuente</th>
                    <th className="num-col">Seguidores</th>
                    <th className="num-col">Visitas perfil</th>
                    <th className="num-col">Conversión</th>
                    <th className="num-col">Costo seguidor</th>
                  </tr>
                </thead>
                <tbody>
                  {executiveSocialRows.map((entry) => (
                    <tr key={entry.clientId}>
                      <td>{entry.clientName}</td>
                      <td>
                        <span
                          className={`meta-chip ${
                            entry.socialMetric ? 'source-manual' : adDataOriginClass(entry.profileVisits.sourceOrigin)
                          }`}
                        >
                          {entry.socialMetric ? 'Manual mensual' : entry.profileVisits.sourceLabel}
                        </span>
                      </td>
                      <td className="num-col">
                        {entry.socialMetric ? formatNumber(entry.socialMetric.new_followers) : 'Sin dato'}
                      </td>
                      <td className="num-col">
                        {entry.profileVisits.value != null ? formatNumber(entry.profileVisits.value) : 'Sin dato'}
                      </td>
                      <td className="num-col">
                        {entry.followerConversion != null ? `${entry.followerConversion.toFixed(1)}%` : '—'}
                      </td>
                      <td className="num-col">Pendiente de fuente</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="source-note">
            `new_followers` sale solo de `social_monthly_metrics`. `profile_visits` prioriza cierre
            manual y luego Ads si ese action type existe.
          </p>
        </div>

        <div className="card section-block insight-card">
          <div className="section-heading"><h2>Vista Estratégica</h2></div>
          <div className="insight-stats">
            <div className="insight-stat">
              <span className="insight-num">{clients.filter(c => c.status === 'active').length}</span>
              <span className="insight-label">clientes activos</span>
            </div>
            <div className="insight-stat">
              <span className="insight-num">
                {clientSummaries.filter((entry) => (entry.monthRow?.ad_roas ?? 0) >= 3).length}
              </span>
              <span className="insight-label">ROAS ≥ 3x</span>
            </div>
            <div className="insight-stat">
              <span className="insight-num">{pendingTasks}</span>
              <span className="insight-label">tareas abiertas</span>
            </div>
            <div className="insight-stat">
              <span className="insight-num">{unreadCount}</span>
              <span className="insight-label">alertas nuevas</span>
            </div>
            <div className="insight-stat">
              <span className="insight-num">{healthyClients}</span>
              <span className="insight-label">clientes al día</span>
            </div>
            <div className="insight-stat">
              <span className="insight-num">{metaOkCount}</span>
              <span className="insight-label">sync Meta OK</span>
            </div>
            <div className="insight-stat">
              <span className="insight-num">{metaStaleCount}</span>
              <span className="insight-label">sync Meta stale</span>
            </div>
            <div className="insight-stat">
              <span className="insight-num">{metaNoDataCount}</span>
              <span className="insight-label">sin datos Meta</span>
            </div>
          </div>
          <p className="insight-text">
            Mes ejecutivo {executiveMonthLabel}: {formatRoas(overall.ad_roas)} de ROAS Ads con {formatCop(overall.spend)} de inversión.
            {overall.total_sales > 0 && ` Ventas reportadas del mes: ${formatCop(overall.total_sales)}.`}
            {rollingOverall.total_sales > 0 && ` Rolling operativo 30d: ${formatCop(rollingOverall.total_sales)} en ventas.`}
          </p>
        </div>
      </div>
    </div>
  );
}

function useDashboardWithCounts() {
  const dashboard = useDashboard(30);
  return {
    ...dashboard,
    unreadCount: dashboard.alerts.filter((alert) => alert.status === 'unread').length,
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

function KpiBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
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

function SpecialMetricRow({
  title,
  status,
  detail,
}: {
  title: string;
  status: string;
  detail: string;
}) {
  return (
    <div className="special-metric-row">
      <div className="special-metric-main">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <span className="status-pill status-gray">{status}</span>
    </div>
  );
}

function formatNullableMetric(value: number | null, fallback = '—'): string {
  if (value == null) return fallback;
  return formatNumber(value);
}

function formatNullablePct(part: number | null, total: number | null): string {
  if (part == null || total == null || total <= 0) return 'Sin dato';
  return `${((part / total) * 100).toFixed(1)}%`;
}
