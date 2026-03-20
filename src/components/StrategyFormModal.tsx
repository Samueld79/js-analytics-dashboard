import { useMemo, useState } from 'react';
import type {
  Client,
  ServiceMutationResult,
  Strategy,
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

function getCurrentMonthValue(): string {
  return new Date().toISOString().slice(0, 7);
}

function csv(value: string[]): string {
  return value.join(', ');
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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
        return {
          name,
          reason: reason || undefined,
        };
      }

      const [name, action, priority] = parts;
      return {
        name,
        action: action || undefined,
        priority: priority || undefined,
      };
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

      if (mode === 'off') {
        return [entry.name, entry.reason ?? ''].join(' | ');
      }

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

// ── Section heading for the modal ────────────────────────────────────────────
function SectionHeading({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '18px 0 12px',
    }}>
      <span style={{
        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em',
        color: 'hsl(180,100%,50%)', fontFamily: 'JetBrains Mono',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'hsl(180 100% 50% / 0.12)' }} />
    </div>
  );
}

const FIELD_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

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
  transition: 'border-color 0.15s',
};

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  resize: 'vertical' as const,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.78rem',
  lineHeight: 1.5,
};

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
    objective: inferObjectiveFromText(`${base?.title ?? ''} ${base?.notes ?? ''}`),
    notes: base?.notes ?? '',
    ai_summary: base?.ai_summary ?? '',
    raw_input: base?.raw_input ?? '',
    segmentation_ages: base?.segmentation.ages ?? '',
    segmentation_cities: csv(base?.segmentation.cities ?? []),
    segmentation_audiences: csv(base?.segmentation.audiences ?? []),
    segmentation_exclusions: csv(base?.segmentation.exclusions ?? []),
    campaigns_new: serializeCampaignLines(base?.campaigns_new ?? [], 'new'),
    campaigns_off: serializeCampaignLines(base?.campaigns_off ?? [], 'off'),
    campaigns_optimize: serializeCampaignLines(base?.campaigns_optimize ?? [], 'optimize'),
    creatives: serializeCreativeLines(base?.creatives ?? []),
    drive_links: serializeDriveLines(base?.drive_links ?? []),
    ai_checklist: serializeChecklistLines(base?.ai_checklist ?? []),
    optimize_creatives_date: '',
    optimize_adsets_date: '',
    change_summary: '',
  }));

  const canSave = useMemo(
    () => Boolean(form.client_id && form.title.trim() && form.month),
    [form.client_id, form.title, form.month],
  );

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
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
        campaigns_new: parseCampaignLines(form.campaigns_new, 'new'),
        campaigns_off: parseCampaignLines(form.campaigns_off, 'off'),
        campaigns_optimize: parseCampaignLines(form.campaigns_optimize, 'optimize'),
        segmentation: {
          ages: form.segmentation_ages.trim() || undefined,
          cities: parseCsv(form.segmentation_cities),
          audiences: parseCsv(form.segmentation_audiences),
          exclusions: parseCsv(form.segmentation_exclusions),
        },
        creatives: parseCreativeLines(form.creatives),
        drive_links: parseDriveLines(form.drive_links),
        notes: form.notes.trim(),
        ai_summary: form.ai_summary,
        ai_checklist: parseChecklistLines(form.ai_checklist),
        ai_diff: strategy?.ai_diff ?? draft?.ai_diff ?? null,
        raw_input: form.raw_input,
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
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body modal-scroll">

          {/* ── SECCIÓN 1: Identificación ── */}
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
                  <option key={client.id} value={client.id}>{client.name}</option>
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
              <label style={LABEL_STYLE}>Presupuesto mensual</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_budget}
                onChange={(e) => setField('monthly_budget', e.target.value)}
                placeholder="25000000"
                style={INPUT_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Objetivo principal</label>
              <select
                value={form.objective}
                onChange={(e) => setField('objective', e.target.value)}
                style={INPUT_STYLE as React.CSSProperties}
              >
                <option value="General">General</option>
                <option value="Reconocimiento">Reconocimiento</option>
                <option value="Tráfico">Tráfico</option>
                <option value="Interacción">Interacción</option>
                <option value="Ventas">Ventas</option>
              </select>
            </div>
          </div>

          {/* ── SECCIÓN 2: Período y estado ── */}
          <SectionHeading label="PERÍODO Y ESTADO" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
          </div>

          {/* ── SECCIÓN 3: Descripción ── */}
          <SectionHeading label="DESCRIPCIÓN" />
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

          {/* ── SECCIÓN 4: Optimización ── */}
          <SectionHeading label="OPTIMIZACIÓN PROGRAMADA" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>📅 Optimizar creativos</label>
              <input
                type="date"
                value={form.optimize_creatives_date}
                onChange={(e) => setField('optimize_creatives_date', e.target.value)}
                style={INPUT_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>📅 Optimizar conjuntos</label>
              <input
                type="date"
                value={form.optimize_adsets_date}
                onChange={(e) => setField('optimize_adsets_date', e.target.value)}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* ── SECCIÓN 5: Campañas y creativos ── */}
          <SectionHeading label="CAMPAÑAS Y CREATIVOS" />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Campañas off — <span style={{ color: 'hsl(215,15%,40%)' }}>Nombre | Razón</span></label>
              <textarea
                rows={3}
                value={form.campaigns_off}
                onChange={(e) => setField('campaigns_off', e.target.value)}
                placeholder="Campaña ventas mayo | bajo rendimiento"
                style={TEXTAREA_STYLE}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Campañas a optimizar — <span style={{ color: 'hsl(215,15%,40%)' }}>Nombre | Acción | Prioridad</span></label>
              <textarea
                rows={3}
                value={form.campaigns_optimize}
                onChange={(e) => setField('campaigns_optimize', e.target.value)}
                placeholder="Retargeting | Reducir CPM | alta"
                style={TEXTAREA_STYLE}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={FIELD_STYLE}>
                <label style={LABEL_STYLE}>Creativos — <span style={{ color: 'hsl(215,15%,40%)' }}>Tipo | Desc | Link</span></label>
                <textarea
                  rows={3}
                  value={form.creatives}
                  onChange={(e) => setField('creatives', e.target.value)}
                  placeholder="Video | Testimonio cliente | https://..."
                  style={TEXTAREA_STYLE}
                />
              </div>
              <div style={FIELD_STYLE}>
                <label style={LABEL_STYLE}>Links de Drive — <span style={{ color: 'hsl(215,15%,40%)' }}>Label | URL</span></label>
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
              <label style={LABEL_STYLE}>Checklist operativo — <span style={{ color: 'hsl(215,15%,40%)' }}>Tarea | prioridad | notas | done</span></label>
              <textarea
                rows={4}
                value={form.ai_checklist}
                onChange={(e) => setField('ai_checklist', e.target.value)}
                placeholder="Subir creativos | alta | | &#10;Configurar píxel | media | | done"
                style={TEXTAREA_STYLE}
              />
            </div>
          </div>

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
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSave || saving}
            style={{
              padding: '9px 24px',
              borderRadius: 8,
              border: 'none',
              cursor: canSave && !saving ? 'pointer' : 'not-allowed',
              background: canSave && !saving ? 'hsl(180,100%,45%)' : 'hsl(180,100%,45%)',
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

function inferObjectiveFromText(text: string): string {
  const t = text.toUpperCase();
  if (t.includes('RECON')) return 'Reconocimiento';
  if (t.includes('TRAFI')) return 'Tráfico';
  if (t.includes('INTER') || t.includes('ENGAGE')) return 'Interacción';
  if (t.includes('VENT') || t.includes('CONVER')) return 'Ventas';
  return 'General';
}
