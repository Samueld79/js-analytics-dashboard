import { useState } from 'react';
import { createManualPartnerPayment } from '../../services/billing';
import type { BillingSettlement } from '../../lib/supabase';
import { formatCopExact } from '../../lib/utils';
import { getBogotaTodayIso } from '../../lib/billingPeriods';

interface Props {
  defaultAmount: number;
  onClose: () => void;
  onSaved: (saved: BillingSettlement) => void;
}

// "Registrar pago de Juanca" — transferencia manual con lo que Juanca ya
// cobró este mes (ver PartnerGoalCard). No toca cobros ni ingresos extra,
// solo deja constancia de que esa plata ya se pasó. billing_settlements no
// tiene columna de nota libre, así que este modal no pide nota (ver PR).
export function RegisterPartnerPaymentModal({ defaultAmount, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState(String(Math.round(defaultAmount)));
  const [settledOn, setSettledOn] = useState(getBogotaTodayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const amountNumber = Number(amount);

  async function handleSubmit() {
    if (!amount.trim() || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }

    setSaving(true);
    setError('');

    const result = await createManualPartnerPayment({ settledOn, amount: amountNumber });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    if (result.data) onSaved(result.data);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Registrar pago de Juanca</h2>
            <p className="modal-subtitle">Con lo que Juanca ya cobró este mes, de Juanca a Samuel</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-field" style={{ marginBottom: 12, flex: 1 }}>
              <label>Monto (COP)</label>
              <input className="form-input" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="form-field" style={{ marginBottom: 12, flex: 1 }}>
              <label>Fecha</label>
              <input className="form-input" type="date" value={settledOn} onChange={(e) => setSettledOn(e.target.value)} />
            </div>
          </div>

          {!Number.isNaN(amountNumber) && amountNumber > 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>Juanca le pasa {formatCopExact(amountNumber)} a Samuel.</p>
          )}

          {error && <p style={{ marginTop: 12, fontSize: '0.74rem', color: 'var(--danger)' }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}
