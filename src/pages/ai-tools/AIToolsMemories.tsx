import { useCallback, useEffect, useState } from 'react';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import { TOOL_CONFIGS } from './toolConfigs';
import {
  listToolKnowledgeBases,
  updateToolKnowledgeBase,
  type ToolKnowledgeBase,
} from '../../services/aiToolsService';

type SaveState = { saving: boolean; ok: boolean; error: string | null };

const INIT_SAVE: SaveState = { saving: false, ok: false, error: null };

export function AIToolsMemories() {
  const [memories, setMemories] = useState<ToolKnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listToolKnowledgeBases();
    setMemories(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function getContent(toolKey: string): string {
    if (toolKey in edited) return edited[toolKey];
    return memories.find((m) => m.tool_key === toolKey)?.content ?? '';
  }

  async function handleSave(toolKey: string) {
    setSaveStates((p) => ({ ...p, [toolKey]: { saving: true, ok: false, error: null } }));
    const { error } = await updateToolKnowledgeBase(toolKey, edited[toolKey] ?? '');
    if (error) {
      setSaveStates((p) => ({ ...p, [toolKey]: { saving: false, ok: false, error } }));
    } else {
      setSaveStates((p) => ({ ...p, [toolKey]: { saving: false, ok: true, error: null } }));
      setTimeout(() => setSaveStates((p) => ({ ...p, [toolKey]: INIT_SAVE })), 3000);
      await load();
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
        Cargando memorias...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <div>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
          Memorias de IA
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
          Conocimiento base que se inyecta en los prompts de cada herramienta. Edita para personalizar el comportamiento de la IA.
        </p>
      </div>

      {TOOL_CONFIGS.map((tool) => {
        const content = getContent(tool.key);
        const state = saveStates[tool.key] ?? INIT_SAVE;
        const isDirty = tool.key in edited;

        return (
          <div
            key={tool.key}
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{tool.emoji}</span>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                  {tool.title}
                </span>
                {isDirty && (
                  <span style={{
                    fontSize: '0.6rem',
                    padding: '1px 7px',
                    borderRadius: 20,
                    background: 'color-mix(in srgb, var(--color-accent-cyan) 15%, transparent)',
                    color: 'var(--color-accent-cyan)',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                  }}>
                    EDITADO
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {state.ok && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: '0.75rem' }}>
                    <CheckCircle size={13} /> Guardado
                  </div>
                )}
                {state.error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', fontSize: '0.75rem' }}>
                    <AlertCircle size={13} /> {state.error}
                  </div>
                )}
                {isDirty && (
                  <button
                    className="btn-primary"
                    onClick={() => void handleSave(tool.key)}
                    disabled={state.saving}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: '0.76rem' }}
                  >
                    <Save size={12} />
                    {state.saving ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding: '14px 18px' }}>
              <textarea
                value={content}
                onChange={(e) => setEdited((p) => ({ ...p, [tool.key]: e.target.value }))}
                rows={8}
                style={{
                  width: '100%',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.78rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  lineHeight: 1.7,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
                placeholder={`Contenido de la memoria para ${tool.title}...`}
              />
              <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 6, marginBottom: 0 }}>
                {content.length} caracteres
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
