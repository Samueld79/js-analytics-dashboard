import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from 'lucide-react';
import { StrategyDetailModal } from '../components/StrategyDetailModal';
import { StrategyFormModal } from '../components/StrategyFormModal';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useClients';
import { useStrategies } from '../hooks/useStrategies';
import { createOrTouchOperationalAlert } from '../services/alerts';
import { upsertOptimizeTask } from '../services/tasks';
import { formatCop, statusLabel } from '../lib/utils';
import type { Strategy } from '../lib/supabase';

const EMPTY_CLIENT_SCOPE = '00000000-0000-0000-0000-000000000000';

/** Statuses that map to the "Activa" column */
const ACTIVE_STATUSES: Strategy['status'][] = ['active', 'mounted', 'reviewed', 'approved'];

const STATUS_BORDER: Record<string, string> = {
  pending: 'var(--color-accent-cyan)',
  active: 'hsl(145,100%,45%)',   // green
};

const OBJECTIVE_STYLE: Record<string, { background: string; color: string }> = {
  Reconocimiento: { background: 'hsl(180 100% 50% / 0.12)', color: 'var(--color-accent-cyan)' },
  Tráfico: { background: 'hsl(215 80% 55% / 0.15)', color: 'hsl(215,80%,70%)' },
  Interacción: { background: 'hsl(280 80% 60% / 0.15)', color: 'hsl(280,80%,70%)' },
  Ventas: { background: 'hsl(145 100% 45% / 0.12)', color: 'hsl(145,100%,55%)' },
  General: { background: 'rgba(255,255,255,0.07)', color: 'hsl(215,15%,55%)' },
};

function inferObjective(strategy: Strategy): string {
  const explicit = strategy.campaigns?.[0]?.objective;
  if (explicit && explicit !== 'General') return explicit;
  const text = `${strategy.title ?? ''} ${strategy.notes ?? ''}`.toUpperCase();
  if (text.includes('RECON')) return 'Reconocimiento';
  if (text.includes('TRAFI')) return 'Tráfico';
  if (text.includes('INTER') || text.includes('ENGAGE')) return 'Interacción';
  if (text.includes('VENT') || text.includes('CONVER') || text.includes('VENTA')) return 'Ventas';
  return explicit ?? 'General';
}

const DATE_INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '4px 8px',
  fontSize: '0.76rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--color-border-strong)',
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
  color: 'var(--color-accent-cyan)',
  flexShrink: 0,
};

export function StrategiesPage() {
  const navigate = useNavigate();
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Kanban expand / optimization
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [creativeDates, setCreativeDates] = useState<Record<string, string>>({});
  const [adsetDates, setAdsetDates] = useState<Record<string, string>>({});
  const [alertSaving, setAlertSaving] = useState<Set<string>>(new Set());
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);

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
    deleteStrategy,
    toggleOptimizing,
    loadHistory,
    generateTasks,
    loadingHistoryIds,
    generatingTaskIds,
  } = useStrategies(queryClientId);

  // Which "En optimización" section is expanded per kanban column (only one: 'active')
  const [optimizingSectionOpen, setOptimizingSectionOpen] = useState(true);

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

  async function handleDeleteConfirm(id: string) {
    setDeletingId(id);
    const result = await deleteStrategy(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (result.error) {
      setNotice(result.error);
    } else {
      if (selectedStrategyId === id) setSelectedStrategyId(null);
    }
  }

  async function handleSaveStrategy(
    input: import('../lib/supabase').StrategyInput,
    options?: { changeSummary?: string | null; optimizeCreativesDate?: string; optimizeAdsetsDate?: string },
  ) {
    const result = editingStrategy
      ? await updateStrategy(editingStrategy.id, input, { changeSummary: options?.changeSummary })
      : await createStrategy(input, { changeSummary: options?.changeSummary });

    if (result.data) {
      const strategy = result.data;
      setSelectedStrategyId(strategy.id);
      await loadHistory(strategy.id);
      setNotice(editingStrategy ? 'Estrategia actualizada.' : 'Estrategia creada.');

      // Create or update optimization tasks (no dates appended to notes)
      if (options?.optimizeCreativesDate) {
        await upsertOptimizeTask({
          strategyId: strategy.id,
          clientId: strategy.client_id,
          title: `🎨 Optimizar creativos — ${strategy.title}`,
          dueDate: options.optimizeCreativesDate,
          description: 'Optimización programada desde Estrategias',
        });
      }
      if (options?.optimizeAdsetsDate) {
        await upsertOptimizeTask({
          strategyId: strategy.id,
          clientId: strategy.client_id,
          title: `⚙️ Optimizar conjuntos — ${strategy.title}`,
          dueDate: options.optimizeAdsetsDate,
          description: 'Optimización de conjuntos programada',
        });
      }
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

  function renderCard(strategy: Strategy, borderColor: string) {
    const client = getClient(strategy.client_id);
    const obj = inferObjective(strategy);
    const objStyle = OBJECTIVE_STYLE[obj] ?? OBJECTIVE_STYLE.General;
    const isExpanded = expandedIds.has(strategy.id);
    const isConfirmingDelete = confirmDeleteId === strategy.id;
    const isActiveCard = ACTIVE_STATUSES.includes(strategy.status);
    const isHovered = hoveredCardId === strategy.id;

    return (
      <div
        key={strategy.id}
        className="strategy-card"
        onClick={() => void openStrategyDetail(strategy.id)}
        onMouseEnter={() => setHoveredCardId(strategy.id)}
        onMouseLeave={() => setHoveredCardId(null)}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderLeftColor: borderColor,
          borderLeftWidth: 3,
          borderLeftStyle: 'solid',
          borderRadius: 10,
          padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 7,
          cursor: 'pointer',
          position: 'relative',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
      >
        {/* Confirm delete overlay */}
        {isConfirmingDelete && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', inset: 0, zIndex: 10, borderRadius: 9,
              background: 'rgba(10,14,24,0.94)', backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16,
            }}
          >
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'hsl(0,84%,70%)', textAlign: 'center', fontWeight: 600 }}>¿Eliminar esta estrategia?</p>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'hsl(215,15%,52%)', textAlign: 'center' }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={deletingId === strategy.id} onClick={() => void handleDeleteConfirm(strategy.id)}
                style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'hsl(0,84%,55%)', color: '#fff', fontSize: '0.76rem', fontWeight: 700, opacity: deletingId === strategy.id ? 0.5 : 1 }}>
                {deletingId === strategy.id ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button type="button" onClick={() => setConfirmDeleteId(null)}
                style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'transparent', color: 'hsl(215,15%,65%)', fontSize: '0.76rem' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ROW 1: client + date pill + trash (hover only) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <span className="strategy-client-name" style={{ flex: 1 }}>
            {client?.name ?? '—'}
          </span>
          {strategy.month && (
            <span style={{ fontSize: '0.6rem', color: 'hsl(215,15%,42%)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '1px 6px', border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              {new Date(`${strategy.month}T12:00:00`).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })}
            </span>
          )}
          {isInternal && (
            <button type="button" title="Eliminar estrategia"
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(strategy.id); }}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer',
                background: isHovered ? 'hsl(0 84% 60% / 0.15)' : 'transparent',
                color: 'hsl(0,84%,60%)',
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.15s, background 0.15s',
                flexShrink: 0,
              }}
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>

        {/* ROW 2: title */}
        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.25, color: '#e8f0ff' }}>
          {strategy.title}
        </h4>

        {/* ROW 3: budget badge + objective + "Optimizando" amber badge */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {strategy.monthly_budget != null && (
            <span style={{ fontSize: '0.68rem', color: 'hsl(145,100%,55%)', fontWeight: 700, fontFamily: 'JetBrains Mono', background: 'hsl(145 100% 45% / 0.1)', padding: '1px 7px', borderRadius: 5, border: '1px solid hsl(145 100% 45% / 0.15)' }}>
              {formatCop(strategy.monthly_budget)}
            </span>
          )}
          <span style={{ padding: '1px 8px', borderRadius: 8, fontSize: '0.61rem', fontWeight: 700, ...objStyle }}>
            {obj}
          </span>
          {strategy.is_optimizing && (
            <span style={{ padding: '1px 8px', borderRadius: 8, fontSize: '0.61rem', fontWeight: 700, background: 'hsl(38 100% 55% / 0.12)', color: 'hsl(38,100%,62%)', border: '1px solid hsl(38 100% 55% / 0.2)' }}>
              🔧 Optimizando
            </span>
          )}
        </div>

        {/* ROW 4: footer — status select + optimizing switch + calendar icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {isInternal ? (
            <select
              className="status-select"
              value={ACTIVE_STATUSES.includes(strategy.status) ? 'active' : strategy.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                void handleStatusChange(strategy.id, e.target.value as Strategy['status']);
              }}
              style={{ flex: 1, minWidth: 0 }}
            >
              <option value="pending">Pendiente</option>
              <option value="active">Activa</option>
              <option value="archived">📦 Archivar</option>
            </select>
          ) : (
            <span className="mini-chip" style={{ flex: 1 }}>{statusLabel(strategy.status)}</span>
          )}

          {/* Optimizing toggle switch — active cards only */}
          {isInternal && isActiveCard && (
            <button
              type="button"
              title={strategy.is_optimizing ? 'Quitar de optimización' : 'Marcar en optimización'}
              onClick={(e) => { e.stopPropagation(); void toggleOptimizing(strategy.id, !strategy.is_optimizing); }}
              style={{
                width: 34, height: 18, borderRadius: 9, padding: 0, border: 'none',
                background: strategy.is_optimizing ? 'hsl(38,100%,50%)' : 'rgba(255,255,255,0.1)',
                cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2,
                left: strategy.is_optimizing ? 16 : 2,
                width: 14, height: 14, borderRadius: '50%',
                background: strategy.is_optimizing ? '#000' : 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.5rem', transition: 'left 0.2s',
                pointerEvents: 'none',
              }}>🔧</span>
            </button>
          )}

          {/* Calendar icon — expand date pickers */}
          {isInternal && (
            <button
              type="button"
              title="Fechas optimización"
              onClick={(e) => { e.stopPropagation(); toggleExpanded(strategy.id); }}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: 5, cursor: 'pointer',
                border: `1px solid ${isExpanded ? 'var(--color-accent-cyan)' : 'var(--color-border)'}`,
                background: isExpanded ? 'hsl(180 100% 45% / 0.1)' : 'transparent',
                color: isExpanded ? 'var(--color-accent-cyan)' : 'hsl(215,15%,38%)',
                flexShrink: 0,
              }}
            >
              <Calendar size={11} />
            </button>
          )}
        </div>

        {/* Date pickers panel (expandable) */}
        {isExpanded && isInternal && (
          <div onClick={(e) => e.stopPropagation()}
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'grid', gap: 8 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '0.58rem', color: 'var(--color-accent-cyan)', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono' }}>📅 CREATIVOS</p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="date" value={creativeDates[strategy.id] ?? ''} onChange={(e) => setCreativeDates((d) => ({ ...d, [strategy.id]: e.target.value }))} style={DATE_INPUT_STYLE} />
                <button type="button" disabled={!creativeDates[strategy.id] || alertSaving.has(`${strategy.id}:creatives`)} onClick={() => void handleCreateOptimizeAlert(strategy, 'creatives')} style={{ ...CAL_BTN_STYLE, opacity: !creativeDates[strategy.id] ? 0.35 : 1 }}>
                  <Calendar size={11} />
                </button>
              </div>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '0.58rem', color: 'var(--color-accent-cyan)', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono' }}>📅 CONJUNTOS</p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="date" value={adsetDates[strategy.id] ?? ''} onChange={(e) => setAdsetDates((d) => ({ ...d, [strategy.id]: e.target.value }))} style={DATE_INPUT_STYLE} />
                <button type="button" disabled={!adsetDates[strategy.id] || alertSaving.has(`${strategy.id}:adsets`)} onClick={() => void handleCreateOptimizeAlert(strategy, 'adsets')} style={{ ...CAL_BTN_STYLE, opacity: !adsetDates[strategy.id] ? 0.35 : 1 }}>
                  <Calendar size={11} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Estrategias</h1>
          <p className="page-subtitle">
            {loading
              ? 'Cargando estrategias...'
              : (() => {
                  const activeCount = visibleStrategies.filter((s) => s.status !== 'archived').length;
                  return `${activeCount} estrategia${activeCount !== 1 ? 's' : ''}${!isInternal ? ' visibles para tu empresa' : ''}`;
                })()}
          </p>
        </div>
        <div className="header-actions">
          {isInternal ? (
            <>
              <button
                className="btn-ghost"
                onClick={() => {
                  const clientId = selectedClient !== 'all' ? selectedClient : undefined;
                  navigate(clientId ? `/ai-tools/estrategia?clientId=${clientId}` : '/ai-tools/estrategia');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--color-accent-cyan)', color: 'var(--color-accent-cyan)' }}
              >
                <Sparkles size={15} /> Crear con AI Tools
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setSelectedStrategyId(null);
                  setFormMode('create');
                }}
              >
                <Plus size={16} /> Nueva Estrategia
              </button>
            </>
          ) : (
            <span className="meta-chip">Solo lectura</span>
          )}
        </div>
      </div>

      {/* AI Tools banner — visible solo para internos */}
      {isInternal && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px', marginBottom: 4,
          background: 'color-mix(in srgb, var(--color-accent-cyan) 6%, var(--color-bg-card))',
          border: '1px solid color-mix(in srgb, var(--color-accent-cyan) 20%, transparent)',
          borderRadius: 10,
          flexWrap: 'wrap', gap: 10,
        }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
            ⚡ ¿Quieres crear una estrategia con IA?
          </span>
          <button
            onClick={() => {
              const clientId = selectedClient !== 'all' ? selectedClient : undefined;
              navigate(clientId ? `/ai-tools/estrategia?clientId=${clientId}` : '/ai-tools/estrategia');
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              borderRadius: 8, border: '1px solid var(--color-accent-cyan)',
              background: 'transparent', color: 'var(--color-accent-cyan)',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--color-accent-cyan) 10%, transparent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Generar con AI Tools →
          </button>
        </div>
      )}

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
        <div className="status-lanes">
          {(['pending', 'active'] as const).map((col) => (
            <div key={col} className="status-lane">
              <div className="lane-header">
                <span className="lane-dot" style={{ background: STATUS_BORDER[col], boxShadow: `0 0 6px ${STATUS_BORDER[col]}55` }} />
                <span className="lane-title">{col === 'pending' ? 'Pendiente' : 'Activa'}</span>
              </div>
              <div className="lane-cards">
                {[1, 2].map((n) => (
                  <div key={n} className="skeleton-card" style={{ height: 130 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="status-lanes">
          {(['pending', 'active'] as const).map((col) => {
            const isPending = col === 'pending';
            const borderColor = STATUS_BORDER[col];
            const group = isPending
              ? visibleStrategies.filter((s) => s.status === 'pending')
              : visibleStrategies.filter((s) => ACTIVE_STATUSES.includes(s.status));
            const normalGroup = isPending ? group : group.filter((s) => !s.is_optimizing);
            const optimizingGroup = isPending ? [] : group.filter((s) => s.is_optimizing);

            return (
              <div key={col} className="status-lane">
                <div className="lane-header">
                  <span className="lane-dot" style={{ background: borderColor, boxShadow: `0 0 6px ${borderColor}55` }} />
                  <span className="lane-title">{isPending ? 'Pendiente' : 'Activa'}</span>
                  <span className="lane-count">{group.length}</span>
                </div>
                <div className="lane-cards">
                  {normalGroup.map((s) => renderCard(s, borderColor))}
                  {normalGroup.length === 0 && optimizingGroup.length === 0 && (
                    <div className="lane-empty">Sin estrategias</div>
                  )}

                  {!isPending && optimizingGroup.length > 0 && (
                    <div style={{ marginTop: normalGroup.length > 0 ? 10 : 0 }}>
                      <button
                        type="button"
                        onClick={() => setOptimizingSectionOpen((v) => !v)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                          padding: '5px 10px', borderRadius: 7, marginBottom: 6,
                          background: 'hsl(38 100% 55% / 0.08)',
                          border: '1px solid hsl(38 100% 55% / 0.2)',
                          cursor: 'pointer', color: 'hsl(38,100%,62%)', fontSize: '0.72rem', fontWeight: 700,
                        }}
                      >
                        {optimizingSectionOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        🔧 En optimización ({optimizingGroup.length})
                      </button>
                      {optimizingSectionOpen && optimizingGroup.map((s) => renderCard(s, 'hsl(38,100%,55%)'))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Archived section ─────────────────────────────────── */}
      {!loading && (() => {
        const archivedStrategies = visibleStrategies.filter((s) => s.status === 'archived');
        if (archivedStrategies.length === 0) return null;
        return (
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={() => setArchivedOpen((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderRadius: 8, marginBottom: archivedOpen ? 12 : 0,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', color: 'hsl(215,15%,50%)', fontSize: '0.75rem', fontWeight: 700,
                width: '100%',
              }}
            >
              {archivedOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              📦 ARCHIVADAS ({archivedStrategies.length})
            </button>
            {archivedOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, opacity: 0.55 }}>
                {archivedStrategies.map((s) => {
                  const client = getClient(s.client_id);
                  const obj = inferObjective(s);
                  const objStyle = OBJECTIVE_STYLE[obj] ?? OBJECTIVE_STYLE.General;
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                        borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: 'hsl(215,15%,35%)',
                        borderRadius: 10, padding: '10px 12px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ flex: 1, fontSize: '0.63rem', fontWeight: 700, color: 'hsl(215,15%,50%)', textTransform: 'uppercase', letterSpacing: '0.07em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {client?.name ?? '—'}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: 'hsl(215,15%,35%)', background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '1px 6px', border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                          ARCHIVADA
                        </span>
                      </div>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.25, color: 'hsl(215,15%,65%)' }}>
                        {s.title}
                      </h4>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        {s.monthly_budget != null && (
                          <span style={{ fontSize: '0.67rem', color: 'hsl(215,15%,45%)', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                            {formatCop(s.monthly_budget)}
                          </span>
                        )}
                        <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: '0.6rem', fontWeight: 700, ...objStyle, opacity: 0.6 }}>
                          {obj}
                        </span>
                      </div>
                      {isInternal && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(s.id, 'pending')}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
                            background: 'transparent', cursor: 'pointer',
                            color: 'var(--color-accent-cyan)', fontSize: '0.68rem', fontWeight: 600,
                            alignSelf: 'flex-start',
                          }}
                        >
                          Restaurar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
