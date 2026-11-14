import { useState } from 'react';
import { formatCopExact } from '../../../lib/utils';
import type { BillingSettlement } from '../../../lib/supabase';
import type { PartnerGoalRow } from './types';

const COLLECTOR_LABELS = { samuel: 'Samuel', juanca: 'Juanca' } as const;

interface Props {
  monthLabel: string;
  expectedJuanca: number;
  expectedSamuel: number;
  goal: number;
  received: number;
  missing: number;
  payNow: number;
  rows: PartnerGoalRow[];
  monthSettlements: BillingSettlement[];
  onRegisterPayment: () => void;
  onUndoPayment: (settlement: BillingSettlement) => void;
  undoingId: string | null;
  actionError: string | null;
}

// Reemplaza la vieja "Cruce entre socios" (saldo A-le-debe-a-B + "Liquidar
// saldo"). Modelo mental de Muel y Juanca: de lo que Juanca cobra en los
// compartidos, cuánto le toca a cada uno — Samuel NUNCA le transfiere nada
// a Juanca, es Juanca quien le va pagando a Samuel con sus propios cobros
// del mes hasta cumplir la meta. Cálculo real vive en `partnerGoal`
// (FacturacionPage) — este componente solo presenta.
export function PartnerGoalCard({
  monthLabel,
  expectedJuanca,
  expectedSamuel,
  goal,
  received,
  missing,
  payNow,
  rows,
  monthSettlements,
  onRegisterPayment,
  onUndoPayment,
  undoingId,
  actionError,
}: Props) {
  const [rowsOpen, setRowsOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const percent = goal > 0 ? Math.min(100, (received / goal) * 100) : received > 0 ? 100 : 0;

  return (
    <div className="card-glass card-padded">
      <p className="number-label" style={{ fontSize: '0.64rem', color: 'var(--fg-muted)', marginBottom: 10 }}>
        Lo que le toca a Samuel en {monthLabel}
      </p>

      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--fg)' }}>Le toca a Samuel este mes: {formatCopExact(goal)}</p>
      <p style={{ margin: '4px 0 14px', fontSize: '0.64rem', color: 'var(--fg-muted)' }}>
        = mitad de lo que cobra Juanca ({formatCopExact(expectedJuanca / 2)}) menos la mitad de lo que Samuel ya cobró por su
        cuenta ({formatCopExact(expectedSamuel / 2)}).
      </p>

      <p style={{ margin: '0 0 6px', fontSize: '0.74rem', color: 'var(--fg)' }}>
        Juanca ya le pasó: <strong>{formatCopExact(received)}</strong> · Falta: <strong>{formatCopExact(missing)}</strong>
      </p>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Lo que le toca a Samuel este mes: ${Math.round(percent)}% pagado`}
        style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden', marginBottom: 14 }}
      >
        <div style={{ height: '100%', width: `${percent}%`, background: 'var(--cyan)', borderRadius: 999, transition: 'width 600ms ease-out' }} />
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 14px' }} />

      <p className="number-label" style={{ fontSize: '0.56rem', color: 'var(--fg-muted)' }}>Resultado</p>
      <p style={{ margin: '4px 0 14px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--fg)' }}>
        {payNow > 0
          ? `Juanca le pasa ahora ${formatCopExact(payNow)} a Samuel (de lo que ya cobró)`
          : missing > 0
            ? 'Esperando más cobros de Juanca'
            : 'Ya está completo lo de Samuel: lo que Juanca cobre de aquí en adelante este mes es suyo'}
      </p>

      <button className="btn-primary" onClick={onRegisterPayment} style={{ marginBottom: 10 }}>
        Registrar pago de Juanca
      </button>

      {actionError && <p style={{ marginBottom: 10, fontSize: '0.72rem', color: 'var(--danger)' }}>{actionError}</p>}

      <div style={{ marginBottom: 6 }}>
        <button className="btn-ghost" onClick={() => setPaymentsOpen((o) => !o)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>
          {paymentsOpen ? 'Ocultar pagos registrados' : `Pagos registrados del mes (${monthSettlements.length})`}
        </button>

        {paymentsOpen && (
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
            {monthSettlements.length === 0 && <li className="empty-note">Todavía no hay pagos registrados este mes.</li>}
            {monthSettlements.map((s) => (
              <li key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
                <span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{s.settled_on}</span> — {formatCopExact(s.amount)}
                </span>
                <button
                  className="btn-ghost"
                  style={{ fontSize: '0.6rem', padding: '2px 6px', color: 'var(--danger)' }}
                  disabled={undoingId === s.id}
                  onClick={() => onUndoPayment(s)}
                >
                  {undoingId === s.id ? 'Deshaciendo...' : 'Deshacer'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button className="btn-ghost" onClick={() => setRowsOpen((o) => !o)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>
          {rowsOpen ? 'Ocultar cobros del mes' : `Ver cobros del mes (${rows.length})`}
        </button>

        {rowsOpen && (
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            {rows.length === 0 ? (
              <p className="empty-note">Sin compartidos ni ingresos extra en {monthLabel}.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cliente / concepto', 'Cobra', 'Monto', 'Mitad'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, fontSize: '0.58rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '4px 8px', color: 'var(--fg)' }}>{row.label}</td>
                      <td style={{ padding: '4px 8px', color: 'var(--fg-muted)' }}>{COLLECTOR_LABELS[row.collector]}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg)' }}>{formatCopExact(row.amount)}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg-muted)' }}>{formatCopExact(row.half)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
