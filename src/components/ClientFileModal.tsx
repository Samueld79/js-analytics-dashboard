import { useMemo, useState } from 'react';
import type {
  ClientFile,
  ClientFileInput,
  ClientFileType,
  ServiceMutationResult,
  Strategy,
} from '../lib/supabase';

interface Props {
  clientId: string;
  strategies: Strategy[];
  onClose: () => void;
  onSave: (input: ClientFileInput) => Promise<ServiceMutationResult<ClientFile>>;
}

const FILE_TYPES: Array<{ value: ClientFileType; label: string }> = [
  { value: 'creative', label: 'Creativo' },
  { value: 'strategy_doc', label: 'Documento estrategia' },
  { value: 'report', label: 'Reporte' },
  { value: 'landing', label: 'Landing' },
  { value: 'other', label: 'Otro' },
];

export function ClientFileModal({ clientId, strategies, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    drive_url: '',
    file_type: 'creative' as ClientFileType,
    strategy_id: '',
  });

  const canSave = useMemo(
    () => Boolean(form.name.trim() && form.drive_url.trim()),
    [form.drive_url, form.name],
  );

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (!canSave) return;

    setSaving(true);
    setErrorMessage('');

    const result = await onSave({
      client_id: clientId,
      strategy_id: form.strategy_id || null,
      file_type: form.file_type,
      name: form.name.trim(),
      drive_url: form.drive_url.trim(),
      drive_file_id: null,
      created_by: null,
    });

    if (result.error) {
      setErrorMessage(result.error);
      setSaving(false);
      return;
    }

    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Registrar archivo</h2>
            <p className="modal-subtitle">Guardar referencia de Drive en el workspace del cliente</p>
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
              placeholder="Ej. Carrusel abril aprobados"
            />
          </div>

          <div className="form-field required">
            <label>URL de Drive</label>
            <input
              className="form-input"
              value={form.drive_url}
              onChange={(event) => setField('drive_url', event.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Tipo</label>
              <select
                className="form-select"
                value={form.file_type}
                onChange={(event) => setField('file_type', event.target.value)}
              >
                {FILE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Estrategia vinculada</label>
              <select
                className="form-select"
                value={form.strategy_id}
                onChange={(event) => setField('strategy_id', event.target.value)}
              >
                <option value="">Sin estrategia</option>
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errorMessage && <p className="empty-note">{errorMessage}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => void handleSave()} disabled={!canSave || saving}>
            {saving ? 'Guardando...' : 'Registrar archivo'}
          </button>
        </div>
      </div>
    </div>
  );
}
