import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdSetEntry,
  Client,
  CreativeFormEntry,
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

interface CreativeFormState {
  description: string;
  publicationType: 'nueva' | 'existente';
  existingUrl: string;
  notes: string;
  imageBase64: string;
  imageFilename: string;
}

interface AdSetFormState {
  adType: string;
  ageMin: number;
  ageMax: number;
  gender: 'all' | 'male' | 'female';
  locationsText: string;
  placements: string[];
  creatives: CreativeFormState[];
  welcomeMessage: string;
  interests: string;
  behaviors: string;
  customAudiences: string;
  lookalikeAudiences: string;
  exclusions: string;
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
const OBJECTIVES = ['General', 'Reconocimiento', 'Tráfico', 'Interacción', 'Ventas'];
const AGE_OPTIONS_MIN = Array.from({ length: 48 }, (_, i) => 18 + i); // 18–65
const AGE_OPTIONS_MAX = Array.from({ length: 46 }, (_, i) => 20 + i); // 20–65

const DRAFT_KEY = 'strategy_draft';

// ─── Empty factories ───────────────────────────────────────────────────────

function emptyCreative(): CreativeFormState {
  return {
    description: '',
    publicationType: 'nueva',
    existingUrl: '',
    notes: '',
    imageBase64: '',
    imageFilename: '',
  };
}

function emptyAdSet(): AdSetFormState {
  return {
    adType: '',
    ageMin: 18,
    ageMax: 65,
    gender: 'all',
    locationsText: '',
    placements: [],
    creatives: [emptyCreative()],
    welcomeMessage: '',
    interests: '',
    behaviors: '',
    customAudiences: '',
    lookalikeAudiences: '',
    exclusions: '',
  };
}

function emptyCampaign(): CampaignFormState {
  return { name: '', budget: '', budgetType: 'CBO', objective: 'General', adsets: [emptyAdSet()] };
}

// ─── Converters ───────────────────────────────────────────────────────────

function toFormCampaigns(campaigns?: StrategyCampaign[] | null): CampaignFormState[] {
  if (!campaigns?.length) return [];
  return campaigns.map((c) => ({
    name: c.name,
    budget: c.budget?.toString() ?? '',
    budgetType: c.budgetType ?? 'CBO',
    objective: c.objective ?? 'General',
    adsets: (c.adsets ?? []).map((a) => ({
      adType: a.adType ?? '',
      ageMin: a.ageMin ?? 18,
      ageMax: a.ageMax ?? 65,
      gender: a.gender ?? 'all',
      locationsText: (a.locations ?? []).join(', '),
      placements: a.placements ?? [],
      creatives:
        a.creatives?.map((cr) => ({
          description: cr.description ?? '',
          publicationType: (cr.publicationType ?? 'nueva') as 'nueva' | 'existente',
          existingUrl: cr.existingUrl ?? '',
          notes: cr.notes ?? '',
          imageBase64: cr.imageBase64 ?? '',
          imageFilename: cr.imageBase64 ? 'imagen_guardada' : '',
        })) ?? [emptyCreative()],
      welcomeMessage: a.welcomeMessage ?? '',
      interests: a.interests ?? '',
      behaviors: a.behaviors ?? '',
      customAudiences: a.customAudiences ?? '',
      lookalikeAudiences: a.lookalikeAudiences ?? '',
      exclusions: a.exclusions ?? '',
    })),
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
      adsets: c.adsets.map(
        (a): AdSetEntry => ({
          adType: a.adType || undefined,
          ageMin: a.ageMin,
          ageMax: a.ageMax,
          gender: a.gender,
          locations: a.locationsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          placements: a.placements,
          creatives: a.creatives
            .filter((cr) => cr.description || cr.existingUrl || cr.notes || cr.imageBase64)
            .map(
              (cr): CreativeFormEntry => ({
                description: cr.description || undefined,
                publicationType: cr.publicationType,
                existingUrl:
                  cr.publicationType === 'existente' ? cr.existingUrl || undefined : undefined,
                notes: cr.notes || undefined,
                imageBase64: cr.imageBase64 || undefined,
              }),
            ),
          welcomeMessage: a.welcomeMessage || undefined,
          interests: a.interests || undefined,
          behaviors: a.behaviors || undefined,
          customAudiences: a.customAudiences || undefined,
          lookalikeAudiences: a.lookalikeAudiences || undefined,
          exclusions: a.exclusions || undefined,
        }),
      ),
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

// ─── Creative card ────────────────────────────────────────────────────────

function CreativeCard({
  creative,
  index,
  onChange,
  onRemove,
}: {
  creative: CreativeFormState;
  index: number;
  onChange: (updated: CreativeFormState) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof CreativeFormState>(field: K, value: CreativeFormState[K]) {
    onChange({ ...creative, [field]: value });
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
      onChange({ ...creative, imageBase64: reader.result as string, imageFilename: file.name });
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
          CREATIVO {index + 1}
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

      {/* Description */}
      <textarea
        rows={2}
        value={creative.description}
        onChange={(e) => set('description', e.target.value)}
        placeholder="Describe el creativo: qué se muestra, mensaje principal, formato..."
        style={{ ...TEXTAREA_STYLE, fontSize: '0.8rem' }}
      />

      {/* Publication type pills */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['nueva', 'existente'] as const).map((t) => {
          const isActive = creative.publicationType === t;
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

      {/* URL — only when existente */}
      {creative.publicationType === 'existente' && (
        <input
          value={creative.existingUrl}
          onChange={(e) => set('existingUrl', e.target.value)}
          placeholder="https://www.facebook.com/permalink/..."
          style={{ ...INPUT_STYLE, fontSize: '0.78rem' }}
        />
      )}

      {/* Notes */}
      <input
        value={creative.notes}
        onChange={(e) => set('notes', e.target.value)}
        placeholder="Indicaciones adicionales para este creativo..."
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
        {creative.imageBase64 ? (
          <>
            <img
              src={creative.imageBase64}
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
                {creative.imageFilename}
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...creative, imageBase64: '', imageFilename: '' })}
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
    </div>
  );
}

// ─── Adset block ──────────────────────────────────────────────────────────

function AdSetBlock({
  adset,
  adsetIdx,
  onChange,
  onRemove,
}: {
  adset: AdSetFormState;
  adsetIdx: number;
  onChange: (updated: AdSetFormState) => void;
  onRemove: () => void;
}) {
  function set<K extends keyof AdSetFormState>(field: K, value: AdSetFormState[K]) {
    onChange({ ...adset, [field]: value });
  }

  function togglePlacement(p: string) {
    const next = adset.placements.includes(p)
      ? adset.placements.filter((x) => x !== p)
      : [...adset.placements, p];
    set('placements', next);
  }

  function updateCreative(crIdx: number, updated: CreativeFormState) {
    set(
      'creatives',
      adset.creatives.map((cr, i) => (i === crIdx ? updated : cr)),
    );
  }

  function removeCreative(crIdx: number) {
    set(
      'creatives',
      adset.creatives.filter((_, i) => i !== crIdx),
    );
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'hsl(215,15%,45%)',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.08em',
          }}
        >
          CONJUNTO {adsetIdx + 1}
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
          active={adset.adType}
          onToggle={(v) => set('adType', adset.adType === v ? '' : v)}
        />
      </div>

      {/* Age range */}
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Rango de edad</label>
        <AgeDropdowns
          ageMin={adset.ageMin}
          ageMax={adset.ageMax}
          onChange={(min, max) => onChange({ ...adset, ageMin: min, ageMax: max })}
        />
      </div>

      {/* Gender */}
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Género</label>
        <PillToggle
          options={['Todos', 'Hombres', 'Mujeres']}
          active={
            adset.gender === 'all' ? 'Todos' : adset.gender === 'male' ? 'Hombres' : 'Mujeres'
          }
          onToggle={(v) =>
            set('gender', v === 'Todos' ? 'all' : v === 'Hombres' ? 'male' : 'female')
          }
        />
      </div>

      {/* Locations */}
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Ciudades / ubicaciones</label>
        <input
          value={adset.locationsText}
          onChange={(e) => set('locationsText', e.target.value)}
          placeholder="Bogotá, Medellín, Cali"
          style={{ ...INPUT_STYLE, fontSize: '0.8rem' }}
        />
      </div>

      {/* Placements */}
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Ubicaciones de pauta</label>
        <PillToggle options={PLACEMENTS} active={adset.placements} onToggle={togglePlacement} />
      </div>

      {/* Segmentation grid */}
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
          <label style={{ ...LABEL_STYLE, color: 'hsl(180,100%,60%)' }}>Comportamientos</label>
          <textarea
            rows={2}
            value={adset.behaviors}
            onChange={(e) => set('behaviors', e.target.value)}
            placeholder="Compradores activos, Viajeros frecuentes..."
            style={{ ...TEXTAREA_STYLE, fontSize: '0.75rem' }}
          />
        </div>
        <div style={FIELD_STYLE}>
          <label style={{ ...LABEL_STYLE, color: 'hsl(180,100%,60%)' }}>Audiencias personalizadas</label>
          <textarea
            rows={2}
            value={adset.customAudiences}
            onChange={(e) => set('customAudiences', e.target.value)}
            placeholder="Clientes actuales, Lista de emails..."
            style={{ ...TEXTAREA_STYLE, fontSize: '0.75rem' }}
          />
        </div>
        <div style={FIELD_STYLE}>
          <label style={{ ...LABEL_STYLE, color: 'hsl(180,100%,60%)' }}>Audiencias similares</label>
          <textarea
            rows={2}
            value={adset.lookalikeAudiences}
            onChange={(e) => set('lookalikeAudiences', e.target.value)}
            placeholder="Lookalike 1% compradores..."
            style={{ ...TEXTAREA_STYLE, fontSize: '0.75rem' }}
          />
        </div>
      </div>

      {/* Creatives */}
      <div style={FIELD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={LABEL_STYLE}>Creativos</label>
          <button
            type="button"
            onClick={() => set('creatives', [...adset.creatives, emptyCreative()])}
            style={{
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
            <Plus size={10} /> Creativo
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {adset.creatives.map((cr, crIdx) => (
            <CreativeCard
              key={crIdx}
              creative={cr}
              index={crIdx}
              onChange={(updated) => updateCreative(crIdx, updated)}
              onRemove={() => removeCreative(crIdx)}
            />
          ))}
        </div>
      </div>

      {/* Welcome message */}
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>💬 Ejemplo de mensaje de bienvenida</label>
        <textarea
          rows={2}
          value={adset.welcomeMessage}
          onChange={(e) => set('welcomeMessage', e.target.value)}
          placeholder="Escribe aquí el mensaje que se enviará al prospecto cuando inicie la conversación..."
          style={{ ...TEXTAREA_STYLE, fontSize: '0.78rem' }}
        />
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
          style={{ ...TEXTAREA_STYLE, fontSize: '0.78rem', borderColor: 'hsl(38 100% 50% / 0.2)' }}
        />
      </div>
    </div>
  );
}

// ─── Campaign block ───────────────────────────────────────────────────────

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            color: 'hsl(180,100%,50%)',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.1em',
          }}
        >
          CAMPAÑA {campIdx + 1}
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
          <Trash2 size={14} />
        </button>
      </div>

      {/* Name + objective */}
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
          <label style={LABEL_STYLE}>Objetivo</label>
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

      {/* Budget + budgetType */}
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
          <label style={LABEL_STYLE}>Tipo presupuesto</label>
          <PillToggle
            options={['ABO', 'CBO']}
            active={campaign.budgetType}
            onToggle={(v) => set('budgetType', v as 'ABO' | 'CBO')}
          />
        </div>
      </div>

      {/* Adsets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {campaign.adsets.map((adset, adsetIdx) => (
          <AdSetBlock
            key={adsetIdx}
            adset={adset}
            adsetIdx={adsetIdx}
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

  // Auto-save draft on every form/campaign change (new strategies only); mark dirty always
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
    if (!raw) { setHasDraft(false); return; }
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
        latest_version: strategy?.latest_version ?? strategy?.version ?? draft?.latest_version ?? 1,
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
