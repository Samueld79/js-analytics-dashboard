import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientCreateModal } from '../components/ClientCreateModal';
import { useClients } from '../hooks/useClients';
import { useMonthlyOperatingKpis, useMetaSyncRows, useAlerts } from '../hooks/useData';
import { Plus, Search, Users, Building2, MapPin, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { formatCop, formatRoas, statusLabel } from '../lib/utils';

export function ClientsPage() {
  const { clients, loading, saving, error, createClient } = useClients();
  const { monthlyKpis } = useMonthlyOperatingKpis(undefined, 1);
  const { syncRows } = useMetaSyncRows();
  const { alerts } = useAlerts();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const kpiByClient = useMemo(() => {
    const map = new Map<string, { spend: number; roas: number }>();
    for (const row of monthlyKpis) {
      const m = typeof row.month === 'string' ? row.month.slice(0, 7) : '';
      if (m === currentMonth) {
        map.set(row.client_id, { spend: row.spend ?? 0, roas: row.real_roas ?? 0 });
      }
    }
    return map;
  }, [monthlyKpis, currentMonth]);

  const alertsByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const alert of alerts) {
      if (!alert.client_id) continue;
      if (!['unread', 'read'].includes(alert.status)) continue;
      map.set(alert.client_id, (map.get(alert.client_id) ?? 0) + 1);
    }
    return map;
  }, [alerts]);

  const syncByClient = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of syncRows) {
      const existing = map.get(row.client_id);
      if (!existing || (row.last_sync_at ?? '') > existing) {
        map.set(row.client_id, row.last_sync_at ?? null);
      }
    }
    return map;
  }, [syncRows]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.niche ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Base operativa de empresas y portal cliente por membresías activas</p>
          <div className="period-chip-row">
            <span className="meta-chip">{clients.length} clientes registrados</span>
            <span className="meta-chip">Admins: vista global</span>
            <span className="meta-chip">Clientes: solo su empresa</span>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      {error && (
        <div className="card section-block" style={{ padding: 16 }}>
          <p className="empty-note">{error}</p>
        </div>
      )}

      <div className="search-bar-wrap">
        <Search size={16} className="search-icon" />
        <input
          className="search-input"
          placeholder="Buscar por nombre o nicho..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-card" />)}
        </div>
      ) : (
        <div className="clients-list-grid">
          {filtered.map(client => (
            <article key={client.id} className="client-list-card card">
              <Link to={`/clients/${client.id}`} className="client-list-body">
                <div className="client-list-header">
                  <div className="client-avatar" style={{ background: clientGradient(client.id) }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="client-list-info">
                    <h3>{client.name}</h3>
                    <span className="client-niche">{client.niche ?? 'Sin nicho'}</span>
                  </div>
                  <span className={`status-pill status-${client.status === 'active' ? 'green' : client.status === 'paused' ? 'amber' : 'red'}`}>
                    {statusLabel(client.status)}
                  </span>
                </div>
                <div className="client-list-meta">
                  {client.main_city && (
                    <span className="meta-chip"><MapPin size={11} /> {client.main_city}</span>
                  )}
                  {client.ad_account_id && (
                    <span className="meta-chip"><Building2 size={11} /> {client.ad_account_id}</span>
                  )}
                </div>
                {client.notes && <p className="client-notes-preview">{client.notes}</p>}
                <div className="client-list-kpis">
                  {(() => {
                    const kpi = kpiByClient.get(client.id);
                    const openAlerts = alertsByClient.get(client.id) ?? 0;
                    const lastSync = syncByClient.get(client.id);
                    const syncAge = lastSync
                      ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 86400000)
                      : null;
                    return (
                      <>
                        {kpi ? (
                          <>
                            <span className="meta-chip">{formatCop(kpi.spend)}</span>
                            <span className="meta-chip">{formatRoas(kpi.roas)} ROAS</span>
                          </>
                        ) : (
                          <span className="meta-chip source-unknown">Sin KPI mensual</span>
                        )}
                        {openAlerts > 0 && (
                          <span className="meta-chip" style={{ color: '#ff5252' }}>
                            <AlertTriangle size={11} style={{ display:'inline', marginRight:3 }} />
                            {openAlerts} alerta{openAlerts > 1 ? 's' : ''}
                          </span>
                        )}
                        <span className={`meta-chip ${syncAge === null ? 'source-unknown' : syncAge <= 1 ? 'source-automatic' : syncAge <= 3 ? '' : 'source-manual'}`}>
                          <RefreshCw size={11} style={{ display:'inline', marginRight:3 }} />
                          {syncAge === null ? 'Sin sync' : syncAge === 0 ? 'Sync hoy' : `Sync hace ${syncAge}d`}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </Link>
              <div className="client-list-actions">
                <Link to={`/clients/${client.id}`} className="btn-secondary client-card-action">
                  Ver interno
                </Link>
                <Link
                  to={`/portal/${client.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary client-card-action"
                >
                  <ExternalLink size={14} />
                  Abrir portal
                </Link>
              </div>
            </article>
          ))}

          {filtered.length === 0 && (
            <div className="empty-state">
              <Users size={32} />
              <h3>{search ? 'No se encontraron clientes' : 'No hay clientes cargados'}</h3>
              <p>{search ? 'Prueba con otro término de búsqueda' : 'Crea el primer cliente en Supabase para comenzar.'}</p>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <ClientCreateModal
          saving={saving}
          onClose={() => setShowCreateModal(false)}
          onSave={async (input) => {
            const result = await createClient(input);
            if (!result.error) {
              setShowCreateModal(false);
            }
            return result;
          }}
        />
      )}
    </div>
  );
}

function clientGradient(id: string): string {
  const gradients = [
    'linear-gradient(135deg,#2979ff,#00b0ff)',
    'linear-gradient(135deg,#00e676,#00bcd4)',
    'linear-gradient(135deg,#ff5252,#e040fb)',
    'linear-gradient(135deg,#ffc107,#ff5722)',
    'linear-gradient(135deg,#e040fb,#2979ff)',
    'linear-gradient(135deg,#00bcd4,#00e676)',
  ];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return gradients[hash % gradients.length];
}
