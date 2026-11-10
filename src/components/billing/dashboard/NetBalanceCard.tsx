import { formatCopExact } from '../../../lib/utils';

interface Props {
  net: number;
  owedBySamuelToJuanca: number;
  owedByJuancaToSamuel: number;
  pendingSettlementsCount: number;
  monthLabel: string;
  monthOwedBySamuelToJuanca: number;
  monthOwedByJuancaToSamuel: number;
  settling: boolean;
  settleError: string | null;
  history: { date: string; net: number }[];
  onSettle: () => void;
}

// Misma lógica/estado de siempre (netBalance, settlementHistory,
// handleSettleBalance en FacturacionPage) — solo se le dio una casa nueva
// dentro del dashboard, nada se recalculó aquí.
export function NetBalanceCard({
  net,
  owedBySamuelToJuanca,
  owedByJuancaToSamuel,
  pendingSettlementsCount,
  monthLabel,
  monthOwedBySamuelToJuanca,
  monthOwedByJuancaToSamuel,
  settling,
  settleError,
  history,
  onSettle,
}: Props) {
  return (
    <div className="card-glass card-padded">
      <p className="number-label" style={{ fontSize: '0.64rem', color: 'var(--fg-muted)' }}>Saldo neto entre socios (acumulado)</p>
      <p style={{ margin: '6px 0 0', fontSize: '1.05rem', fontWeight: 600, color: 'var(--fg)' }}>
        {net > 0
          ? `Samuel le debe a Juanca ${formatCopExact(net)}`
          : net < 0
            ? `Juanca le debe a Samuel ${formatCopExact(Math.abs(net))}`
            : 'Están a mano'}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
        Samuel debe {formatCopExact(owedBySamuelToJuanca)} · Juanca debe {formatCopExact(owedByJuancaToSamuel)}
      </p>
      <p style={{ margin: '6px 0 14px', fontSize: '0.62rem', color: 'var(--fg-muted)' }}>
        Referencia de {monthLabel}: Samuel debe {formatCopExact(monthOwedBySamuelToJuanca)} · Juanca debe {formatCopExact(monthOwedByJuancaToSamuel)}
      </p>

      <button className="btn-primary" disabled={pendingSettlementsCount === 0 || settling} onClick={onSettle}>
        {settling ? 'Liquidando...' : 'Liquidar saldo'}
      </button>

      {settleError && <p style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--danger)' }}>{settleError}</p>}

      {history.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: '0.58rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Historial de liquidaciones
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
            {history.map(({ date, net: dayNet }) => (
              <li key={date} style={{ fontSize: '0.66rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                {date} —{' '}
                {dayNet > 0
                  ? `Samuel le pagó a Juanca ${formatCopExact(dayNet)}`
                  : dayNet < 0
                    ? `Juanca le pagó a Samuel ${formatCopExact(Math.abs(dayNet))}`
                    : 'quedaron a mano'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
