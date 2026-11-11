import { useState } from 'react';
import { formatCopExact } from '../../../lib/utils';
import type { BillingInvoiceIssuerKey, BillingSettlement } from '../../../lib/supabase';
import { SettleConfirmModal } from './SettleConfirmModal';
import type { CrossRow } from './types';

const ISSUER_LABELS: Record<BillingInvoiceIssuerKey, string> = { samuel: 'Samuel', juanca: 'Juanca' };

interface Props {
  monthLabel: string;
  rows: CrossRow[];
  monthLeToSamuel: number;
  monthLeToJuanca: number;
  hasPendingThisMonth: boolean;
  resultNet: number;
  net: number;
  monthProjectionNet: number;
  pendingSettlementsCount: number;
  sharedPendingCount: number;
  settling: boolean;
  settleError: string | null;
  settlements: BillingSettlement[];
  onSettle: () => void;
}

function netPhrase(net: number, verb: string): string {
  if (net > 0) return `Samuel le ${verb} a Juanca ${formatCopExact(net)}`;
  if (net < 0) return `Juanca le ${verb} a Samuel ${formatCopExact(Math.abs(net))}`;
  return 'Están a mano';
}

// "Cruce entre socios": tabla corta del mes (un compartido = un fee/2, un
// ingreso extra sin liquidar = su amount/2) que explica de dónde sale el
// resultado, más las dos cifras ya existentes (saldo actual acumulado /
// proyección del mes) de referencia, más chicas. El historial se lee de
// billing_settlements, plegado. La liquidación en sí (qué se inserta/
// actualiza) no cambió — solo se le agregaron los ingresos extra al mismo
// cruce (ver netBalance en FacturacionPage).
export function NetBalanceCard({
  monthLabel,
  rows,
  monthLeToSamuel,
  monthLeToJuanca,
  hasPendingThisMonth,
  resultNet,
  net,
  monthProjectionNet,
  pendingSettlementsCount,
  sharedPendingCount,
  settling,
  settleError,
  settlements,
  onSettle,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  function handleConfirm() {
    onSettle();
    setConfirmOpen(false);
  }

  return (
    <div className="card-glass card-padded">
      <p className="number-label" style={{ fontSize: '0.64rem', color: 'var(--fg-muted)', marginBottom: 10 }}>Cruce entre socios</p>

      {rows.length === 0 ? (
        <p className="empty-note" style={{ marginBottom: 14 }}>
          Sin compartidos ni ingresos extra pendientes en {monthLabel}.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Cliente / concepto', 'Quién cobra', 'Mitad'].map((h) => (
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
                  <td style={{ padding: '4px 8px', color: 'var(--fg-muted)' }}>{ISSUER_LABELS[row.collector]}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg)' }}>{formatCopExact(row.half)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ margin: '0 0 4px', fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
        Le toca a Samuel (lo que cobra Juanca): <strong style={{ color: 'var(--fg)' }}>{formatCopExact(monthLeToSamuel)}</strong>
      </p>
      <p style={{ margin: '0 0 14px', fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
        Le toca a Juanca (lo que cobra Samuel): <strong style={{ color: 'var(--fg)' }}>{formatCopExact(monthLeToJuanca)}</strong>
      </p>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 14px' }} />

      <p className="number-label" style={{ fontSize: '0.56rem', color: 'var(--fg-muted)' }}>Resultado</p>
      <p style={{ margin: '4px 0 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--fg)' }}>
        {netPhrase(resultNet, hasPendingThisMonth ? 'pagaría' : 'paga')}
      </p>
      {hasPendingThisMonth && (
        <p style={{ margin: '4px 0 0', fontSize: '0.62rem', color: 'var(--warning)' }}>
          Aún faltan compartidos por cobrar este mes — esto es una proyección.
        </p>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '10px 0 14px' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--fg-muted)' }}>Saldo actual (cobrado): {netPhrase(net, 'debe')}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--fg-muted)' }}>Proyección del mes: {netPhrase(monthProjectionNet, 'pagaría')}</span>
      </div>

      <button className="btn-primary" disabled={pendingSettlementsCount === 0 || settling} onClick={() => setConfirmOpen(true)}>
        {settling ? 'Liquidando...' : 'Liquidar saldo'}
      </button>

      {settleError && <p style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--danger)' }}>{settleError}</p>}

      <div style={{ marginTop: 14 }}>
        <button className="btn-ghost" onClick={() => setHistoryOpen((o) => !o)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>
          {historyOpen ? 'Ocultar historial' : `Ver historial (${settlements.length})`}
        </button>

        {historyOpen && (
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
            {settlements.length === 0 && <li className="empty-note">Todavía no hay liquidaciones.</li>}
            {settlements.map((s) => (
              <li key={s.id} style={{ fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{s.settled_on}</span> —{' '}
                {s.payer && s.payee
                  ? `${ISSUER_LABELS[s.payer]} le pagó a ${ISSUER_LABELS[s.payee]} ${formatCopExact(s.amount)}`
                  : 'Compensado, sin transferencia'}
                <br />
                <span style={{ fontSize: '0.6rem' }}>
                  Samuel debía {formatCopExact(s.gross_samuel_to_juanca)} · Juanca debía {formatCopExact(s.gross_juanca_to_samuel)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmOpen && (
        <SettleConfirmModal
          net={net}
          sharedPendingCount={sharedPendingCount}
          settling={settling}
          onConfirm={handleConfirm}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
