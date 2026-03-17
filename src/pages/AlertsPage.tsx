import { useMemo, useState } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { useClients } from '../hooks/useClients';
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
    </div>
  );
}
