import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClientCreateModal } from '../components/ClientCreateModal';
import { useClients } from '../hooks/useClients';
import { useCampaignSummary, useAlerts } from '../hooks/useData';
import {
  aggregateCampaignKpisByClient,
  sumCampaignMonthAggregates,
} from '../services/adCampaignMetrics';
import { getMonthLabel } from '../utils/monthLabel';
import { Plus, Search, Users } from 'lucide-react';
import { formatCop, formatNumber } from '../lib/utils';

type StatusFilter = 'all' | 'active' | 'paused';

export function ClientsPage() {
  const navigate = useNavigate();
  const { clients, loading, saving, error, createClient } = useClients();
  // Unified campaign source — same hook as DashboardPage
  const { rows: campaignRows, byMonth: campaignByMonth } = useCampaignSummary();
  const { alerts } = useAlerts();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Period selector — null = auto-select most recent
  const [selectedPeriod, setSelectedPeriod] = useState<string | 'all' | null>(null);
  const activePeriod = selectedPeriod ?? campaignByMonth[campaignByMonth.length - 1]?.month ?? '';

  // Rows filtered to active period
  const periodRows = useMemo(
    () =>
      activePeriod === 'all' || activePeriod === ''
        ? campaignRows
        : campaignRows.filter((r) => r.date.startsWith(activePeriod)),
    [campaignRows, activePeriod],
  );

  // Per-client KPIs for selected period
  const campaignByClient = useMemo(
    () => aggregateCampaignKpisByClient(periodRows),
    [periodRows],
  );

  // Total KPIs for selected period (for header summary)
  const totalKpis = useMemo(
    () =>
      activePeriod === 'all'
        ? sumCampaignMonthAggregates(campaignByMonth, 'all')
        : (campaignByMonth.find((m) => m.month === activePeriod) ?? null),
    [campaignByMonth, activePeriod],
  );

  const alertsByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const alert of alerts) {
      if (!alert.client_id) continue;
      if (!['unread', 'read'].includes(alert.status)) continue;
      map.set(alert.client_id, (map.get(alert.client_id) ?? 0) + 1);
    }
    return map;
  }, [alerts]);

  // MAX(date) per client from ad_campaign_metrics — replaces n8n sync indicator
  const lastUpdateByClient = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of campaignRows) {
      const existing = map.get(row.client_id);
      if (!existing || row.date > existing) map.set(row.client_id, row.date);
    }
    return map;
  }, [campaignRows]);

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

      {/* ── Period Selector ── */}
      {campaignByMonth.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', padding: '0 24px 0' }}>
          {campaignByMonth.map((m) => (
            <button
              key={m.month}
              onClick={() => setSelectedPeriod(m.month)}
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                padding: '5px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                border: activePeriod === m.month
                  ? '1px solid hsl(180,100%,50%)'
                  : '1px solid hsl(0 0% 100% / 0.1)',
                background: activePeriod === m.month
                  ? 'hsl(180 100% 50% / 0.1)'
                  : 'transparent',
                color: activePeriod === m.month
                  ? 'hsl(180,100%,50%)'
                  : 'hsl(215,15%,55%)',
              }}
            >
              {getMonthLabel(m.month)}
            </button>
          ))}
          <button
            onClick={() => setSelectedPeriod('all')}
            style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              padding: '5px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: activePeriod === 'all'
                ? '1px solid hsl(180,100%,50%)'
                : '1px solid hsl(0 0% 100% / 0.1)',
              background: activePeriod === 'all'
                ? 'hsl(180 100% 50% / 0.1)'
                : 'transparent',
              color: activePeriod === 'all'
                ? 'hsl(180,100%,50%)'
                : 'hsl(215,15%,55%)',
            }}
          >
            Total año
          </button>
          {totalKpis && (
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.65rem',
              color: 'hsl(215,15%,45%)',
              alignSelf: 'center',
              marginLeft: '8px',
            }}>
              {formatCop(totalKpis.spend)} · {formatNumber(totalKpis.messages)} conv.
            </span>
          )}
        </div>
      )}

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
                <tr style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.06)' }}>
                  {['Cliente', 'Inversión', 'Mensajes', 'Reach', 'CPM', 'Frec.', 'Actualizado', 'Acciones'].map(
                    (h) => (
                      <th
                        key={h}
                        className="number-label"
                        style={{
                          padding: '9px 16px',
                          textAlign: 'left',
                          fontWeight: 400,
                          whiteSpace: 'nowrap',
                          fontSize: '0.6rem',
                          color: 'hsl(215,15%,40%)',
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
                  const kpi = campaignByClient.get(client.id);
                  const openAlerts = alertsByClient.get(client.id) ?? 0;
                  const lastUpdate = lastUpdateByClient.get(client.id);
                  const updateLabel = lastUpdate ? formatShortDate(lastUpdate) : '—';

                  return (
                    <tr
                      key={client.id}
                      style={{
                        borderBottom: '1px solid hsl(0 0% 100% / 0.04)',
                        transition: 'background 120ms ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          'hsl(0 0% 100% / 0.025)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      {/* Cliente + Nicho */}
                      <td style={{ padding: '9px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              background: clientGradient(client.id),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.68rem', color: '#fff' }}>
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <Link
                              to={`/clients/${client.id}`}
                              style={{
                                fontFamily: 'Outfit, sans-serif',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'hsl(0,0%,92%)',
                                textDecoration: 'none',
                                display: 'block',
                                lineHeight: 1.2,
                              }}
                            >
                              {client.name}
                            </Link>
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.58rem', color: 'hsl(215,15%,42%)', letterSpacing: '0.04em' }}>
                              {client.niche ?? '—'}
                            </span>
                            {openAlerts > 0 && (
                              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em', color: 'hsl(0,84%,65%)', display: 'block' }}>
                                {openAlerts} alerta{openAlerts > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Inversión — cyan */}
                      <td style={{ padding: '9px 16px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: kpi ? 'hsl(180,100%,50%)' : 'hsl(215,15%,35%)', fontWeight: 500 }}>
                          {kpi ? formatCop(kpi.spend) : '—'}
                        </span>
                      </td>

                      {/* Mensajes — muted */}
                      <td style={{ padding: '9px 16px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'hsl(215,15%,58%)' }}>
                          {kpi ? formatNumber(kpi.messages) : '—'}
                        </span>
                      </td>

                      {/* Reach — muted */}
                      <td style={{ padding: '9px 16px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'hsl(215,15%,58%)' }}>
                          {kpi ? formatNumber(kpi.reach) : '—'}
                        </span>
                      </td>

                      {/* CPM — color badge */}
                      <td style={{ padding: '9px 16px' }}>
                        {kpi && kpi.cpm > 0 ? (
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6rem', letterSpacing: '0.05em', padding: '2px 6px', borderRadius: '3px', ...cpmBadgeStyle(kpi.cpm) }}>
                            {formatCop(kpi.cpm)}
                          </span>
                        ) : (
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'hsl(215,15%,35%)' }}>—</span>
                        )}
                      </td>

                      {/* Frecuencia */}
                      <td style={{ padding: '9px 16px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'hsl(215,15%,58%)' }}>
                          {kpi && kpi.frequency > 0 ? kpi.frequency.toFixed(2) : '—'}
                        </span>
                      </td>

                      {/* Actualizado — dot + fecha */}
                      <td style={{ padding: '9px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: lastUpdate ? 'hsl(180,100%,50%)' : 'hsl(215,15%,28%)', flexShrink: 0 }} />
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.58rem', letterSpacing: '0.04em', color: lastUpdate ? 'hsl(215,15%,62%)' : 'hsl(215,15%,32%)' }}>
                            {updateLabel}
                          </span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '9px 16px' }}>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            className="btn-ghost"
                            style={{ fontSize: '0.62rem', padding: '3px 8px', cursor: 'pointer', border: '1px solid hsl(0 0% 100% / 0.08)' }}
                            onClick={() => void navigate(`/clients/${client.id}`)}
                          >
                            Ver
                          </button>
                          <a
                            href={`/portal/${client.id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontFamily: 'JetBrains Mono', fontSize: '0.62rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid hsl(180 100% 50% / 0.22)', color: 'hsl(180,100%,50%)', textDecoration: 'none', whiteSpace: 'nowrap' }}
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
                    <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center' }}>
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

function cpmBadgeStyle(cpm: number): React.CSSProperties {
  if (cpm < 5_000) return { background: 'hsl(145 100% 45% / 0.12)', color: 'hsl(145,100%,45%)', border: '1px solid hsl(145 100% 45% / 0.2)' };
  if (cpm <= 10_000) return { background: 'hsl(38 100% 50% / 0.12)', color: 'hsl(38,100%,60%)', border: '1px solid hsl(38 100% 50% / 0.2)' };
  return { background: 'hsl(0 84% 60% / 0.12)', color: 'hsl(0,84%,65%)', border: '1px solid hsl(0 84% 60% / 0.2)' };
}

/** Formats "2026-03-17" → "17 Mar" */
function formatShortDate(dateStr: string): string {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const [, mm, dd] = dateStr.split('-');
  const month = months[parseInt(mm, 10) - 1] ?? mm;
  return `${parseInt(dd, 10)} ${month}`;
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
