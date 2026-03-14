import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientCreateModal } from '../components/ClientCreateModal';
import { useClients } from '../hooks/useClients';
import { Plus, Search, Users, Building2, MapPin } from 'lucide-react';
import { statusLabel } from '../lib/utils';

export function ClientsPage() {
  const { clients, loading, saving, error, createClient } = useClients();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.niche ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clients.length} clientes registrados</p>
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
            <Link key={client.id} to={`/clients/${client.id}`} className="client-list-card card">
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
            </Link>
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
