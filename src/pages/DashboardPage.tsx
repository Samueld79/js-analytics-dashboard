import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  DollarSign,
  MessageSquare,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useAuth } from '../hooks/useAuth';
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
} from '../lib/utils';
import { buildClientMetaOverviewByClient } from '../services/meta';
import { getMonthKey, getMonthLabel, listAvailableMonthKeys } from '../utils/monthLabel';

const EMPTY_CLIENT_SCOPE = '00000000-0000-0000-0000-000000000000';

export function DashboardPage() {
  const { clients } = useClients();
  const { isInternal, accessibleClientIds, defaultClientId } = useAuth();
  const { alerts, unreadCount } = useAlerts();
  const { tasks } = useTasks();
  const scopedClientId =
    !isInternal && accessibleClientIds.length <= 1
      ? defaultClientId ?? EMPTY_CLIENT_SCOPE
      : undefined;
  const { monthlyKpis } = useMonthlyOperatingKpis(scopedClientId, 6);
  const { metrics: rawAdMetrics } = useAdMetrics(scopedClientId, 180);
  const { sales } = useDailySales({ clientId: scopedClientId, days: 180 });
  const { metrics: socialMonthlyMetrics } = useSocialMonthlyMetrics(scopedClientId, 12);
  const { syncRows } = useMetaSyncRows(scopedClientId);
  const visibleClientIds = useMemo(
    () => new Set(isInternal ? clients.map((client) => client.id) : accessibleClientIds),
    [accessibleClientIds, clients, isInternal],
  );
  const visibleClients = useMemo(
    () =>
      isInternal
        ? clients
        : clients.filter((client) => visibleClientIds.has(client.id)),
    [clients, isInternal, visibleClientIds],
  );
  const scopedMonthlyKpis = useMemo(
    () =>
      isInternal
        ? monthlyKpis
        : monthlyKpis.filter((row) => visibleClientIds.has(row.client_id)),
    [isInternal, monthlyKpis, visibleClientIds],
  );
  const scopedAdMetrics = useMemo(
    () =>
      isInternal
        ? rawAdMetrics
        : rawAdMetrics.filter((row) => visibleClientIds.has(row.client_id)),
    [isInternal, rawAdMetrics, visibleClientIds],
  );
  const scopedSales = useMemo(
    () =>
      isInternal
        ? sales
        : sales.filter((row) => visibleClientIds.has(row.client_id)),
    [isInternal, sales, visibleClientIds],
  );
  const scopedSocialMonthlyMetrics = useMemo(
    () =>
      isInternal
        ? socialMonthlyMetrics
        : socialMonthlyMetrics.filter((row) => visibleClientIds.has(row.client_id)),
    [isInternal, socialMonthlyMetrics, visibleClientIds],
  );
  const scopedSyncRows = useMemo(
    () =>
      isInternal
        ? syncRows
        : syncRows.filter((row) => visibleClientIds.has(row.client_id)),
    [isInternal, syncRows, visibleClientIds],
  );
  const scopedAlerts = useMemo(
    () =>
      isInternal
        ? alerts
        : alerts.filter((alert) => alert.client_id && visibleClientIds.has(alert.client_id)),
    [alerts, isInternal, visibleClientIds],
  );
  const scopedTasks = useMemo(
    () =>
      isInternal
        ? tasks
        : tasks.filter((task) => task.client_id && visibleClientIds.has(task.client_id)),
    [isInternal, tasks, visibleClientIds],
  );

  const executiveMonth =
    listAvailableMonthKeys([
      ...scopedMonthlyKpis.map((row) => row.month),
      ...scopedAdMetrics.map((row) => row.date),
      ...scopedSales.map((row) => row.date),
      ...scopedSocialMonthlyMetrics.map((row) => row.month),
    ])[0] ?? new Date().toISOString().slice(0, 7);
  const executiveMonthLabel = getMonthLabel(executiveMonth);
  const latestSyncAt = [...scopedSyncRows]
    .map((row) => row.last_sync_at)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const portalClientName =
    !isInternal && visibleClients.length === 1 ? visibleClients[0]?.name ?? 'Mi empresa' : null;

  const executiveRows = scopedMonthlyKpis.filter((row) => getMonthKey(row.month) === executiveMonth);
  const executiveAdMetrics = scopedAdMetrics.filter((row) => getMonthKey(row.date) === executiveMonth);
  const executiveSales = scopedSales.filter((row) => getMonthKey(row.date) === executiveMonth);
  const executiveSocialMetrics = scopedSocialMonthlyMetrics.filter(
    (row) => getMonthKey(row.month) === executiveMonth,
  );

  const metaByClient = useMemo(
    () =>
      buildClientMetaOverviewByClient({
        clientIds: visibleClients.map((client) => client.id),
        monthlyKpis: scopedMonthlyKpis,
        syncRows: scopedSyncRows,
      }),
    [scopedMonthlyKpis, scopedSyncRows, visibleClients],
  );

  const overall = executiveRows.length
    ? sumOperatingKpis(executiveRows)
    : buildCombinedMonthTotals(executiveAdMetrics, executiveSales);
  const marketing = buildMarketingActionSummary(executiveAdMetrics);
  const specialSummary = buildMonthlySpecialMetricsSummary(executiveSocialMetrics);

  const clientNameById = useMemo(
    () => new Map(visibleClients.map((client) => [client.id, client.name])),
    [visibleClients],
  );

  const visibleOpenAlerts = useMemo(
    () =>
      scopedAlerts.filter(
        (alert) => ['unread', 'read'].includes(alert.status) && !isAlertSnoozed(alert),
      ),
    [scopedAlerts],
  );

  const clientAlertCount = new Map<string, number>();
  const clientCriticalAlertCount = new Map<string, number>();

  visibleOpenAlerts.forEach((alert) => {
    if (!alert.client_id) return;
    clientAlertCount.set(alert.client_id, (clientAlertCount.get(alert.client_id) ?? 0) + 1);

    if (alert.severity === 'critical') {
      clientCriticalAlertCount.set(
        alert.client_id,
        (clientCriticalAlertCount.get(alert.client_id) ?? 0) + 1,
      );
    }
  });

  const recentAlerts = [...visibleOpenAlerts].sort(sortAlertsBySeverity).slice(0, 5);
  const criticalAlerts = visibleOpenAlerts.filter((alert) => alert.severity === 'critical');
  const clientsWithAlerts = new Set(visibleOpenAlerts.map((alert) => alert.client_id).filter(Boolean)).size;
  const pendingTasks = scopedTasks.filter((task) => task.status === 'pending').length;

  const socialRows = visibleClients
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
  const salesRecordCount = executiveSales.length;
  const costPerConversation =
    marketing.messagingStarted > 0 ? overall.spend / marketing.messagingStarted : null;
  const averageTicket =
    salesRecordCount > 0 ? overall.total_sales / salesRecordCount : null;
  const specialClickSignals = specialSummary.whatsappClicks + specialSummary.linkClicks;
  const commercialSignalRows = [
    {
      label: 'Seguidores nuevos',
      value: socialFollowersTotal > 0 ? formatNumber(socialFollowersTotal) : 'Sin dato',
      muted: socialFollowersTotal <= 0,
    },
    {
      label: 'Visitas al perfil',
      value:
        socialProfileVisitsTotal > 0 ? formatNumber(socialProfileVisitsTotal) : 'Sin dato',
      muted: socialProfileVisitsTotal <= 0,
    },
    {
      label: 'Clicks WhatsApp + link',
      value: specialClickSignals > 0 ? formatNumber(specialClickSignals) : 'Sin cierre',
      muted: specialClickSignals <= 0,
    },
    {
      label: 'Registros de venta',
      value: formatNumber(salesRecordCount),
      muted: salesRecordCount === 0,
    },
  ];

  const clientExecutiveRows = visibleClients
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
  const topSalesClients = [...clientExecutiveRows]
    .filter((entry) => entry.monthTotals.total_sales > 0)
    .sort((left, right) => {
      if (right.monthTotals.total_sales !== left.monthTotals.total_sales) {
        return right.monthTotals.total_sales - left.monthTotals.total_sales;
      }
      if (right.monthTotals.real_roas !== left.monthTotals.real_roas) {
        return right.monthTotals.real_roas - left.monthTotals.real_roas;
      }
      return right.monthTotals.spend - left.monthTotals.spend;
    })
    .slice(0, 4);
  const topRoasClients = [...clientExecutiveRows]
    .filter((entry) => entry.monthTotals.spend > 0 && entry.monthTotals.total_sales > 0)
    .sort((left, right) => {
      if (right.monthTotals.real_roas !== left.monthTotals.real_roas) {
        return right.monthTotals.real_roas - left.monthTotals.real_roas;
      }
      if (right.monthTotals.total_sales !== left.monthTotals.total_sales) {
        return right.monthTotals.total_sales - left.monthTotals.total_sales;
      }
      return right.monthTotals.spend - left.monthTotals.spend;
    })
    .slice(0, 4);
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

  return (
    <div className="page-content reporting-page executive-dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{portalClientName ? `Resultados de ${portalClientName}` : 'Dashboard General'}</h1>
          <p className="page-subtitle">
            Tablero ejecutivo del mes visible · {executiveMonthLabel}
            {!isInternal ? ' · portal cliente filtrado por membresía' : ''}
          </p>
        </div>
        <div className="header-actions">
          {isInternal && unreadCount > 0 && (
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
              <h2>Resumen ejecutivo</h2>
            </div>
            <p className="source-note">
              Mes visible para negocio arriba. Riesgo, alertas y estado Meta siguen leyendo la
              operación actual.
            </p>
            <div className="period-chip-row">
              <span className="meta-chip">{executiveMonthLabel}</span>
              {isInternal && (
                <>
                  <span className="meta-chip">KPIs: mensual</span>
                  <span className="meta-chip">Riesgo y Meta: actual</span>
                  <span className="meta-chip">ROAS operativo = ventas manuales / inversión</span>
                </>
              )}
              <span className="meta-chip">
                {latestSyncAt ? `Último sync Meta ${formatDateTime(latestSyncAt)}` : 'Meta sin sync reciente'}
              </span>
              {isInternal && (
                <span className="meta-chip">Supabase real</span>
              )}
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
          icon={<MessageSquare size={18} />}
          label={`Conversaciones ${executiveMonthLabel}`}
          value={formatNumber(marketing.messagingStarted)}
          color="purple"
        />
        <KpiBox
          icon={<BarChart3 size={18} />}
          label="Costo por conversación"
          value={costPerConversation != null ? formatCop(costPerConversation) : 'Sin dato'}
          color="amber"
        />
        <KpiBox
          icon={<TrendingUp size={18} />}
          label={`Ventas manuales ${executiveMonthLabel}`}
          value={formatCop(overall.total_sales)}
          color="green"
        />
        <KpiBox
          icon={<Users size={18} />}
          label="Ticket promedio"
          value={averageTicket != null ? formatCop(averageTicket) : 'Sin dato'}
          color="blue"
        />
        <KpiBox
          icon={<ShieldAlert size={18} />}
          label="Clientes con alertas"
          value={String(clientsWithAlerts)}
          color="red"
        />
      </div>

      <div className="executive-focus-grid">
        <section className="card section-block executive-spotlight-card">
          <div className="section-heading">
            <h2>Clientes destacados</h2>
            <Link to={isInternal ? '/clients' : '/mi-espacio'} className="link-small">
              {isInternal ? 'Ver clientes' : 'Ver mi empresa'} <ArrowRight size={12} />
            </Link>
          </div>
          <p className="source-note">
            Dos cortes rápidos del mes visible: quién más vende y quién mejor convierte inversión
            en ventas reales.
          </p>

          {topClients.length === 0 ? (
            <p className="empty-note">No hay clientes con data suficiente para destacar este mes.</p>
          ) : (
            <div className="executive-duo-grid">
              <div className="executive-list-block">
                <div className="section-heading section-heading-mini">
                  <h3>Top ventas</h3>
                </div>
                <div className="executive-client-list">
                  {topSalesClients.map(({ client, monthTotals, alertCount }) => (
                    <Link key={`sales-${client.id}`} to={`/clients/${client.id}`} className="executive-client-row">
                      <div className="executive-client-main">
                        <div className="table-primary-cell">
                          <strong>{client.name}</strong>
                          <span className="table-secondary-note">
                            {formatCop(monthTotals.total_sales)} ventas · {formatCop(monthTotals.spend)} inversión
                          </span>
                        </div>
                        {alertCount > 0 && (
                          <div className="period-chip-row">
                            <span className="status-pill status-red">{alertCount} alerta(s)</span>
                          </div>
                        )}
                      </div>
                      <div className="executive-client-metrics">
                        <span className={roasClass(monthTotals.real_roas)}>
                          {formatRoas(monthTotals.real_roas)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="executive-list-block">
                <div className="section-heading section-heading-mini">
                  <h3>Top ROAS operativo</h3>
                </div>
                <div className="executive-client-list">
                  {topRoasClients.map(({ client, monthTotals, meta }) => (
                    <Link key={`roas-${client.id}`} to={`/clients/${client.id}`} className="executive-client-row">
                      <div className="executive-client-main">
                        <div className="table-primary-cell">
                          <strong>{client.name}</strong>
                          <span className="table-secondary-note">
                            {formatCop(monthTotals.total_sales)} ventas · {formatCop(monthTotals.spend)} inversión
                          </span>
                        </div>
                        {meta && (
                          <div className="period-chip-row">
                            <span className={`status-pill ${metaSyncStatusClass(meta.sync_status)}`}>
                              {metaSyncStatusLabel(meta.sync_status)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="executive-client-metrics">
                        <span className={roasClass(monthTotals.real_roas)}>
                          {formatRoas(monthTotals.real_roas)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="card section-block executive-signals-card">
          <div className="section-heading">
            <h2>Señales comerciales del mes</h2>
          </div>
          <p className="source-note">
            Cierres sociales, clicks reportados y tracción comercial real del mes visible.
          </p>
          <div className="executive-micro-grid">
            {commercialSignalRows.map((item) => (
              <MetricBoxMini key={item.label} label={item.label} value={item.value} muted={item.muted} />
            ))}
          </div>
          <div className="period-chip-row">
            <span className="meta-chip source-automatic">
              ROAS operativo {formatRoas(overall.real_roas)}
            </span>
            {socialFollowersTotal > 0 && (
              <span className="meta-chip source-manual">
                Conversión visita → seguidor {socialConversion != null ? `${socialConversion.toFixed(1)}%` : '—'}
              </span>
            )}
            {specialSummary.newCustomersReported > 0 && (
              <span className="meta-chip source-manual">
                {formatNumber(specialSummary.newCustomersReported)} nuevos clientes reportados
              </span>
            )}
            <span className={`meta-chip ${adDataOriginClass(marketing.sourceOrigin)}`}>
              Ads {adDataOriginLabel(marketing.sourceOrigin)}
            </span>
          </div>
        </section>

        {isInternal && (
        <section className="card section-block executive-radar-card">
          <div className="section-heading">
            <h2>Radar operativo</h2>
            <Link to="/alerts" className="link-small">
              Ver alertas <ArrowRight size={12} />
            </Link>
          </div>
          <p className="source-note">
            Lo que requiere atención hoy: alertas abiertas, riesgo operativo y sincronización.
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
        )}
      </div>

      {isInternal && (
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
            <span className="badge-count">{visibleOpenAlerts.length}</span>
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

      </div>
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
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`metric-box ${muted ? 'metric-box-muted' : ''}`}>
      <span className="metric-box-label">{label}</span>
      <span className="metric-box-value">{value}</span>
    </div>
  );
}
