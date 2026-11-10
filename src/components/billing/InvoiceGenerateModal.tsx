import { useState } from 'react';
import { createBillingInvoice } from '../../services/billing';
import type { BillingInvoice, BillingInvoiceIssuerKey, BillingInvoiceItem, BillingIssuer, BillingPaymentPeriod, Client } from '../../lib/supabase';
import { formatCopPlain } from '../../lib/utils';
import { getMonthLabel } from '../../utils/monthLabel';
import { defaultIssueDateForPeriod, periodDateRangeText, periodLabel } from '../../lib/billingPeriods';

interface Props {
  client: Client;
  period: BillingPaymentPeriod;
  month: string;
  defaultAmount: number;
  issuerKey: BillingInvoiceIssuerKey;
  issuer: BillingIssuer | undefined;
  payDays?: number[] | null;
  onClose: () => void;
  onCreated: (invoice: BillingInvoice) => void;
}

const ISSUER_LABELS: Record<BillingInvoiceIssuerKey, string> = { samuel: 'Samuel', juanca: 'Juanca' };

function defaultItems(amount: number, month: string, period: BillingPaymentPeriod): BillingInvoiceItem[] {
  return [
    { qty: 1, description: 'Actividades como Trafficker / Estratega en Meta Ads e Instagram', value: null },
    { qty: 1, description: `Servicios de Growth Marketing ${periodDateRangeText(month, period)}`, value: amount },
  ];
}

export function InvoiceGenerateModal({ client, period, month, defaultAmount, issuerKey, issuer, payDays, onClose, onCreated }: Props) {
  const [items, setItems] = useState<BillingInvoiceItem[]>(() => defaultItems(defaultAmount, month, period));
  const [issueDate, setIssueDate] = useState(() => defaultIssueDateForPeriod(month, period, payDays));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const nextNumberPreview = issuer ? String(issuer.next_invoice_number).padStart(5, '0') : null;

  function updateItem(index: number, patch: Partial<BillingInvoiceItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((current) => [...current, { qty: 1, description: '', value: null }]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function handleConfirm() {
    setSaving(true);
    setError('');

    const result = await createBillingInvoice({
      clientId: client.id,
      issuerKey,
      month,
      period,
      items,
      total,
      issueDate,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    if (result.data) onCreated(result.data);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-large" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Generar cuenta de cobro</h2>
            <p className="modal-subtitle">
              {client.name} · {getMonthLabel(month)} · {periodLabel(period, payDays)} · Emite {ISSUER_LABELS[issuerKey]}
              {nextNumberPreview ? ` · próximo número #${nextNumberPreview}` : ''}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-field" style={{ marginBottom: 16, maxWidth: 200 }}>
            <label style={{ fontSize: '0.64rem' }}>Fecha de la cuenta</label>
            <input className="form-input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Cant.', 'Descripción', 'Valor', ''].map((h) => (
                  <th key={h} className="number-label" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 400, fontSize: '0.6rem', color: 'var(--fg-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => updateItem(index, { qty: Number(e.target.value) || 1 })}
                      style={{ width: 60 }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      className="form-input"
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      style={{ width: '100%', minWidth: 260 }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      value={item.value ?? ''}
                      placeholder="sin valor"
                      onChange={(e) => updateItem(index, { value: e.target.value.trim() ? Number(e.target.value) : null })}
                      style={{ width: 140 }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <button className="btn-ghost" onClick={() => removeItem(index)} disabled={items.length <= 1}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="btn-secondary" onClick={addItem} style={{ marginBottom: 16 }}>
            + Agregar fila
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
            <div className="portal-kpi-card" style={{ minWidth: 160 }}>
              <p className="portal-kpi-label">Subtotal</p>
              <p className="portal-kpi-value">{formatCopPlain(total)}</p>
            </div>
            <div className="portal-kpi-card" style={{ minWidth: 160 }}>
              <p className="portal-kpi-label">Total</p>
              <p className="portal-kpi-value">{formatCopPlain(total)}</p>
            </div>
          </div>

          {error && (
            <p style={{ marginTop: 16, fontSize: '0.74rem', color: 'var(--danger)' }}>{error}</p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => void handleConfirm()} disabled={saving}>
            {saving ? 'Generando...' : 'Generar y abrir vista imprimible'}
          </button>
        </div>
      </div>
    </div>
  );
}
