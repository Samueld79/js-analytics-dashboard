import { formatCopExact } from '../../../lib/utils';
import { periodLabel } from '../../../lib/billingPeriods';
import type { DueItem } from './types';

interface Props {
  items: DueItem[];
  todayIso: string;
  onRequestInvoice: (item: DueItem) => void;
}

function daysLabel(dueDate: string, todayIso: string): { text: string; color: string } {
  const diff = Math.round(
    (new Date(`${dueDate}T00:00:00Z`).getTime() - new Date(`${todayIso}T00:00:00Z`).getTime()) / 86_400_000,
  );
  if (diff < 0) return { text: `Vencido hace ${Math.abs(diff)} día${Math.abs(diff) === 1 ? '' : 's'}`, color: 'var(--danger)' };
  if (diff === 0) return { text: 'Vence hoy', color: 'var(--warning)' };
  if (diff <= 5) return { text: `Vence en ${diff} día${diff === 1 ? '' : 's'}`, color: 'var(--warning)' };
  return { text: `Vence en ${diff} días`, color: 'var(--fg-muted)' };
}

// Lista de cobros pendientes del mes actual (real, no el del selector de
// arriba), ordenada por fecha de vencimiento. El botón reutiliza el modal
// de "Cuenta de cobro" que ya existe en FacturacionPage (via onRequestInvoice).
export function DueSoonList({ items, todayIso, onRequestInvoice }: Props) {
  return (
    <div className="card-glass card-padded">
      <p className="number-label" style={{ fontSize: '0.72rem', color: 'var(--fg)', marginBottom: 2 }}>Por cobrar ahora</p>
      <p style={{ margin: '0 0 12px', fontSize: '0.6rem', color: 'var(--fg-muted)' }}>
        Mes actual, independiente del selector de arriba
      </p>

      {items.length === 0 ? (
        <p className="empty-note">Todo cobrado este mes 🎉</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => {
            const due = daysLabel(item.dueDate, todayIso);
            const issuerReady = !!item.issuer?.legal_name && !!item.issuer?.account_number;
            const disabled = !item.issuerKey || !issuerReady;

            return (
              <li
                key={`${item.client.id}:${item.month}:${item.period}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--fg)' }}>{item.client.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
                    {periodLabel(item.period, item.payDays)} · {formatCopExact(item.amount)}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.66rem', color: due.color, fontFamily: 'JetBrains Mono, monospace' }}>
                    {due.text}
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  disabled={disabled}
                  title={disabled ? 'Asigna un emisor con datos completos primero' : undefined}
                  style={{ fontSize: '0.64rem' }}
                  onClick={() => onRequestInvoice(item)}
                >
                  {item.existingInvoiceId ? 'Ver / reimprimir' : 'Cuenta de cobro'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
