import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { BillingExtraIncome, BillingInvoiceIssuerKey, Client } from '../../lib/supabase';
import { formatCopExact } from '../../lib/utils';

const ISSUER_LABELS: Record<BillingInvoiceIssuerKey, string> = { samuel: 'Samuel', juanca: 'Juanca' };

interface Props {
  monthLabel: string;
  items: BillingExtraIncome[];
  clientsById: Map<string, Client>;
  onAdd: () => void;
  onEdit: (item: BillingExtraIncome) => void;
  onDelete: (item: BillingExtraIncome) => void;
  deletingId: string | null;
  sectionError: string | null;
}

// Sección compacta y plegable — abierta por defecto si hay registros ese
// mes. Un extra ya liquidado (settlement_id no nulo) no se puede editar ni
// borrar: se muestra "Liquidado" y las acciones quedan deshabilitadas.
export function ExtraIncomeSection({ monthLabel, items, clientsById, onAdd, onEdit, onDelete, deletingId, sectionError }: Props) {
  const [open, setOpen] = useState(items.length > 0);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="card-glass card-padded">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <p className="number-label" style={{ fontSize: '0.68rem', color: 'var(--fg)', margin: 0 }}>
            Ingresos extra de {monthLabel} {items.length > 0 ? `(${items.length})` : ''}
          </p>
          {open ? <ChevronUp size={14} color="var(--fg-muted)" /> : <ChevronDown size={14} color="var(--fg-muted)" />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg)' }}>
            Total: {formatCopExact(total)}
          </span>
          <button className="btn-secondary" style={{ fontSize: '0.66rem' }} onClick={onAdd}>
            + Agregar ingreso extra
          </button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          {items.length === 0 ? (
            <p className="empty-note">Sin ingresos extra este mes.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item) => {
                const isSettled = !!item.settlement_id;
                const client = item.client_id ? clientsById.get(item.client_id) : undefined;
                return (
                  <li
                    key={item.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--fg)' }}>
                        {item.concept}
                        {client && <span style={{ color: 'var(--fg-muted)' }}> · {client.name}</span>}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.66rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {item.received_on} · {formatCopExact(item.amount)} · cobró {ISSUER_LABELS[item.collector]}
                        {isSettled && <span style={{ color: 'var(--cyan)' }}> · Liquidado</span>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-ghost" style={{ fontSize: '0.64rem' }} disabled={isSettled} onClick={() => onEdit(item)}>
                        Editar
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: '0.64rem', color: 'var(--danger)' }}
                        disabled={isSettled || deletingId === item.id}
                        onClick={() => onDelete(item)}
                      >
                        {deletingId === item.id ? 'Borrando...' : 'Borrar'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {sectionError && <p style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--danger)' }}>{sectionError}</p>}
        </div>
      )}
    </div>
  );
}
