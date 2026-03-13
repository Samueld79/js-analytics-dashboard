import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { StrategyDetailModal } from '../components/StrategyDetailModal';
import { StrategyFormModal } from '../components/StrategyFormModal';
import { useClients } from '../hooks/useClients';
import { useStrategies } from '../hooks/useStrategies';
import { formatCop, statusLabel } from '../lib/utils';
import type { Strategy } from '../lib/supabase';

const OPERATING_STATUSES: Strategy['status'][] = ['pending', 'mounted', 'reviewed', 'approved'];

export function StrategiesPage() {
  const { clients } = useClients();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientParam = searchParams.get('client');
  const [selectedClient, setSelectedClient] = useState(clientParam ?? 'all');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
  } = useStrategies(selectedClient === 'all' ? undefined : selectedClient);

  useEffect(() => {
    setSelectedClient(clientParam ?? 'all');
  }, [clientParam]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedStrategyId) ?? null,
    [selectedStrategyId, strategies],
  );

  const editingStrategy = formMode === 'edit' ? selectedStrategy : null;

  function getClient(id: string) {
    return clients.find((client) => client.id === id);
  }

  function handleClientFilter(value: string) {
    setSelectedClient(value);
    setSearchParams(value === 'all' ? {} : { client: value });
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

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Estrategias</h1>
          <p className="page-subtitle">
            {loading ? 'Cargando estrategias...' : `${strategies.length} estrategia${strategies.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="header-actions">
          <Link
            to={selectedClient === 'all' ? '/ai' : `/ai?client=${selectedClient}`}
            className="btn-secondary"
          >
            Crear con IA
          </Link>
          <button
            className="btn-primary"
            onClick={() => {
              setSelectedStrategyId(null);
              setFormMode('create');
            }}
          >
            <Plus size={16} /> Nueva Estrategia
          </button>
        </div>
      </div>

      <div className="filter-row">
        <button
          onClick={() => handleClientFilter('all')}
          className={`filter-chip ${selectedClient === 'all' ? 'active' : ''}`}
        >
          Todos
        </button>
        {clients.map((client) => (
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
            const group = strategies.filter((strategy) => strategy.status === status);
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

                    return (
                      <div
                        key={strategy.id}
                        className="strategy-card card"
                        onClick={() => void openStrategyDetail(strategy.id)}
                      >
                        <div className="strategy-card-top">
                          <span className="strategy-client-name">{client?.name ?? '—'}</span>
                          {strategy.month && (
                            <span className="strategy-month-badge">
                              {new Date(`${strategy.month}T12:00:00`).toLocaleDateString('es-CO', {
                                month: 'short',
                                year: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        <h4 className="strategy-card-title">{strategy.title}</h4>
                        {strategy.monthly_budget != null && (
                          <div className="strategy-budget">{formatCop(strategy.monthly_budget)}</div>
                        )}
                        {strategy.ai_summary && (
                          <p className="strategy-ai-preview">
                            {strategy.ai_summary.slice(0, 110)}
                            {strategy.ai_summary.length > 110 ? '…' : ''}
                          </p>
                        )}
                        <div className="strategy-card-footer">
                          <div className="strategy-chips">
                            {strategy.campaigns_new.length > 0 && (
                              <span className="mini-chip chip-green">
                                +{strategy.campaigns_new.length} campanas
                              </span>
                            )}
                            {strategy.campaigns_off.length > 0 && (
                              <span className="mini-chip chip-red">
                                -{strategy.campaigns_off.length} off
                              </span>
                            )}
                            {checklist.length > 0 && (
                              <span className="mini-chip chip-blue">
                                {checklist.filter((item) => item.done).length}/{checklist.length} ✓
                              </span>
                            )}
                            <span className="mini-chip">v{strategy.latest_version ?? strategy.version ?? 1}</span>
                          </div>
                          <div className="strategy-status-actions">
                            <select
                              className="status-select"
                              value={strategy.status}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                event.stopPropagation();
                                void handleStatusChange(
                                  strategy.id,
                                  event.target.value as Strategy['status'],
                                );
                              }}
                            >
                              <option value="pending">Pendiente</option>
                              <option value="mounted">Montada</option>
                              <option value="reviewed">Revisada</option>
                              <option value="approved">Aprobada</option>
                            </select>
                          </div>
                        </div>
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
          onEdit={() => setFormMode('edit')}
          onGenerateTasks={() => void handleGenerateTasks(selectedStrategy.id)}
          onStatusChange={(status) => {
            void handleStatusChange(selectedStrategy.id, status);
          }}
        />
      )}

      {formMode && (formMode === 'create' || editingStrategy) && (
        <StrategyFormModal
          clients={clients}
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
