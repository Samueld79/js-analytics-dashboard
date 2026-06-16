import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Sparkles, AlertCircle, Image, X } from 'lucide-react';
import { useAITools } from '../../hooks/useAIToolsContext';
import { callAI, getToolKnowledgeBase, type ToolKnowledgeBase } from '../../services/aiToolsService';
import { SYSTEM_PROMPT_AI } from './toolConfigs';
import {
  type Campaign,
  type AdSet,
  CAMPAIGN_OBJECTIVES,
  createEmptyCampaign,
  createEmptyAdSet,
  uid,
} from './estrategia/types';
import {
  buildFormPrompt,
  buildImagePrompt,
  buildTranscriptPrompt,
  buildGeneradorPrompt,
  type GeneradorForm,
} from './estrategia/promptBuilder';
import { AdSetForm } from './estrategia/AdSetForm';
import { OrganigramaOutput } from './estrategia/OrganigramaOutput';

type Mode = 'generador' | 'formulario' | 'imagen' | 'transcripcion';

const MODES: { key: Mode; label: string; primary?: boolean }[] = [
  { key: 'generador', label: '✨ Generar con IA', primary: true },
  { key: 'formulario', label: '📋 Formulario detallado' },
  { key: 'imagen', label: '🖼️ Desde imagen' },
  { key: 'transcripcion', label: '🎙️ Desde transcripción' },
];

const LOADING_MESSAGES = [
  'Analizando el Kit de Marca...',
  'Definiendo audiencias objetivo...',
  'Construyendo la estructura de campañas...',
  'Redactando el copy de anuncios...',
  'Calculando presupuestos y KPIs...',
  'Finalizando el organigrama...',
];

const GENERADOR_SYSTEM = `Eres el estratega experto de Meta Ads de la agencia Growth Strategy JS para el mercado colombiano. Tu tarea es generar una estrategia completa de Meta Ads lista para montar. Debes tomar TODAS las decisiones técnicas — el usuario no debe llenar nada más. Respondes siempre en español colombiano.`;

const S: Record<string, React.CSSProperties> = {
  label: {
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)',
    marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  sectionCard: {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    padding: '20px',
  },
  hint: { fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4 },
};

// ─── Generador tab ────────────────────────────────────────────────────────────

const OBJETIVO_OPTIONS = [
  '💬 Más mensajes por WhatsApp',
  '🛒 Más ventas directas',
  '👁️ Reconocimiento de marca',
  '🚶 Tráfico al punto físico',
  '📲 Combinar mensajes + reconocimiento (embudo completo)',
];

const CONTEXTO_OPTIONS = [
  'Nada especial — optimizar lo que ya funciona',
  'Lanzamiento de producto o servicio nuevo',
  'Fecha especial (festivo, temporada, promoción)',
  'Arrancar desde cero (cuenta nueva o sin historial)',
  'Escalar resultados actuales (ROAS positivo, subir presupuesto)',
];

const NUM_CAMPANAS_OPTIONS = [
  '1 campaña (presupuesto concentrado)',
  '2 campañas (TOFU + BOFU)',
  '3 campañas (embudo completo TOFU + MOFU + BOFU)',
  'Claude decide según el presupuesto',
];

const EMPTY_GENERADOR: GeneradorForm = {
  objetivo: '',
  presupuesto: '',
  contexto: CONTEXTO_OPTIONS[0],
  numCampanas: NUM_CAMPANAS_OPTIONS[3],
  extra: '',
};

function GeneradorTab({
  form,
  onChange,
  kitName,
  hasClient,
}: {
  form: GeneradorForm;
  onChange: (f: GeneradorForm) => void;
  kitName: string | null;
  hasClient: boolean;
}) {
  function set(field: keyof GeneradorForm, value: string) {
    onChange({ ...form, [field]: value });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{
        background: 'color-mix(in srgb, var(--color-accent-cyan) 6%, var(--color-bg-card))',
        border: '1px solid color-mix(in srgb, var(--color-accent-cyan) 25%, transparent)',
        borderRadius: 12,
        padding: '16px 20px',
      }}>
        <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          ✨ Generador Automático
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Claude construye la estrategia completa basándose en
          el Kit de Marca{kitName ? ` de ${kitName}` : ' del cliente seleccionado'}.
          Solo responde 4 preguntas.
        </p>
      </div>

      {!hasClient && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'color-mix(in srgb, hsl(38,92%,55%) 10%, transparent)',
          border: '1px solid color-mix(in srgb, hsl(38,92%,55%) 30%, transparent)',
          color: 'hsl(38,92%,60%)', fontSize: '0.8rem',
        }}>
          Selecciona un cliente arriba para que Claude use su información de marca automáticamente.
        </div>
      )}

      {/* Pregunta 1 */}
      <div>
        <label style={S.label}>¿Qué quieres lograr este mes? <span style={{ color: '#ef4444' }}>*</span></label>
        <select
          className="form-select"
          value={form.objetivo}
          onChange={(e) => set('objetivo', e.target.value)}
        >
          <option value="">Seleccionar objetivo...</option>
          {OBJETIVO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Pregunta 2 */}
      <div>
        <label style={S.label}>¿Cuánto presupuesto tiene disponible este mes? (COP) <span style={{ color: '#ef4444' }}>*</span></label>
        <input
          className="form-input"
          type="number"
          min={0}
          placeholder="Ej: 1500000"
          value={form.presupuesto}
          onChange={(e) => set('presupuesto', e.target.value)}
        />
        <p style={S.hint}>Claude distribuirá este presupuesto entre las campañas automáticamente</p>
      </div>

      {/* Pregunta 3 */}
      <div>
        <label style={S.label}>¿Hay algo especial este mes?</label>
        <select
          className="form-select"
          value={form.contexto}
          onChange={(e) => set('contexto', e.target.value)}
        >
          {CONTEXTO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Pregunta 4 */}
      <div>
        <label style={S.label}>¿Cuántas campañas necesitas? <span style={{ color: '#ef4444' }}>*</span></label>
        <select
          className="form-select"
          value={form.numCampanas}
          onChange={(e) => set('numCampanas', e.target.value)}
        >
          {NUM_CAMPANAS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Extra opcional */}
      <div>
        <label style={S.label}>¿Algo más que Claude deba saber? (opcional)</label>
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Ej: Esta semana hay descuento del 20%, enfocarse en lentes de contacto, evitar Bogotá este mes..."
          value={form.extra}
          onChange={(e) => set('extra', e.target.value)}
        />
      </div>
    </div>
  );
}

// ─── Campaign block (level 1) ─────────────────────────────────────────────────

function CampaignBlock({
  campaign, index, onChange, onRemove, canRemove,
}: {
  campaign: Campaign;
  index: number;
  onChange: <K extends keyof Campaign>(field: K, value: Campaign[K]) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function updateAdSet<K extends keyof AdSet>(setId: string, field: K, value: AdSet[K]) {
    onChange('conjuntos', campaign.conjuntos.map((s) => (s.id === setId ? { ...s, [field]: value } : s)));
  }
  function addAdSet() { onChange('conjuntos', [...campaign.conjuntos, createEmptyAdSet()]); }
  function removeAdSet(setId: string) { onChange('conjuntos', campaign.conjuntos.filter((s) => s.id !== setId)); }

  return (
    <div style={{ border: '2px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 18px',
        background: 'color-mix(in srgb, var(--color-accent-cyan) 10%, var(--color-bg-secondary))',
        borderBottom: '2px solid var(--color-border)',
      }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          📋 Campaña {index + 1}
          {campaign.nombre && (
            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8, fontSize: '0.8rem' }}>
              · {campaign.nombre}
            </span>
          )}
        </span>
        {canRemove && (
          <button className="btn-ghost" onClick={onRemove} style={{ color: '#ef4444', padding: '4px 8px' }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={S.label}>Nombre de la campaña <span style={{ color: '#ef4444' }}>*</span></label>
          <input className="form-input" type="text" placeholder="Ej: OpticaPL_TOFU_Junio2026"
            value={campaign.nombre} onChange={(e) => onChange('nombre', e.target.value)} />
        </div>
        <div style={S.row2}>
          <div>
            <label style={S.label}>Objetivo de campaña <span style={{ color: '#ef4444' }}>*</span></label>
            <select className="form-select" value={campaign.objetivo}
              onChange={(e) => onChange('objetivo', e.target.value as Campaign['objetivo'])}>
              {CAMPAIGN_OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Tipo de presupuesto</label>
            <div style={{ display: 'flex', gap: 16, paddingTop: 6 }}>
              {(['ABO', 'CBO'] as const).map((v) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  <input type="radio" checked={campaign.tipoPresupuesto === v} onChange={() => onChange('tipoPresupuesto', v)} />
                  <span><strong>{v}</strong> — {v === 'ABO' ? 'Por conjunto' : 'Advantage+'}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 240 }}>
          <label style={S.label}>
            {campaign.tipoPresupuesto === 'CBO' ? 'Presupuesto de campaña (COP/día)' : 'Presupuesto por conjunto (COP/día)'}
          </label>
          {campaign.tipoPresupuesto === 'CBO' ? (
            <input className="form-input" type="number" min={0} placeholder="Ej: 50000"
              value={campaign.presupuesto || ''} onChange={(e) => onChange('presupuesto', Number(e.target.value))} />
          ) : (
            <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', padding: '8px 0' }}>
              Configura el presupuesto en cada conjunto abajo
            </p>
          )}
        </div>
        <div>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
            Conjuntos de anuncios
          </p>
          {campaign.conjuntos.map((s, si) => (
            <AdSetForm key={s.id} adset={s} index={si} campaignObjective={campaign.objetivo} budgetType={campaign.tipoPresupuesto}
              onChange={(field, value) => updateAdSet(s.id, field, value)}
              onRemove={() => removeAdSet(s.id)} canRemove={campaign.conjuntos.length > 1} />
          ))}
          <button className="btn-ghost" onClick={addAdSet}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: '0.8rem' }}>
            <Plus size={14} /> Agregar conjunto
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AIToolsEstrategia() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { kit, selectedClientId, clients, setSelectedClientId } = useAITools();
  const [knowledge, setKnowledge] = useState<ToolKnowledgeBase | null>(null);
  const [mode, setMode] = useState<Mode>('generador');

  // Generador mode state
  const [generadorForm, setGeneradorForm] = useState<GeneradorForm>(EMPTY_GENERADOR);

  // Formulario mode state
  const [campaigns, setCampaigns] = useState<Campaign[]>([createEmptyCampaign()]);
  const [contextNote, setContextNote] = useState('');

  // Imagen mode state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transcripcion mode state
  const [transcripcion, setTranscripcion] = useState('');

  // Shared state
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Cycle loading messages
  useEffect(() => {
    if (!loading) { setLoadingMsg(LOADING_MESSAGES[0]); return; }
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  // Read ?clientId= URL param (when coming from StrategiesPage)
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId && clients.some((c) => c.id === clientId)) {
      setSelectedClientId(clientId);
    }
  }, [searchParams, clients, setSelectedClientId]);

  useEffect(() => {
    getToolKnowledgeBase('estrategia').then(setKnowledge).catch(console.error);
  }, []);

  function updateCampaign<K extends keyof Campaign>(id: string, field: K, value: Campaign[K]) {
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }
  function addCampaign() { setCampaigns((prev) => [...prev, { ...createEmptyCampaign(), id: uid() }]); }
  function removeCampaign(id: string) { setCampaigns((prev) => prev.filter((c) => c.id !== id)); }

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

  function switchMode(next: Mode) {
    setMode(next);
    setOutput(null);
    setError(null);
  }

  const handleGenerate = useCallback(async () => {
    setError(null);
    setOutput(null);

    if (mode === 'generador') {
      if (!generadorForm.objetivo) { setError('Selecciona el objetivo principal'); return; }
      if (!generadorForm.presupuesto) { setError('Ingresa el presupuesto mensual'); return; }
    } else if (mode === 'formulario') {
      for (const c of campaigns) {
        if (!c.nombre.trim()) { setError('Todas las campañas deben tener nombre'); return; }
        for (const s of c.conjuntos) {
          if (!s.nombre.trim()) { setError('Todos los conjuntos deben tener nombre'); return; }
        }
      }
    } else if (mode === 'imagen' && !imageFile) {
      setError('Debes subir una imagen del mapa mental o estrategia');
      return;
    } else if (mode === 'transcripcion' && !transcripcion.trim()) {
      setError('Pega la transcripción antes de generar');
      return;
    }

    setLoading(true);
    try {
      let prompt: string;
      let systemPrompt: string = SYSTEM_PROMPT_AI;
      let images: Array<{ data: string; media_type: string }> | undefined;

      if (mode === 'generador') {
        prompt = buildGeneradorPrompt(generadorForm, kit, knowledge);
        systemPrompt = GENERADOR_SYSTEM;
      } else if (mode === 'formulario') {
        prompt = buildFormPrompt(campaigns, kit, knowledge, contextNote);
      } else if (mode === 'imagen') {
        prompt = buildImagePrompt(contextNote, kit);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile!);
        });
        images = [{ data: base64, media_type: imageFile!.type }];
      } else {
        prompt = buildTranscriptPrompt(transcripcion, kit, knowledge);
      }

      const text = await callAI({ prompt, system: systemPrompt, max_tokens: 6000, images });
      setOutput(text);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el organigrama');
    } finally {
      setLoading(false);
    }
  }, [mode, generadorForm, campaigns, kit, knowledge, contextNote, transcripcion, imageFile]);

  const formSummary: Record<string, unknown> = mode === 'generador'
    ? { mode, objetivo: generadorForm.objetivo, presupuesto: generadorForm.presupuesto, contexto: generadorForm.contexto, numCampanas: generadorForm.numCampanas, extra: generadorForm.extra, client: kit?.name ?? selectedClientId ?? '' }
    : { mode, campaigns: campaigns.map((c) => c.nombre).join(', '), client: kit?.name ?? selectedClientId ?? '' };

  const isGenerateDisabled = loading || (
    mode === 'generador' && (!generadorForm.objetivo || !generadorForm.presupuesto)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820 }}>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn-ghost" onClick={() => navigate('/ai-tools')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}>
          <ArrowLeft size={15} /> Herramientas
        </button>
        <span style={{ color: 'var(--color-border)', fontSize: '1rem' }}>›</span>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          ⚡ Estrategia de Ads
        </span>
        {kit && (
          <span style={{
            fontSize: '0.68rem', padding: '2px 9px', borderRadius: 20,
            background: 'color-mix(in srgb, var(--color-accent-cyan) 12%, transparent)',
            color: 'var(--color-accent-cyan)', fontWeight: 700, letterSpacing: '0.08em',
          }}>
            {kit.name}
          </span>
        )}
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg-secondary)', padding: 4, borderRadius: 12, width: 'fit-content', flexWrap: 'wrap' }}>
        {MODES.map(({ key, label, primary }) => {
          const active = mode === key;
          return (
            <button key={key} onClick={() => switchMode(key)} style={{
              padding: primary ? '8px 18px' : '7px 14px',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: primary ? '0.84rem' : '0.78rem',
              fontWeight: active || primary ? 700 : 500,
              transition: 'background 0.15s, color 0.15s',
              background: active ? 'var(--color-accent-cyan)' : 'transparent',
              color: active ? 'var(--color-accent-cyan-fg, #000)' : primary ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ─── MODO GENERADOR ─── */}
      {mode === 'generador' && (
        <GeneradorTab
          form={generadorForm}
          onChange={setGeneradorForm}
          kitName={kit?.name ?? null}
          hasClient={!!selectedClientId}
        />
      )}

      {/* ─── MODO FORMULARIO ─── */}
      {mode === 'formulario' && (
        <>
          {campaigns.map((c, ci) => (
            <CampaignBlock key={c.id} campaign={c} index={ci}
              onChange={(field, value) => updateCampaign(c.id, field, value)}
              onRemove={() => removeCampaign(c.id)} canRemove={campaigns.length > 1} />
          ))}
          <button className="btn-ghost" onClick={addCampaign}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', alignSelf: 'flex-start' }}>
            <Plus size={15} /> Agregar campaña
          </button>
          <div style={S.sectionCard}>
            <label style={S.label}>Contexto adicional (opcional)</label>
            <textarea className="form-textarea" rows={3}
              placeholder="Situación del negocio, resultados anteriores, restricciones, temporada..."
              value={contextNote} onChange={(e) => setContextNote(e.target.value)} />
          </div>
        </>
      )}

      {/* ─── MODO IMAGEN ─── */}
      {mode === 'imagen' && (
        <div style={{ ...S.sectionCard, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={S.label}>Imagen del mapa mental o pizarrón <span style={{ color: '#ef4444' }}>*</span></label>
            {!imagePreview ? (
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '36px 16px', border: '2px dashed var(--color-border-strong)',
                borderRadius: 10, background: 'transparent', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: '0.82rem', transition: 'border-color 0.15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent-cyan)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}>
                <Image size={20} /> Haz clic para subir la imagen (PNG, JPG, WEBP)
              </button>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={imagePreview} alt="Estrategia" style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8, display: 'block' }} />
                <button type="button" onClick={removeImage} style={{
                  position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.65)',
                  border: 'none', borderRadius: '50%', width: 26, height: 26,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff',
                }}>
                  <X size={13} />
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }} onChange={handleImageChange} />
          </div>
          <div>
            <label style={S.label}>Pregunta o contexto adicional</label>
            <textarea className="form-textarea" rows={3}
              placeholder="¿Qué cliente es? ¿Hay algo específico que quieras analizar?"
              value={contextNote} onChange={(e) => setContextNote(e.target.value)} />
          </div>
        </div>
      )}

      {/* ─── MODO TRANSCRIPCIÓN ─── */}
      {mode === 'transcripcion' && (
        <div style={{ ...S.sectionCard, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={S.label}>Transcripción o notas de estrategia <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea className="form-textarea" rows={12}
              placeholder="Pega aquí la transcripción de voz o notas de reunión. Ej: 'Para Óptica vamos a montar una campaña de tráfico con ABO, dos conjuntos...'"
              value={transcripcion} onChange={(e) => setTranscripcion(e.target.value)} />
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
              {transcripcion.length} caracteres · Claude interpreta el lenguaje natural y estructura la campaña
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          background: 'color-mix(in srgb, #ef4444 10%, transparent)',
          border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
          borderRadius: 8, color: '#ef4444', fontSize: '0.8rem',
        }}>
          <AlertCircle size={15} /> {error}
          <button className="btn-ghost" onClick={() => void handleGenerate()} style={{ marginLeft: 'auto', fontSize: '0.76rem' }}>
            Reintentar
          </button>
        </div>
      )}

      {/* Generate button */}
      {mode === 'generador' ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <button
            onClick={() => void handleGenerate()}
            disabled={isGenerateDisabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 32px', borderRadius: 12, border: 'none', cursor: isGenerateDisabled ? 'default' : 'pointer',
              background: isGenerateDisabled ? 'var(--color-bg-secondary)' : 'var(--color-accent-cyan)',
              color: isGenerateDisabled ? 'var(--color-text-muted)' : 'var(--color-accent-cyan-fg, #000)',
              fontSize: '0.95rem', fontWeight: 800,
              transition: 'opacity 0.15s, transform 0.15s',
              boxShadow: isGenerateDisabled ? 'none' : '0 4px 24px color-mix(in srgb, var(--color-accent-cyan) 30%, transparent)',
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000',
                  borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
                }} />
                {loadingMsg}
              </>
            ) : (
              <>
                <Sparkles size={18} /> ⚡ Generar estrategia completa
              </>
            )}
          </button>
        </div>
      ) : (
        <button
          className="btn-primary"
          onClick={() => void handleGenerate()}
          disabled={loading}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', padding: '10px 20px' }}
        >
          {loading ? (
            <>
              <span style={{
                width: 15, height: 15, border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000',
                borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
              }} />
              {loadingMsg}
            </>
          ) : (
            <><Sparkles size={16} /> Generar organigrama</>
          )}
        </button>
      )}

      {/* Output */}
      {output && (
        <div ref={outputRef}>
          <OrganigramaOutput output={output} toolKey="estrategia" formSummary={formSummary} />
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
