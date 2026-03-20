import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { StrategyDetailModal } from '../components/StrategyDetailModal';
import { StrategyFormModal } from '../components/StrategyFormModal';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useClients';
import { useStrategies } from '../hooks/useStrategies';
import { createOrTouchOperationalAlert } from '../services/alerts';
import { formatCop, statusLabel } from '../lib/utils';
import type { Strategy } from '../lib/supabase';

const OPERATING_STATUSES: Strategy['status'][] = ['pending', 'mounted', 'reviewed', 'approved'];
const EMPTY_CLIENT_SCOPE = '00000000-0000-0000-0000-000000000000';

const STATUS_ACCENT: Record<string, string> = {
  pending: 'hsl(215,20%,38%)',
  mounted: 'hsl(215,80%,55%)',
  reviewed: 'hsl(38,100%,55%)',
  approved: 'hsl(145,100%,45%)',
};

const OBJECTIVE_STYLE: Record<string, { background: string; color: string }> = {
  Reconocimiento: { background: 'hsl(180 100% 50% / 0.12)', color: 'hsl(180,100%,55%)' },
  Tráfico: { background: 'hsl(280 80% 60% / 0.15)', color: 'hsl(280,80%,70%)' },
  Interacción: { background: 'hsl(38 100% 55% / 0.15)', color: 'hsl(38,100%,65%)' },
  Ventas: { background: 'hsl(145 100% 45% / 0.12)', color: 'hsl(145,100%,55%)' },
  General: { background: 'rgba(255,255,255,0.07)', color: 'hsl(215,15%,55%)' },
};

function inferObjective(strategy: Strategy): string {
  const text = `${strategy.title ?? ''} ${strategy.notes ?? ''}`.toUpperCase();
  if (text.includes('RECON')) return 'Reconocimiento';
  if (text.includes('TRAFI')) return 'Tráfico';
  if (text.includes('INTER') || text.includes('ENGAGE')) return 'Interacción';
  if (text.includes('VENT') || text.includes('CONVER') || text.includes('VENTA')) return 'Ventas';
  return 'General';
}

const DATE_INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '4px 8px',
  fontSize: '0.76rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid hsl(180 100% 50% / 0.2)',
  borderRadius: 6,
  color: 'inherit',
  minWidth: 0,
};

const CAL_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  background: 'hsl(180 100% 45% / 0.15)',
  color: 'hsl(180,100%,55%)',
  flexShrink: 0,
};

export function StrategiesPage() {
  const { clients } = useClients();
  const { isInternal, accessibleClientIds, defaultClientId } = useAuth();
  const visibleClients = useMemo(
    () =>
      isInternal
        ? clients
        : clients.filter((client) => accessibleClientIds.includes(client.id)),
    [accessibleClientIds, clients, isInternal],
  );
  const visibleClientIds = useMemo(
    () => new Set(visibleClients.map((client) => client.id)),
    [visibleClients],
  );
  const canSelectAllClients = isInternal || visibleClients.length > 1;
  const [searchParams, setSearchParams] = useSearchParams();
  const clientParam = searchParams.get('client');
  const [selectedClient, setSelectedClient] = useState(
    !isInternal && defaultClientId ? defaultClientId : clientParam ?? 'all',
  );
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Kanban card expand/optimization state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [creativeDates, setCreativeDates] = useState<Record<string, string>>({});
  const [adsetDates, setAdsetDates] = useState<Record<string, string>>({});
  const [alertSaving, setAlertSaving] = useState<Set<string>>(new Set());

  const selectedClientId = selectedClient === 'all' ? undefined : selectedClient;
  const queryClientId =
    !isInternal && !canSelectAllClients
      ? defaultClientId ?? EMPTY_CLIENT_SCOPE
      : selectedClientId;

  const {
    strategies,
    historyByStrategy,
    loading,
    saving,
    error,
    createStrategy,
    updateStrategy,
    updateStatus,
    loadHistory,
    generateTasks,
    loadingHistoryIds,
    generatingTaskIds,
  } = useStrategies(queryClientId);

  useEffect(() => {
    if (!isInternal) {
      if (defaultClientId && !canSelectAllClients) {
        setSelectedClient(defaultClientId);
        return;
      }
      if (clientParam && visibleClientIds.has(clientParam)) {
        setSelectedClient(clientParam);
        return;
      }
      setSelectedClient(defaultClientId ?? 'all');
      return;
    }
    setSelectedClient(clientParam ?? 'all');
  }, [canSelectAllClients, clientParam, defaultClientId, isInternal, visibleClientIds]);

  const visibleStrategies = useMemo(
    () =>
      isInternal
        ? strategies
        : strategies.filter((strategy) => visibleClientIds.has(strategy.client_id)),
    [isInternal, strategies, visibleClientIds],
  );

  const selectedStrategy = useMemo(
    () => visibleStrategies.find((strategy) => strategy.id === selectedStrategyId) ?? null,
    [selectedStrategyId, visibleStrategies],
  );

  const editingStrategy = formMode === 'edit' ? selectedStrategy : null;

  function getClient(id: string) {
    return visibleClients.find((client) => client.id === id);
  }

  function handleClientFilter(value: string) {
    const nextValue = value === 'all' && !canSelectAllClients ? defaultClientId ?? 'all' : value;
    setSelectedClient(nextValue);
    setSearchParams(nextValue === 'all' ? {} : { client: nextValue });
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openStrategyDetail(strategyId: string) {
    setSelectedStrategyId(strategyId);
    setNotice(null);
    if (!historyByStrategy[strategyId]) {
      await loadHistory(strategyId);
    }
  }

  async function handleStatusChange(strategyId: string, status: Strategy['status']) {
    const result = await updateStatus(strategyId, status);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setNotice(`Estado actualizado a ${statusLabel(status)}.`);
  }

  async function handleSaveStrategy(
    input: import('../lib/supabase').StrategyInput,
    options?: { changeSummary?: string | null },
  ) {
    const result = editingStrategy
      ? await updateStrategy(editingStrategy.id, input, options)
      : await createStrategy(input, options);

    if (result.data) {
      setSelectedStrategyId(result.data.id);
      await loadHistory(result.data.id);
      setNotice(editingStrategy ? 'Estrategia actualizada.' : 'Estrategia creada.');
    }
    return result;
  }

  async function handleGenerateTasks(strategyId: string) {
    const result = await generateTasks(strategyId);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    const createdCount = result.data?.length ?? 0;
    setNotice(
      createdCount > 0
        ? `${createdCount} tarea${createdCount !== 1 ? 's' : ''} creada${createdCount !== 1 ? 's' : ''}.`
        : 'No se crearon tareas nuevas. Ya existen tareas abiertas para este checklist.',
    );
  }

  async function handleCreateOptimizeAlert(strategy: Strategy, kind: 'creatives' | 'adsets') {
    const date = kind === 'creatives' ? creativeDates[strategy.id] : adsetDates[strategy.id];
    if (!date) return;

    const type = kind === 'creatives' ? 'optimize_creatives' : 'optimize_adsets';
    const title =
      kind === 'creatives'
        ? `Optimizar creativos para ${strategy.title}`
        : `Revisar conjuntos de anuncios: ${strategy.title}`;
    const saveKey = `${strategy.id}:${kind}`;

    setAlertSaving((s) => new Set(s).add(saveKey));
    const result = await createOrTouchOperationalAlert({
      clientId: strategy.client_id,
      type,
      ruleKey: `${type}:${strategy.id}`,
      title,
      body: `Fecha programada: ${date}`,
      severity: 'warning',
      triggeredBy: 'strategy',
      metadata: { strategy_id: strategy.id, due_date: date, strategy_title: strategy.title },
    });
    setAlertSaving((s) => {
      const next = new Set(s);
      next.delete(saveKey);
      return next;
    });

    if (result.error) {
      setNotice(result.error);
    } else {
      setNotice(`Alerta creada: ${title}`);
      if (kind === 'creatives') {
        setCreativeDates((d) => ({ ...d, [strategy.id]: '' }));
      } else {
        setAdsetDates((d) => ({ ...d, [strategy.id]: '' }));
      }
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Estrategias</h1>
          <p className="page-subtitle">
            {loading
              ? 'Cargando estrategias...'
              : `${visibleStrategies.length} estrategia${visibleStrategies.length !== 1 ? 's' : ''}${
                  !isInternal ? ' visibles para tu empresa' : ''
                }`}
          </p>
        </div>
        <div className="header-actions">
          {isInternal ? (
            <button
              className="btn-primary"
              onClick={() => {
                setSelectedStrategyId(null);
                setFormMode('create');
              }}
            >
              <Plus size={16} /> Nueva Estrategia
            </button>
          ) : (
            <span className="meta-chip">Solo lectura</span>
          )}
        </div>
      </div>

      {/* Client filter pills */}
      <div className="filter-row">
        {canSelectAllClients && (
          <button
            onClick={() => handleClientFilter('all')}
            className={`filter-chip ${selectedClient === 'all' ? 'active' : ''}`}
          >
            {isInternal ? 'Todos' : 'Mis empresas'}
          </button>
        )}
        {visibleClients.map((client) => (
          <button
            key={client.id}
            onClick={() => handleClientFilter(client.id)}
            className={`filter-chip ${selectedClient === client.id ? 'active' : ''}`}
          >
            {client.name}
          </button>
        ))}
      </div>

      {(error || notice) && (
        <div className="card section-block" style={{ padding: 16 }}>
          <p className="empty-note">{error ?? notice}</p>
        </div>
      )}

      {loading ? (
        <div className="loading-grid">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton-card" />
          ))}
        </div>
      ) : (
        <div className="status-lanes">
          {OPERATING_STATUSES.map((status) => {
            const group = visibleStrategies.filter((strategy) => strategy.status === status);
            return (
              <div key={status} className="status-lane">
                <div className="lane-header">
                  <span className={`lane-dot status-dot-${status}`} />
                  <span className="lane-title">{statusLabel(status)}</span>
                  <span className="lane-count">{group.length}</span>
                </div>
                <div className="lane-cards">
                  {group.map((strategy) => {
                    const client = getClient(strategy.client_id);
                    const checklist = strategy.ai_checklist ?? [];
                    const obj = inferObjective(strategy);
                    const objStyle = OBJECTIVE_STYLE[obj] ?? OBJECTIVE_STYLE.General;
                    const isExpanded = expandedIds.has(strategy.id);

                    return (
                      <div
                        key={strategy.id}
                        className="strategy-card"
                        onClick={() => void openStrategyDetail(strategy.id)}
                        style={{
                          borderTop: `3px solid ${STATUS_ACCENT[strategy.status] ?? 'hsl(215,20%,38%)'}`,
                          background: 'hsl(220,18%,7%)',
                          border: `1px solid hsl(180 100% 50% / 0.1)`,
                          borderTopColor: STATUS_ACCENT[strategy.status] ?? 'hsl(215,20%,38%)',
                          transition: 'box-shadow 0.2s ease, border-color 0.2s',
                        }}
                      >
                        {/* Top row: client + date */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'hsl(215,80%,65%)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {client?.name ?? '—'}
                          </span>
                          {strategy.month && (
                            <span style={{ fontSize: '0.68rem', color: 'hsl(215,15%,45%)', background: 'rgba(255,255,255,0.06)', borderRadius: 5, padding: '2px 6px' }}>
                              {new Date(`${strategy.month}T12:00:00`).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="strategy-card-title">{strategy.title}</h4>

                        {/* Budget + Objective */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {strategy.monthly_budget != null && (
                            <span style={{ fontSize: '0.72rem', color: 'hsl(145,100%,50%)', fontWeight: 600 }}>
                              {formatCop(strategy.monthly_budget)}
                            </span>
                          )}
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.66rem', fontWeight: 700, ...objStyle }}>
                            {obj}
                          </span>
                        </div>

                        {/* Status + checklist chips */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {strategy.campaigns_new.length > 0 && (
                              <span className="mini-chip chip-green">+{strategy.campaigns_new.length}</span>
                            )}
                            {strategy.campaigns_off.length > 0 && (
                              <span className="mini-chip chip-red">-{strategy.campaigns_off.length}</span>
                            )}
                            {checklist.length > 0 && (
                              <span className="mini-chip chip-blue">
                                {checklist.filter((i) => i.done).length}/{checklist.length}✓
                              </span>
                            )}
                          </div>
                          {isInternal ? (
                            <select
                              className="status-select"
                              value={strategy.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                void handleStatusChange(strategy.id, e.target.value as Strategy['status']);
                              }}
                            >
                              <option value="pending">Pendiente</option>
                              <option value="mounted">Montada</option>
                              <option value="reviewed">Revisada</option>
                              <option value="approved">Aprobada</option>
                            </select>
                          ) : (
                            <span className="mini-chip">{statusLabel(strategy.status)}</span>
                          )}
                        </div>

                        {/* Expand button */}
                        {isInternal && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(strategy.id);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                              padding: '5px 0', background: 'none',
                              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6,
                              cursor: 'pointer', fontSize: '0.68rem',
                              color: 'hsl(215,15%,48%)', width: '100%',
                            }}
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {isExpanded ? 'Cerrar' : 'Optimización'}
                          </button>
                        )}

                        {/* Expanded: description + optimization dates */}
                        {isExpanded && isInternal && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'grid', gap: 10 }}
                          >
                            {strategy.ai_summary && (
                              <p style={{ margin: 0, fontSize: '0.76rem', color: 'hsl(215,15%,52%)', lineHeight: 1.5 }}>
                                {strategy.ai_summary.slice(0, 180)}{strategy.ai_summary.length > 180 ? '…' : ''}
                              </p>
                            )}

                            {/* Optimize creatives */}
                            <div>
                              <p style={{ margin: '0 0 5px', fontSize: '0.62rem', color: 'hsl(180,100%,50%)', letterSpacing: '0.08em' }}>
                                OPTIMIZAR CREATIVOS
                              </p>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="date"
                                  value={creativeDates[strategy.id] ?? ''}
                                  onChange={(e) => setCreativeDates((d) => ({ ...d, [strategy.id]: e.target.value }))}
                                  style={DATE_INPUT_STYLE}
                                />
                                <button
                                  type="button"
                                  title="Crear alerta de optimización de creativos"
                                  disabled={!creativeDates[strategy.id] || alertSaving.has(`${strategy.id}:creatives`)}
                                  onClick={() => void handleCreateOptimizeAlert(strategy, 'creatives')}
                                  style={{ ...CAL_BTN_STYLE, opacity: !creativeDates[strategy.id] ? 0.4 : 1 }}
                                >
                                  <Calendar size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Optimize adsets */}
                            <div>
                              <p style={{ margin: '0 0 5px', fontSize: '0.62rem', color: 'hsl(180,100%,50%)', letterSpacing: '0.08em' }}>
                                OPTIMIZAR CONJUNTOS DE ANUNCIOS
                              </p>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="date"
                                  value={adsetDates[strategy.id] ?? ''}
                                  onChange={(e) => setAdsetDates((d) => ({ ...d, [strategy.id]: e.target.value }))}
                                  style={DATE_INPUT_STYLE}
                                />
                                <button
                                  type="button"
                                  title="Crear alerta de optimización de conjuntos"
                                  disabled={!adsetDates[strategy.id] || alertSaving.has(`${strategy.id}:adsets`)}
                                  onClick={() => void handleCreateOptimizeAlert(strategy, 'adsets')}
                                  style={{ ...CAL_BTN_STYLE, opacity: !adsetDates[strategy.id] ? 0.4 : 1 }}
                                >
                                  <Calendar size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {group.length === 0 && <div className="lane-empty">Sin estrategias</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedStrategy && formMode !== 'edit' && (
        <StrategyDetailModal
          strategy={selectedStrategy}
          client={getClient(selectedStrategy.client_id) ?? null}
          history={historyByStrategy[selectedStrategy.id] ?? []}
          historyLoading={Boolean(loadingHistoryIds[selectedStrategy.id])}
          generatingTasks={Boolean(generatingTaskIds[selectedStrategy.id])}
          onClose={() => setSelectedStrategyId(null)}
          readOnly={!isInternal}
          onEdit={isInternal ? () => setFormMode('edit') : undefined}
          onGenerateTasks={isInternal ? () => void handleGenerateTasks(selectedStrategy.id) : undefined}
          onStatusChange={
            isInternal
              ? (status) => {
                  void handleStatusChange(selectedStrategy.id, status);
                }
              : undefined
          }
        />
      )}

      {isInternal && formMode && (formMode === 'create' || editingStrategy) && (
        <StrategyFormModal
          clients={visibleClients}
          strategy={editingStrategy}
          defaultClientId={selectedClient === 'all' ? undefined : selectedClient}
          saving={saving}
          onClose={() => setFormMode(null)}
          onSubmit={handleSaveStrategy}
        />
      )}
    </div>
  );
}
