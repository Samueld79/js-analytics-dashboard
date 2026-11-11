import { formatCopExact } from '../../../lib/utils';
import { ProgressRing } from './ProgressRing';

interface Props {
  monthLabel: string;
  expected: number;
  collected: number;
  pending: number;
  paidCount: number;
  totalCount: number;
  adSpendUnderManagement: number;
  feeUndefinedCount: number;
}

// Fusiona el antiguo hero + las 4 tarjetas KPI en una sola tarjeta de
// resumen del mes.
export function MonthSummaryCard({
  monthLabel,
  expected,
  collected,
  pending,
  paidCount,
  totalCount,
  adSpendUnderManagement,
  feeUndefinedCount,
}: Props) {
  const percentCollected = expected > 0 ? (collected / expected) * 100 : 0;

  return (
    <div className="card-glass card-padded" style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
      <ProgressRing percent={percentCollected} label={`${Math.round(percentCollected)} por ciento cobrado del mes`} />

      <div style={{ flex: '1 1 320px', minWidth: 260 }}>
        <p className="number-label" style={{ fontSize: '0.64rem', color: 'var(--fg-muted)' }}>Resumen de {monthLabel}</p>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: '1.7rem',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--fg)',
            lineHeight: 1.1,
          }}
        >
          {formatCopExact(expected)}
          <span style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', fontWeight: 400, marginLeft: 8 }}>esperado</span>
        </p>

        <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cobrado</p>
            <p style={{ margin: '2px 0 0', fontSize: '1.05rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--success)', fontWeight: 600 }}>
              {formatCopExact(collected)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por cobrar</p>
            <p style={{ margin: '2px 0 0', fontSize: '1.05rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--warning)', fontWeight: 600 }}>
              {formatCopExact(pending)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pagados</p>
            <p style={{ margin: '2px 0 0', fontSize: '1.05rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg)', fontWeight: 600 }}>
              {paidCount} de {totalCount}
            </p>
          </div>
        </div>

        <p style={{ margin: '14px 0 0', fontSize: '0.64rem', color: 'var(--fg-muted)' }}>
          Pauta bajo gestión: {formatCopExact(adSpendUnderManagement)}
        </p>

        {feeUndefinedCount > 0 && (
          <p style={{ margin: '6px 0 0', fontSize: '0.64rem', color: 'var(--warning)' }}>
            Fee sin definir: {feeUndefinedCount} cliente{feeUndefinedCount === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </div>
  );
}
