import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  type: string;
  existingUrl: string;
}

interface AdSetFormState {
  adType: string;
  ageMin: number;
  ageMax: number;
  gender: 'all' | 'male' | 'female';
  locationsText: string;
  placements: string[];
  creatives: CreativeFormState[];
  chatRecommended: boolean;
}

interface CampaignFormState {
  name: string;
  budget: string;
  budgetType: 'ABO' | 'CBO';
  objective: string;
  adsets: AdSetFormState[];
}

// ─── Constants ────────────────────────────────────────────────────────────

const AGE_OPTIONS = [18, 24, 25, 34, 35, 44, 45, 54, 55, 65];
const PLACEMENTS = ['Feed', 'Reels', 'Stories', 'Explore', 'Messenger', 'Audience Network'];
const AD_TYPES = ['Video', 'Imagen', 'Carrusel', 'Reel', 'Colección'];
const OBJECTIVES = ['General', 'Reconocimiento', 'Tráfico', 'Interacción', 'Ventas'];

// ─── Empty factories ───────────────────────────────────────────────────────

function emptyCreative(): CreativeFormState {
  return { description: '', type: '', existingUrl: '' };
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
    chatRecommended: false,
  };
}

function emptyCampaign(): CampaignFormState {
  return {
    name: '',
    budget: '',
    budgetType: 'CBO',
    objective: 'General',
    adsets: [emptyAdSet()],
  };
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
          type: cr.type ?? '',
          existingUrl: cr.existingUrl ?? '',
        })) ?? [emptyCreative()],
      chatRecommended: a.chatRecommended ?? false,
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
            .filter((cr) => cr.description || cr.type || cr.existingUrl)
            .map(
              (cr): CreativeFormEntry => ({
                description: cr.description || undefined,
                type: cr.type || undefined,
                existingUrl: cr.existingUrl || undefined,
              }),
            ),
          chatRecommended: a.chatRecommended,
        }),
      ),
    }));
}

function parseCampaignLines(
  value: string,
  mode: 'new' | 'off' | 'optimize',
): StrategyInput['campaigns_new'] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((part) => part.trim()))
    .map((parts) => {
      if (mode === 'new') {
        const [name, objective, budget, audience, notes] = parts;
        return {
          name,
          objective: objective || undefined,
          budget: budget ? Number(budget) || 0 : undefined,
          audience: audience || undefined,
          notes: notes || undefined,
        };
      }
      if (mode === 'off') {
        const [name, reason] = parts;
        return { name, reason: reason || undefined };
      }
      const [name, action, priority] = parts;
      return { name, action: action || undefined, priority: priority || undefined };
    })
    .filter((entry) => entry.name);
}

function serializeCampaignLines(
  entries: Strategy['campaigns_new'],
  mode: 'new' | 'off' | 'optimize',
): string {
  return entries
    .map((entry) => {
      if (mode === 'new') {
        return [
          entry.name,
          entry.objective ?? '',
          entry.budget ?? '',
          entry.audience ?? '',
          entry.notes ?? '',
        ].join(' | ');
      }
      if (mode === 'off') return [entry.name, entry.reason ?? ''].join(' | ');
      return [entry.name, entry.action ?? '', entry.priority ?? ''].join(' | ');
    })
    .join('\n');
}

function parseCreativeLines(value: string): StrategyInput['creatives'] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((part) => part.trim()))
    .map(([type, description, link]) => ({
      type: type || undefined,
      description: description || undefined,
      link: link || undefined,
    }))
    .filter((entry) => entry.type || entry.description || entry.link);
}

function serializeCreativeLines(entries: Strategy['creatives']): string {
  return entries
    .map((entry) => [entry.type ?? '', entry.description ?? '', entry.link ?? ''].join(' | '))
    .join('\n');
}

function parseDriveLines(value: string): StrategyInput['drive_links'] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((part) => part.trim()))
    .map(([label, url]) => ({ label, url }))
    .filter((entry) => entry.label && entry.url);
}

function serializeDriveLines(entries: Strategy['drive_links']): string {
  return entries.map((entry) => [entry.label, entry.url].join(' | ')).join('\n');
}

function parseChecklistLines(value: string): StrategyInput['ai_checklist'] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((part) => part.trim()))
    .map(([task, priority, notes, done]) => ({
      task,
      priority: priority || undefined,
      notes: notes || undefined,
      done: ['true', '1', 'si', 'yes', 'done'].includes((done ?? '').toLowerCase()),
    }))
    .filter((entry) => entry.task);
}

function serializeChecklistLines(entries: Strategy['ai_checklist']): string {
  return entries
    .map((entry) =>
      [entry.task, entry.priority ?? '', entry.notes ?? '', entry.done ? 'done' : '']
        .join(' | ')
        .trim(),
    )
    .join('\n');
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

// ─── Age range pills ──────────────────────────────────────────────────────

function AgePills({
  ageMin,
  ageMax,
  onChange,
}: {
  ageMin: number;
  ageMax: number;
  onChange: (min: number, max: number) => void;
}) {
  function handleClick(age: number) {
    const mid = (ageMin + ageMax) / 2;
    if (age <= mid) {
      onChange(age, ageMax < age ? age : ageMax);
    } else {
      onChange(ageMin > age ? age : ageMin, age);
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {AGE_OPTIONS.map((age) => {
        const inRange = age >= ageMin && age <= ageMax;
        const isEndpoint = age === ageMin || age === ageMax;
        return (
          <button
            key={age}
            type="button"
            onClick={() => handleClick(age)}
            style={{
              padding: '3px 8px',
              borderRadius: 5,
              fontSize: '0.72rem',
              fontFamily: 'JetBrains Mono, monospace',
              border: isEndpoint
                ? '1px solid hsl(180,100%,50%)'
                : inRange
                  ? '1px solid hsl(180 100% 50% / 0.35)'
                  : '1px solid rgba(255,255,255,0.1)',
              background: isEndpoint
                ? 'hsl(180 100% 50% / 0.18)'
                : inRange
                  ? 'hsl(180 100% 50% / 0.07)'
                  : 'transparent',
              color: inRange ? 'hsl(180,100%,70%)' : 'hsl(215,15%,50%)',
              cursor: 'pointer',
              fontWeight: isEndpoint ? 700 : 400,
            }}
          >
            {age}
          </button>
        );
      })}
      <span
        style={{
          fontSize: '0.72rem',
          color: 'hsl(180,100%,55%)',
          fontFamily: 'JetBrains Mono, monospace',
          alignSelf: 'center',
          marginLeft: 4,
        }}
      >
        {ageMin}–{ageMax}
      </span>
    </div>
  );
}

// ─── Generic pill toggle ──────────────────────────────────────────────────

function PillToggle({
  options,
  active,
  onToggle,
  single,
}: {
  options: string[];
  active: string | string[];
  onToggle: (value: string) => void;
  single?: boolean;
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
      {single && null}
    </div>
  );
}

// ─── Creative row ──────────────────────────────────────────────────────────

function CreativeRow({
  creative,
  index,
  onChange,
  onRemove,
}: {
  creative: CreativeFormState;
  index: number;
  onChange: (field: keyof CreativeFormState, value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr auto',
        gap: 6,
        alignItems: 'center',
      }}
    >
      <input
        value={creative.type}
        onChange={(e) => onChange('type', e.target.value)}
        placeholder={`Tipo ${index + 1}`}
        style={{ ...INPUT_STYLE, fontSize: '0.78rem', padding: '5px 8px' }}
      />
      <input
        value={creative.description}
        onChange={(e) => onChange('description', e.target.value)}
        placeholder="Descripción"
        style={{ ...INPUT_STYLE, fontSize: '0.78rem', padding: '5px 8px' }}
      />
      <input
        value={creative.existingUrl}
        onChange={(e) => onChange('existingUrl', e.target.value)}
        placeholder="URL existente"
        style={{ ...INPUT_STYLE, fontSize: '0.78rem', padding: '5px 8px' }}
      />
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
        <Trash2 size={13} />
      </button>
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

  function updateCreative(crIdx: number, field: keyof CreativeFormState, value: string) {
    const next = adset.creatives.map((cr, i) => (i === crIdx ? { ...cr, [field]: value } : cr));
    set('creatives', next);
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
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
          single
          onToggle={(v) => set('adType', adset.adType === v ? '' : v)}
        />
      </div>

      {/* Age range */}
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Rango de edad</label>
        <AgePills
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
          single
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

      {/* Creatives */}
      <div style={FIELD_STYLE}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
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
        {/* Headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: 6,
            paddingRight: 24,
          }}
        >
          {['Tipo', 'Descripción', 'URL existente'].map((h) => (
            <span key={h} style={{ ...LABEL_STYLE, fontSize: '0.62rem' }}>
              {h}
            </span>
          ))}
        </div>
        {adset.creatives.map((cr, crIdx) => (
          <CreativeRow
            key={crIdx}
            creative={cr}
            index={crIdx}
            onChange={(field, value) => updateCreative(crIdx, field, value)}
            onRemove={() => removeCreative(crIdx)}
          />
        ))}
      </div>

      {/* Chat recommended */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={adset.chatRecommended}
          onChange={(e) => set('chatRecommended', e.target.checked)}
          style={{ accentColor: 'hsl(180,100%,50%)', width: 14, height: 14 }}
        />
        <span style={{ fontSize: '0.75rem', color: 'hsl(215,15%,55%)' }}>
          <MessageCircle size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Recomendado por chat
        </span>
      </label>
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
      {/* Campaign header */}
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
          <label style={LABEL_STYLE}>Tipo</label>
          <PillToggle
            options={['ABO', 'CBO']}
            active={campaign.budgetType}
            single
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
    raw_input: base?.raw_input ?? '',
    campaigns_off: serializeCampaignLines(base?.campaigns_off ?? [], 'off'),
    campaigns_optimize: serializeCampaignLines(base?.campaigns_optimize ?? [], 'optimize'),
    creatives: serializeCreativeLines(base?.creatives ?? []),
    drive_links: serializeDriveLines(base?.drive_links ?? []),
    ai_checklist: serializeChecklistLines(base?.ai_checklist ?? []),
    optimize_creatives_date: '',
    optimize_adsets_date: '',
    change_summary: '',
  }));

  const [campaigns, setCampaigns] = useState<CampaignFormState[]>(() =>
    toFormCampaigns(base?.campaigns),
  );

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

  async function handleSubmit() {
    if (!canSave) return;
    setErrorMessage('');

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
        campaigns_off: parseCampaignLines(form.campaigns_off, 'off'),
        campaigns_optimize: parseCampaignLines(form.campaigns_optimize, 'optimize'),
        segmentation: strategy?.segmentation ?? draft?.segmentation ?? {},
        creatives: parseCreativeLines(form.creatives),
        drive_links: parseDriveLines(form.drive_links),
        notes: form.notes.trim(),
        ai_summary: form.ai_summary,
        ai_checklist: parseChecklistLines(form.ai_checklist),
        ai_diff: strategy?.ai_diff ?? draft?.ai_diff ?? null,
        raw_input: form.raw_input,
        campaigns: fromFormCampaigns(campaigns),
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
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-large"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'hsl(220,22%,7%)',
          border: '1px solid hsl(180 100% 50% / 0.15)',
          boxShadow: '0 0 40px hsl(180 100% 50% / 0.06), 0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
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
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body modal-scroll">

          {/* ── SECCIÓN 1: IDENTIFICACIÓN ── */}
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
                <option value="mounted">Montada</option>
                <option value="reviewed">Revisada</option>
                <option value="approved">Aprobada</option>
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

          {/* ── SECCIÓN 2: CAMPAÑAS ── */}
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

          {/* ── SECCIÓN 3: CAMPAÑAS OFF / OPTIMIZAR ── */}
          <SectionHeading label="CAMPAÑAS OFF / OPTIMIZAR" />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>
                Campañas a apagar —{' '}
                <span style={{ color: 'hsl(215,15%,40%)' }}>Nombre | Razón</span>
              </label>
              <textarea
                rows={3}
                value={form.campaigns_off}
                onChange={(e) => setField('campaigns_off', e.target.value)}
                placeholder="Campaña ventas mayo | bajo rendimiento"
                style={TEXTAREA_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>
                Campañas a optimizar —{' '}
                <span style={{ color: 'hsl(215,15%,40%)' }}>Nombre | Acción | Prioridad</span>
              </label>
              <textarea
                rows={3}
                value={form.campaigns_optimize}
                onChange={(e) => setField('campaigns_optimize', e.target.value)}
                placeholder="Retargeting | Reducir CPM | alta"
                style={TEXTAREA_STYLE}
              />
            </div>
          </div>

          {/* ── SECCIÓN 4: OPTIMIZACIÓN PROGRAMADA ── */}
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

          {/* ── SECCIÓN 5: NOTAS ── */}
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

          {/* ── SECCIÓN 6: RECURSOS ── */}
          <SectionHeading label="RECURSOS" />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={FIELD_STYLE}>
                <label style={LABEL_STYLE}>
                  Creativos —{' '}
                  <span style={{ color: 'hsl(215,15%,40%)' }}>Tipo | Desc | Link</span>
                </label>
                <textarea
                  rows={3}
                  value={form.creatives}
                  onChange={(e) => setField('creatives', e.target.value)}
                  placeholder="Video | Testimonio cliente | https://..."
                  style={TEXTAREA_STYLE}
                />
              </div>
              <div style={FIELD_STYLE}>
                <label style={LABEL_STYLE}>
                  Links de Drive —{' '}
                  <span style={{ color: 'hsl(215,15%,40%)' }}>Label | URL</span>
                </label>
                <textarea
                  rows={3}
                  value={form.drive_links}
                  onChange={(e) => setField('drive_links', e.target.value)}
                  placeholder="Brief | https://drive.google.com/..."
                  style={TEXTAREA_STYLE}
                />
              </div>
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>
                Checklist operativo —{' '}
                <span style={{ color: 'hsl(215,15%,40%)' }}>Tarea | prioridad | notas | done</span>
              </label>
              <textarea
                rows={4}
                value={form.ai_checklist}
                onChange={(e) => setField('ai_checklist', e.target.value)}
                placeholder={`Subir creativos | alta | | \nConfigurar píxel | media | | done`}
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
          <button className="btn-ghost" onClick={onClose}>
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
