import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientCreateModal } from '../components/ClientCreateModal';
import { ClientAvatar } from '../components/ClientAvatar';
import { useClients } from '../hooks/useClients';
import { useCampaignSummary, useAlerts, useAdMetrics } from '../hooks/useData';
import {
  aggregateCampaignKpisByClient,
  sumCampaignMonthAggregates,
} from '../services/adCampaignMetrics';
import { getMonthLabel } from '../utils/monthLabel';
import { ChevronDown, ExternalLink, Plus, Search, Users } from 'lucide-react';
import { formatCop, formatNumber } from '../lib/utils';

type StatusFilter = 'all' | 'active' | 'paused';

export function ClientsPage() {
  const { clients, loading, saving, error, createClient, reload } = useClients();
  // Unified campaign source — same hook as DashboardPage
  const { rows: campaignRows, byMonth: campaignByMonth } = useCampaignSummary();
  const { metrics: adMetrics } = useAdMetrics(undefined, 180);
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

  // ad_metrics (windsor_ai) totals for selected period — authoritative source
  const adMetricsPeriodTotals = useMemo(() => {
    if (!activePeriod) return null;
    const filtered =
      activePeriod === 'all'
        ? adMetrics
        : adMetrics.filter((m) => m.date.startsWith(activePeriod));
    if (filtered.length === 0) return null;
    return {
      spend: filtered.reduce((sum, m) => sum + (m.spend ?? 0), 0),
      messages: filtered.reduce((sum, m) => sum + (m.messages ?? 0), 0),
    };
  }, [adMetrics, activePeriod]);

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
            Base operativa · {clients.filter(c => c.status === 'active').length} activos
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px 0', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              className="page-period-select"
              value={activePeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {campaignByMonth.map((m) => (
                <option key={m.month} value={m.month}>{getMonthLabel(m.month)}</option>
              ))}
              <option value="all">Total año</option>
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: 'var(--color-text-muted)' }} />
          </div>
          {totalKpis && (
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.65rem',
              color: 'var(--color-text-muted)',
            }}>
              {formatCop(adMetricsPeriodTotals?.spend ?? totalKpis.spend)} · {formatNumber(adMetricsPeriodTotals?.messages ?? totalKpis.messages)} conv.
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
              background: 'var(--color-bg-input)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              color: 'var(--color-text-primary)',
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
            background: 'var(--color-bg-input)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            color: 'var(--color-text-secondary)',
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
        style={{ margin: '16px 24px 24px', overflow: 'hidden' }}
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
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 200 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Cliente', 'Inversión', 'Alcance', 'CPM', 'Actualizado', 'Portal'].map(
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
                          color: 'var(--color-text-muted)',
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
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 120ms ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          'var(--color-bg-card-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      {/* Cliente + Nicho */}
                      <td style={{ padding: '9px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <ClientAvatar
                            clientId={client.id}
                            name={client.name}
                            logoUrl={client.logo_url}
                            size={32}
                            borderRadius={6}
                            editable
                            onLogoChange={() => void reload()}
                          />
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <Link
                              to={`/clients/${client.id}`}
                              style={{
                                fontFamily: 'Outfit, sans-serif',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'var(--color-text-primary)',
                                textDecoration: 'none',
                                display: 'block',
                                lineHeight: 1.2,
                              }}
                            >
                              {client.name}
                            </Link>
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.58rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
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

                      {/* Inversión */}
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: kpi ? 'var(--color-accent-cyan)' : 'hsl(215,15%,35%)', fontWeight: 500 }}>
                          {kpi ? formatCop(kpi.spend) : '—'}
                        </span>
                      </td>

                      {/* Alcance = msgs · reach compact */}
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.66rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {kpi
                            ? `${formatNumber(kpi.messages)} msgs · ${fmtCompact(kpi.reach)} reach`
                            : '—'}
                        </span>
                      </td>

                      {/* CPM — color badge, no $ */}
                      <td style={{ padding: '9px 14px' }}>
                        {kpi && kpi.cpm > 0 ? (
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6rem', letterSpacing: '0.05em', padding: '2px 6px', borderRadius: '3px', ...cpmBadgeStyle(kpi.cpm) }}>
                            {formatNumber(Math.round(kpi.cpm))}
                          </span>
                        ) : (
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'hsl(215,15%,35%)' }}>—</span>
                        )}
                      </td>

                      {/* Actualizado — dot + fecha */}
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span className={`accent-dot${lastUpdate ? '' : ' muted'}`} />
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.58rem', letterSpacing: '0.04em', color: lastUpdate ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                            {updateLabel}
                          </span>
                        </div>
                      </td>

                      {/* Portal — dedicated column, always visible */}
                      <td style={{ padding: '9px 14px' }}>
                        <a
                          href={`/portal/${client.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir portal del cliente"
                          className="portal-link-btn"
                        >
                          <ExternalLink size={11} /> Ver
                        </a>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center' }}>
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

/** Compact number: 162000 → "162K", 1500000 → "1.5M" */
function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
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

