import { useMemo, useState } from 'react';
import type { DailySaleInput, ServiceMutationResult, DailySale } from '../lib/supabase';
import { validateDailySale } from '../lib/utils';

interface Props {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSave: (data: DailySaleInput) => Promise<ServiceMutationResult<DailySale>>;
}

export function SalesModal({ clientId, clientName, onClose, onSave }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    date: today,
    total_sales: '',
    new_client_sales: '',
    repeat_sales: '',
    physical_store_sales: '',
    online_sales: '',
    observations: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const numericForm = useMemo(() => ({
    total_sales: parseFloat(form.total_sales) || 0,
    new_client_sales: parseFloat(form.new_client_sales) || 0,
    repeat_sales: parseFloat(form.repeat_sales) || 0,
    physical_store_sales: parseFloat(form.physical_store_sales) || 0,
    online_sales: parseFloat(form.online_sales) || 0,
  }), [form]);
  const validation = useMemo(() => validateDailySale(numericForm), [numericForm]);

  const handleSave = async () => {
    if (!form.total_sales) return;
    setSaving(true);
    setErrorMessage('');

    const result = await onSave({
      client_id: clientId,
      date: form.date,
      total_sales: numericForm.total_sales,
      new_client_sales: numericForm.new_client_sales,
      repeat_sales: numericForm.repeat_sales,
      physical_store_sales: numericForm.physical_store_sales,
      online_sales: numericForm.online_sales,
      observations: form.observations || undefined,
    });

    if (result.error) {
      setErrorMessage(result.error);
    }

    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Registrar Ventas</h2>
            <p className="modal-subtitle">{clientName}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-field">
            <label>Fecha</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="form-input" />
          </div>

          <div className="form-field required">
            <label>📦 Ventas totales del día *</label>
            <input type="number" min="0" step="0.01" placeholder="0" value={form.total_sales} onChange={e => set('total_sales', e.target.value)} className="form-input form-input-large" />
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>🆕 Cliente nuevo</label>
              <input type="number" min="0" step="0.01" placeholder="0" value={form.new_client_sales} onChange={e => set('new_client_sales', e.target.value)} className="form-input" />
            </div>
            <div className="form-field">
              <label>🔁 Recompra</label>
              <input type="number" min="0" step="0.01" placeholder="0" value={form.repeat_sales} onChange={e => set('repeat_sales', e.target.value)} className="form-input" />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>🏪 Punto físico</label>
              <input type="number" min="0" step="0.01" placeholder="0" value={form.physical_store_sales} onChange={e => set('physical_store_sales', e.target.value)} className="form-input" />
            </div>
            <div className="form-field">
              <label>🌐 Online</label>
              <input type="number" min="0" step="0.01" placeholder="0" value={form.online_sales} onChange={e => set('online_sales', e.target.value)} className="form-input" />
            </div>
          </div>

          <div className="form-field">
            <label>Observaciones (opcional)</label>
            <textarea placeholder="Día de descuentos, campaña especial, etc." value={form.observations} onChange={e => set('observations', e.target.value)} className="form-textarea" rows={2} />
          </div>

          {errorMessage && (
            <p className="empty-note" style={{ marginTop: 8 }}>
              {errorMessage}
            </p>
          )}
          {!errorMessage && validation.totalsMismatch && (
            <p className="empty-note" style={{ marginTop: 8 }}>
              Cliente nuevo + recompra no coincide con el total. Se guardará igual.
            </p>
          )}
          {!errorMessage && validation.channelsMismatch && (
            <p className="empty-note" style={{ marginTop: 8 }}>
              Punto físico + online no coincide con el total. Se guardará igual.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={!form.total_sales || saving}>
            {saving ? 'Guardando…' : '✓ Guardar Ventas'}
          </button>
        </div>
      </div>
    </div>
  );
}
