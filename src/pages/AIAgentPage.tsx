import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Send, Lightbulb, Brain, Loader2, FileText, Save } from 'lucide-react';
import { StrategyFormModal } from '../components/StrategyFormModal';
import { useClients, useStrategies } from '../hooks/useData';
import type { StrategyInput } from '../lib/supabase';
import {
  buildChecklistFromStrategy,
  queryClientMemory,
  structureStrategyFromText,
  summarizePreviousStrategy,
  type StructuredStrategyResponse,
} from '../services/ai';
import { saveStructuredDraftToMemory } from '../services/memory';

function csv(values: string[]): string {
  return values.join(', ');
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeChecklist(strategy: StrategyInput): string {
  return strategy.ai_checklist
    .map((item) => [item.task, item.priority ?? '', item.notes ?? ''].join(' | ').trim())
    .join('\n');
}

function parseChecklist(value: string): StrategyInput['ai_checklist'] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [task, priority, notes] = line.split('|').map((part) => part.trim());
      return {
        task,
        priority: priority || undefined,
        notes: notes || undefined,
        done: false,
      };
    })
    .filter((item) => item.task);
}

export function AIAgentPage() {
  const { clients } = useClients();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientParam = searchParams.get('client') ?? '';

  const [selectedClient, setSelectedClient] = useState(clientParam);
  const [rawInput, setRawInput] = useState('');
  const [mode, setMode] = useState<'structure' | 'query'>('structure');
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [structureLoading, setStructureLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [savingWithTasks, setSavingWithTasks] = useState(false);
  const [structuredResult, setStructuredResult] = useState<StructuredStrategyResponse | null>(null);
  const [previousSummary, setPreviousSummary] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const {
    strategies,
    createStrategy,
    generateTasks,
    saving: savingStrategy,
  } = useStrategies(selectedClient || undefined);

  useEffect(() => {
    setSelectedClient(clientParam);
  }, [clientParam]);

  useEffect(() => {
    setStructuredResult(null);
    setPreviousSummary(null);
    setRawInput('');
    setChatHistory([]);
    setMessage(null);
  }, [selectedClient]);

  const client = clients.find((entry) => entry.id === selectedClient);
  const latestApproved = useMemo(
    () => strategies.find((strategy) => strategy.status === 'approved') ?? strategies[0] ?? null,
    [strategies],
  );

  function setClient(value: string) {
    setSelectedClient(value);
    setSearchParams(value ? { client: value } : {});
  }

  function updateDraft(patch: Partial<StrategyInput>) {
    setStructuredResult((current) =>
      current
        ? {
            ...current,
            strategy: {
              ...current.strategy,
              ...patch,
            },
          }
        : current,
    );
  }

  function updateChecklistText(value: string) {
    setStructuredResult((current) =>
      current
        ? {
            ...current,
            strategy: {
              ...current.strategy,
              ai_checklist: parseChecklist(value),
            },
          }
        : current,
    );
  }

  async function handleStructureStrategy() {
    if (!selectedClient || !rawInput.trim()) return;

    setStructureLoading(true);
    setMessage(null);
    try {
      const result = await structureStrategyFromText({
        clientId: selectedClient,
        rawInput,
      });
      setStructuredResult(result);
      setPreviousSummary(result.previousSummary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo estructurar la estrategia.');
    } finally {
      setStructureLoading(false);
    }
  }

  async function handlePreviousSummary() {
    if (!selectedClient) return;

    setStructureLoading(true);
    setMessage(null);
    try {
      const summary = await summarizePreviousStrategy(selectedClient);
      setPreviousSummary(summary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar el resumen anterior.');
    } finally {
      setStructureLoading(false);
    }
  }

  async function handleSaveStrategy(options: { generateTasksAfterSave?: boolean } = {}) {
    if (!structuredResult) return;

    if (options.generateTasksAfterSave) {
      setSavingWithTasks(true);
    }

    const result = await createStrategy(structuredResult.strategy, {
      changeSummary: 'Creada desde Agente IA',
    });

    if (result.error) {
      setMessage(result.error);
      setSavingWithTasks(false);
      return;
    }

    if (result.data && options.generateTasksAfterSave) {
      const taskResult = await generateTasks(result.data.id, result.data.ai_checklist);
      setSavingWithTasks(false);

      if (taskResult.error) {
        setMessage(`Estrategia guardada, pero no se pudieron generar tareas: ${taskResult.error}`);
        return;
      }

      const createdCount = taskResult.data?.length ?? 0;
      setMessage(
        createdCount > 0
          ? `Estrategia guardada y ${createdCount} tarea${createdCount !== 1 ? 's' : ''} creada${createdCount !== 1 ? 's' : ''}.`
          : 'Estrategia guardada. No se crearon tareas nuevas porque ya existían abiertas.',
      );
      return;
    }

    setSavingWithTasks(false);
    setMessage('Estrategia guardada correctamente.');
  }

  async function handleSaveMemory() {
    if (!selectedClient || !structuredResult) return;

    setSavingMemory(true);
    setMessage(null);
    try {
      const result = await saveStructuredDraftToMemory({
        clientId: selectedClient,
        strategy: structuredResult.strategy,
        observations: structuredResult.observations,
        rawInput,
      });

      if (result.error) {
        setMessage(result.error);
        return;
      }

      const saved = result.data?.length ?? 0;
      setMessage(`${saved} entrada${saved !== 1 ? 's' : ''} guardada${saved !== 1 ? 's' : ''} en memoria.`);
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleQueryMemory() {
    if (!selectedClient || !query.trim()) return;

    const userText = query.trim();
    setChatHistory((current) => [...current, { role: 'user', text: userText }]);
    setQuery('');
    setQueryLoading(true);

    try {
      const response = await queryClientMemory(selectedClient, userText);
      setChatHistory((current) => [...current, { role: 'ai', text: response.answer }]);
    } catch (error) {
      setChatHistory((current) => [
        ...current,
        {
          role: 'ai',
          text: error instanceof Error ? error.message : 'No se pudo consultar la memoria del cliente.',
        },
      ]);
    } finally {
      setQueryLoading(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Bot size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Agente IA
          </h1>
          <p className="page-subtitle">Copiloto estratégico conectado a estrategias y memoria real</p>
        </div>
      </div>

      <div className="card section-block ai-client-selector">
        <label className="form-label">Selecciona el cliente</label>
        <select className="form-select" value={selectedClient} onChange={(event) => setClient(event.target.value)}>
          <option value="">— Seleccionar cliente —</option>
          {clients.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        {client && (
          <div className="client-context-chip">
            <Brain size={14} />
            Contexto: {client.name} · {client.niche ?? 'Sin nicho'} · {strategies.length} estrategia{strategies.length !== 1 ? 's' : ''} registrada{strategies.length !== 1 ? 's' : ''}
          </div>
        )}
        <div className="ai-context-actions">
          <button className="btn-secondary" onClick={() => void handlePreviousSummary()} disabled={!selectedClient || structureLoading}>
            <FileText size={14} /> Resumen anterior
          </button>
          {latestApproved && (
            <span className="meta-chip">
              Ultima aprobada: {latestApproved.title}
            </span>
          )}
        </div>
        {previousSummary && (
          <div className="ai-summary-block">
            <h3>Resumen anterior</h3>
            <p>{previousSummary}</p>
          </div>
        )}
        {message && <p className="empty-note">{message}</p>}
      </div>

      <div className="tab-bar">
        <button onClick={() => setMode('structure')} className={`tab-btn ${mode === 'structure' ? 'active' : ''}`}>
          <Lightbulb size={14} /> Estructurar Estrategia
        </button>
        <button onClick={() => setMode('query')} className={`tab-btn ${mode === 'query' ? 'active' : ''}`}>
          <Bot size={14} /> Consultar Memoria
        </button>
      </div>

      {mode === 'structure' && (
        <div className="ai-workspace">
          <div className="ai-input-panel card section-block">
            <div className="section-heading"><h2>Texto libre del estratega</h2></div>
            <textarea
              className="ai-textarea"
              rows={10}
              placeholder={`Pega aqui la estrategia como la escribirias normalmente.\n\nMes: marzo\nPresupuesto: $25M\nCampanas nuevas:\n- Coleccion primavera - conversiones - $8M\n- Remarketing carrito - $3M\nApagar: Campana reyes - trafico\nOptimizar: siempre activo subir 20%\nPublicos: mujeres 23-45, Bogota y Medellin\nCreativos: unboxing video, carrusel top 5 prendas`}
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
            />
            <button
              className="btn-primary btn-ai"
              onClick={() => void handleStructureStrategy()}
              disabled={!rawInput.trim() || !selectedClient || structureLoading}
            >
              {structureLoading ? (
                <>
                  <Loader2 size={16} className="spin" /> Creando estructura...
                </>
              ) : (
                <>
                  <Bot size={16} /> Crear con IA
                </>
              )}
            </button>
          </div>

          {structuredResult && (
            <div className="ai-output card section-block">
              <div className="section-heading"><h2>Estrategia estructurada</h2></div>

              <div className="form-row-2">
                <div className="form-field">
                  <label>Titulo</label>
                  <input
                    className="form-input"
                    value={structuredResult.strategy.title}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                  />
                </div>
                <div className="form-row-2">
                  <div className="form-field">
                    <label>Mes</label>
                    <input
                      type="month"
                      className="form-input"
                      value={(structuredResult.strategy.month ?? '').slice(0, 7)}
                      onChange={(event) => updateDraft({ month: `${event.target.value}-01` })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Presupuesto</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      value={structuredResult.strategy.monthly_budget ?? ''}
                      onChange={(event) =>
                        updateDraft({
                          monthly_budget: event.target.value ? Number(event.target.value) || 0 : null,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="ai-summary-block">
                <h3>Resumen ejecutivo editable</h3>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={structuredResult.strategy.ai_summary ?? ''}
                  onChange={(event) => updateDraft({ ai_summary: event.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label>Publicos</label>
                  <input
                    className="form-input"
                    value={csv(structuredResult.strategy.segmentation.audiences ?? [])}
                    onChange={(event) =>
                      updateDraft({
                        segmentation: {
                          ...structuredResult.strategy.segmentation,
                          audiences: parseCsv(event.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="form-field">
                  <label>Ciudades</label>
                  <input
                    className="form-input"
                    value={csv(structuredResult.strategy.segmentation.cities ?? [])}
                    onChange={(event) =>
                      updateDraft({
                        segmentation: {
                          ...structuredResult.strategy.segmentation,
                          cities: parseCsv(event.target.value),
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Notas</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={structuredResult.strategy.notes ?? ''}
                  onChange={(event) => updateDraft({ notes: event.target.value })}
                />
              </div>

              {structuredResult.observations.length > 0 && (
                <div className="ai-observations">
                  {structuredResult.observations.map((observation, index) => (
                    <div key={`${observation}-${index}`} className="ai-obs-item">
                      {observation}
                    </div>
                  ))}
                </div>
              )}

              <div className="ai-checklist-block">
                <div className="ai-inline-header">
                  <h3>Checklist operativo</h3>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      updateDraft({
                        ai_checklist: buildChecklistFromStrategy(structuredResult.strategy),
                      })
                    }
                  >
                    Rehacer checklist
                  </button>
                </div>
                <textarea
                  className="form-textarea strategy-code-textarea"
                  rows={6}
                  value={serializeChecklist(structuredResult.strategy)}
                  onChange={(event) => updateChecklistText(event.target.value)}
                />
              </div>

              <div className="campaign-blocks">
                <div>
                  <h3 style={{ color: '#00e676' }}>Campanas nuevas</h3>
                  {structuredResult.strategy.campaigns_new.length === 0 ? (
                    <p className="empty-note">No se detectaron campanas nuevas.</p>
                  ) : (
                    structuredResult.strategy.campaigns_new.map((campaign, index) => (
                      <div key={`${campaign.name}-${index}`} className="campaign-entry">
                        <strong>{campaign.name}</strong>
                        {campaign.objective && <span className="campaign-meta">Obj: {campaign.objective}</span>}
                        {campaign.budget != null && <span className="campaign-meta">Budget: {campaign.budget.toLocaleString('es-CO')}</span>}
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <h3 style={{ color: '#ffc107' }}>Optimizar</h3>
                  {structuredResult.strategy.campaigns_optimize.length === 0 ? (
                    <p className="empty-note">Sin optimizaciones detectadas.</p>
                  ) : (
                    structuredResult.strategy.campaigns_optimize.map((campaign, index) => (
                      <div key={`${campaign.name}-${index}`} className="campaign-entry optimize">
                        <strong>{campaign.name}</strong>
                        {campaign.action && <span className="campaign-meta">{campaign.action}</span>}
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <h3 style={{ color: '#ff5252' }}>Apagar</h3>
                  {structuredResult.strategy.campaigns_off.length === 0 ? (
                    <p className="empty-note">Sin campanas a apagar.</p>
                  ) : (
                    structuredResult.strategy.campaigns_off.map((campaign, index) => (
                      <div key={`${campaign.name}-${index}`} className="campaign-entry off">
                        <strong>{campaign.name}</strong>
                        {campaign.reason && <span className="campaign-meta">{campaign.reason}</span>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="ai-save-actions">
                <button className="btn-primary" onClick={() => void handleSaveStrategy()} disabled={savingStrategy}>
                  {savingStrategy ? (
                    <>
                      <Loader2 size={16} className="spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Guardar como estrategia
                    </>
                  )}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => void handleSaveStrategy({ generateTasksAfterSave: true })}
                  disabled={savingStrategy || savingWithTasks}
                >
                  {savingWithTasks ? (
                    <>
                      <Loader2 size={16} className="spin" /> Guardando y creando tareas...
                    </>
                  ) : (
                    'Guardar y generar tareas'
                  )}
                </button>
                <button className="btn-secondary" onClick={() => setShowEditModal(true)}>
                  Editar detalle
                </button>
                <button className="btn-secondary" onClick={() => void handleSaveMemory()} disabled={savingMemory}>
                  {savingMemory ? 'Guardando memoria...' : 'Guardar en memoria'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'query' && (
        <div className="ai-chat card section-block">
          <div className="chat-history">
            {chatHistory.length === 0 && (
              <div className="chat-placeholder">
                <Bot size={32} />
                <p>Pregunta sobre el historial de estrategias, publicos usados o aprendizajes del cliente.</p>
                <div className="chat-suggestions">
                  {[
                    'Dame resumen de la estrategia anterior',
                    'Que publicos hemos usado antes',
                    'Que aprendizajes tiene este cliente',
                    'Que campanas se apagaron',
                  ].map((suggestion) => (
                    <button key={suggestion} className="suggestion-chip" onClick={() => setQuery(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((messageEntry, index) => (
              <div key={`${messageEntry.role}-${index}`} className={`chat-msg ${messageEntry.role}`}>
                <span className="chat-avatar">{messageEntry.role === 'user' ? 'U' : 'IA'}</span>
                <div className="chat-bubble">{messageEntry.text}</div>
              </div>
            ))}

            {queryLoading && (
              <div className="chat-msg ai">
                <span className="chat-avatar">IA</span>
                <div className="chat-bubble">
                  <Loader2 size={14} className="spin" /> Consultando memoria...
                </div>
              </div>
            )}
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder={selectedClient ? 'Pregunta sobre el historial de este cliente...' : 'Selecciona un cliente primero'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleQueryMemory();
                }
              }}
              disabled={!selectedClient}
            />
            <button className="btn-primary chat-send" onClick={() => void handleQueryMemory()} disabled={!query.trim() || !selectedClient || queryLoading}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {showEditModal && structuredResult && (
        <StrategyFormModal
          clients={clients}
          draft={structuredResult.strategy}
          defaultClientId={selectedClient}
          saving={savingStrategy}
          onClose={() => setShowEditModal(false)}
          onSubmit={async (input, options) => {
            const result = await createStrategy(input, {
              changeSummary: options?.changeSummary ?? 'Creada desde Agente IA',
            });
            if (result.error) {
              setMessage(result.error);
            } else {
              setMessage('Estrategia guardada desde editor IA.');
            }
            return result;
          }}
        />
      )}
    </div>
  );
}
