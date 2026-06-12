import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Copy, Check, AlertCircle, Image, X } from 'lucide-react';
import { getToolConfig, SYSTEM_PROMPT_AI } from './toolConfigs';
import type { ToolField, ToolMode } from './toolConfigs';
import { useAITools } from '../../hooks/useAIToolsContext';
import {
  callAI,
  getToolKnowledgeBase,
  insertToolOutput,
  type ToolKnowledgeBase,
} from '../../services/aiToolsService';

function buildPrompt(
  outputInstructions: string,
  fields: ToolField[],
  formValues: Record<string, string>,
  kit: ReturnType<typeof useAITools>['kit'],
  knowledge: ToolKnowledgeBase | null,
): string {
  const kitSection = kit
    ? `## CLIENTE: ${kit.name}
### IDENTIDAD DE MARCA
- Colores: ${kit.colors || '(no definido)'}
- Fuentes: ${kit.fonts || '(no definido)'}
- Voz de marca: ${kit.voice || '(no definido)'}
- Audiencias objetivo: ${kit.audiences || '(no definido)'}
- Diferenciadores: ${kit.differentiators || '(no definido)'}
- No hacer: ${kit.do_not || '(no definido)'}`
    : '## CLIENTE: (Sin kit de marca — usa criterio general para el mercado colombiano)';

  const knowledgeSection = knowledge?.content
    ? `\n## BASE DE CONOCIMIENTO: ${knowledge.title}\n${knowledge.content}`
    : '';

  const fieldSection = fields
    .filter((f) => formValues[f.key])
    .map((f) => `- ${f.label}: ${formValues[f.key]}`)
    .join('\n');

  return `${kitSection}
${knowledgeSection}

## TAREA
${outputInstructions}

## DATOS DEL FORMULARIO
${fieldSection || '(sin datos adicionales)'}`;
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: ToolField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === 'select') {
    return (
      <div className="form-field">
        <label className="form-label">
          {field.label}{field.required && <span style={{ color: 'var(--color-accent-red)' }}> *</span>}
        </label>
        <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Seleccionar...</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === 'textarea') {
    return (
      <div className="form-field">
        <label className="form-label">
          {field.label}{field.required && <span style={{ color: 'var(--color-accent-red)' }}> *</span>}
        </label>
        <textarea
          className="form-textarea"
          rows={field.rows ?? 3}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className="form-field">
      <label className="form-label">
        {field.label}{field.required && <span style={{ color: 'var(--color-accent-red)' }}> *</span>}
      </label>
      <input
        className="form-input"
        type="text"
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function AIToolsTool() {
  const { toolKey } = useParams<{ toolKey: string }>();
  const navigate = useNavigate();
  const { kit, selectedClientId } = useAITools();
  const config = toolKey ? getToolConfig(toolKey) : undefined;

  const [activeMode, setActiveMode] = useState<string>(() =>
    config?.modes?.[0]?.key ?? 'default',
  );
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<ToolKnowledgeBase | null>(null);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toolKey) return;
    getToolKnowledgeBase(toolKey).then(setKnowledge).catch(console.error);
  }, [toolKey]);

  useEffect(() => {
    setFormValues({});
    setOutput(null);
    setError(null);
    setImageFile(null);
    setImagePreview(null);
    if (config?.modes) setActiveMode(config.modes[0].key);
  }, [toolKey, config]);

  const currentMode: ToolMode | undefined = config?.modes?.find((m) => m.key === activeMode);
  const currentFields = currentMode?.fields ?? config?.fields ?? [];
  const currentHasImage = currentMode?.hasImage ?? config?.hasImage ?? false;
  const currentImageLabel = currentMode?.imageLabel ?? config?.imageLabel ?? 'Subir imagen';
  const currentOutputInstructions =
    currentMode?.outputInstructions ?? config?.outputInstructions ?? '';

  function handleFieldChange(key: string, val: string) {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleSubmit = useCallback(async () => {
    if (!config) return;

    const requiredFields = currentFields.filter((f) => f.required);
    for (const f of requiredFields) {
      if (!formValues[f.key]?.trim()) {
        setError(`El campo "${f.label}" es requerido`);
        return;
      }
    }
    if (currentHasImage && config.key !== 'analizar' && !imageFile && activeMode === 'imagen') {
      setError('Debes subir una imagen');
      return;
    }

    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const prompt = buildPrompt(
        currentOutputInstructions,
        currentFields,
        formValues,
        kit,
        knowledge,
      );

      let images: Array<{ data: string; media_type: string }> | undefined;
      if (imageFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
        images = [{ data: base64, media_type: imageFile.type as string }];
      }

      const text = await callAI({
        prompt,
        system: SYSTEM_PROMPT_AI,
        max_tokens: 4000,
        images,
      });

      setOutput(text);

      if (selectedClientId) {
        await insertToolOutput({
          client_id: selectedClientId,
          tool_key: config.key,
          inputs: { ...formValues, mode: activeMode },
          output: text,
        });
      }

      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar contenido');
    } finally {
      setLoading(false);
    }
  }, [config, currentFields, currentHasImage, currentOutputInstructions, activeMode, formValues, imageFile, knowledge, kit, selectedClientId]);

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!config) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Herramienta no encontrada.{' '}
        <button className="btn-ghost" onClick={() => navigate('/ai-tools')}>Volver</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="btn-ghost"
          onClick={() => navigate('/ai-tools')}
          style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={15} /> Herramientas
        </button>
        <span style={{ color: 'var(--color-border)', fontSize: '1rem' }}>›</span>
        <span style={{ fontSize: '1rem' }}>{config.emoji}</span>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {config.title}
        </span>
      </div>

      {/* Mode tabs (Estrategia only) */}
      {config.modes && (
        <div style={{
          display: 'flex',
          gap: 4,
          background: 'var(--color-bg-secondary)',
          padding: 4,
          borderRadius: 10,
          width: 'fit-content',
        }}>
          {config.modes.map((mode) => (
            <button
              key={mode.key}
              onClick={() => {
                setActiveMode(mode.key);
                setFormValues({});
                setOutput(null);
                setError(null);
                setImageFile(null);
                setImagePreview(null);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 600,
                transition: 'background 0.15s, color 0.15s',
                background: activeMode === mode.key
                  ? 'var(--color-accent-cyan)'
                  : 'transparent',
                color: activeMode === mode.key
                  ? 'var(--color-accent-cyan-fg, #000)'
                  : 'var(--color-text-secondary)',
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {/* Form card */}
      <div style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Image upload */}
        {currentHasImage && (
          <div className="form-field">
            <label className="form-label">{currentImageLabel}</label>
            {!imagePreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '28px 16px',
                  border: '2px dashed var(--color-border-strong)',
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.82rem',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent-cyan)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
              >
                <Image size={18} />
                Haz clic para subir imagen (PNG, JPG, WEBP)
              </button>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, display: 'block' }}
                />
                <button
                  type="button"
                  onClick={removeImage}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
          </div>
        )}

        {/* Dynamic fields */}
        {currentFields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={formValues[field.key] ?? ''}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        ))}

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'color-mix(in srgb, var(--color-accent-red, #ef4444) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-accent-red, #ef4444) 30%, transparent)',
            borderRadius: 8,
            color: 'var(--color-accent-red, #ef4444)',
            fontSize: '0.8rem',
          }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={() => void handleSubmit()}
          disabled={loading}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {loading ? (
            <>
              <span style={{
                width: 14,
                height: 14,
                border: '2px solid rgba(0,0,0,0.2)',
                borderTop: '2px solid #000',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
              Generando...
            </>
          ) : (
            <>
              <Sparkles size={15} />
              Generar con IA
            </>
          )}
        </button>
      </div>

      {/* Output */}
      {output && (
        <div
          ref={outputRef}
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'var(--color-accent-cyan)',
              textTransform: 'uppercase',
            }}>
              Resultado generado
            </span>
            <button
              className="btn-ghost"
              onClick={() => void copyOutput()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: '0.78rem' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div
            style={{
              padding: '20px 24px',
              fontSize: '0.84rem',
              lineHeight: 1.75,
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'Outfit, sans-serif',
              maxHeight: 600,
              overflowY: 'auto',
            }}
          >
            {output}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
