import { useDashboard } from '../hooks/useDashboard';
import { formatCop, formatNumber, formatRoas, healthStatusLabel, sumOperatingKpis } from '../lib/utils';
import { Link } from 'react-router-dom';
import { TrendingUp, MessageSquare, DollarSign, BarChart3, AlertTriangle, ArrowRight } from 'lucide-react';

export function DashboardPage() {
  const { clients, alerts, dailyKpis, monthlyKpis, tasks, healthByClient, issuesByClient, unreadCount } = useDashboardWithCounts();
  const overall = sumOperatingKpis(dailyKpis);
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

  const clientSummaries = clients.map(c => {
    const clientDaily = dailyKpis.filter(kpi => kpi.client_id === c.id);
    const clientMonthly = monthlyKpis.filter(kpi => kpi.client_id === c.id);
    const totals = sumOperatingKpis(clientDaily);
    const latestMonth = [...clientMonthly].sort((a, b) => b.month.localeCompare(a.month))[0] ?? null;
    return { client: c, totals, latestMonth, health: healthByClient[c.id] };
  }).sort((a, b) => b.totals.ad_roas - a.totals.ad_roas);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard General</h1>
          <p className="page-subtitle">Resumen operativo · Últimos 30 días</p>
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

      {/* Global KPIs */}
      <div className="kpi-row">
        <KpiBox icon={<DollarSign size={18} />} label="Inversión total" value={formatCop(overall.spend)} color="blue" />
        <KpiBox icon={<TrendingUp size={18} />} label="Ventas totales" value={formatCop(overall.total_sales)} color="green" />
        <KpiBox icon={<BarChart3 size={18} />} label="ROAS Ads" value={formatRoas(overall.ad_roas)} color="amber" />
        <KpiBox icon={<MessageSquare size={18} />} label="Mensajes totales" value={formatNumber(overall.messages)} color="purple" />
        <KpiBox icon={<BarChart3 size={18} />} label="Clientes al día" value={String(healthyClients)} color="green" />
        <KpiBox icon={<AlertTriangle size={18} />} label="Clientes en riesgo" value={String(clientsAtRisk.length)} color="amber" />
      </div>

      <div className="dashboard-grid">
        {/* Client rankings */}
        <div className="card section-block">
          <div className="section-heading">
            <h2>Clientes por ROAS</h2>
            <Link to="/clients" className="link-small">Ver todos <ArrowRight size={12} /></Link>
          </div>
          <div className="client-ranking">
            {clientSummaries.length === 0 ? (
              <p className="empty-note">No hay clientes o metricas cargadas todavia.</p>
            ) : (
              clientSummaries.map(({ client, totals, latestMonth, health }, i) => (
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
                    <span className={`roas-pill ${totals.ad_roas >= 3 ? 'roas-good' : totals.ad_roas >= 2 ? 'roas-ok' : 'roas-low'}`}>
                      {formatRoas(totals.ad_roas)}
                    </span>
                    <span className="rank-spend">{formatCop(totals.spend)}</span>
                    {(latestMonth?.total_sales ?? totals.total_sales) > 0 && (
                      <span className="rank-sales">↳ {formatCop(latestMonth?.total_sales ?? totals.total_sales)}</span>
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

        {/* Pending tasks */}
        <div className="card section-block">
          <div className="section-heading">
            <h2>Tareas Pendientes</h2>
            <span className="badge-count">{pendingTasks}</span>
          </div>
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
        <div className="card section-block insight-card">
          <div className="section-heading"><h2>Vista Estratégica</h2></div>
          <div className="insight-stats">
            <div className="insight-stat">
              <span className="insight-num">{clients.filter(c => c.status === 'active').length}</span>
              <span className="insight-label">clientes activos</span>
            </div>
            <div className="insight-stat">
              <span className="insight-num">{clientSummaries.filter(c => c.totals.ad_roas >= 3).length}</span>
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
          </div>
          <p className="insight-text">
            La operación muestra {formatRoas(overall.ad_roas)} de ROAS Ads con {formatCop(overall.spend)} de inversión.
            {overall.total_sales > 0 && ` Ventas reportadas: ${formatCop(overall.total_sales)}.`}
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
