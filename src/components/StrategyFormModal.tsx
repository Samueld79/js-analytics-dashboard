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
    options?: { changeSummary?: string | null },
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
        notes: form.notes,
        ai_summary: form.ai_summary,
        ai_checklist: parseChecklistLines(form.ai_checklist),
        ai_diff: strategy?.ai_diff ?? draft?.ai_diff ?? null,
        raw_input: form.raw_input,
        latest_version: strategy?.latest_version ?? strategy?.version ?? draft?.latest_version ?? 1,
      },
      {
        changeSummary: form.change_summary.trim() || null,
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
      <div className="modal-box modal-large" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {isEditing ? 'Editar estrategia' : 'Nueva estrategia'}
            </h2>
            <p className="modal-subtitle">Estructura operativa lista para guardar en Supabase</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body modal-scroll">
          <div className="form-row-2">
            <div className="form-field required">
              <label>Cliente</label>
              <select
                className="form-select"
                value={form.client_id}
                onChange={(event) => setField('client_id', event.target.value)}
              >
                <option value="">Selecciona un cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row-2">
              <div className="form-field required">
                <label>Mes</label>
                <input
                  type="month"
                  className="form-input"
                  value={form.month}
                  onChange={(event) => setField('month', event.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Estado</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(event) => setField('status', event.target.value)}
                >
                  <option value="pending">Pendiente</option>
                  <option value="mounted">Montada</option>
                  <option value="reviewed">Revisada</option>
                  <option value="approved">Aprobada</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field required">
              <label>Titulo</label>
              <input
                className="form-input"
                value={form.title}
                onChange={(event) => setField('title', event.target.value)}
                placeholder="Ej. Escalamiento abril - conversiones"
              />
            </div>
            <div className="form-field">
              <label>Presupuesto mensual</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={form.monthly_budget}
                onChange={(event) => setField('monthly_budget', event.target.value)}
                placeholder="25000000"
              />
            </div>
          </div>

          <div className="form-field">
            <label>Resumen ejecutivo / ai_summary</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.ai_summary}
              onChange={(event) => setField('ai_summary', event.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Notas</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Texto original / raw_input</label>
            <textarea
              className="form-textarea strategy-code-textarea"
              rows={4}
              value={form.raw_input}
              onChange={(event) => setField('raw_input', event.target.value)}
              placeholder="Texto libre del estratega"
            />
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Edades</label>
              <input
                className="form-input"
                value={form.segmentation_ages}
                onChange={(event) => setField('segmentation_ages', event.target.value)}
                placeholder="25-44"
              />
            </div>
            <div className="form-field">
              <label>Ciudades</label>
              <input
                className="form-input"
                value={form.segmentation_cities}
                onChange={(event) => setField('segmentation_cities', event.target.value)}
                placeholder="Bogota, Medellin"
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Publicos</label>
              <input
                className="form-input"
                value={form.segmentation_audiences}
                onChange={(event) => setField('segmentation_audiences', event.target.value)}
                placeholder="Lookalike compradores, Intereses nicho"
              />
            </div>
            <div className="form-field">
              <label>Exclusiones</label>
              <input
                className="form-input"
                value={form.segmentation_exclusions}
                onChange={(event) => setField('segmentation_exclusions', event.target.value)}
                placeholder="Compradores 7 dias, Empleados"
              />
            </div>
          </div>

          <div className="form-field">
            <label>Campanas nuevas</label>
            <textarea
              className="form-textarea strategy-code-textarea"
              rows={4}
              value={form.campaigns_new}
              onChange={(event) => setField('campaigns_new', event.target.value)}
              placeholder="Nombre | Objetivo | Budget | Publico | Notas"
            />
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Campanas off</label>
              <textarea
                className="form-textarea strategy-code-textarea"
                rows={4}
                value={form.campaigns_off}
                onChange={(event) => setField('campaigns_off', event.target.value)}
                placeholder="Nombre | Razon"
              />
            </div>
            <div className="form-field">
              <label>Campanas a optimizar</label>
              <textarea
                className="form-textarea strategy-code-textarea"
                rows={4}
                value={form.campaigns_optimize}
                onChange={(event) => setField('campaigns_optimize', event.target.value)}
                placeholder="Nombre | Accion | Prioridad"
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Creativos</label>
              <textarea
                className="form-textarea strategy-code-textarea"
                rows={4}
                value={form.creatives}
                onChange={(event) => setField('creatives', event.target.value)}
                placeholder="Tipo | Descripcion | Link"
              />
            </div>
            <div className="form-field">
              <label>Links de Drive</label>
              <textarea
                className="form-textarea strategy-code-textarea"
                rows={4}
                value={form.drive_links}
                onChange={(event) => setField('drive_links', event.target.value)}
                placeholder="Label | URL"
              />
            </div>
          </div>

          <div className="form-field">
            <label>Checklist operativo</label>
            <textarea
              className="form-textarea strategy-code-textarea"
              rows={5}
              value={form.ai_checklist}
              onChange={(event) => setField('ai_checklist', event.target.value)}
              placeholder="Tarea | prioridad | notas | done"
            />
          </div>

          {isEditing && (
            <div className="form-field">
              <label>Resumen del cambio</label>
              <input
                className="form-input"
                value={form.change_summary}
                onChange={(event) => setField('change_summary', event.target.value)}
                placeholder="Ej. ajuste de presupuesto y publicos"
              />
            </div>
          )}

          {errorMessage && <p className="empty-note">{errorMessage}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => void handleSubmit()} disabled={!canSave || saving}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear estrategia'}
          </button>
        </div>
      </div>
    </div>
  );
}
