import { useCallback, useEffect, useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { TOOL_CONFIGS } from './toolConfigs';
import { useAITools } from '../../hooks/useAIToolsContext';
import {
  listToolOutputs,
  deleteToolOutput,
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
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: '0.7rem',
      fontWeight: 600,
      padding: '2px 9px',
      borderRadius: 20,
      background: 'color-mix(in srgb, var(--color-accent-cyan) 10%, transparent)',
      color: 'var(--color-accent-cyan)',
      border: '1px solid color-mix(in srgb, var(--color-accent-cyan) 20%, transparent)',
    }}>
      {tool?.emoji} {tool?.title ?? toolKey}
    </span>
  );
}

function OutputRow({ output, onDelete }: { output: ToolOutput; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const preview = output.output.slice(0, 120).replace(/\n+/g, ' ');

  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        cursor: 'pointer',
      }}
        onClick={() => setExpanded((p) => !p)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <ToolBadge toolKey={output.tool_key} />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              {formatDate(output.created_at)}
            </span>
          </div>
          <p style={{
            fontSize: '0.78rem',
            color: 'var(--color-text-secondary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {preview}{output.output.length > 120 ? '...' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            className="btn-ghost"
            onClick={(e) => { e.stopPropagation(); void handleCopy(); }}
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          <button
            className="btn-ghost"
            onClick={(e) => { e.stopPropagation(); void handleDelete(); }}
            disabled={deleting}
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', color: '#ef4444' }}
          >
            <Trash2 size={12} />
          </button>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '16px',
          fontSize: '0.82rem',
          lineHeight: 1.75,
          color: 'var(--color-text-primary)',
          whiteSpace: 'pre-wrap',
          background: 'var(--color-bg-secondary)',
          maxHeight: 400,
          overflowY: 'auto',
          fontFamily: 'Outfit, sans-serif',
        }}>
          {output.output}
        </div>
      )}
    </div>
  );
}

export function AIToolsHistory() {
  const { selectedClientId, clients } = useAITools();
  const [outputs, setOutputs] = useState<ToolOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTool, setFilterTool] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>(selectedClientId ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listToolOutputs({
      clientId: filterClient || undefined,
      toolKey: filterTool || undefined,
      limit: 50,
    });
    setOutputs(data);
    setLoading(false);
  }, [filterClient, filterTool]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select
          className="form-select"
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          style={{ minWidth: 180, maxWidth: 240 }}
        >
          <option value="">Todos los clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="form-select"
          value={filterTool}
          onChange={(e) => setFilterTool(e.target.value)}
          style={{ minWidth: 180, maxWidth: 240 }}
        >
          <option value="">Todas las herramientas</option>
          {TOOL_CONFIGS.map((t) => (
            <option key={t.key} value={t.key}>{t.emoji} {t.title}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
          Cargando historial...
        </div>
      )}

      {!loading && outputs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '0.88rem', marginBottom: 4 }}>Sin resultados guardados</p>
          <p style={{ fontSize: '0.76rem' }}>Los resultados que generes con las herramientas aparecerán aquí.</p>
        </div>
      )}

      {!loading && outputs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>
            {outputs.length} resultado{outputs.length !== 1 ? 's' : ''}
          </p>
          {outputs.map((o) => (
            <OutputRow
              key={o.id}
              output={o}
              onDelete={() => setOutputs((prev) => prev.filter((x) => x.id !== o.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
