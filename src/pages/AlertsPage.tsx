import { useState } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { useClients } from '../hooks/useClients';
import { Bell, CheckCircle, X, AlertTriangle, Info } from 'lucide-react';

export function AlertsPage() {
  const { alerts, markRead, dismiss, resolve } = useAlerts();
  const { clients } = useClients();
  const [filter, setFilter] = useState<'open' | 'resolved' | 'dismissed' | 'critical'>('open');
  const [selectedClient, setSelectedClient] = useState('all');

  const filtered = alerts.filter((alert) => {
    if (selectedClient !== 'all' && alert.client_id !== selectedClient) return false;
    if (filter === 'resolved') return alert.status === 'resolved';
    if (filter === 'dismissed') return alert.status === 'dismissed';
    if (filter === 'critical') {
      return alert.severity === 'critical' && ['unread', 'read'].includes(alert.status);
    }
    return ['unread', 'read'].includes(alert.status);
  });

  const getClient = (id?: string | null) => clients.find((client) => client.id === id);

  const unread = alerts.filter((alert) => alert.status === 'unread').length;
  const openCount = alerts.filter((alert) => ['unread', 'read'].includes(alert.status)).length;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Bell size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Alertas
          </h1>
          <p className="page-subtitle">{unread} sin leer · {openCount} abiertas · {alerts.length} total</p>
        </div>
      </div>

      <div className="filter-row">
        {(['open', 'resolved', 'dismissed', 'critical'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`filter-chip ${filter === value ? 'active' : ''}`}
          >
            {value === 'open'
              ? 'Abiertas'
              : value === 'resolved'
                ? 'Resueltas'
                : value === 'dismissed'
                  ? 'Descartadas'
                  : 'Criticas'}
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
            <CheckCircle size={32} style={{ color: '#00e676' }} />
            <h3>Todo en orden</h3>
            <p>No hay alertas activas por ahora.</p>
          </div>
        )}
        {filtered.map((alert) => {
          const client = getClient(alert.client_id);
          return (
            <div key={alert.id} className={`alert-row card severity-${alert.severity} ${alert.status === 'unread' ? 'unread' : ''}`}>
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
                </div>
                {alert.body && <p className="alert-text">{alert.body}</p>}
                <span className="alert-time">
                  {new Date(alert.created_at).toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="alert-actions">
                {alert.status === 'unread' && (
                  <button className="alert-btn read-btn" onClick={() => void markRead(alert.id)} title="Marcar leída">
                    <CheckCircle size={16} />
                  </button>
                )}
                {['unread', 'read'].includes(alert.status) && (
                  <button className="alert-btn read-btn" onClick={() => void resolve(alert.id)} title="Resolver">
                    <CheckCircle size={16} />
                  </button>
                )}
                {alert.status !== 'dismissed' && (
                  <button className="alert-btn dismiss-btn" onClick={() => void dismiss(alert.id)} title="Descartar">
                    <X size={16} />
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
