import { formatCopExact } from '../../../lib/utils';
import type { BillingInvoiceIssuerKey, BillingSettlement } from '../../../lib/supabase';

const ISSUER_LABELS: Record<BillingInvoiceIssuerKey, string> = { samuel: 'Samuel', juanca: 'Juanca' };

interface Props {
  net: number;
  owedBySamuelToJuanca: number;
  owedByJuancaToSamuel: number;
  pendingSettlementsCount: number;
  monthLabel: string;
  monthProjectionNet: number;
  monthProjectionSamuelToJuanca: number;
  monthProjectionJuancaToSamuel: number;
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

// "Saldo actual (cobrado)" = netBalance real y acumulado, viene tal cual de
// FacturacionPage (sin recalcular acá). "Proyección del mes" es un número
// aparte e hipotético (todo lo compartido del mes se pagara), para que no
// se confundan. El historial se lee de billing_settlements (no se infiere).
export function NetBalanceCard({
  net,
  owedBySamuelToJuanca,
  owedByJuancaToSamuel,
  pendingSettlementsCount,
  monthLabel,
  monthProjectionNet,
  monthProjectionSamuelToJuanca,
  monthProjectionJuancaToSamuel,
  settling,
  settleError,
  settlements,
  onSettle,
}: Props) {
  return (
    <div className="card-glass card-padded">
      <p className="number-label" style={{ fontSize: '0.6rem', color: 'var(--fg-muted)' }}>Saldo actual (cobrado)</p>
      <p style={{ margin: '4px 0 0', fontSize: '1.05rem', fontWeight: 600, color: 'var(--fg)' }}>{netPhrase(net, 'debe')}</p>
      <p style={{ margin: '4px 0 0', fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
        Samuel debe {formatCopExact(owedBySamuelToJuanca)} · Juanca debe {formatCopExact(owedByJuancaToSamuel)}
      </p>

      <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

      <p className="number-label" style={{ fontSize: '0.6rem', color: 'var(--fg-muted)' }}>
        Proyección del mes ({monthLabel})
      </p>
      <p style={{ margin: '4px 0 0', fontSize: '0.84rem', fontWeight: 600, color: 'var(--fg-2)' }}>
        {netPhrase(monthProjectionNet, 'pagaría')}
      </p>
      <p style={{ margin: '4px 0 14px', fontSize: '0.62rem', color: 'var(--fg-muted)' }}>
        Si todo lo compartido de este mes se pagara: Samuel {formatCopExact(monthProjectionSamuelToJuanca)} · Juanca {formatCopExact(monthProjectionJuancaToSamuel)}
      </p>

      <button className="btn-primary" disabled={pendingSettlementsCount === 0 || settling} onClick={onSettle}>
        {settling ? 'Liquidando...' : 'Liquidar saldo'}
      </button>

      {settleError && <p style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--danger)' }}>{settleError}</p>}

      {settlements.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: '0.58rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Historial de liquidaciones
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
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
        </div>
      )}
    </div>
  );
}
