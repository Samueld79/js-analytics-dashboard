import { useCallback, useRef, useState } from 'react';
import { Copy, Check, BookmarkPlus, CheckCircle, Send } from 'lucide-react';
import {
  insertToolOutput,
  updateToolOutputInputs,
} from '../../../services/aiToolsService';
import { useAITools } from '../../../hooks/useAIToolsContext';

function colorizeLine(line: string, index: number) {
  const trimmed = line.trim();

  if (trimmed.startsWith('┌') || trimmed.startsWith('└') || trimmed.startsWith('┐') || trimmed.startsWith('┘')) {
    return <div key={index} style={{ color: 'var(--color-accent-cyan)', opacity: 0.7 }}>{line}</div>;
  }
  if (trimmed.startsWith('━━')) {
    return <div key={index} style={{ color: 'var(--color-accent-cyan)', opacity: 0.5 }}>{line}</div>;
  }
  if (trimmed.startsWith('│  ⚡') || trimmed.startsWith('│  Generado')) {
    return (
      <div key={index} style={{
        color: 'var(--color-text-primary)',
        fontWeight: trimmed.includes('⚡') ? 700 : 400,
        fontSize: trimmed.includes('⚡') ? '0.9rem' : undefined,
      }}>{line}</div>
    );
  }
  if (trimmed.startsWith('📋')) {
    return <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '0.88rem', marginTop: 4 }}>{line}</div>;
  }
  if (trimmed.match(/^(🎯|💰|💡)/)) {
    return (
      <div key={index} style={{
        color: trimmed.startsWith('💡') ? 'hsl(215,80%,72%)' : 'var(--color-text-secondary)',
        fontStyle: trimmed.startsWith('💡') ? 'italic' : 'normal',
      }}>{line}</div>
    );
  }
  if (trimmed.startsWith('│ 📦')) {
    return <div key={index} style={{ color: 'var(--color-accent-cyan)', fontWeight: 700 }}>{line}</div>;
  }
  if (trimmed.startsWith('├──') || trimmed.startsWith('└──')) {
    return <div key={index} style={{ color: 'var(--color-border-strong)', opacity: 0.8 }}>{line}</div>;
  }
  if (trimmed.match(/^\│\s+(👥|📱|🎨|🎯|📍|💰|💬)/)) {
    return <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{line}</div>;
  }
  if (line.includes('✅')) return <div key={index} style={{ color: 'hsl(145,100%,55%)' }}>{line}</div>;
  if (line.includes('❌')) return <div key={index} style={{ color: 'var(--color-text-muted)' }}>{line}</div>;
  if (line.includes('⚠️')) return <div key={index} style={{ color: 'hsl(38,92%,60%)' }}>{line}</div>;
  if (line.includes('❓')) return <div key={index} style={{ color: 'hsl(260,80%,72%)' }}>{line}</div>;
  if (trimmed.startsWith('📊')) {
    return <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '0.88rem', marginTop: 4 }}>{line}</div>;
  }
  if (trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
    return <div key={index} style={{ color: 'var(--color-text-secondary)' }}>{line}</div>;
  }
  if (!trimmed) return <div key={index} style={{ height: 6 }} />;
  return <div key={index} style={{ color: 'var(--color-text-secondary)' }}>{line}</div>;
}

type Props = {
  output: string;
  toolKey: string;
  formSummary: Record<string, unknown>;
};

export function OrganigramaOutput({ output, toolKey, formSummary }: Props) {
  const { selectedClientId } = useAITools();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [marked, setMarked] = useState(false);
  const [marking, setMarking] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handlePrint = useCallback(() => {
    const dateStr = new Date().toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    // Build HTML line by line, inserting page-breaks before each campaign section
    let firstDivider = true;
    const htmlLines = output.split('\n').map((line) => {
      const esc = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      if (line.trim().startsWith('━━━')) {
        if (firstDivider) {
          firstDivider = false;
          return `<div class="divider">${esc}</div>`;
        }
        return `<div class="page-break"></div><div class="divider">${esc}</div>`;
      }
      if (!line.trim()) return '<div class="empty-line"></div>';
      return `<div>${esc}</div>`;
    }).join('');

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estrategia de Ads — Growth Strategy JS</title>
  <style>
    @page {
      size: letter;
      margin: 1.5cm;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      line-height: 1.55;
      color: #000;
      background: #fff;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1.5pt solid #333;
      padding-bottom: 6pt;
      margin-bottom: 14pt;
    }
    .print-header-brand {
      font-weight: bold;
      font-size: 10pt;
      color: #000;
    }
    .print-header-date {
      font-size: 8pt;
      color: #555;
    }
    .print-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 7.5pt;
      color: #888;
      border-top: 0.5pt solid #ccc;
      padding: 4pt 0;
      background: #fff;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
      height: 0;
    }
    .empty-line { height: 5pt; }
    .divider { color: #333; }
  </style>
</head>
<body>
  <div class="print-header">
    <span class="print-header-brand">Growth Strategy JS</span>
    <span class="print-header-date">${dateStr}</span>
  </div>
  <div class="print-footer">Documento confidencial &middot; Growth Strategy JS</div>
  ${htmlLines}
</body>
</html>`);

    w.document.close();
    w.print();
  }, [output]);

  const handleSave = useCallback(async () => {
    if (!selectedClientId || saving || saved) return;
    setSaving(true);
    const { data } = await insertToolOutput({
      client_id: selectedClientId,
      tool_key: toolKey,
      inputs: formSummary,
      output,
    });
    if (data?.id) setSavedId(data.id);
    setSaved(true);
    setSaving(false);
  }, [selectedClientId, saving, saved, toolKey, formSummary, output]);

  const handleMarkForSamuel = useCallback(async () => {
    if (!savedId || marking || marked) return;
    setMarking(true);
    const updatedInputs = { ...formSummary, ready_for_review: true };
    await updateToolOutputInputs(savedId, updatedInputs);
    setMarked(true);
    setMarking(false);
  }, [savedId, marking, marked, formSummary]);

  const lines = output.split('\n');

  return (
    <div ref={outputRef} style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-accent-cyan)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 18px',
        borderBottom: '1px solid var(--color-border)',
        background: 'color-mix(in srgb, var(--color-accent-cyan) 5%, var(--color-bg-secondary))',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
          color: 'var(--color-accent-cyan)', textTransform: 'uppercase',
        }}>
          ⚡ Organigrama generado
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn-ghost"
            onClick={() => void handleCopy()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.76rem' }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </button>
          <button
            className="btn-ghost"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.76rem' }}
          >
            📄 Exportar PDF
          </button>
          {selectedClientId && (
            <button
              className="btn-ghost"
              onClick={() => void handleSave()}
              disabled={saving || saved}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.76rem',
                color: saved ? '#22c55e' : undefined,
              }}
            >
              {saved ? <CheckCircle size={13} /> : <BookmarkPlus size={13} />}
              {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
          {savedId && !marked && (
            <button
              onClick={() => void handleMarkForSamuel()}
              disabled={marking}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: '0.76rem',
                fontWeight: 700, borderRadius: 8, border: 'none', cursor: marking ? 'default' : 'pointer',
                background: 'hsl(38,92%,55%)',
                color: '#000',
                transition: 'opacity 0.15s',
                opacity: marking ? 0.6 : 1,
              }}
            >
              <Send size={13} />
              {marking ? 'Enviando...' : '📤 Marcar para Samuel'}
            </button>
          )}
          {marked && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              fontSize: '0.76rem', fontWeight: 700, color: '#22c55e',
            }}>
              <CheckCircle size={13} /> ✅ Samuel puede verlo en Historial
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: '20px 24px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.78rem',
        lineHeight: 1.65,
        overflowX: 'auto',
        maxHeight: 700,
        overflowY: 'auto',
      }}>
        {lines.map((line, i) => colorizeLine(line, i))}
      </div>
    </div>
  );
}
