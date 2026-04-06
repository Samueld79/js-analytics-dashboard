import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdSetEntry,
  Client,
  MetaAdEntry,
  ServiceMutationResult,
  Strategy,
  StrategyCampaign,
  StrategyInput,
} from '../lib/supabase';

interface Props {
  clients: Client[];
  strategy?: Strategy | null;
  draft?: StrategyInput | null;
  defaultClientId?: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (
    input: StrategyInput,
    options?: { changeSummary?: string | null; optimizeCreativesDate?: string; optimizeAdsetsDate?: string },
  ) => Promise<ServiceMutationResult<Strategy>>;
}

// ─── Local form state types ────────────────────────────────────────────────

interface AdFormState {
  adType: string;
  description: string;
  publicationType: 'nueva' | 'existente';
  existingUrl: string;
  notes: string;
  imageBase64: string;
  imageFilename: string;
  welcomeMessage: string;
  suggestedQuestions: string;
}

interface AdSetFormState {
  name: string;
  aboBudgetType: 'diario' | 'total';
  aboBudgetAmount: string;
  startDate: string;
  endDate: string;
  hasEndDate: boolean;
  optimizationGoal: string;
  trafficDestination: string;
  interactionType: string;
  messageDestinations: string[];
  conversionDestination: string;
  leadsType: string;
  ageMin: number;
  ageMax: number;
  gender: 'all' | 'male' | 'female';
  locationsText: string;
  detailedTargeting: string;
  interests: string;
  behaviors: string;
  hasCustomAudience: boolean;
  customAudienceName: string;
  lookalikeAudiences: string;
  exclusions: string;
  placementsOption: 'auto' | 'manual';
  placements: string[];
  ads: AdFormState[];
}

interface CampaignFormState {
  name: string;
  budget: string;
  budgetType: 'ABO' | 'CBO';
  objective: string;
  adsets: AdSetFormState[];
}

// ─── Constants ────────────────────────────────────────────────────────────

const PLACEMENTS = ['Feed', 'Reels', 'Stories', 'Explore', 'Messenger', 'Audience Network'];
const AD_TYPES = ['Video', 'Imagen', 'Carrusel', 'Reel', 'Colección'];
const OBJECTIVES = ['Reconocimiento', 'Tráfico', 'Interacción', 'Ventas', 'Generación de leads', 'Mensajes'];
const AGE_OPTIONS_MIN = Array.from({ length: 48 }, (_, i) => 18 + i);
const AGE_OPTIONS_MAX = Array.from({ length: 46 }, (_, i) => 20 + i);

const OPTIMIZATION_GOALS: Record<string, string[]> = {
  Reconocimiento: ['Alcance', 'Impresiones', 'Reproducciones de video', 'Reconocimiento de marca'],
  Tráfico: ['Clics en enlace', 'Visitas a página de destino', 'Clics en publicación'],
  Interacción: ['Interacciones con publicación', 'Reproducciones de video', 'Mensajes', 'Visitas al perfil'],
  Ventas: ['Conversiones', 'Valor de conversión', 'Ventas del catálogo'],
  'Generación de leads': ['Clientes potenciales', 'Conversiones de clientes potenciales'],
  Mensajes: ['Conversaciones iniciadas', 'Respuestas a mensajes'],
};
const TRAFFIC_DESTINATIONS = ['Sitio web', 'App', 'Messenger', 'Instagram', 'WhatsApp'];
const MESSAGE_DESTINATIONS = ['WhatsApp', 'Messenger', 'Instagram DM'];
const INTERACTION_TYPES = ['Mensajes', 'Reacciones y comentarios', 'Reproducciones de video', 'Visitas al perfil', 'Seguimiento'];
const CONVERSION_DESTINATIONS = ['Sitio web', 'App', 'WhatsApp', 'Messenger', 'Instagram DM', 'Catálogo'];
const LEADS_TYPES = ['Formulario nativo', 'Sitio web', 'WhatsApp', 'Messenger'];

const CAMPAIGN_OBJ_COLORS: Record<string, string> = {
  Reconocimiento: 'hsl(180,100%,50%)',
  Tráfico: 'hsl(215,80%,65%)',
  Interacción: 'hsl(280,80%,70%)',
  Ventas: 'hsl(145,100%,55%)',
  'Generación de leads': 'hsl(38,100%,60%)',
  Mensajes: 'hsl(320,80%,65%)',
};

const DRAFT_KEY = 'strategy_draft';

// ─── Empty factories ───────────────────────────────────────────────────────

function emptyAd(): AdFormState {
  return {
    adType: '',
    description: '',
    publicationType: 'nueva',
    existingUrl: '',
    notes: '',
    imageBase64: '',
    imageFilename: '',
    welcomeMessage: '',
    suggestedQuestions: '',
  };
}

function emptyAdSet(): AdSetFormState {
  return {
    name: '',
    aboBudgetType: 'diario',
    aboBudgetAmount: '',
    startDate: '',
    endDate: '',
    hasEndDate: false,
    optimizationGoal: '',
    trafficDestination: '',
    interactionType: '',
    messageDestinations: [],
    conversionDestination: '',
    leadsType: '',
    ageMin: 18,
    ageMax: 65,
    gender: 'all',
    locationsText: '',
    detailedTargeting: '',
    interests: '',
    behaviors: '',
    hasCustomAudience: false,
    customAudienceName: '',
    lookalikeAudiences: '',
    exclusions: '',
    placementsOption: 'auto',
    placements: [],
    ads: [emptyAd()],
  };
}

function emptyCampaign(): CampaignFormState {
  return { name: '', budget: '', budgetType: 'CBO', objective: 'Reconocimiento', adsets: [emptyAdSet()] };
}

// ─── Converters ───────────────────────────────────────────────────────────

function toFormCampaigns(campaigns?: StrategyCampaign[] | null): CampaignFormState[] {
  if (!campaigns?.length) return [];
  return campaigns.map((c) => ({
    name: c.name,
    budget: c.budget?.toString() ?? '',
    budgetType: c.budgetType ?? 'CBO',
    objective: c.objective ?? 'Reconocimiento',
    adsets: (c.adsets ?? []).map((a): AdSetFormState => {
      let ads: AdFormState[];
      if (a.ads?.length) {
        ads = a.ads.map((ad) => ({
          adType: ad.adType ?? '',
          description: ad.description ?? '',
          publicationType: (ad.publicationType ?? 'nueva') as 'nueva' | 'existente',
          existingUrl: ad.existingUrl ?? '',
          notes: ad.notes ?? '',
          imageBase64: ad.imageBase64 ?? '',
          imageFilename: ad.imageBase64 ? 'imagen_guardada' : '',
          welcomeMessage: ad.welcomeMessage ?? '',
          suggestedQuestions: ad.suggestedQuestions ?? '',
        }));
      } else if (a.creatives?.length) {
        // Migrate legacy creatives → ads
        ads = a.creatives.map((cr) => ({
          adType: a.adType ?? '',
          description: cr.description ?? '',
          publicationType: (cr.publicationType ?? 'nueva') as 'nueva' | 'existente',
          existingUrl: cr.existingUrl ?? '',
          notes: cr.notes ?? '',
          imageBase64: cr.imageBase64 ?? '',
          imageFilename: cr.imageBase64 ? 'imagen_guardada' : '',
          welcomeMessage: a.welcomeMessage ?? '',
          suggestedQuestions: '',
        }));
      } else {
        ads = [emptyAd()];
      }
      return {
        name: a.name ?? '',
        aboBudgetType: (a.aboBudgetType ?? 'diario') as 'diario' | 'total',
        aboBudgetAmount: a.aboBudgetAmount?.toString() ?? '',
        startDate: a.startDate ?? '',
        endDate: a.endDate ?? '',
        hasEndDate: a.hasEndDate ?? false,
        optimizationGoal: a.optimizationGoal ?? '',
        trafficDestination: a.trafficDestination ?? '',
        interactionType: a.interactionType ?? '',
        messageDestinations: a.messageDestinations ?? [],
        conversionDestination: a.conversionDestination ?? '',
        leadsType: a.leadsType ?? '',
        ageMin: a.ageMin ?? 18,
        ageMax: a.ageMax ?? 65,
        gender: a.gender ?? 'all',
        locationsText: (a.locations ?? []).join(', '),
        detailedTargeting: a.detailedTargeting ?? '',
        interests: a.interests ?? '',
        behaviors: a.behaviors ?? '',
        hasCustomAudience: a.hasCustomAudience ?? Boolean(a.customAudiences),
        customAudienceName: a.customAudienceName ?? a.customAudiences ?? '',
        lookalikeAudiences: a.lookalikeAudiences ?? '',
        exclusions: a.exclusions ?? '',
        placementsOption: (a.placementsOption ?? 'auto') as 'auto' | 'manual',
        placements: a.placements ?? [],
        ads,
      };
    }),
  }));
}

function fromFormCampaigns(campaigns: CampaignFormState[]): StrategyCampaign[] {
  return campaigns
    .filter((c) => c.name.trim())
    .map((c) => ({
      name: c.name.trim(),
      budget: c.budget ? Number(c.budget) || undefined : undefined,
      budgetType: c.budgetType,
      objective: c.objective,
      adsets: c.adsets.map((a): AdSetEntry => ({
        name: a.name || undefined,
        aboBudgetType: c.budgetType === 'ABO' ? a.aboBudgetType : undefined,
        aboBudgetAmount:
          c.budgetType === 'ABO' && a.aboBudgetAmount
            ? Number(a.aboBudgetAmount) || undefined
            : undefined,
        startDate: a.startDate || undefined,
        endDate: a.hasEndDate && a.endDate ? a.endDate : undefined,
        hasEndDate: a.hasEndDate || undefined,
        optimizationGoal: a.optimizationGoal || undefined,
        trafficDestination:
          c.objective === 'Tráfico' ? a.trafficDestination || undefined : undefined,
        interactionType:
          c.objective === 'Interacción' ? a.interactionType || undefined : undefined,
        messageDestinations:
          c.objective === 'Mensajes' && a.messageDestinations.length
            ? a.messageDestinations
            : undefined,
        conversionDestination:
          c.objective === 'Ventas' ? a.conversionDestination || undefined : undefined,
        leadsType:
          c.objective === 'Generación de leads' ? a.leadsType || undefined : undefined,
        ageMin: a.ageMin,
        ageMax: a.ageMax,
        gender: a.gender,
        locations: a.locationsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        detailedTargeting: a.detailedTargeting || undefined,
        interests: a.interests || undefined,
        behaviors: a.behaviors || undefined,
        hasCustomAudience: a.hasCustomAudience || undefined,
        customAudienceName: a.hasCustomAudience ? a.customAudienceName || undefined : undefined,
        lookalikeAudiences: a.lookalikeAudiences || undefined,
        exclusions: a.exclusions || undefined,
        placementsOption: a.placementsOption,
        placements: a.placementsOption === 'manual' ? a.placements : undefined,
        ads: a.ads
          .filter((ad) => ad.description || ad.existingUrl || ad.notes || ad.imageBase64)
          .map(
            (ad): MetaAdEntry => ({
              adType: ad.adType || undefined,
              description: ad.description || undefined,
              publicationType: ad.publicationType,
              existingUrl:
                ad.publicationType === 'existente' ? ad.existingUrl || undefined : undefined,
              notes: ad.notes || undefined,
              imageBase64: ad.imageBase64 || undefined,
              welcomeMessage: ad.welcomeMessage || undefined,
              suggestedQuestions: ad.suggestedQuestions || undefined,
            }),
          ),
      })),
    }));
}

function getCurrentMonthValue(): string {
  return new Date().toISOString().slice(0, 7);
}

// ─── Styles ───────────────────────────────────────────────────────────────

const FIELD_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.68rem',
  color: 'hsl(215,15%,55%)',
  fontWeight: 600,
  letterSpacing: '0.04em',
};

const INPUT_STYLE: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: '0.84rem',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid hsl(180 100% 50% / 0.15)',
  borderRadius: 7,
  color: 'inherit',
  outline: 'none',
};

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  resize: 'vertical' as const,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.78rem',
  lineHeight: 1.5,
};

const SELECT_COMPACT: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: '0.78rem',
  background: 'hsl(220,22%,10%)',
  border: '1px solid hsl(180 100% 50% / 0.2)',
  borderRadius: 6,
  color: 'inherit',
  outline: 'none',
  cursor: 'pointer',
};

// ─── Section heading ───────────────────────────────────────────────────────

function SectionHeading({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 12px' }}>
      <span
        style={{
          fontSize: '0.58rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'hsl(180,100%,50%)',
          fontFamily: 'JetBrains Mono',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'hsl(180 100% 50% / 0.12)' }} />
    </div>
  );
}

// ─── Age dropdowns ────────────────────────────────────────────────────────

function AgeDropdowns({
  ageMin,
  ageMax,
  onChange,
}: {
  ageMin: number;
  ageMax: number;
  onChange: (min: number, max: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <select
        value={ageMin}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(v, Math.max(v + 1, ageMax));
        }}
        style={SELECT_COMPACT}
      >
        {AGE_OPTIONS_MIN.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <span style={{ color: 'hsl(215,15%,40%)', fontSize: '0.8rem' }}>—</span>
      <select
        value={ageMax}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(Math.min(ageMin, v - 1), v);
        }}
        style={SELECT_COMPACT}
      >
        {AGE_OPTIONS_MAX.map((a) => (
          <option key={a} value={a}>
            {a === 65 ? '65+' : a}
          </option>
        ))}
      </select>
      <span
        style={{
          padding: '3px 9px',
          borderRadius: 20,
          fontSize: '0.72rem',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
          background: 'hsl(180 100% 50% / 0.12)',
          color: 'hsl(180,100%,65%)',
          border: '1px solid hsl(180 100% 50% / 0.25)',
        }}
      >
        {ageMin} – {ageMax === 65 ? '65+' : ageMax} años
      </span>
    </div>
  );
}

// ─── Generic pill toggle ──────────────────────────────────────────────────

function PillToggle({
  options,
  active,
  onToggle,
}: {
  options: string[];
  active: string | string[];
  onToggle: (value: string) => void;
}) {
  const activeSet = new Set(Array.isArray(active) ? active : [active]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {options.map((opt) => {
        const isActive = activeSet.has(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            style={{
              padding: '3px 10px',
              borderRadius: 5,
              fontSize: '0.72rem',
              border: isActive
                ? '1px solid hsl(180,100%,50%)'
                : '1px solid rgba(255,255,255,0.1)',
              background: isActive ? 'hsl(180 100% 50% / 0.15)' : 'transparent',
              color: isActive ? 'hsl(180,100%,70%)' : 'hsl(215,15%,50%)',
              cursor: 'pointer',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Ad block (Level 3) ───────────────────────────────────────────────────

function AdBlock({
  ad,
  adIdx,
  showMessaging,
  onChange,
  onRemove,
}: {
  ad: AdFormState;
  adIdx: number;
  showMessaging: boolean;
  onChange: (updated: AdFormState) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof AdFormState>(field: K, value: AdFormState[K]) {
    onChange({ ...ad, [field]: value });
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no puede superar 2 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...ad, imageBase64: reader.result as string, imageFilename: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 7,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '0.62rem',
            color: 'hsl(215,15%,40%)',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          ANUNCIO {adIdx + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'hsl(0,80%,55%)',
            cursor: 'pointer',
            padding: 2,
            lineHeight: 1,
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Ad type */}
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Tipo de anuncio</label>
        <PillToggle
          options={AD_TYPES}
          active={ad.adType}
          onToggle={(v) => set('adType', ad.adType === v ? '' : v)}
        />
      </div>

      {/* Publication type */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['nueva', 'existente'] as const).map((t) => {
          const isActive = ad.publicationType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => set('publicationType', t)}
              style={{
                padding: '4px 12px',
                borderRadius: 5,
                fontSize: '0.72rem',
                border: isActive
                  ? '1px solid hsl(180,100%,50%)'
                  : '1px solid rgba(255,255,255,0.1)',
                background: isActive ? 'hsl(180 100% 50% / 0.15)' : 'transparent',
                color: isActive ? 'hsl(180,100%,70%)' : 'hsl(215,15%,50%)',
                cursor: 'pointer',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {t === 'nueva' ? '📝 Publicación nueva' : '♻️ Publicación existente'}
            </button>
          );
        })}
      </div>

      {/* URL — only for existente */}
      {ad.publicationType === 'existente' && (
        <input
          value={ad.existingUrl}
          onChange={(e) => set('existingUrl', e.target.value)}
          placeholder="https://www.facebook.com/permalink/..."
          style={{ ...INPUT_STYLE, fontSize: '0.78rem' }}
        />
      )}

      {/* Description */}
      <textarea
        rows={2}
        value={ad.description}
        onChange={(e) => set('description', e.target.value)}
        placeholder="Brief del creativo: qué se muestra, mensaje principal, formato..."
        style={{ ...TEXTAREA_STYLE, fontSize: '0.8rem' }}
      />

      {/* Notes */}
      <input
        value={ad.notes}
        onChange={(e) => set('notes', e.target.value)}
        placeholder="Indicaciones adicionales..."
        style={{ ...INPUT_STYLE, fontSize: '0.78rem' }}
      />

      {/* Image attachment */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />
        {ad.imageBase64 ? (
          <>
            <img
              src={ad.imageBase64}
              alt="preview"
              style={{
                width: 80,
                height: 80,
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'hsl(215,15%,55%)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {ad.imageFilename}
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...ad, imageBase64: '', imageFilename: '' })}
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  border: '1px solid hsl(0 70% 50% / 0.4)',
                  borderRadius: 5,
                  color: 'hsl(0,80%,60%)',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                }}
              >
                ✕ Quitar imagen
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'transparent',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 6,
              color: 'hsl(215,15%,50%)',
              cursor: 'pointer',
              padding: '6px 12px',
              fontSize: '0.72rem',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            🖼️ Adjuntar imagen (máx. 2 MB)
          </button>
        )}
      </div>

      {/* Welcome message + suggested questions — only for Mensajes objective */}
      {showMessaging && (
        <>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>💬 Mensaje de bienvenida</label>
            <textarea
              rows={2}
              value={ad.welcomeMessage}
              onChange={(e) => set('welcomeMessage', e.target.value)}
              placeholder="Mensaje que recibirá el prospecto al iniciar la conversación..."
              style={{ ...TEXTAREA_STYLE, fontSize: '0.78rem' }}
            />
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>❓ Preguntas sugeridas (una por línea)</label>
            <textarea
              rows={3}
              value={ad.suggestedQuestions}
              onChange={(e) => set('suggestedQuestions', e.target.value)}
              placeholder={'¿Cuánto cuesta?\n¿Cómo puedo pedir?\nQuiero más información'}
              style={{ ...TEXTAREA_STYLE, fontSize: '0.75rem' }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Adset block (Level 2) ────────────────────────────────────────────────

function adSetTabStyle(isActive: boolean, position: 'first' | 'last'): React.CSSProperties {
  return {
    padding: '2px 9px',
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    border: isActive ? '1px solid hsl(180,100%,50%)' : '1px solid rgba(255,255,255,0.1)',
    borderRadius: position === 'first' ? '4px 0 0 4px' : '0 4px 4px 0',
    borderLeft: position === 'last' ? 'none' : undefined,
    background: isActive ? 'hsl(180 100% 50% / 0.15)' : 'transparent',
    color: isActive ? 'hsl(180,100%,65%)' : 'hsl(215,15%,45%)',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
  };
}

function AdSetBlock({
  adset,
  adsetIdx,
  campaignObjective,
  campaignBudgetType,
  onChange,
  onRemove,
}: {
  adset: AdSetFormState;
  adsetIdx: number;
  campaignObjective: string;
  campaignBudgetType: 'ABO' | 'CBO';
  onChange: (updated: AdSetFormState) => void;
  onRemove: () => void;
}) {
  const [isOpen, setIsOpen] = useState(adsetIdx === 0);
  const [activeTab, setActiveTab] = useState<'conjunto' | 'anuncios'>('conjunto');

  function set<K extends keyof AdSetFormState>(field: K, value: AdSetFormState[K]) {
    onChange({ ...adset, [field]: value });
  }

  function toggleMessageDest(dest: string) {
    const next = adset.messageDestinations.includes(dest)
      ? adset.messageDestinations.filter((x) => x !== dest)
      : [...adset.messageDestinations, dest];
    set('messageDestinations', next);
  }

  function togglePlacement(p: string) {
    const next = adset.placements.includes(p)
      ? adset.placements.filter((x) => x !== p)
      : [...adset.placements, p];
    set('placements', next);
  }

  function updateAd(adIdx: number, updated: AdFormState) {
    set('ads', adset.ads.map((a, i) => (i === adIdx ? updated : a)));
  }

  function removeAd(adIdx: number) {
    set('ads', adset.ads.filter((_, i) => i !== adIdx));
  }

  const goalsForObjective = OPTIMIZATION_GOALS[campaignObjective] ?? [];
  const showMessaging = campaignObjective === 'Mensajes';
  const displayName = adset.name.trim() || `CONJUNTO ${adsetIdx + 1}`;

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'hsl(215,15%,45%)',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName}
          </span>
          {isOpen && (
            <div style={{ display: 'flex', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setActiveTab('conjunto')}
                style={adSetTabStyle(activeTab === 'conjunto', 'first')}
              >
                CONJUNTO
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('anuncios')}
                style={adSetTabStyle(activeTab === 'anuncios', 'last')}
              >
                ANUNCIOS ({adset.ads.length})
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'hsl(215,15%,50%)',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'hsl(0,80%,55%)',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* ── CONJUNTO TAB ── */}
          {activeTab === 'conjunto' && (
            <>
              {/* Name */}
              <div style={FIELD_STYLE}>
                <label style={LABEL_STYLE}>Nombre del conjunto</label>
                <input
                  value={adset.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ej. Conjunto Bogotá 25-40"
                  style={{ ...INPUT_STYLE, fontSize: '0.82rem' }}
                />
              </div>

              {/* ABO budget — only when campaign is ABO */}
              {campaignBudgetType === 'ABO' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={FIELD_STYLE}>
                    <label style={LABEL_STYLE}>Tipo presupuesto ABO</label>
                    <PillToggle
                      options={['Diario', 'Total']}
                      active={adset.aboBudgetType === 'diario' ? 'Diario' : 'Total'}
                      onToggle={(v) => set('aboBudgetType', v === 'Diario' ? 'diario' : 'total')}
                    />
                  </div>
                  <div style={{ ...FIELD_STYLE, flex: 1 }}>
                    <label style={LABEL_STYLE}>Presupuesto COP</label>
                    <input
                      type="number"
                      min="0"
                      value={adset.aboBudgetAmount}
                      onChange={(e) => set('aboBudgetAmount', e.target.value)}
                      placeholder="500000"
                      style={INPUT_STYLE}
                    />
                  </div>
                </div>
              )}

              {/* Scheduling */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>Fecha de inicio</label>
                  <input
                    type="date"
                    value={adset.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                    style={INPUT_STYLE}
                  />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Fecha de fin
                    <button
                      type="button"
                      onClick={() => set('hasEndDate', !adset.hasEndDate)}
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: '0.6rem',
                        border: adset.hasEndDate
                          ? '1px solid hsl(180,100%,50%)'
                          : '1px solid rgba(255,255,255,0.15)',
                        background: adset.hasEndDate ? 'hsl(180 100% 50% / 0.15)' : 'transparent',
                        color: adset.hasEndDate ? 'hsl(180,100%,65%)' : 'hsl(215,15%,45%)',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {adset.hasEndDate ? 'con fin' : 'sin fin'}
                    </button>
                  </label>
                  {adset.hasEndDate && (
                    <input
                      type="date"
                      value={adset.endDate}
                      onChange={(e) => set('endDate', e.target.value)}
                      style={INPUT_STYLE}
                    />
                  )}
                </div>
              </div>

              {/* Optimization goal */}
              {goalsForObjective.length > 0 && (
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>Objetivo de optimización</label>
                  <select
                    value={adset.optimizationGoal}
                    onChange={(e) => set('optimizationGoal', e.target.value)}
                    style={INPUT_STYLE as React.CSSProperties}
                  >
                    <option value="">Selecciona un objetivo de optimización...</option>
                    {goalsForObjective.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Conditional: Tráfico */}
              {campaignObjective === 'Tráfico' && (
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>Destino del tráfico</label>
                  <PillToggle
                    options={TRAFFIC_DESTINATIONS}
                    active={adset.trafficDestination}
                    onToggle={(v) =>
                      set('trafficDestination', adset.trafficDestination === v ? '' : v)
                    }
                  />
                </div>
              )}

              {/* Conditional: Interacción */}
              {campaignObjective === 'Interacción' && (
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>Tipo de interacción</label>
                  <PillToggle
                    options={INTERACTION_TYPES}
                    active={adset.interactionType}
                    onToggle={(v) =>
                      set('interactionType', adset.interactionType === v ? '' : v)
                    }
                  />
                </div>
              )}

              {/* Conditional: Mensajes */}
              {campaignObjective === 'Mensajes' && (
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>Destinos de mensajes</label>
                  <PillToggle
                    options={MESSAGE_DESTINATIONS}
                    active={adset.messageDestinations}
                    onToggle={toggleMessageDest}
                  />
                </div>
              )}

              {/* Conditional: Ventas */}
              {campaignObjective === 'Ventas' && (
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>Destino de conversión</label>
                  <PillToggle
                    options={CONVERSION_DESTINATIONS}
                    active={adset.conversionDestination}
                    onToggle={(v) =>
                      set('conversionDestination', adset.conversionDestination === v ? '' : v)
                    }
                  />
                </div>
              )}

              {/* Conditional: Generación de leads */}
              {campaignObjective === 'Generación de leads' && (
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>Tipo de captación</label>
                  <PillToggle
                    options={LEADS_TYPES}
                    active={adset.leadsType}
                    onToggle={(v) => set('leadsType', adset.leadsType === v ? '' : v)}
                  />
                </div>
              )}

              {/* Audience */}
              <div
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  paddingTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: 'hsl(180,100%,50%)',
                    letterSpacing: '0.1em',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  AUDIENCIA
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={FIELD_STYLE}>
                    <label style={LABEL_STYLE}>Rango de edad</label>
                    <AgeDropdowns
                      ageMin={adset.ageMin}
                      ageMax={adset.ageMax}
                      onChange={(min, max) => onChange({ ...adset, ageMin: min, ageMax: max })}
                    />
                  </div>
                  <div style={FIELD_STYLE}>
                    <label style={LABEL_STYLE}>Género</label>
                    <PillToggle
                      options={['Todos', 'Hombres', 'Mujeres']}
                      active={
                        adset.gender === 'all'
                          ? 'Todos'
                          : adset.gender === 'male'
                            ? 'Hombres'
                            : 'Mujeres'
                      }
                      onToggle={(v) =>
                        set('gender', v === 'Todos' ? 'all' : v === 'Hombres' ? 'male' : 'female')
                      }
                    />
                  </div>
                </div>

                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>Ciudades / ubicaciones</label>
                  <input
                    value={adset.locationsText}
                    onChange={(e) => set('locationsText', e.target.value)}
                    placeholder="Bogotá, Medellín, Cali"
                    style={{ ...INPUT_STYLE, fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={FIELD_STYLE}>
                    <label style={{ ...LABEL_STYLE, color: 'hsl(180,100%,60%)' }}>Intereses</label>
                    <textarea
                      rows={2}
                      value={adset.interests}
                      onChange={(e) => set('interests', e.target.value)}
                      placeholder="Moda, Fitness, Tecnología..."
                      style={{ ...TEXTAREA_STYLE, fontSize: '0.75rem' }}
                    />
                  </div>
                  <div style={FIELD_STYLE}>
                    <label style={{ ...LABEL_STYLE, color: 'hsl(180,100%,60%)' }}>
                      Comportamientos
                    </label>
                    <textarea
                      rows={2}
                      value={adset.behaviors}
                      onChange={(e) => set('behaviors', e.target.value)}
                      placeholder="Compradores activos, Viajeros frecuentes..."
                      style={{ ...TEXTAREA_STYLE, fontSize: '0.75rem' }}
                    />
                  </div>
                </div>

                <div style={FIELD_STYLE}>
                  <label
                    style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    Audiencias personalizadas
                    <button
                      type="button"
                      onClick={() => set('hasCustomAudience', !adset.hasCustomAudience)}
                      style={{
                        padding: '1px 8px',
                        borderRadius: 4,
                        fontSize: '0.62rem',
                        border: adset.hasCustomAudience
                          ? '1px solid hsl(180,100%,50%)'
                          : '1px solid rgba(255,255,255,0.15)',
                        background: adset.hasCustomAudience
                          ? 'hsl(180 100% 50% / 0.15)'
                          : 'transparent',
                        color: adset.hasCustomAudience
                          ? 'hsl(180,100%,65%)'
                          : 'hsl(215,15%,45%)',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {adset.hasCustomAudience ? 'sí' : 'no'}
                    </button>
                  </label>
                  {adset.hasCustomAudience && (
                    <input
                      value={adset.customAudienceName}
                      onChange={(e) => set('customAudienceName', e.target.value)}
                      placeholder="Nombre de la audiencia personalizada..."
                      style={{ ...INPUT_STYLE, fontSize: '0.8rem' }}
                    />
                  )}
                </div>

                <div style={FIELD_STYLE}>
                  <label style={{ ...LABEL_STYLE, color: 'hsl(180,100%,60%)' }}>
                    Audiencias similares
                  </label>
                  <textarea
                    rows={2}
                    value={adset.lookalikeAudiences}
                    onChange={(e) => set('lookalikeAudiences', e.target.value)}
                    placeholder="Lookalike 1% compradores..."
                    style={{ ...TEXTAREA_STYLE, fontSize: '0.75rem' }}
                  />
                </div>
              </div>

              {/* Placements */}
              <div
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  paddingTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: 'hsl(180,100%,50%)',
                    letterSpacing: '0.1em',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  UBICACIONES DE PAUTA
                </span>
                <PillToggle
                  options={['Automáticas', 'Manuales']}
                  active={adset.placementsOption === 'auto' ? 'Automáticas' : 'Manuales'}
                  onToggle={(v) => set('placementsOption', v === 'Automáticas' ? 'auto' : 'manual')}
                />
                {adset.placementsOption === 'manual' && (
                  <PillToggle
                    options={PLACEMENTS}
                    active={adset.placements}
                    onToggle={togglePlacement}
                  />
                )}
              </div>

              {/* Exclusions */}
              <div
                style={{
                  ...FIELD_STYLE,
                  borderLeft: '3px solid hsl(38,100%,50%)',
                  paddingLeft: 10,
                }}
              >
                <label style={{ ...LABEL_STYLE, color: 'hsl(38,100%,65%)' }}>🚫 Exclusiones</label>
                <textarea
                  rows={2}
                  value={adset.exclusions}
                  onChange={(e) => set('exclusions', e.target.value)}
                  placeholder="Clientes recientes, audiencias a excluir..."
                  style={{
                    ...TEXTAREA_STYLE,
                    fontSize: '0.78rem',
                    borderColor: 'hsl(38 100% 50% / 0.2)',
                  }}
                />
              </div>
            </>
          )}

          {/* ── ANUNCIOS TAB ── */}
          {activeTab === 'anuncios' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {adset.ads.map((ad, adIdx) => (
                  <AdBlock
                    key={adIdx}
                    ad={ad}
                    adIdx={adIdx}
                    showMessaging={showMessaging}
                    onChange={(updated) => updateAd(adIdx, updated)}
                    onRemove={() => removeAd(adIdx)}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => set('ads', [...adset.ads, emptyAd()])}
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  border: '1px solid hsl(180 100% 50% / 0.25)',
                  borderRadius: 5,
                  color: 'hsl(180,100%,55%)',
                  cursor: 'pointer',
                  padding: '2px 7px',
                  fontSize: '0.68rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Plus size={10} /> Anuncio
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Campaign block (Level 1) ─────────────────────────────────────────────

function campTabStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: '4px 12px',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    border: isActive
      ? '1px solid hsl(180,100%,50%)'
      : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 5,
    background: isActive ? 'hsl(180 100% 50% / 0.15)' : 'transparent',
    color: isActive ? 'hsl(180,100%,65%)' : 'hsl(215,15%,40%)',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
  };
}

function CampaignBlock({
  campaign,
  campIdx,
  onChange,
  onRemove,
}: {
  campaign: CampaignFormState;
  campIdx: number;
  onChange: (updated: CampaignFormState) => void;
  onRemove: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'campaign' | 'adsets'>('campaign');

  function set<K extends keyof CampaignFormState>(field: K, value: CampaignFormState[K]) {
    onChange({ ...campaign, [field]: value });
  }

  function updateAdSet(adsetIdx: number, updated: AdSetFormState) {
    onChange({
      ...campaign,
      adsets: campaign.adsets.map((a, i) => (i === adsetIdx ? updated : a)),
    });
  }

  function removeAdSet(adsetIdx: number) {
    onChange({ ...campaign, adsets: campaign.adsets.filter((_, i) => i !== adsetIdx) });
  }

  const totalAds = campaign.adsets.reduce((sum, a) => sum + a.ads.length, 0);
  const objColor = CAMPAIGN_OBJ_COLORS[campaign.objective] ?? 'hsl(215,15%,55%)';

  return (
    <div
      style={{
        padding: '14px',
        borderRadius: 10,
        border: '1px solid hsl(180 100% 50% / 0.15)',
        background: 'rgba(0,255,255,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Campaign header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: objColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              color: 'hsl(180,100%,50%)',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.1em',
            }}
          >
            {campaign.name.trim() || `CAMPAÑA ${campIdx + 1}`}
          </span>
          {campaign.objective && (
            <span style={{ fontSize: '0.6rem', color: objColor, fontFamily: 'JetBrains Mono' }}>
              · {campaign.objective}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'hsl(0,80%,55%)',
            cursor: 'pointer',
            padding: 2,
            lineHeight: 1,
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Wizard step tabs */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setActiveTab('campaign')}
          style={campTabStyle(activeTab === 'campaign')}
        >
          ① CAMPAÑA
        </button>
        <span style={{ color: 'hsl(215,15%,30%)', fontSize: '0.7rem' }}>→</span>
        <button
          type="button"
          onClick={() => setActiveTab('adsets')}
          style={campTabStyle(activeTab === 'adsets')}
        >
          ② CONJUNTOS ({campaign.adsets.length}) · ANUNCIOS ({totalAds})
        </button>
      </div>

      {/* ── CAMPAÑA TAB ── */}
      {activeTab === 'campaign' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Nombre *</label>
              <input
                value={campaign.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Campaña reconocimiento abril"
                style={INPUT_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Objetivo de campaña</label>
              <select
                value={campaign.objective}
                onChange={(e) => set('objective', e.target.value)}
                style={INPUT_STYLE as React.CSSProperties}
              >
                {OBJECTIVES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ ...FIELD_STYLE, flex: 1 }}>
              <label style={LABEL_STYLE}>Presupuesto COP</label>
              <input
                type="number"
                min="0"
                value={campaign.budget}
                onChange={(e) => set('budget', e.target.value)}
                placeholder="5000000"
                style={INPUT_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Tipo de presupuesto</label>
              <PillToggle
                options={['CBO', 'ABO']}
                active={campaign.budgetType}
                onToggle={(v) => set('budgetType', v as 'ABO' | 'CBO')}
              />
            </div>
          </div>

          <p
            style={{
              fontSize: '0.72rem',
              color:
                campaign.budgetType === 'ABO'
                  ? 'hsl(38,100%,50%)'
                  : 'hsl(215,15%,40%)',
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            {campaign.budgetType === 'CBO'
              ? 'CBO: Meta optimiza el presupuesto entre todos los conjuntos automáticamente.'
              : 'ABO: Define el presupuesto individualmente en cada conjunto de anuncios.'}
          </p>
        </div>
      )}

      {/* ── CONJUNTOS TAB ── */}
      {activeTab === 'adsets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {campaign.adsets.map((adset, adsetIdx) => (
            <AdSetBlock
              key={adsetIdx}
              adset={adset}
              adsetIdx={adsetIdx}
              campaignObjective={campaign.objective}
              campaignBudgetType={campaign.budgetType}
              onChange={(updated) => updateAdSet(adsetIdx, updated)}
              onRemove={() => removeAdSet(adsetIdx)}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...campaign, adsets: [...campaign.adsets, emptyAdSet()] })}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              border: '1px dashed hsl(215 15% 30%)',
              borderRadius: 7,
              color: 'hsl(215,15%,50%)',
              cursor: 'pointer',
              padding: '5px 12px',
              fontSize: '0.72rem',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Plus size={11} /> Agregar conjunto de anuncios
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────

export function StrategyFormModal({
  clients,
  strategy,
  draft,
  defaultClientId,
  saving = false,
  onClose,
  onSubmit,
}: Props) {
  const isEditing = Boolean(strategy);
  const base = draft ?? strategy ?? null;

  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState(() => ({
    client_id: base?.client_id ?? defaultClientId ?? '',
    title: base?.title ?? '',
    month: (base?.month ?? `${getCurrentMonthValue()}-01`).slice(0, 7),
    status: base?.status ?? 'pending',
    monthly_budget: base?.monthly_budget?.toString() ?? '',
    notes: base?.notes ?? '',
    ai_summary: base?.ai_summary ?? '',
    optimize_creatives_date: '',
    optimize_adsets_date: '',
    change_summary: '',
  }));

  const [campaigns, setCampaigns] = useState<CampaignFormState[]>(() =>
    toFormCampaigns(base?.campaigns),
  );

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasDraft, setHasDraft] = useState(() => {
    if (isEditing) return false;
    return Boolean(localStorage.getItem(DRAFT_KEY));
  });

  const hasMountedRef = useRef(false);
  const isDirtyRef = useRef(false);

  // Auto-save draft on every form/campaign change (new strategies only)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    isDirtyRef.current = true;
    if (!isEditing) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, campaigns }));
    }
  }, [form, campaigns, isEditing]);

  const canSave = useMemo(
    () => Boolean(form.client_id && form.title.trim() && form.month),
    [form.client_id, form.title, form.month],
  );

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCampaign(idx: number, updated: CampaignFormState) {
    setCampaigns((prev) => prev.map((c, i) => (i === idx ? updated : c)));
  }

  function removeCampaign(idx: number) {
    setCampaigns((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleClose() {
    if (isDirtyRef.current) {
      setShowExitConfirm(true);
      return;
    }
    onClose();
  }

  function confirmClose() {
    if (!isEditing) localStorage.removeItem(DRAFT_KEY);
    onClose();
  }

  function recoverDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      setHasDraft(false);
      return;
    }
    try {
      const saved = JSON.parse(raw) as { form: typeof form; campaigns: CampaignFormState[] };
      setForm(saved.form);
      setCampaigns(saved.campaigns);
    } catch {
      // ignore parse errors
    }
    setHasDraft(false);
  }

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  }

  async function handleSubmit() {
    if (!canSave) return;
    setErrorMessage('');

    const builtCampaigns = fromFormCampaigns(campaigns);
    console.log('[StrategyFormModal] PAYLOAD COMPLETO:', JSON.stringify({
      client_id: form.client_id,
      title: form.title.trim(),
      month: `${form.month}-01`,
      status: form.status,
      campaigns: builtCampaigns,
      campaigns_count: builtCampaigns.length,
      adsets_per_campaign: builtCampaigns.map((c) => ({
        campaign: c.name,
        adsets: c.adsets?.length ?? 0,
      })),
    }, null, 2));

    const result = await onSubmit(
      {
        client_id: form.client_id,
        title: form.title.trim(),
        month: `${form.month}-01`,
        status: form.status as StrategyInput['status'],
        monthly_budget: form.monthly_budget ? Number(form.monthly_budget) || 0 : null,
        responsible_id: strategy?.responsible_id ?? draft?.responsible_id ?? null,
        created_by: strategy?.created_by ?? draft?.created_by ?? null,
        campaigns_new: strategy?.campaigns_new ?? draft?.campaigns_new ?? [],
        campaigns_off: strategy?.campaigns_off ?? draft?.campaigns_off ?? [],
        campaigns_optimize: strategy?.campaigns_optimize ?? draft?.campaigns_optimize ?? [],
        segmentation: strategy?.segmentation ?? draft?.segmentation ?? {},
        creatives: strategy?.creatives ?? draft?.creatives ?? [],
        drive_links: strategy?.drive_links ?? draft?.drive_links ?? [],
        notes: form.notes.trim(),
        ai_summary: form.ai_summary,
        ai_checklist: strategy?.ai_checklist ?? draft?.ai_checklist ?? [],
        ai_diff: strategy?.ai_diff ?? draft?.ai_diff ?? null,
        raw_input: strategy?.raw_input ?? draft?.raw_input ?? null,
        campaigns: builtCampaigns,
        latest_version:
          strategy?.latest_version ?? strategy?.version ?? draft?.latest_version ?? 1,
      },
      {
        changeSummary: form.change_summary.trim() || null,
        optimizeCreativesDate: form.optimize_creatives_date || undefined,
        optimizeAdsetsDate: form.optimize_adsets_date || undefined,
      },
    );

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    if (!isEditing) localStorage.removeItem(DRAFT_KEY);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-box modal-large"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'hsl(220,22%,7%)',
          border: '1px solid hsl(180 100% 50% / 0.15)',
          boxShadow: '0 0 40px hsl(180 100% 50% / 0.06), 0 24px 80px rgba(0,0,0,0.6)',
          position: 'relative',
        }}
      >
        {/* Exit confirmation overlay */}
        {showExitConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              background: 'rgba(0,0,0,0.82)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <div
              style={{
                background: 'hsl(220,22%,10%)',
                border: '1px solid hsl(0 70% 50% / 0.3)',
                borderRadius: 10,
                padding: '24px 28px',
                maxWidth: 320,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <p style={{ fontSize: '0.88rem', color: 'hsl(215,15%,80%)', margin: 0 }}>
                Tienes cambios sin guardar.
                <br />
                ¿Descartar y salir?
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowExitConfirm(false)}
                >
                  Seguir editando
                </button>
                <button
                  type="button"
                  onClick={confirmClose}
                  style={{
                    padding: '7px 18px',
                    borderRadius: 7,
                    border: 'none',
                    background: 'hsl(0,70%,45%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Descartar y salir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div
          className="modal-header"
          style={{
            borderBottom: '1px solid hsl(180 100% 50% / 0.12)',
            background: 'hsl(180 100% 50% / 0.04)',
          }}
        >
          <div>
            <h2 className="modal-title" style={{ color: 'hsl(180,100%,60%)' }}>
              {isEditing ? 'Editar estrategia' : 'Nueva estrategia'}
            </h2>
            <p className="modal-subtitle" style={{ color: 'hsl(215,15%,48%)' }}>
              Estructura operativa · Growth Strategy
            </p>
          </div>
          <button className="modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="modal-body modal-scroll">

          {/* Draft recovery banner */}
          {hasDraft && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'hsl(180 100% 50% / 0.08)',
                border: '1px solid hsl(180 100% 50% / 0.2)',
                marginBottom: 4,
                gap: 10,
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'hsl(180,100%,70%)' }}>
                📝 Hay un borrador guardado. ¿Recuperarlo?
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={recoverDraft}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 5,
                    border: '1px solid hsl(180,100%,50%)',
                    background: 'hsl(180 100% 50% / 0.15)',
                    color: 'hsl(180,100%,70%)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  Recuperar
                </button>
                <button
                  type="button"
                  onClick={discardDraft}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: 'hsl(215,15%,50%)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Descartar
                </button>
              </div>
            </div>
          )}

          {/* ── 1: IDENTIFICACIÓN ── */}
          <SectionHeading label="IDENTIFICACIÓN" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Cliente *</label>
              <select
                value={form.client_id}
                onChange={(e) => setField('client_id', e.target.value)}
                style={INPUT_STYLE as React.CSSProperties}
              >
                <option value="">Selecciona un cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Nombre de la estrategia *</label>
              <input
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="Ej. Escalamiento abril – conversiones"
                style={INPUT_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Mes *</label>
              <input
                type="month"
                value={form.month}
                onChange={(e) => setField('month', e.target.value)}
                style={INPUT_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Estado inicial</label>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                style={INPUT_STYLE as React.CSSProperties}
              >
                <option value="pending">Pendiente</option>
                <option value="active">Activa</option>
              </select>
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Presupuesto mensual total</label>
              <input
                type="number"
                min="0"
                value={form.monthly_budget}
                onChange={(e) => setField('monthly_budget', e.target.value)}
                placeholder="25000000"
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* ── 2: CAMPAÑAS ── */}
          <SectionHeading label="CAMPAÑAS" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campaigns.map((camp, campIdx) => (
              <CampaignBlock
                key={campIdx}
                campaign={camp}
                campIdx={campIdx}
                onChange={(updated) => updateCampaign(campIdx, updated)}
                onRemove={() => removeCampaign(campIdx)}
              />
            ))}
            <button
              type="button"
              onClick={() => setCampaigns((prev) => [...prev, emptyCampaign()])}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: '1px solid hsl(180 100% 50% / 0.3)',
                borderRadius: 8,
                color: 'hsl(180,100%,55%)',
                cursor: 'pointer',
                padding: '7px 16px',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={13} /> Nueva campaña
            </button>
          </div>

          {/* ── 3: OPTIMIZACIÓN PROGRAMADA ── */}
          <SectionHeading label="OPTIMIZACIÓN PROGRAMADA" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Optimizar creativos</label>
              <input
                type="date"
                value={form.optimize_creatives_date}
                onChange={(e) => setField('optimize_creatives_date', e.target.value)}
                style={INPUT_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Optimizar conjuntos</label>
              <input
                type="date"
                value={form.optimize_adsets_date}
                onChange={(e) => setField('optimize_adsets_date', e.target.value)}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* ── 4: NOTAS ── */}
          <SectionHeading label="NOTAS" />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Resumen ejecutivo</label>
              <textarea
                rows={3}
                value={form.ai_summary}
                onChange={(e) => setField('ai_summary', e.target.value)}
                style={TEXTAREA_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Notas adicionales</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                style={TEXTAREA_STYLE}
              />
            </div>
          </div>

          {/* ── REGISTRO DE CAMBIO (solo edición) ── */}
          {isEditing && (
            <>
              <SectionHeading label="REGISTRO DE CAMBIO" />
              <div style={FIELD_STYLE}>
                <label style={LABEL_STYLE}>Resumen del cambio</label>
                <input
                  value={form.change_summary}
                  onChange={(e) => setField('change_summary', e.target.value)}
                  placeholder="Ej. Ajuste de presupuesto y segmentación"
                  style={INPUT_STYLE}
                />
              </div>
            </>
          )}

          {errorMessage && (
            <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'hsl(0,84%,65%)' }}>
              {errorMessage}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{ borderTop: '1px solid hsl(180 100% 50% / 0.1)' }}
        >
          <button className="btn-ghost" onClick={handleClose}>
            Cancelar
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSave || saving}
            style={{
              padding: '9px 24px',
              borderRadius: 8,
              border: 'none',
              cursor: canSave && !saving ? 'pointer' : 'not-allowed',
              background: 'hsl(180,100%,45%)',
              color: '#000',
              fontWeight: 700,
              fontSize: '0.8rem',
              letterSpacing: '0.06em',
              opacity: !canSave || saving ? 0.45 : 1,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {saving ? 'GUARDANDO...' : isEditing ? 'GUARDAR CAMBIOS' : 'CREAR ESTRATEGIA'}
          </button>
        </div>
      </div>
    </div>
  );
}
