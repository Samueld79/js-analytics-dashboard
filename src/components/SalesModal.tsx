import { useMemo, useState } from 'react';
import type { DailySale, DailySaleInput, ServiceMutationResult } from '../lib/supabase';

interface Props {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSave: (data: DailySaleInput) => Promise<ServiceMutationResult<DailySale>>;
}

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SalesModal({ clientId, clientName, onClose, onSave }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    date: today,
    total_sales: '',
  });

  const totalSales = useMemo(() => parseMoney(form.total_sales), [form.total_sales]);
  const isValid = Boolean(form.date) && totalSales > 0;

  async function handleSave() {
    if (!form.date) {
      setErrorMessage('La fecha es obligatoria.');
      return;
    }

    if (totalSales <= 0) {
      setErrorMessage('La venta debe ser mayor a 0.');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const result = await onSave({
      client_id: clientId,
      date: form.date,
      total_sales: totalSales,
      new_client_sales: 0,
      repeat_sales: 0,
      physical_store_sales: 0,
      online_sales: 0,
      observations: null,
      status: 'submitted',
    });

    if (result.error) {
      setErrorMessage(result.error);
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-sales-simple" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Registrar venta</h2>
            <p className="modal-subtitle">
              {clientName} · Captura simple sobre ventas diarias
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="source-note">
            En esta fase solo pedimos fecha y venta. El resto de campos se guarda en cero.
          </p>

          <div className="sales-simple-fields">
            <label className="form-field required">
              <span className="form-label">Fecha</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => {
                  setForm((current) => ({ ...current, date: event.target.value }));
                  setErrorMessage('');
                }}
                className="form-input"
              />
            </label>

            <label className="form-field required">
              <span className="form-label">Venta</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.total_sales}
                onChange={(event) => {
                  setForm((current) => ({ ...current, total_sales: event.target.value }));
                  setErrorMessage('');
                }}
                className="form-input form-input-large"
              />
            </label>
          </div>

          {errorMessage && <p className="empty-note">{errorMessage}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => void handleSave()} disabled={!isValid || saving}>
            {saving ? 'Guardando…' : 'Guardar venta'}
          </button>
        </div>
      </div>
    </div>
  );
}
