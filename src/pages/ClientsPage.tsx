import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClientCreateModal } from '../components/ClientCreateModal';
import { useClients } from '../hooks/useClients';
import { useMonthlyOperatingKpis, useMetaSyncRows, useAlerts } from '../hooks/useData';
import { Plus, Search, Users } from 'lucide-react';
import { formatCop, formatRoas } from '../lib/utils';

type StatusFilter = 'all' | 'active' | 'paused';

export function ClientsPage() {
  const navigate = useNavigate();
  const { clients, loading, saving, error, createClient } = useClients();
  const { monthlyKpis } = useMonthlyOperatingKpis(undefined, 1);
  const { syncRows } = useMetaSyncRows();
  const { alerts } = useAlerts();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        const matchesSearch =
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.niche ?? '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && c.status === 'active') ||
          (statusFilter === 'paused' && c.status === 'paused');
        return matchesSearch && matchesStatus;
      }),
    [clients, search, statusFilter],
  );

  return (
    <div className="page-content dashboard-v3">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">
            BASE OPERATIVA · {clients.length} ACTIVOS
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={14} />
          Nuevo cliente
        </button>
      </div>

      {/* ── Search + Filter row ── */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          padding: '16px 24px 0',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: '10px',
              color: 'hsl(215,15%,45%)',
              pointerEvents: 'none',
            }}
          />
          <input
            style={{
              width: '100%',
              height: '36px',
              paddingLeft: '32px',
              paddingRight: '12px',
              background: 'hsl(220,18%,9%)',
              border: '1px solid hsl(0 0% 100% / 0.08)',
              borderRadius: '4px',
              color: 'hsl(0,0%,92%)',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.78rem',
              outline: 'none',
            }}
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={{
            height: '36px',
            padding: '0 12px',
            background: 'hsl(220,18%,9%)',
            border: '1px solid hsl(0 0% 100% / 0.08)',
            borderRadius: '4px',
            color: 'hsl(215,15%,65%)',
            fontFamily: 'JetBrains Mono',
            fontSize: '0.72rem',
            letterSpacing: '0.05em',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="paused">Pausados</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: '12px 24px 0' }}>
          <p
            style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.72rem',
              color: 'hsl(0,84%,65%)',
              padding: '10px 14px',
              background: 'hsl(0 84% 60% / 0.08)',
              border: '1px solid hsl(0 84% 60% / 0.15)',
              borderRadius: '4px',
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* ── Table ── */}
      <div
        className="card-glass"
        style={{ margin: '16px 24px 24px', borderRadius: '4px', overflow: 'hidden' }}
      >
        {loading ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.72rem',
              color: 'hsl(215,15%,40%)',
            }}
          >
            Cargando clientes...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.08)' }}>
                  {['Cliente', 'Nicho', 'Ciudad', 'Inversión', 'ROAS', 'Meta', 'Acciones'].map(
                    (h) => (
                      <th
                        key={h}
                        className="number-label"
                        style={{
                          padding: '11px 20px',
                          textAlign: 'left',
                          fontWeight: 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => {
                  const kpi = kpiByClient.get(client.id);
                  const openAlerts = alertsByClient.get(client.id) ?? 0;
                  const lastSync = syncByClient.get(client.id);
                  const syncAge = lastSync
                    ? Math.floor(
                        (Date.now() - new Date(lastSync).getTime()) / 86_400_000,
                      )
                    : null;
                  const syncLabel =
                    syncAge === null
                      ? 'SIN SYNC'
                      : syncAge === 0
                        ? 'HOY'
                        : `HACE ${syncAge}D`;
                  const syncOk = syncAge !== null && syncAge <= 1;
                  const syncWarn = syncAge !== null && syncAge > 1 && syncAge <= 3;

                  return (
                    <tr
                      key={client.id}
                      style={{
                        borderBottom: '1px solid hsl(0 0% 100% / 0.05)',
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          'hsl(0 0% 100% / 0.02)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      {/* Cliente */}
                      <td style={{ padding: '13px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '4px',
                              background: clientGradient(client.id),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'Outfit, sans-serif',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                color: '#fff',
                              }}
                            >
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <Link
                              to={`/clients/${client.id}`}
                              style={{
                                fontFamily: 'Outfit, sans-serif',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                color: 'hsl(0,0%,92%)',
                                textDecoration: 'none',
                                display: 'block',
                              }}
                            >
                              {client.name}
                            </Link>
                            {openAlerts > 0 && (
                              <span
                                style={{
                                  fontFamily: 'JetBrains Mono',
                                  fontSize: '0.58rem',
                                  letterSpacing: '0.08em',
                                  color: 'hsl(0,84%,65%)',
                                }}
                              >
                                {openAlerts} alerta{openAlerts > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Nicho */}
                      <td style={{ padding: '13px 20px' }}>
                        <span className="number-label">
                          {client.niche ?? '—'}
                        </span>
                      </td>

                      {/* Ciudad */}
                      <td style={{ padding: '13px 20px' }}>
                        <span className="number-label">
                          {client.main_city ?? '—'}
                        </span>
                      </td>

                      {/* Inversión */}
                      <td style={{ padding: '13px 20px' }}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono',
                            fontSize: '0.78rem',
                            color: 'hsl(0,0%,85%)',
                          }}
                        >
                          {kpi ? formatCop(kpi.spend) : '—'}
                        </span>
                      </td>

                      {/* ROAS */}
                      <td style={{ padding: '13px 20px' }}>
                        {kpi ? (
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono',
                              fontSize: '0.78rem',
                              color:
                                kpi.roas >= 1
                                  ? 'hsl(180,100%,50%)'
                                  : 'hsl(0,84%,65%)',
                            }}
                          >
                            {formatRoas(kpi.roas)}
                          </span>
                        ) : (
                          <span className="number-label">—</span>
                        )}
                      </td>

                      {/* Meta sync */}
                      <td style={{ padding: '13px 20px' }}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono',
                            fontSize: '0.6rem',
                            letterSpacing: '0.08em',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            ...(syncOk
                              ? {
                                  background: 'hsl(145 100% 45% / 0.12)',
                                  color: 'hsl(145,100%,45%)',
                                  border: '1px solid hsl(145 100% 45% / 0.2)',
                                }
                              : syncWarn
                                ? {
                                    background: 'hsl(38 100% 50% / 0.12)',
                                    color: 'hsl(38,100%,60%)',
                                    border: '1px solid hsl(38 100% 50% / 0.2)',
                                  }
                                : {
                                    background: 'hsl(0 0% 100% / 0.04)',
                                    color: 'hsl(215,15%,45%)',
                                    border: '1px solid hsl(0 0% 100% / 0.08)',
                                  }),
                          }}
                        >
                          {syncLabel}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '13px 20px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn-ghost"
                            style={{
                              fontSize: '0.7rem',
                              padding: '4px 10px',
                              cursor: 'pointer',
                              border: '1px solid hsl(0 0% 100% / 0.08)',
                            }}
                            onClick={() => void navigate(`/clients/${client.id}`)}
                          >
                            Ver
                          </button>
                          <a
                            href={`/portal/${client.id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontFamily: 'JetBrains Mono',
                              fontSize: '0.7rem',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              border: '1px solid hsl(180 100% 50% / 0.25)',
                              color: 'hsl(180,100%,50%)',
                              textDecoration: 'none',
                              transition: 'all 200ms ease',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Portal ↗
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '10px',
                          color: 'hsl(215,15%,40%)',
                        }}
                      >
                        <Users size={28} style={{ opacity: 0.5 }} />
                        <p
                          style={{
                            fontFamily: 'JetBrains Mono',
                            fontSize: '0.72rem',
                            margin: 0,
                          }}
                        >
                          {search || statusFilter !== 'all'
                            ? 'Sin resultados para este filtro'
                            : 'No hay clientes registrados'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <ClientCreateModal
          saving={saving}
          onClose={() => setShowCreateModal(false)}
          onSave={async (input) => {
            const result = await createClient(input);
            if (!result.error) setShowCreateModal(false);
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
