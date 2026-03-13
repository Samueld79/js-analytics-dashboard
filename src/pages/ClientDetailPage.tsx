import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart2,
  TrendingUp,
  ClipboardList,
  CheckSquare,
  FolderOpen,
  MapPin,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { ClientFileModal } from '../components/ClientFileModal';
import { SalesModal } from '../components/SalesModal';
import { useClientWorkspace } from '../hooks/useClientWorkspace';
import {
  formatCop,
  formatDate,
  formatNumber,
  formatRoas,
  healthStatusLabel,
  statusLabel,
  sumOperatingKpis,
} from '../lib/utils';
import type {
  AdMetric,
  Alert,
  Client,
  ClientHealthScore,
  ClientFile,
  ClientDailyOperatingKpi,
  DailySale,
  OperationalIssue,
  Strategy,
  Task,
  TaskUpdateInput,
} from '../lib/supabase';

type Tab = 'overview' | 'metrics' | 'sales' | 'strategies' | 'tasks' | 'files';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    client,
    metrics,
    dailyKpis,
    sales,
    strategies,
    tasks,
    alerts,
    files,
    health,
    issues,
    loading,
    addSale,
    addFile,
    updateTask,
  } = useClientWorkspace(id, 30);
  const [tab, setTab] = useState<Tab>('overview');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);

  const recentOperatingKpis = useMemo(
    () => [...dailyKpis].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7),
    [dailyKpis],
  );

  if (loading) {
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
          <h3>Cliente no encontrado</h3>
          <p>Verifica que el cliente exista en Supabase y que tengas acceso a su workspace.</p>
        </div>
      </div>
    );
  }

  const operatingTotals = sumOperatingKpis(dailyKpis);
  const pendingTasks = tasks.filter((task) => task.status === 'pending');
  const criticalAlerts = alerts.filter(
    (alert) => alert.severity === 'critical' && ['unread', 'read'].includes(alert.status),
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Resumen', icon: <BarChart2 size={14} /> },
    { key: 'metrics', label: 'Ads', icon: <TrendingUp size={14} /> },
    { key: 'sales', label: 'Ventas', icon: <TrendingUp size={14} /> },
    { key: 'strategies', label: 'Estrategias', icon: <ClipboardList size={14} /> },
    { key: 'tasks', label: 'Tareas', icon: <CheckSquare size={14} /> },
    { key: 'files', label: 'Archivos', icon: <FolderOpen size={14} /> },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <Link to="/clients" className="back-link"><ArrowLeft size={14} /> Clientes</Link>
          <div className="client-page-title">
            <h1 className="page-title">{client.name}</h1>
            <span className="client-niche-tag">{client.niche}</span>
          </div>
          {client.main_city && <span className="meta-chip"><MapPin size={11} /> {client.main_city}</span>}
          {client.drive_folder_url && (
            <a href={client.drive_folder_url} target="_blank" rel="noreferrer" className="meta-chip clickable">
              <ExternalLink size={11} /> Drive
            </a>
          )}
        </div>
        <button className="btn-primary" onClick={() => setShowSalesModal(true)}>
          + Registrar Ventas
        </button>
      </div>

      {(health || criticalAlerts.length > 0) && (
        <ClientOperationalBanner health={health} issues={issues} criticalAlerts={criticalAlerts} />
      )}

      <div className="kpi-strip">
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">Salud</span>
          <span className={`kpi-strip-value health-${health?.status ?? 'healthy'}`}>
            {health ? `${health.score} · ${healthStatusLabel(health.status)}` : '—'}
          </span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">Inversión 30d</span>
          <span className="kpi-strip-value">{formatCop(operatingTotals.spend)}</span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">ROAS Ads</span>
          <span className={`kpi-strip-value roas-color-${operatingTotals.ad_roas >= 3 ? 'good' : operatingTotals.ad_roas >= 2 ? 'ok' : 'low'}`}>
            {formatRoas(operatingTotals.ad_roas)}
          </span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">Mensajes</span>
          <span className="kpi-strip-value">{formatNumber(operatingTotals.messages)}</span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">ROAS Real</span>
          <span className={`kpi-strip-value roas-color-${operatingTotals.real_roas >= 3 ? 'good' : operatingTotals.real_roas >= 2 ? 'ok' : 'low'}`}>
            {formatRoas(operatingTotals.real_roas)}
          </span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">Ventas 30d</span>
          <span className="kpi-strip-value">{formatCop(operatingTotals.total_sales)}</span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">Tareas</span>
          <span className="kpi-strip-value">{pendingTasks.length} pendientes</span>
        </div>
      </div>

      <div className="tab-bar">
        {tabs.map((currentTab) => (
          <button
            key={currentTab.key}
            onClick={() => setTab(currentTab.key)}
            className={`tab-btn ${tab === currentTab.key ? 'active' : ''}`}
          >
            {currentTab.icon} {currentTab.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <ClientOverview
          client={client}
          health={health}
          issues={issues}
          operatingTotals={operatingTotals}
          operatingRows={recentOperatingKpis}
        />
      )}
      {tab === 'metrics' && <ClientMetricsTab metrics={metrics} />}
      {tab === 'sales' && <ClientSalesTab sales={sales} />}
      {tab === 'strategies' && <ClientStrategiesTab strategies={strategies} clientId={client.id} />}
      {tab === 'tasks' && <ClientTasksTab tasks={tasks} updateTask={updateTask} />}
      {tab === 'files' && (
        <ClientFilesTab
          files={files}
          strategies={strategies}
          onAddFile={() => setShowFileModal(true)}
        />
      )}

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

      {showFileModal && (
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
    </div>
  );
}

function ClientOverview({
  operatingTotals,
  operatingRows,
  client,
  health,
  issues,
}: {
  operatingTotals: ReturnType<typeof sumOperatingKpis>;
  operatingRows: ClientDailyOperatingKpi[];
  client: Client;
  health: ClientHealthScore | null;
  issues: OperationalIssue[];
}) {
  return (
    <div className="tab-content overview-grid">
      {health && (
        <div className="card section-block">
          <div className="section-heading"><h2>Salud operativa</h2></div>
          <div className="metric-grid-4">
            <MetricBox label="Score" value={String(health.score)} highlight={health.status === 'healthy' ? 'green' : health.status === 'warning' ? 'amber' : 'red'} />
            <MetricBox label="Estado" value={healthStatusLabel(health.status)} highlight={health.status === 'healthy' ? 'green' : health.status === 'warning' ? 'amber' : 'red'} />
            <MetricBox label="Alertas críticas" value={String(health.open_critical_alerts)} highlight={health.open_critical_alerts > 0 ? 'red' : undefined} />
            <MetricBox label="Tareas vencidas" value={String(health.overdue_tasks)} highlight={health.overdue_tasks > 0 ? 'amber' : undefined} />
            <MetricBox label="Ventas ayer" value={health.missing_sales_yesterday ? 'Faltan' : 'OK'} highlight={health.missing_sales_yesterday ? 'red' : 'green'} />
            <MetricBox label="Optimización" value={health.optimize_overdue ? 'Pendiente' : 'Al día'} highlight={health.optimize_overdue ? 'amber' : 'green'} />
            <MetricBox label="ROAS real" value={formatRoas(health.real_roas)} highlight={health.low_real_roas ? 'red' : 'green'} />
            <MetricBox label="Issues activos" value={String(issues.length)} highlight={issues.length > 0 ? 'amber' : 'green'} />
          </div>
        </div>
      )}

      <div className="card section-block">
        <div className="section-heading"><h2>Métricas Ads — Últimos 30 días</h2></div>
        <div className="metric-grid-4">
          <MetricBox label="Inversión" value={formatCop(operatingTotals.spend)} />
          <MetricBox label="ROAS Ads" value={formatRoas(operatingTotals.ad_roas)} highlight={operatingTotals.ad_roas >= 3 ? 'green' : operatingTotals.ad_roas >= 2 ? 'amber' : 'red'} />
          <MetricBox label="Compras" value={formatNumber(operatingTotals.purchases)} />
          <MetricBox label="Valor compras" value={formatCop(operatingTotals.purchase_value)} />
          <MetricBox label="Mensajes" value={formatNumber(operatingTotals.messages)} />
          <MetricBox label="Leads" value={formatNumber(operatingTotals.leads)} />
          <MetricBox label="Alcance" value={formatNumber(operatingTotals.reach)} />
          <MetricBox label="Impresiones" value={formatNumber(operatingTotals.impressions)} />
        </div>
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Ventas — Últimos 30 días</h2></div>
        {operatingTotals.total_sales > 0 ? (
          <div className="metric-grid-4">
            <MetricBox label="Total ventas" value={formatCop(operatingTotals.total_sales)} />
            <MetricBox label="Cliente nuevo" value={formatCop(operatingTotals.new_client_sales)} />
            <MetricBox label="Recompra" value={formatCop(operatingTotals.repeat_sales)} highlight={operatingTotals.repeat_sales > operatingTotals.new_client_sales ? 'green' : undefined} />
            <MetricBox label="Punto físico" value={formatCop(operatingTotals.physical_store_sales)} />
            <MetricBox label="Online" value={formatCop(operatingTotals.online_sales)} />
          </div>
        ) : (
          <p className="empty-note">No hay ventas registradas. Usa "Registrar Ventas" para comenzar.</p>
        )}
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Últimos 7 días — Ads</h2></div>
        {operatingRows.length === 0 ? (
          <p className="empty-note">Sin métricas recientes para este cliente.</p>
        ) : (
          <div className="mini-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num-col">Inversión</th>
                  <th className="num-col">ROAS</th>
                  <th className="num-col">Mensajes</th>
                  <th className="num-col">ROAS Real</th>
                </tr>
              </thead>
              <tbody>
                {operatingRows.map((row) => (
                  <tr key={`${row.client_id}-${row.date}`}>
                    <td>{formatDate(row.date)}</td>
                    <td className="num-col">{formatCop(row.spend)}</td>
                    <td className={`num-col ${row.ad_roas >= 3 ? 'text-green' : row.ad_roas >= 2 ? 'text-amber' : 'text-red'}`}>{formatRoas(row.ad_roas)}</td>
                    <td className="num-col">{formatNumber(row.messages)}</td>
                    <td className={`num-col ${row.real_roas >= 3 ? 'text-green' : row.real_roas >= 2 ? 'text-amber' : 'text-red'}`}>{formatRoas(row.real_roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Últimos 7 días — Ventas</h2></div>
        {operatingRows.length === 0 ? (
          <p className="empty-note">Todavía no hay ventas recientes registradas.</p>
        ) : (
          <div className="mini-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num-col">Total</th>
                  <th className="num-col">Nuevo</th>
                  <th className="num-col">Recompra</th>
                </tr>
              </thead>
              <tbody>
                {operatingRows.map((row) => (
                  <tr key={row.date}>
                    <td>{formatDate(row.date)}</td>
                    <td className="num-col">{formatCop(row.total_sales)}</td>
                    <td className="num-col">{formatCop(row.new_client_sales)}</td>
                    <td className="num-col">{formatCop(row.repeat_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {client.notes && (
        <div className="card section-block">
          <div className="section-heading"><h2>Notas del cliente</h2></div>
          <p className="notes-text">{client.notes}</p>
        </div>
      )}
    </div>
  );
}

function ClientOperationalBanner({
  health,
  issues,
  criticalAlerts,
}: {
  health: ClientHealthScore | null;
  issues: OperationalIssue[];
  criticalAlerts: Alert[];
}) {
  if (!health && criticalAlerts.length === 0) return null;

  return (
    <div className="card section-block operational-banner">
      <div className="section-heading">
        <h2>Estado operativo</h2>
      </div>
      {health && (
        <div className="operational-summary-row">
          <span className={`health-badge status-${health.status}`}>
            Salud {health.score} · {healthStatusLabel(health.status)}
          </span>
          {health.missing_sales_yesterday && <span className="meta-chip">Falta venta de ayer</span>}
          {health.optimize_overdue && <span className="meta-chip">Toca optimización</span>}
          {health.overdue_tasks > 0 && <span className="meta-chip">{health.overdue_tasks} tareas vencidas</span>}
          {health.low_real_roas && <span className="meta-chip">ROAS real bajo</span>}
        </div>
      )}
      {issues.length > 0 && (
        <div className="operational-issues-list">
          {issues.map((issue) => (
            <div key={issue.type} className={`operational-issue ${issue.severity}`}>
              <strong>{issue.title}</strong>
              <span>{issue.body}</span>
            </div>
          ))}
        </div>
      )}
      {criticalAlerts.length > 0 && (
        <div className="operational-critical-list">
          {criticalAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="alert-item critical">
              <strong>{alert.title}</strong>
              {alert.body && <p>{alert.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'green' | 'amber' | 'red';
}) {
  return (
    <div className="metric-box">
      <span className="metric-box-label">{label}</span>
      <span className={`metric-box-value ${highlight ? `text-${highlight}` : ''}`}>{value}</span>
    </div>
  );
}

function ClientMetricsTab({ metrics }: { metrics: AdMetric[] }) {
  const orderedMetrics = [...metrics].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="tab-content">
      <div className="card section-block">
        <div className="section-heading"><h2>Métricas diarias — 30 días</h2></div>
        {orderedMetrics.length === 0 ? (
          <p className="empty-note">No hay métricas cargadas para este cliente.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num-col">Inversión</th>
                  <th className="num-col">Alcance</th>
                  <th className="num-col">Impresiones</th>
                  <th className="num-col">Clics</th>
                  <th className="num-col">CPM</th>
                  <th className="num-col">CPC</th>
                  <th className="num-col">CTR</th>
                  <th className="num-col">Mensajes</th>
                  <th className="num-col">Leads</th>
                  <th className="num-col">Compras</th>
                  <th className="num-col">Valor</th>
                  <th className="num-col">ROAS</th>
                  <th className="num-col">CPR</th>
                </tr>
              </thead>
              <tbody>
                {orderedMetrics.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td className="num-col">{formatCop(row.spend)}</td>
                    <td className="num-col">{formatNumber(row.reach)}</td>
                    <td className="num-col">{formatNumber(row.impressions)}</td>
                    <td className="num-col">{formatNumber(row.clicks)}</td>
                    <td className="num-col">{formatCop(row.cpm)}</td>
                    <td className="num-col">{formatCop(row.cpc)}</td>
                    <td className="num-col">{row.ctr.toFixed(2)}%</td>
                    <td className="num-col">{formatNumber(row.messages)}</td>
                    <td className="num-col">{formatNumber(row.leads)}</td>
                    <td className="num-col">{formatNumber(row.purchases)}</td>
                    <td className="num-col">{formatCop(row.purchase_value)}</td>
                    <td className={`num-col ${row.roas >= 3 ? 'text-green' : row.roas >= 2 ? 'text-amber' : 'text-red'}`}>{formatRoas(row.roas)}</td>
                    <td className="num-col">{formatCop(row.cpr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientSalesTab({ sales }: { sales: DailySale[] }) {
  const orderedSales = [...sales].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="tab-content">
      <div className="card section-block">
        <div className="section-heading"><h2>Ventas diarias — 30 días</h2></div>
        {orderedSales.length === 0 ? (
          <p className="empty-note">No hay ventas cargadas para este cliente.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num-col">Total</th>
                  <th className="num-col">Nuevo</th>
                  <th className="num-col">Recompra</th>
                  <th className="num-col">Físico</th>
                  <th className="num-col">Online</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {orderedSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{formatDate(sale.date)}</td>
                    <td className="num-col">{formatCop(sale.total_sales)}</td>
                    <td className="num-col">{formatCop(sale.new_client_sales)}</td>
                    <td className="num-col">{formatCop(sale.repeat_sales)}</td>
                    <td className="num-col">{formatCop(sale.physical_store_sales)}</td>
                    <td className="num-col">{formatCop(sale.online_sales)}</td>
                    <td className="text-muted">{sale.observations ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientStrategiesTab({
  strategies,
  clientId,
}: {
  strategies: Strategy[];
  clientId: string;
}) {
  return (
    <div className="tab-content">
      <div className="strategy-tab-header">
        <Link to={`/strategies?client=${clientId}`} className="btn-secondary">Ver en módulo de estrategias</Link>
      </div>
      {strategies.length === 0 ? (
        <div className="empty-state">
          <h3>Sin estrategias</h3>
          <p>Crea la primera estrategia para este cliente en el módulo de estrategias.</p>
        </div>
      ) : (
        <div className="strategy-list">
          {strategies.map((strategy) => (
            <div key={strategy.id} className="card strategy-card-compact">
              <div className="strategy-card-header">
                <div>
                  <h3>{strategy.title}</h3>
                  {strategy.month && (
                    <span className="strategy-month">
                      {new Date(`${strategy.month}T12:00:00`).toLocaleDateString('es-CO', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                <span className={`status-pill status-${strategy.status === 'approved' ? 'green' : strategy.status === 'mounted' ? 'blue' : strategy.status === 'reviewed' ? 'amber' : 'gray'}`}>
                  {statusLabel(strategy.status)}
                </span>
              </div>
              {strategy.ai_summary && <p className="strategy-summary-preview">{strategy.ai_summary.slice(0, 160)}…</p>}
              {strategy.monthly_budget && <span className="meta-chip">Presupuesto: {formatCop(strategy.monthly_budget)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientTasksTab({
  tasks,
  updateTask,
}: {
  tasks: Task[];
  updateTask: (id: string, updates: TaskUpdateInput) => Promise<unknown>;
}) {
  return (
    <div className="tab-content">
      <div className="card section-block">
        <div className="section-heading"><h2>Tareas</h2></div>
        {tasks.length === 0 ? (
          <p className="empty-note">No hay tareas para este cliente.</p>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <div key={task.id} className={`task-row ${task.status}`}>
                <button
                  className={`task-checkbox ${task.status === 'done' ? 'checked' : ''}`}
                  onClick={() => void updateTask(task.id, { status: task.status === 'done' ? 'pending' : 'done' })}
                >
                  {task.status === 'done' ? '✓' : ''}
                </button>
                <div className="task-body">
                  <span className={`task-title ${task.status === 'done' ? 'done-text' : ''}`}>{task.title}</span>
                  {task.description && <span className="task-desc">{task.description}</span>}
                </div>
                <div className="task-meta">
                  <span className={`priority-pill priority-${task.priority}`}>{task.priority}</span>
                  {task.due_date && (
                    <span className="task-due-date">
                      {new Date(`${task.due_date}T12:00:00`).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientFilesTab({
  files,
  strategies,
  onAddFile,
}: {
  files: ClientFile[];
  strategies: Strategy[];
  onAddFile: () => void;
}) {
  const strategyMap = new Map(strategies.map((strategy) => [strategy.id, strategy.title]));

  return (
    <div className="tab-content">
      <div className="strategy-tab-header">
        <button className="btn-primary" onClick={onAddFile}>
          + Registrar archivo
        </button>
      </div>
      <div className="card section-block">
        <div className="section-heading">
          <h2>Archivos del cliente</h2>
        </div>
        {files.length === 0 ? (
          <p className="empty-note">No hay archivos registrados. Agrega links de Drive para ordenar creativos y documentos.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Estrategia</th>
                  <th>Registrado</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>{file.name}</td>
                    <td>{file.file_type}</td>
                    <td>{file.strategy_id ? strategyMap.get(file.strategy_id) ?? '—' : '—'}</td>
                    <td>{new Date(file.created_at).toLocaleDateString('es-CO')}</td>
                    <td>
                      <a href={file.drive_url} target="_blank" rel="noreferrer" className="link-small">
                        Abrir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
