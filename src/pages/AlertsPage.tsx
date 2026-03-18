import { useMemo, useState } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { useClients } from '../hooks/useClients';
import { useTasks } from '../hooks/useData';
import { createTasks } from '../services/tasks';
import { Bell, CheckCircle2, Clock3, AlertTriangle, Info, XCircle } from 'lucide-react';
import {
  alertStateClass,
  alertStateLabel,
  formatDateTime,
  getAlertSnoozedUntil,
  isAlertSnoozed,
} from '../lib/utils';

function buildFutureIso(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function toCustomIso(dateKey: string): string | null {
  if (!dateKey) return null;
  const parsed = new Date(`${dateKey}T12:00:00`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function AlertsPage() {
  const { alerts, dismiss, postpone, resolve } = useAlerts();
  const { clients } = useClients();
  const [activeTab, setActiveTab] = useState<'alertas' | 'tareas'>('alertas');
  const [filter, setFilter] = useState<'open' | 'snoozed' | 'resolved' | 'dismissed' | 'critical'>('open');
  const [selectedClient, setSelectedClient] = useState('all');
  const [postponeTargetId, setPostponeTargetId] = useState<string | null>(null);
  const [customDates, setCustomDates] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const openAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) => ['unread', 'read'].includes(alert.status) && !isAlertSnoozed(alert),
      ),
    [alerts],
  );
  const snoozedAlerts = useMemo(() => alerts.filter((alert) => isAlertSnoozed(alert)), [alerts]);

  const filtered = alerts.filter((alert) => {
    if (selectedClient !== 'all' && alert.client_id !== selectedClient) return false;
    if (filter === 'resolved') return alert.status === 'resolved';
    if (filter === 'dismissed') return alert.status === 'dismissed';
    if (filter === 'snoozed') return isAlertSnoozed(alert);
    if (filter === 'critical') {
      return alert.severity === 'critical' && ['unread', 'read'].includes(alert.status) && !isAlertSnoozed(alert);
    }
    return ['unread', 'read'].includes(alert.status) && !isAlertSnoozed(alert);
  });

  const getClient = (id?: string | null) => clients.find((client) => client.id === id);
  const unread = openAlerts.filter((alert) => alert.status === 'unread').length;

  async function handleResolve(id: string) {
    const result = await resolve(id);
    setNotice(result.error ?? 'Alerta marcada como realizada.');
  }

  async function handleDismiss(id: string) {
    const result = await dismiss(id);
    setNotice(result.error ?? 'Alerta cerrada / descartada.');
  }

  async function handlePostpone(id: string, until: string | null) {
    if (!until) {
      setNotice('Selecciona una fecha válida para posponer.');
      return;
    }

    const result = await postpone(id, until);
    if (!result.error) {
      setPostponeTargetId(null);
      setCustomDates((current) => ({ ...current, [id]: '' }));
    }
    setNotice(result.error ?? `Alerta pospuesta hasta ${formatDateTime(until)}.`);
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Bell size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Alertas
          </h1>
          <p className="page-subtitle">
            {unread} nuevas · {openAlerts.length} abiertas · {snoozedAlerts.length} pospuestas · {alerts.length} total
          </p>
        </div>
      </div>

      {notice && (
        <div className="card section-block">
          <p className="empty-note">{notice}</p>
        </div>
      )}

      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'alertas' ? 'active' : ''}`}
          onClick={() => setActiveTab('alertas')}
        >
          Alertas
          {openAlerts.length > 0 && (
            <span className="sidebar-badge" style={{ position:'static', marginLeft:6 }}>
              {openAlerts.length}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'tareas' ? 'active' : ''}`}
          onClick={() => setActiveTab('tareas')}
        >
          Tareas pendientes
        </button>
      </div>

      {activeTab === 'alertas' && (
        <>
          <div className="filter-row">
            {(['open', 'snoozed', 'resolved', 'dismissed', 'critical'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`filter-chip ${filter === value ? 'active' : ''}`}
              >
                {value === 'open'
                  ? 'Abiertas'
                  : value === 'snoozed'
                    ? 'Pospuestas'
                    : value === 'resolved'
                      ? 'Realizadas'
                      : value === 'dismissed'
                        ? 'Descartadas'
                        : 'Críticas'}
              </button>
            ))}
            <select
              className="form-select alerts-client-filter"
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
          </div>

          <div className="alerts-list">
            {filtered.length === 0 && (
              <div className="empty-state">
                <CheckCircle2 size={32} style={{ color: '#00e676' }} />
                <h3>Todo en orden</h3>
                <p>No hay alertas para este filtro.</p>
              </div>
            )}
            {filtered.map((alert) => {
              const client = getClient(alert.client_id);
              const snoozedUntil = getAlertSnoozedUntil(alert);
              const canAct = !['resolved', 'dismissed'].includes(alert.status);

              return (
                <div
                  key={alert.id}
                  className={`alert-row card severity-${alert.severity} ${
                    alert.status === 'unread' && !isAlertSnoozed(alert) ? 'unread' : ''
                  }`}
                >
                  <div className="alert-icon">
                    {alert.severity === 'critical' ? <AlertTriangle size={18} style={{ color: '#ff5252' }} /> :
                     alert.severity === 'warning' ? <AlertTriangle size={18} style={{ color: '#ffc107' }} /> :
                     <Info size={18} style={{ color: '#7ab1ff' }} />}
                  </div>
                  <div className="alert-body">
                    <div className="alert-row-header">
                      {client && <span className="alert-client">{client.name}</span>}
                      <h4 className="alert-title">{alert.title}</h4>
                      <span className="mini-chip">{alert.rule_key}</span>
                      <span className={`status-pill ${alertStateClass(alert)}`}>
                        {alertStateLabel(alert)}
                      </span>
                    </div>
                    {alert.body && <p className="alert-text">{alert.body}</p>}
                    <span className="alert-time">
                      {new Date(alert.created_at).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {snoozedUntil ? ` · Pospuesta hasta ${formatDateTime(snoozedUntil)}` : ''}
                    </span>

                    {postponeTargetId === alert.id && canAct && (
                      <div className="alert-postpone-panel">
                        <button className="alert-quick-chip" onClick={() => void handlePostpone(alert.id, buildFutureIso(1))}>
                          Mañana
                        </button>
                        <button className="alert-quick-chip" onClick={() => void handlePostpone(alert.id, buildFutureIso(3))}>
                          3 días
                        </button>
                        <button className="alert-quick-chip" onClick={() => void handlePostpone(alert.id, buildFutureIso(7))}>
                          7 días
                        </button>
                        <input
                          type="date"
                          className="form-input alert-date-input"
                          value={customDates[alert.id] ?? ''}
                          onChange={(event) =>
                            setCustomDates((current) => ({
                              ...current,
                              [alert.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          className="alert-quick-chip primary"
                          onClick={() => void handlePostpone(alert.id, toCustomIso(customDates[alert.id] ?? ''))}
                        >
                          Guardar fecha
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="alert-actions alert-actions-compact">
                    {canAct && (
                      <button
                        className="alert-action-pill action-success"
                        onClick={() => void handleResolve(alert.id)}
                        title="Marcar como realizado"
                      >
                        <CheckCircle2 size={15} />
                        Realizado
                      </button>
                    )}
                    {canAct && (
                      <button
                        className="alert-action-pill action-neutral"
                        onClick={() =>
                          setPostponeTargetId((current) => (current === alert.id ? null : alert.id))
                        }
                        title="Posponer"
                      >
                        <Clock3 size={15} />
                        Posponer
                      </button>
                    )}
                    {canAct && (
                      <button
                        className="alert-action-pill action-danger"
                        onClick={() => void handleDismiss(alert.id)}
                        title="Cerrar o descartar"
                      >
                        <XCircle size={15} />
                        Cerrar / descartar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'tareas' && <TasksPanel clients={clients} />}
    </div>
  );
}

function TasksPanel({ clients }: { clients: import('../lib/supabase').Client[] }) {
  const { tasks, updateTask, reload } = useTasks();
  const [filterClient, setFilterClient] = useState('all');
  const [showDone, setShowDone] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [saving, setSaving] = useState(false);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);

  async function handleCreateTask() {
    if (!newTitle.trim()) {
      setTaskNotice('El título es obligatorio.');
      return;
    }
    setSaving(true);
    const result = await createTasks([{
      title: newTitle.trim(),
      client_id: newClient || null,
      due_date: newDueDate || null,
      priority: newPriority,
      type: 'general',
      status: 'pending',
    }]);
    setSaving(false);
    if (!result.error) {
      setNewTitle('');
      setNewClient('');
      setNewDueDate('');
      setNewPriority('medium');
      setShowNewTask(false);
      setTaskNotice('Tarea creada.');
      void reload();
    } else {
      setTaskNotice(result.error);
    }
  }

  const filtered = tasks.filter(t =>
    (filterClient === 'all' || t.client_id === filterClient) &&
    (showDone || t.status !== 'done')
  );

  const clientName = (id?: string | null) =>
    clients.find(c => c.id === id)?.name ?? 'Sin cliente';

  const pending = filtered.filter(t => t.status !== 'done').length;

  return (
    <div style={{ display:'grid', gap:16 }}>
      <div className="card section-block period-toolbar-card">
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <select className="form-select" value={filterClient}
            onChange={e => setFilterClient(e.target.value)} style={{ minWidth:200 }}>
            <option value="all">Todos los clientes</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6,
            fontSize:'0.86rem', color:'var(--gs-text-soft)', cursor:'pointer' }}>
            <input type="checkbox" checked={showDone}
              onChange={e => setShowDone(e.target.checked)} />
            Mostrar completadas
          </label>
          <span className="badge-count">{pending} pendientes</span>
          <button className="btn-primary" style={{ marginLeft:'auto' }}
            onClick={() => { setShowNewTask(v => !v); setTaskNotice(null); }}>
            + Nueva tarea
          </button>
        </div>

        {taskNotice && (
          <p className="empty-note" style={{ marginTop: 10 }}>{taskNotice}</p>
        )}

        {showNewTask && (
          <div style={{ display:'grid', gap:10, marginTop:14, paddingTop:14, borderTop:'1px solid var(--gs-border)' }}>
            <input
              className="form-input"
              placeholder="Título de la tarea *"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <select className="form-select" value={newClient}
                onChange={e => setNewClient(e.target.value)} style={{ minWidth:180 }}>
                <option value="">Sin cliente</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select className="form-select" value={newPriority}
                onChange={e => setNewPriority(e.target.value as 'high' | 'medium' | 'low')}>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
              <input
                type="date"
                className="form-input"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                style={{ minWidth:150 }}
              />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-primary" onClick={() => void handleCreateTask()} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar tarea'}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewTask(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Tareas operativas</h2></div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Sin tareas pendientes</h3>
            <p>Todo está al día para este filtro.</p>
          </div>
        ) : (
          <div className="task-list">
            {filtered.map(task => (
              <div key={task.id} className={`task-row ${task.status === 'done' ? 'done' : ''}`}>
                <button
                  className={`task-checkbox ${task.status === 'done' ? 'checked' : ''}`}
                  onClick={() => void updateTask(task.id, {
                    status: task.status === 'done' ? 'pending' : 'done'
                  })}
                >
                  {task.status === 'done' ? '✓' : ''}
                </button>
                <div className="task-body">
                  <span className={`task-title ${task.status === 'done' ? 'done-text' : ''}`}>
                    {task.title}
                  </span>
                  <span className="task-desc">
                    {clientName(task.client_id)}
                    {task.due_date && ` · Vence ${
                      new Date(`${task.due_date}T12:00:00`).toLocaleDateString('es-CO', {
                        day:'numeric', month:'short'
                      })
                    }`}
                  </span>
                  {task.description && (
                    <span className="task-desc" style={{ opacity:0.7 }}>{task.description}</span>
                  )}
                </div>
                <div className="task-meta">
                  <span className={`priority-pill priority-${task.priority}`}>
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
