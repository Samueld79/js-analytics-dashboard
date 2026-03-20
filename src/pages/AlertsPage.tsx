import { useEffect, useMemo, useRef, useState } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { useClients } from '../hooks/useClients';
import { useTasks } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { createTasks } from '../services/tasks';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  AlertTriangle,
  BarChart2,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Info,
  Layers,
  Palette,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  alertStateClass,
  alertStateLabel,
  formatDateTime,
  getAlertSnoozedUntil,
  isAlertSnoozed,
} from '../lib/utils';
import type { Alert, AlertSeverity } from '../lib/supabase';

// ── Allowed alert types ───────────────────────────────────────────────────────
const ALLOWED_TYPES = new Set(['optimize_creatives', 'optimize_adsets', 'weekly_report']);

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

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

function severityColor(severity: AlertSeverity): string {
  if (severity === 'critical') return 'hsl(0,84%,60%)';
  if (severity === 'warning') return 'hsl(38,100%,55%)';
  return 'hsl(180,80%,55%)';
}

function AlertIcon({ type, severity }: { type: string; severity: AlertSeverity }) {
  const color = severityColor(severity);
  const size = 16;
  if (type === 'weekly_report') return <BarChart2 size={size} style={{ color }} />;
  if (type.includes('optimize_creativ')) return <Palette size={size} style={{ color }} />;
  if (type.includes('optimize_adset')) return <Layers size={size} style={{ color }} />;
  if (severity === 'critical' || severity === 'warning') return <AlertTriangle size={size} style={{ color }} />;
  return <Info size={size} style={{ color }} />;
}

const COLUMN_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden',
};

const SCROLL_AREA: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  minHeight: 0,
};

export function AlertsPage() {
  const { alerts, dismiss, postpone, resolve, reload, loading } = useAlerts();
  const { clients } = useClients();
  const { isInternal } = useAuth();

  const [filter, setFilter] = useState<'open' | 'snoozed' | 'resolved' | 'dismissed'>('open');
  const [selectedClient, setSelectedClient] = useState('all');
  const [postponeTargetId, setPostponeTargetId] = useState<string | null>(null);
  const [customDates, setCustomDates] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Monday weekly-report alert (once per mount per week)
  const weeklyAlertRef = useRef(false);
  useEffect(() => {
    if (weeklyAlertRef.current || !isInternal || loading || !supabase || !isSupabaseConfigured) return;
    const now = new Date();
    if (now.getDay() !== 1) return; // 1 = Monday
    const weekKey = getISOWeekKey(now);
    const ruleKey = `weekly_report:${weekKey}`;
    const exists = alerts.some((a) => a.rule_key === ruleKey);
    if (exists) { weeklyAlertRef.current = true; return; }
    weeklyAlertRef.current = true;
    void supabase
      .from('alerts')
      .insert({
        client_id: null,
        type: 'weekly_report',
        rule_key: ruleKey,
        title: '📊 Montar métricas semanales en Supabase',
        body: 'Actualizar métricas de todos los clientes activos para esta semana.',
        severity: 'warning',
        triggered_by: 'system',
        metadata: { week: weekKey },
      })
      .then(({ error }) => {
        if (!error) void reload();
      });
  }, [alerts, isInternal, loading, reload]);

  // Only show allowed types
  const allowedAlerts = useMemo(
    () => alerts.filter((a) => ALLOWED_TYPES.has(a.type)),
    [alerts],
  );

  const openAlerts = useMemo(
    () => allowedAlerts.filter((a) => ['unread', 'read'].includes(a.status) && !isAlertSnoozed(a)),
    [allowedAlerts],
  );
  const snoozedAlerts = useMemo(() => allowedAlerts.filter((a) => isAlertSnoozed(a)), [allowedAlerts]);
  const unread = openAlerts.filter((a) => a.status === 'unread').length;
  const warningCount = openAlerts.filter((a) => a.severity === 'warning').length;

  const filtered = useMemo(
    () =>
      allowedAlerts.filter((a) => {
        if (selectedClient !== 'all' && a.client_id !== selectedClient) return false;
        if (filter === 'resolved') return a.status === 'resolved';
        if (filter === 'dismissed') return a.status === 'dismissed';
        if (filter === 'snoozed') return isAlertSnoozed(a);
        return ['unread', 'read'].includes(a.status) && !isAlertSnoozed(a);
      }),
    [allowedAlerts, filter, selectedClient],
  );

  const alertsByClient = useMemo(() => {
    const map = new Map<string, Alert[]>();
    filtered.forEach((a) => {
      const key = a.client_id ?? '__global__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [filtered]);

  const getClient = (id?: string | null) => clients.find((c) => c.id === id);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleResolve(id: string) {
    const result = await resolve(id);
    setNotice(result.error ?? 'Alerta marcada como realizada.');
    setTimeout(() => setNotice(null), 3000);
  }

  async function handleDismiss(id: string) {
    const result = await dismiss(id);
    setNotice(result.error ?? 'Alerta descartada.');
    setTimeout(() => setNotice(null), 3000);
  }

  async function handlePostpone(id: string, until: string | null) {
    if (!until) { setNotice('Selecciona una fecha válida.'); return; }
    const result = await postpone(id, until);
    if (!result.error) {
      setPostponeTargetId(null);
      setCustomDates((c) => ({ ...c, [id]: '' }));
    }
    setNotice(result.error ?? `Pospuesta hasta ${formatDateTime(until)}.`);
    setTimeout(() => setNotice(null), 3000);
  }

  return (
    <div
      className="page-content"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        overflow: 'hidden',
        paddingBottom: 0,
      }}
    >
      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="page-title">
            <Bell size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Alertas
          </h1>
          <p className="page-subtitle" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{unread} nuevas · {openAlerts.length} abiertas · {snoozedAlerts.length} pospuestas</span>
            {warningCount > 0 && <span style={{ color: 'hsl(38,100%,60%)' }}>· {warningCount} pendientes</span>}
          </p>
        </div>
      </div>

      {notice && (
        <p style={{ flexShrink: 0, fontSize: '0.8rem', color: 'hsl(180,100%,50%)', marginBottom: 8, padding: '0 2px' }}>
          {notice}
        </p>
      )}

      {/* Two-column fixed-height grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          flex: 1,
          minHeight: 0,
          paddingBottom: 20,
        }}
      >
        {/* ── Left: Alerts ── */}
        <div style={COLUMN_STYLE}>
          {/* Filter row */}
          <div className="filter-row" style={{ marginBottom: 10, flexWrap: 'wrap', flexShrink: 0 }}>
            {(['open', 'snoozed', 'resolved', 'dismissed'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`filter-chip ${filter === v ? 'active' : ''}`}
              >
                {v === 'open' ? 'Activas' : v === 'snoozed' ? 'Pospuestas' : v === 'resolved' ? 'Realizadas' : 'Descartadas'}
                {v === 'open' && openAlerts.length > 0 && (
                  <span style={{ marginLeft: 5, background: 'hsl(38,100%,55%)', color: '#000', borderRadius: 999, fontSize: '0.6rem', padding: '1px 5px', fontWeight: 700 }}>
                    {openAlerts.length}
                  </span>
                )}
              </button>
            ))}
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              style={{ fontSize: '0.76rem', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'inherit' }}
            >
              <option value="all">Todos</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Scrollable alerts area */}
          <div style={SCROLL_AREA}>
            {loading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton-card" style={{ height: 80 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(215,15%,42%)' }}>
                <CheckCircle2 size={28} style={{ color: 'hsl(145,100%,45%)', marginBottom: 8 }} />
                <p style={{ fontSize: '0.84rem' }}>Sin alertas en este filtro</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, paddingRight: 4 }}>
                {[...alertsByClient.entries()].map(([groupKey, groupAlerts]) => {
                  const groupClient = groupKey === '__global__' ? null : getClient(groupKey);
                  const isCollapsed = collapsedGroups.has(groupKey);
                  const groupCritical = groupAlerts.filter((a) => a.severity === 'critical').length;

                  return (
                    <div key={groupKey}>
                      {alertsByClient.size > 1 && (
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupKey)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '7px 12px', marginBottom: 6,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 8, cursor: 'pointer', color: 'inherit',
                          }}
                        >
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.76rem', fontWeight: 600 }}>
                            {groupClient?.name ?? 'General'}
                            <span style={{ fontSize: '0.66rem', color: 'hsl(215,15%,48%)', fontWeight: 400 }}>
                              ({groupAlerts.length}{groupCritical > 0 ? ` · ${groupCritical} 🔴` : ''})
                            </span>
                          </span>
                          {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                        </button>
                      )}

                      {!isCollapsed && (
                        <div style={{ display: 'grid', gap: 6 }}>
                          {groupAlerts.map((alert) => {
                            const alertClient = getClient(alert.client_id);
                            const snoozedUntil = getAlertSnoozedUntil(alert);
                            const canAct = !['resolved', 'dismissed'].includes(alert.status);
                            const sc = severityColor(alert.severity);

                            return (
                              <div
                                key={alert.id}
                                style={{
                                  display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8,
                                  background: 'rgba(6,10,18,0.85)',
                                  border: `1px solid ${sc}20`,
                                  borderLeft: `3px solid ${sc}`,
                                  opacity: ['resolved', 'dismissed'].includes(alert.status) ? 0.55 : 1,
                                }}
                              >
                                <div style={{ flexShrink: 0, marginTop: 2 }}>
                                  <AlertIcon type={alert.type} severity={alert.severity} />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 3 }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3, flex: 1 }}>
                                      {alert.title}
                                    </span>
                                    {alertClient && alertsByClient.size === 1 && (
                                      <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', color: 'hsl(215,15%,55%)', flexShrink: 0 }}>
                                        {alertClient.name}
                                      </span>
                                    )}
                                    <span className={`status-pill ${alertStateClass(alert)}`} style={{ fontSize: '0.6rem', flexShrink: 0 }}>
                                      {alertStateLabel(alert)}
                                    </span>
                                  </div>
                                  {alert.body && (
                                    <p style={{ margin: '0 0 4px', fontSize: '0.74rem', color: 'hsl(215,15%,50%)', lineHeight: 1.4 }}>
                                      {alert.body}
                                    </p>
                                  )}
                                  <span style={{ fontSize: '0.66rem', color: 'hsl(215,15%,36%)' }}>
                                    {new Date(alert.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    {snoozedUntil ? ` · pospuesta ${formatDateTime(snoozedUntil)}` : ''}
                                  </span>

                                  {postponeTargetId === alert.id && canAct && (
                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                                      {[{ label: 'Mañana', days: 1 }, { label: '3 días', days: 3 }, { label: '7 días', days: 7 }].map(({ label, days }) => (
                                        <button
                                          key={days}
                                          className="alert-quick-chip"
                                          onClick={() => void handlePostpone(alert.id, buildFutureIso(days))}
                                        >
                                          {label}
                                        </button>
                                      ))}
                                      <input
                                        type="date"
                                        className="form-input alert-date-input"
                                        style={{ fontSize: '0.74rem', padding: '3px 6px' }}
                                        value={customDates[alert.id] ?? ''}
                                        onChange={(e) => setCustomDates((c) => ({ ...c, [alert.id]: e.target.value }))}
                                      />
                                      <button
                                        className="alert-quick-chip primary"
                                        onClick={() => void handlePostpone(alert.id, toCustomIso(customDates[alert.id] ?? ''))}
                                      >
                                        Guardar
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {canAct && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                                    <button
                                      title="Resolver"
                                      onClick={() => void handleResolve(alert.id)}
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'hsl(145 100% 45% / 0.12)', color: 'hsl(145,100%,55%)' }}
                                    >
                                      <CheckCircle2 size={13} />
                                    </button>
                                    <button
                                      title="Posponer"
                                      onClick={() => setPostponeTargetId((p) => p === alert.id ? null : alert.id)}
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.07)', color: 'hsl(215,15%,55%)' }}
                                    >
                                      <Clock3 size={13} />
                                    </button>
                                    <button
                                      title="Descartar"
                                      onClick={() => void handleDismiss(alert.id)}
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'hsl(0 84% 60% / 0.1)', color: 'hsl(0,84%,60%)' }}
                                    >
                                      <XCircle size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Tasks ── */}
        <div style={COLUMN_STYLE}>
          <TasksPanel clients={clients} isInternal={isInternal} />
        </div>
      </div>
    </div>
  );
}

function TasksPanel({
  clients,
  isInternal,
}: {
  clients: import('../lib/supabase').Client[];
  isInternal: boolean;
}) {
  const { tasks, updateTask, deleteTask, reload } = useTasks();
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
    if (!newTitle.trim()) { setTaskNotice('El título es obligatorio.'); return; }
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
      setNewTitle(''); setNewClient(''); setNewDueDate(''); setNewPriority('medium');
      setShowNewTask(false);
      setTaskNotice('Tarea creada.');
      void reload();
    } else {
      setTaskNotice(result.error);
    }
  }

  const filtered = tasks.filter(
    (t) => (filterClient === 'all' || t.client_id === filterClient) && (showDone || t.status !== 'done'),
  );
  const clientName = (id?: string | null) => clients.find((c) => c.id === id)?.name ?? 'Sin cliente';
  const pending = filtered.filter((t) => t.status !== 'done').length;

  return (
    <div style={{ ...COLUMN_STYLE }}>
      {/* Panel header */}
      <div
        style={{
          background: 'hsl(220,18%,7%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
          <span className="number-label" style={{ fontSize: '0.62rem', letterSpacing: '0.1em' }}>
            TAREAS PENDIENTES
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'hsl(180,100%,50%)', fontWeight: 600 }}>
            {pending} pendientes
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            style={{ flex: 1, minWidth: 140, fontSize: '0.78rem', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'inherit' }}
          >
            <option value="all">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: 'hsl(215,15%,55%)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Completadas
          </label>
          <button
            className="btn-primary"
            style={{ fontSize: '0.76rem', padding: '4px 10px' }}
            onClick={() => { setShowNewTask((v) => !v); setTaskNotice(null); }}
          >
            + Nueva
          </button>
        </div>

        {taskNotice && <p className="empty-note" style={{ marginBottom: 8, flexShrink: 0 }}>{taskNotice}</p>}

        {showNewTask && (
          <div style={{ display: 'grid', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: 10, flexShrink: 0 }}>
            <input
              className="form-input"
              placeholder="Título de la tarea *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ fontSize: '0.82rem' }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <select
                className="form-select"
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
                style={{ flex: 1, minWidth: 130, fontSize: '0.78rem' }}
              >
                <option value="">Sin cliente</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                className="form-select"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as 'high' | 'medium' | 'low')}
                style={{ fontSize: '0.78rem' }}
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
              <input
                type="date"
                className="form-input"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                style={{ minWidth: 130, fontSize: '0.78rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-primary" style={{ fontSize: '0.78rem' }} onClick={() => void handleCreateTask()} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar tarea'}
              </button>
              <button className="btn-secondary" style={{ fontSize: '0.78rem' }} onClick={() => setShowNewTask(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Scrollable task list */}
        <div style={{ ...SCROLL_AREA, paddingRight: 2 }}>
          {filtered.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'hsl(215,15%,42%)', textAlign: 'center', padding: '12px 0' }}>
              Sin tareas pendientes
            </p>
          ) : (
            <div className="task-list">
              {filtered.map((task) => (
                <div key={task.id} className={`task-row ${task.status === 'done' ? 'done' : ''}`}>
                  <button
                    className={`task-checkbox ${task.status === 'done' ? 'checked' : ''}`}
                    onClick={() => void updateTask(task.id, { status: task.status === 'done' ? 'pending' : 'done' })}
                  >
                    {task.status === 'done' ? '✓' : ''}
                  </button>
                  <div className="task-body">
                    <span className={`task-title ${task.status === 'done' ? 'done-text' : ''}`}>
                      {task.title}
                    </span>
                    <span className="task-desc">
                      {clientName(task.client_id)}
                      {task.due_date && ` · Vence ${new Date(`${task.due_date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}
                    </span>
                  </div>
                  <div className="task-meta">
                    <span className={`priority-pill priority-${task.priority}`}>{task.priority}</span>
                    {isInternal && (
                      <button
                        className="task-delete-btn"
                        title="Eliminar tarea"
                        onClick={async () => {
                          if (!window.confirm(`¿Eliminar "${task.title}"?`)) return;
                          const result = await deleteTask(task.id);
                          if (result.error) setTaskNotice(result.error);
                          else void reload();
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
