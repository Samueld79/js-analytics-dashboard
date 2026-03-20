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
  Plus,
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
import type { Alert, AlertSeverity, Client, Task } from '../lib/supabase';

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

// ── Task due-date helpers ─────────────────────────────────────────────────────
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Dueness = 'overdue' | 'today' | 'upcoming' | 'none';

function taskDueness(task: Task): Dueness {
  if (!task.due_date || task.status === 'done') return 'none';
  const today = todayKey();
  if (task.due_date < today) return 'overdue';
  if (task.due_date === today) return 'today';
  return 'upcoming';
}

function taskBorderColor(d: Dueness): string {
  if (d === 'overdue') return 'hsl(0,84%,60%)';
  if (d === 'today') return 'hsl(38,100%,55%)';
  if (d === 'upcoming') return 'hsl(180,100%,50%)';
  return 'rgba(255,255,255,0.07)';
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

// ── Task creation modal ───────────────────────────────────────────────────────
function TaskCreateModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: Client[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!title.trim()) { setError('El título es obligatorio.'); return; }
    setSaving(true);
    const result = await createTasks([{
      title: title.trim(),
      client_id: clientId || null,
      due_date: dueDate || null,
      priority,
      type: 'general',
      status: 'pending',
      description: notes.trim() || null,
    }]);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      onCreated();
      onClose();
    }
  }

  const PRIORITIES: Array<{ key: 'low' | 'medium' | 'high'; label: string; color: string }> = [
    { key: 'low',    label: 'LOW',    color: 'hsl(180,100%,45%)' },
    { key: 'medium', label: 'MEDIUM', color: 'hsl(38,100%,55%)' },
    { key: 'high',   label: 'HIGH',   color: 'hsl(0,84%,60%)' },
  ];

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 900 }}
    >
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 440,
          background: 'hsl(220,22%,7%)',
          border: '1px solid hsl(180 100% 50% / 0.18)',
          boxShadow: '0 0 40px hsl(180 100% 50% / 0.06), 0 24px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{ borderBottom: '1px solid hsl(180 100% 50% / 0.1)', background: 'hsl(180 100% 50% / 0.04)', paddingBottom: 14 }}
        >
          <div>
            <h2 className="modal-title" style={{ color: 'hsl(180,100%,60%)', fontSize: '1rem' }}>
              + Nueva tarea
            </h2>
            <p className="modal-subtitle" style={{ color: 'hsl(215,15%,45%)', fontSize: '0.72rem' }}>
              Tarea operativa · se guarda en Supabase
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gap: 14, padding: '18px 22px' }}>
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.68rem', color: 'hsl(215,15%,52%)', fontWeight: 600, letterSpacing: '0.04em' }}>
              TÍTULO *
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
              placeholder="Ej. Revisar anuncios activos de cliente X"
              style={{
                padding: '8px 10px', fontSize: '0.86rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid hsl(180 100% 50% / 0.18)',
                borderRadius: 7, color: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* Client */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.68rem', color: 'hsl(215,15%,52%)', fontWeight: 600, letterSpacing: '0.04em' }}>
              CLIENTE
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={{
                padding: '7px 10px', fontSize: '0.84rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid hsl(180 100% 50% / 0.15)',
                borderRadius: 7, color: 'inherit',
              }}
            >
              <option value="">Sin cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Due date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.68rem', color: 'hsl(215,15%,52%)', fontWeight: 600, letterSpacing: '0.04em' }}>
              FECHA LÍMITE
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{
                padding: '7px 10px', fontSize: '0.84rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid hsl(180 100% 50% / 0.15)',
                borderRadius: 7, color: 'inherit',
              }}
            />
          </div>

          {/* Priority pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.68rem', color: 'hsl(215,15%,52%)', fontWeight: 600, letterSpacing: '0.04em' }}>
              PRIORIDAD
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIORITIES.map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPriority(key)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 7,
                    border: `1px solid ${priority === key ? color : 'rgba(255,255,255,0.1)'}`,
                    cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.06em', fontFamily: 'JetBrains Mono, monospace',
                    background: priority === key ? `${color}1a` : 'transparent',
                    color: priority === key ? color : 'hsl(215,15%,50%)',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.68rem', color: 'hsl(215,15%,52%)', fontWeight: 600, letterSpacing: '0.04em' }}>
              NOTAS <span style={{ color: 'hsl(215,15%,40%)', fontWeight: 400 }}>(opcional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto adicional, links, referencias..."
              style={{
                padding: '7px 10px', fontSize: '0.82rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid hsl(180 100% 50% / 0.12)',
                borderRadius: 7, color: 'inherit', resize: 'vertical',
                fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'hsl(0,84%,65%)' }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{ borderTop: '1px solid hsl(180 100% 50% / 0.1)', padding: '14px 22px' }}
        >
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            onClick={() => void handleSubmit()}
            disabled={saving}
            style={{
              padding: '8px 22px', borderRadius: 7, border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              background: 'hsl(180,100%,45%)', color: '#000',
              fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em',
              fontFamily: 'JetBrains Mono, monospace',
              opacity: saving ? 0.55 : 1,
            }}
          >
            {saving ? 'GUARDANDO...' : 'CREAR TAREA'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
  const [mobileTab, setMobileTab] = useState<'alerts' | 'tasks'>('alerts');
  const [fabTrigger, setFabTrigger] = useState(0);

  // Monday weekly-report alert (once per mount per week)
  const weeklyAlertRef = useRef(false);
  useEffect(() => {
    if (weeklyAlertRef.current || !isInternal || loading || !supabase || !isSupabaseConfigured) return;
    const now = new Date();
    if (now.getDay() !== 1) return;
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
      .then(({ error }) => { if (!error) void reload(); });
  }, [alerts, isInternal, loading, reload]);

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

      {/* Mobile tab bar — hidden on desktop via CSS */}
      <div className="alerts-mobile-tabs" style={{ display: 'none', flexShrink: 0, gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
        <button
          className={`alerts-tab-btn${mobileTab === 'alerts' ? ' active' : ''}`}
          onClick={() => setMobileTab('alerts')}
        >
          Alertas {unread > 0 && <span className="alerts-tab-badge">{unread}</span>}
        </button>
        <button
          className={`alerts-tab-btn${mobileTab === 'tasks' ? ' active' : ''}`}
          onClick={() => setMobileTab('tasks')}
        >
          Tareas
        </button>
      </div>

      {/* Two-column fixed-height grid */}
      <div
        className="alerts-grid"
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
        <div className={`alerts-col${mobileTab !== 'alerts' ? ' mobile-hidden' : ''}`} style={COLUMN_STYLE}>
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
        <div className={`tasks-col${mobileTab !== 'tasks' ? ' mobile-hidden' : ''}`} style={COLUMN_STYLE}>
          <TasksPanel clients={clients} isInternal={isInternal} fabTrigger={fabTrigger} />
        </div>
      </div>

      {/* Mobile FAB — hidden on desktop via CSS */}
      <button
        className="alerts-mobile-fab"
        style={{ display: 'none' }}
        onClick={() => { setMobileTab('tasks'); setFabTrigger((n) => n + 1); }}
        aria-label="Nueva tarea"
      >
        <Plus size={20} />
        <span>NUEVA TAREA</span>
      </button>
    </div>
  );
}

// ── Tasks panel ───────────────────────────────────────────────────────────────
function TasksPanel({
  clients,
  isInternal,
  fabTrigger = 0,
}: {
  clients: Client[];
  isInternal: boolean;
  fabTrigger?: number;
}) {
  const { tasks, updateTask, deleteTask, reload } = useTasks();
  const [filterClient, setFilterClient] = useState('all');
  const [showDone, setShowDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);

  useEffect(() => {
    if (fabTrigger > 0) setModalOpen(true);
  }, [fabTrigger]);

  const today = todayKey();

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (filterClient === 'all' || t.client_id === filterClient) &&
          (showDone || t.status !== 'done'),
      ),
    [tasks, filterClient, showDone],
  );

  // Sort: overdue first → today → upcoming (by date asc) → no date → done last
  const sortedFiltered = useMemo(() => {
    const order: Record<Dueness, number> = { overdue: 0, today: 1, upcoming: 2, none: 3 };
    return [...filtered].sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0;
      const bDone = b.status === 'done' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const dA = taskDueness(a);
      const dB = taskDueness(b);
      if (order[dA] !== order[dB]) return order[dA] - order[dB];
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  }, [filtered]);

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && !!t.due_date && t.due_date < today).length,
    [tasks, today],
  );
  const todayCount = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && t.due_date === today).length,
    [tasks, today],
  );
  const pendingCount = filtered.filter((t) => t.status !== 'done').length;

  async function handleToggleDone(task: Task) {
    const isDone = task.status === 'done';
    await updateTask(task.id, {
      status: isDone ? 'pending' : 'done',
      completed_at: isDone ? null : new Date().toISOString(),
    });
  }

  return (
    <div style={COLUMN_STYLE}>
      <div
        style={{
          background: 'hsl(220,18%,7%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1,
        }}
      >
        {/* Panel header */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <span className="number-label" style={{ fontSize: '0.62rem', letterSpacing: '0.1em' }}>
            TAREAS
          </span>

          {/* Due badges */}
          {overdueCount > 0 && (
            <span style={{
              fontSize: '0.64rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: 'hsl(0 84% 60% / 0.15)', color: 'hsl(0,84%,65%)',
              border: '1px solid hsl(0 84% 60% / 0.3)',
            }}>
              ⚠ {overdueCount} vencida{overdueCount !== 1 ? 's' : ''}
            </span>
          )}
          {todayCount > 0 && (
            <span
              className="task-due-today-badge"
              style={{
                fontSize: '0.64rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'hsl(38 100% 55% / 0.15)', color: 'hsl(38,100%,65%)',
                border: '1px solid hsl(38 100% 55% / 0.3)',
              }}
            >
              ⏰ {todayCount} vence hoy
            </span>
          )}

          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'hsl(180,100%,50%)', fontWeight: 600 }}>
            {pendingCount} pendientes
          </span>

          {/* + NUEVA TAREA button */}
          <button
            onClick={() => { setModalOpen(true); setTaskNotice(null); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 6, border: '1px solid hsl(180 100% 50% / 0.3)',
              cursor: 'pointer', background: 'hsl(180 100% 50% / 0.08)',
              color: 'hsl(180,100%,55%)', fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.06em', fontFamily: 'JetBrains Mono, monospace',
              flexShrink: 0,
            }}
          >
            <Plus size={12} /> NUEVA TAREA
          </button>
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            style={{ flex: 1, minWidth: 130, fontSize: '0.76rem', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'inherit' }}
          >
            <option value="all">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', color: 'hsl(215,15%,52%)', cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Completadas
          </label>
        </div>

        {taskNotice && <p className="empty-note" style={{ marginBottom: 8, flexShrink: 0 }}>{taskNotice}</p>}

        {/* Scrollable task list */}
        <div style={{ ...SCROLL_AREA, paddingRight: 2 }}>
          {sortedFiltered.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'hsl(215,15%,42%)', textAlign: 'center', padding: '24px 0' }}>
              Sin tareas pendientes
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {sortedFiltered.map((task) => {
                const dueness = taskDueness(task);
                const borderColor = taskBorderColor(dueness);
                const isDone = task.status === 'done';
                const client = clients.find((c) => c.id === task.client_id);

                return (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex', gap: 10, padding: '9px 12px', borderRadius: 8,
                      background: isDone ? 'rgba(255,255,255,0.02)' : 'rgba(6,10,18,0.7)',
                      border: `1px solid ${isDone ? 'rgba(255,255,255,0.05)' : `${borderColor}25`}`,
                      borderLeft: `3px solid ${borderColor}`,
                      opacity: isDone ? 0.5 : 1,
                      transition: 'opacity 0.25s ease, border-color 0.2s',
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => void handleToggleDone(task)}
                      title={isDone ? 'Marcar pendiente' : 'Marcar completa'}
                      style={{
                        flexShrink: 0, width: 18, height: 18, marginTop: 2, borderRadius: 4,
                        border: `1.5px solid ${isDone ? 'hsl(145,100%,45%)' : borderColor}`,
                        background: isDone ? 'hsl(145 100% 45% / 0.18)' : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'hsl(145,100%,55%)', fontSize: '0.7rem', fontWeight: 700,
                        transition: 'all 0.15s',
                      }}
                    >
                      {isDone ? '✓' : ''}
                    </button>

                    {/* Body */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{
                          fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3,
                          textDecoration: isDone ? 'line-through' : 'none',
                          color: isDone ? 'hsl(215,15%,45%)' : 'hsl(215,15%,88%)',
                          transition: 'color 0.2s, text-decoration 0.2s',
                        }}>
                          {task.title}
                        </span>

                        {/* Status labels */}
                        {!isDone && dueness === 'overdue' && (
                          <span style={{
                            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em',
                            color: 'hsl(0,84%,65%)', fontFamily: 'JetBrains Mono, monospace',
                          }}>
                            VENCIDA
                          </span>
                        )}
                        {!isDone && dueness === 'today' && (
                          <span
                            className="task-label-today"
                            style={{
                              fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em',
                              color: 'hsl(38,100%,65%)', fontFamily: 'JetBrains Mono, monospace',
                            }}
                          >
                            HOY
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {client && (
                          <span style={{ fontSize: '0.66rem', color: 'hsl(215,15%,45%)' }}>
                            {client.name}
                          </span>
                        )}
                        {task.due_date && (
                          <span style={{
                            fontSize: '0.66rem',
                            color: dueness === 'overdue'
                              ? 'hsl(0,84%,58%)'
                              : dueness === 'today'
                                ? 'hsl(38,100%,55%)'
                                : 'hsl(215,15%,42%)',
                          }}>
                            {new Date(`${task.due_date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {task.description && (
                          <span style={{ fontSize: '0.66rem', color: 'hsl(215,15%,38%)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                            {task.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side: priority + delete */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'flex-end' }}>
                      <span className={`priority-pill priority-${task.priority}`} style={{ fontSize: '0.58rem' }}>
                        {task.priority}
                      </span>
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
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Task creation modal */}
      {modalOpen && (
        <TaskCreateModal
          clients={clients}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            void reload();
            setTaskNotice('Tarea creada.');
            setTimeout(() => setTaskNotice(null), 3000);
          }}
        />
      )}
    </div>
  );
}
