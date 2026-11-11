import { useState } from 'react';
import { createBillingExtraIncome, updateBillingExtraIncome } from '../../services/billing';
import type { BillingExtraIncome, BillingInvoiceIssuerKey, Client } from '../../lib/supabase';
import { formatCopExact } from '../../lib/utils';
import { getBogotaTodayIso } from '../../lib/billingPeriods';

const ISSUER_LABELS: Record<BillingInvoiceIssuerKey, string> = { samuel: 'Samuel', juanca: 'Juanca' };
const CONCEPT_SUGGESTIONS = ['Instalación WhatsApp API', 'Agente IA', 'Otro'];

interface Props {
  clients: Client[];
  initial: BillingExtraIncome | null;
  onClose: () => void;
  onSaved: (saved: BillingExtraIncome) => void;
}

// Modal propio para "Agregar ingreso extra" (y editar uno existente, salvo
// que ya esté liquidado — eso se bloquea antes de abrir este modal, desde
// ExtraIncomeSection). Siempre 50/50 entre los socios.
export function ExtraIncomeModal({ clients, initial, onClose, onSaved }: Props) {
  const [concept, setConcept] = useState(initial?.concept ?? '');
  const [clientId, setClientId] = useState(initial?.client_id ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [collector, setCollector] = useState<BillingInvoiceIssuerKey>(initial?.collector ?? 'samuel');
  const [receivedOn, setReceivedOn] = useState(initial?.received_on ?? getBogotaTodayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const amountNumber = Number(amount);
  const half = amount.trim() && !Number.isNaN(amountNumber) ? amountNumber / 2 : null;
  const otherPartner: BillingInvoiceIssuerKey = collector === 'samuel' ? 'juanca' : 'samuel';

  async function handleSubmit() {
    const trimmedConcept = concept.trim();
    if (!trimmedConcept) {
      setError('Escribe un concepto.');
      return;
    }
    if (!amount.trim() || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }

    setSaving(true);
    setError('');

    const month = `${receivedOn.slice(0, 7)}-01`;
    const input = {
      month,
      received_on: receivedOn,
      concept: trimmedConcept,
      client_id: clientId || null,
      amount: amountNumber,
      collector,
    };

    const result = initial ? await updateBillingExtraIncome(initial.id, input) : await createBillingExtraIncome(input);

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
            <h2 className="modal-title">{initial ? 'Editar ingreso extra' : 'Agregar ingreso extra'}</h2>
            <p className="modal-subtitle">Instalaciones, agente IA u otros servicios — siempre 50/50</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>Concepto</label>
            <input className="form-input" type="text" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Instalación WhatsApp API" />
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {CONCEPT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="meta-chip"
                  style={{ cursor: 'pointer', border: 'none' }}
                  onClick={() => setConcept(suggestion === 'Otro' ? '' : suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>Cliente (opcional)</label>
            <select className="form-input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Sin cliente asociado</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-field" style={{ marginBottom: 12, flex: 1 }}>
              <label>Monto (COP)</label>
              <input className="form-input" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="form-field" style={{ marginBottom: 12, flex: 1 }}>
              <label>Fecha recibida</label>
              <input className="form-input" type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
            </div>
          </div>

          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>Quién cobró</label>
            <select className="form-input" value={collector} onChange={(e) => setCollector(e.target.value as BillingInvoiceIssuerKey)}>
              {(Object.keys(ISSUER_LABELS) as BillingInvoiceIssuerKey[]).map((key) => (
                <option key={key} value={key}>
                  {ISSUER_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {half != null && (
            <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
              Se reparte 50/50: le toca {formatCopExact(half)} a {ISSUER_LABELS[otherPartner]}.
            </p>
          )}

          {error && <p style={{ marginTop: 12, fontSize: '0.74rem', color: 'var(--danger)' }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}
