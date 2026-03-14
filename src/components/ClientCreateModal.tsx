import { useMemo, useState } from 'react';
import type { Client, ClientInput, ClientStatus, ServiceMutationResult } from '../lib/supabase';

interface Props {
  saving?: boolean;
  onClose: () => void;
  onSave: (input: ClientInput) => Promise<ServiceMutationResult<Client>>;
}

const STATUS_OPTIONS: Array<{ value: ClientStatus; label: string }> = [
  { value: 'active', label: 'Activo' },
  { value: 'paused', label: 'Pausado' },
  { value: 'churned', label: 'Cancelado' },
];

function parseCities(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function ClientCreateModal({ saving = false, onClose, onSave }: Props) {
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    slug: '',
    niche: '',
    status: 'active' as ClientStatus,
    main_city: '',
    target_cities: '',
    drive_folder_url: '',
    ad_account_id: '',
    notes: '',
  });

  const canSave = useMemo(() => Boolean(form.name.trim()), [form.name]);

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (!canSave || saving) return;

    setErrorMessage('');
    const result = await onSave({
      name: form.name.trim(),
      slug: form.slug.trim() || null,
      niche: form.niche.trim() || null,
      logo_url: null,
      drive_folder_url: form.drive_folder_url.trim() || null,
      ad_account_id: form.ad_account_id.trim() || null,
      status: form.status,
      currency_code: 'COP',
      reporting_timezone: 'America/Bogota',
      main_city: form.main_city.trim() || null,
      target_cities: parseCities(form.target_cities),
      notes: form.notes.trim() || null,
      created_by: null,
    });

    if (result.error) {
      setErrorMessage(result.error);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Nuevo cliente</h2>
            <p className="modal-subtitle">Crear cliente real en Supabase</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-field required">
            <label>Nombre</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder="Ej. Libell"
            />
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Slug</label>
              <input
                className="form-input"
                value={form.slug}
                onChange={(event) => setField('slug', event.target.value)}
                placeholder="Opcional. Se genera automáticamente"
              />
            </div>

            <div className="form-field">
              <label>Nicho</label>
              <input
                className="form-input"
                value={form.niche}
                onChange={(event) => setField('niche', event.target.value)}
                placeholder="retail, salud, servicios..."
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Estado</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(event) => setField('status', event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Ciudad principal</label>
              <input
                className="form-input"
                value={form.main_city}
                onChange={(event) => setField('main_city', event.target.value)}
                placeholder="Bogotá"
              />
            </div>
          </div>

          <div className="form-field">
            <label>Ciudades objetivo</label>
            <input
              className="form-input"
              value={form.target_cities}
              onChange={(event) => setField('target_cities', event.target.value)}
              placeholder="Bogotá, Medellín, Cali"
            />
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Carpeta Drive</label>
              <input
                className="form-input"
                value={form.drive_folder_url}
                onChange={(event) => setField('drive_folder_url', event.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div className="form-field">
              <label>Cuenta publicitaria</label>
              <input
                className="form-input"
                value={form.ad_account_id}
                onChange={(event) => setField('ad_account_id', event.target.value)}
                placeholder="act_123456789"
              />
            </div>
          </div>

          <div className="form-field">
            <label>Notas</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
              placeholder="Notas operativas iniciales"
            />
          </div>

          {errorMessage && <p className="empty-note">{errorMessage}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => void handleSave()} disabled={!canSave || saving}>
            {saving ? 'Guardando...' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
