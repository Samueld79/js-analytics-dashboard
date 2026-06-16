import { useCallback, useRef, useState } from 'react';
import { Copy, Check, Printer, BookmarkPlus, CheckCircle } from 'lucide-react';
import { insertToolOutput } from '../../../services/aiToolsService';
import { useAITools } from '../../../hooks/useAIToolsContext';

function colorizeLine(line: string, index: number) {
  const trimmed = line.trim();

  // Box top/bottom borders
  if (trimmed.startsWith('┌') || trimmed.startsWith('└') || trimmed.startsWith('┐') || trimmed.startsWith('┘')) {
    return (
      <div key={index} style={{ color: 'var(--color-accent-cyan)', opacity: 0.7 }}>{line}</div>
    );
  }

  // ━ dividers
  if (trimmed.startsWith('━━')) {
    return (
      <div key={index} style={{ color: 'var(--color-accent-cyan)', opacity: 0.5, letterSpacing: 0 }}>{line}</div>
    );
  }

  // Header inside top box
  if (trimmed.startsWith('│  ⚡') || trimmed.startsWith('│  Generado')) {
    return (
      <div key={index} style={{
        color: 'var(--color-text-primary)',
        fontWeight: trimmed.includes('⚡') ? 700 : 400,
        fontSize: trimmed.includes('⚡') ? '0.9rem' : undefined,
      }}>{line}</div>
    );
  }

  // Campaign header
  if (trimmed.startsWith('📋')) {
    return (
      <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '0.88rem', marginTop: 4 }}>{line}</div>
    );
  }

  // Campaign meta (🎯 💰 💡 at campaign level)
  if (trimmed.match(/^(🎯|💰|💡)/)) {
    const isRazonamiento = trimmed.startsWith('💡');
    return (
      <div key={index} style={{
        color: isRazonamiento ? 'hsl(215,80%,72%)' : 'var(--color-text-secondary)',
        fontStyle: isRazonamiento ? 'italic' : 'normal',
      }}>{line}</div>
    );
  }

  // Set box header
  if (trimmed.startsWith('│ 📦')) {
    return (
      <div key={index} style={{ color: 'var(--color-accent-cyan)', fontWeight: 700 }}>{line}</div>
    );
  }

  // Set box divider
  if (trimmed.startsWith('├──') || trimmed.startsWith('└──')) {
    return (
      <div key={index} style={{ color: 'var(--color-border-strong)', opacity: 0.8 }}>{line}</div>
    );
  }

  // Section headers inside set box
  if (trimmed.match(/^\│\s+(👥|📱|🎨|🎯|📍|💰)/)) {
    return (
      <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{line}</div>
    );
  }

  // ✅ green
  if (line.includes('✅')) {
    return (
      <div key={index} style={{ color: 'hsl(145,100%,55%)' }}>{line}</div>
    );
  }

  // ❌ muted
  if (line.includes('❌')) {
    return (
      <div key={index} style={{ color: 'var(--color-text-muted)' }}>{line}</div>
    );
  }

  // ⚠️ warnings
  if (line.includes('⚠️')) {
    return (
      <div key={index} style={{ color: 'hsl(38,92%,60%)' }}>{line}</div>
    );
  }

  // ❓ questions
  if (line.includes('❓')) {
    return (
      <div key={index} style={{ color: 'hsl(260,80%,72%)' }}>{line}</div>
    );
  }

  // 📊 Resumen header
  if (trimmed.startsWith('📊')) {
    return (
      <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '0.88rem', marginTop: 4 }}>{line}</div>
    );
  }

  // Resumen items (indented with •)
  if (trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
    return (
      <div key={index} style={{ color: 'var(--color-text-secondary)' }}>{line}</div>
    );
  }

  // Empty lines
  if (!trimmed) {
    return <div key={index} style={{ height: 6 }} />;
  }

  // Default
  return (
    <div key={index} style={{ color: 'var(--color-text-secondary)' }}>{line}</div>
  );
}

type Props = {
  output: string;
  toolKey: string;
  formSummary: Record<string, string>;
};

export function OrganigramaOutput({ output, toolKey, formSummary }: Props) {
  const { selectedClientId } = useAITools();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handlePrint = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Organigrama Estrategia</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.6;
               background: #fff; color: #111; padding: 24px; white-space: pre-wrap; }
        @page { margin: 20mm; }
      </style></head>
      <body>${output.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>
    `);
    w.document.close();
    w.print();
  }, [output]);

  const handleSave = useCallback(async () => {
    if (!selectedClientId || saving || saved) return;
    setSaving(true);
    await insertToolOutput({
      client_id: selectedClientId,
      tool_key: toolKey,
      inputs: formSummary,
      output,
    });
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 4000);
  }, [selectedClientId, saving, saved, toolKey, formSummary, output]);

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
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--color-accent-cyan)',
          textTransform: 'uppercase',
        }}>
          ⚡ Organigrama generado
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className="btn-ghost"
            onClick={() => void handleCopy()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.76rem' }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            className="btn-ghost"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.76rem' }}
          >
            <Printer size={13} /> Imprimir
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
