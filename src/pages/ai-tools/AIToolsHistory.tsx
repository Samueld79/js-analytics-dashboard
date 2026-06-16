import { useCallback, useEffect, useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, Copy, Check, CheckCircle } from 'lucide-react';
import { TOOL_CONFIGS } from './toolConfigs';
import { useAITools } from '../../hooks/useAIToolsContext';
import { useAuth } from '../../hooks/useAuth';
import {
  listToolOutputs,
  deleteToolOutput,
  updateToolOutputInputs,
  type ToolOutput,
} from '../../services/aiToolsService';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ToolBadge({ toolKey }: { toolKey: string }) {
  const tool = TOOL_CONFIGS.find((t) => t.key === toolKey);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.7rem', fontWeight: 600, padding: '2px 9px', borderRadius: 20,
      background: 'color-mix(in srgb, var(--color-accent-cyan) 10%, transparent)',
      color: 'var(--color-accent-cyan)',
      border: '1px solid color-mix(in srgb, var(--color-accent-cyan) 20%, transparent)',
    }}>
      {tool?.emoji} {tool?.title ?? toolKey}
    </span>
  );
}

function StatusBadge({ output }: { output: ToolOutput }) {
  const isReady = output.inputs['ready_for_review'] === true;
  const isReviewed = Boolean(output.inputs['reviewed_by']);

  if (!isReady) return null;

  if (isReviewed) {
    return (
      <span style={{
        fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
        background: 'color-mix(in srgb, #22c55e 12%, transparent)',
        color: '#22c55e',
        border: '1px solid color-mix(in srgb, #22c55e 25%, transparent)',
      }}>
        ✅ Revisado
      </span>
    );
  }

  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: 'color-mix(in srgb, hsl(38,92%,55%) 12%, transparent)',
      color: 'hsl(38,92%,60%)',
      border: '1px solid color-mix(in srgb, hsl(38,92%,55%) 25%, transparent)',
    }}>
      🕐 Pendiente revisión
    </span>
  );
}

function OutputRow({
  output,
  reviewerName,
  onDelete,
  onUpdate,
}: {
  output: ToolOutput;
  reviewerName: string;
  onDelete: () => void;
  onUpdate: (updated: ToolOutput) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const isReady = output.inputs['ready_for_review'] === true;
  const isReviewed = Boolean(output.inputs['reviewed_by']);

  async function handleCopy() {
    await navigator.clipboard.writeText(output.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este resultado?')) return;
    setDeleting(true);
    const { error } = await deleteToolOutput(output.id);
    if (!error) onDelete();
    else setDeleting(false);
  }

  async function handleMarkReviewed() {
    setReviewing(true);
    const updatedInputs = {
      ...output.inputs,
      reviewed_by: reviewerName,
      reviewed_at: new Date().toISOString(),
    };
    const { error } = await updateToolOutputInputs(output.id, updatedInputs);
    if (!error) {
      onUpdate({ ...output, inputs: updatedInputs });
    }
    setReviewing(false);
  }

  const preview = output.output.slice(0, 120).replace(/\n+/g, ' ');

  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: isReady && !isReviewed
        ? '1px solid color-mix(in srgb, hsl(38,92%,55%) 30%, var(--color-border))'
        : '1px solid var(--color-border)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded((p) => !p)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <ToolBadge toolKey={output.tool_key} />
            <StatusBadge output={output} />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              {formatDate(output.created_at)}
            </span>
          </div>
          <p style={{
            fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {preview}{output.output.length > 120 ? '...' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button className="btn-ghost"
            onClick={(e) => { e.stopPropagation(); void handleCopy(); }}
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          <button className="btn-ghost"
            onClick={(e) => { e.stopPropagation(); void handleDelete(); }}
            disabled={deleting}
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', color: '#ef4444' }}>
            <Trash2 size={12} />
          </button>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          <div style={{
            padding: '16px', fontSize: '0.82rem', lineHeight: 1.75,
            color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap',
            background: 'var(--color-bg-secondary)', maxHeight: 400, overflowY: 'auto',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {output.output}
          </div>
          {isReady && !isReviewed && (
            <div style={{
              padding: '10px 16px', borderTop: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'color-mix(in srgb, hsl(38,92%,55%) 5%, var(--color-bg-secondary))',
            }}>
              <span style={{ fontSize: '0.78rem', color: 'hsl(38,92%,60%)' }}>
                📤 Juanca marcó esta estrategia como lista para revisar
              </span>
              <button
                onClick={() => void handleMarkReviewed()}
                disabled={reviewing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                  borderRadius: 8, border: 'none', cursor: reviewing ? 'default' : 'pointer',
                  background: '#22c55e', color: '#000', fontSize: '0.78rem', fontWeight: 700,
                  opacity: reviewing ? 0.6 : 1,
                }}
              >
                <CheckCircle size={14} />
                {reviewing ? 'Marcando...' : '✅ Marcar como revisado'}
              </button>
            </div>
          )}
          {isReviewed && (
            <div style={{
              padding: '8px 16px', borderTop: '1px solid var(--color-border)',
              fontSize: '0.72rem', color: '#22c55e',
              background: 'color-mix(in srgb, #22c55e 4%, var(--color-bg-secondary))',
            }}>
              ✅ Revisado por {String(output.inputs['reviewed_by'])} · {output.inputs['reviewed_at'] ? formatDate(String(output.inputs['reviewed_at'])) : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AIToolsHistory() {
  const { selectedClientId, clients } = useAITools();
  const { profile } = useAuth();
  const reviewerName = profile?.full_name ?? profile?.email ?? 'usuario';

  const [outputs, setOutputs] = useState<ToolOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTool, setFilterTool] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>(selectedClientId ?? '');
  const [filterPendiente, setFilterPendiente] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listToolOutputs({
      clientId: filterClient || undefined,
      toolKey: filterTool || undefined,
      limit: 100,
    });
    setOutputs(data);
    setLoading(false);
  }, [filterClient, filterTool]);

  useEffect(() => { void load(); }, [load]);

  const displayOutputs = filterPendiente
    ? outputs.filter((o) => o.inputs['ready_for_review'] === true && !o.inputs['reviewed_by'])
    : outputs;

  const pendingCount = outputs.filter((o) => o.inputs['ready_for_review'] === true && !o.inputs['reviewed_by']).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)} style={{ minWidth: 180, maxWidth: 240 }}>
          <option value="">Todos los clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select" value={filterTool}
          onChange={(e) => setFilterTool(e.target.value)} style={{ minWidth: 180, maxWidth: 240 }}>
          <option value="">Todas las herramientas</option>
          {TOOL_CONFIGS.map((t) => <option key={t.key} value={t.key}>{t.emoji} {t.title}</option>)}
        </select>
        <button
          onClick={() => setFilterPendiente((p) => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 8, border: `1px solid ${filterPendiente ? 'hsl(38,92%,55%)' : 'var(--color-border)'}`,
            background: filterPendiente ? 'color-mix(in srgb, hsl(38,92%,55%) 12%, transparent)' : 'transparent',
            color: filterPendiente ? 'hsl(38,92%,60%)' : 'var(--color-text-muted)',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          🕐 Solo pendientes{pendingCount > 0 && ` (${pendingCount})`}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
          Cargando historial...
        </div>
      )}

      {!loading && displayOutputs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '0.88rem', marginBottom: 4 }}>
            {filterPendiente ? 'Sin estrategias pendientes de revisión' : 'Sin resultados guardados'}
          </p>
          <p style={{ fontSize: '0.76rem' }}>
            {filterPendiente
              ? 'Cuando Juanca marque una estrategia lista, aparecerá aquí.'
              : 'Los resultados que generes con las herramientas aparecerán aquí.'}
          </p>
        </div>
      )}

      {!loading && displayOutputs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>
            {displayOutputs.length} resultado{displayOutputs.length !== 1 ? 's' : ''}
          </p>
          {displayOutputs.map((o) => (
            <OutputRow
              key={o.id}
              output={o}
              reviewerName={reviewerName}
              onDelete={() => setOutputs((prev) => prev.filter((x) => x.id !== o.id))}
              onUpdate={(updated) => setOutputs((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
