import { formatCopExact } from '../../../lib/utils';
import { ProgressRing } from './ProgressRing';

interface Props {
  monthLabel: string;
  expected: number;
  collected: number;
  pending: number;
  feeUndefinedCount: number;
}

export function IncomeHero({ monthLabel, expected, collected, pending, feeUndefinedCount }: Props) {
  const percentCollected = expected > 0 ? (collected / expected) * 100 : 0;

  return (
    <div className="card-glass card-padded" style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
      <ProgressRing
        percent={percentCollected}
        label={`${Math.round(percentCollected)} por ciento cobrado del mes`}
      />
      <div style={{ flex: '1 1 260px', minWidth: 220 }}>
        <p className="number-label" style={{ fontSize: '0.64rem', color: 'var(--fg-muted)' }}>Ingresos de {monthLabel}</p>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: '2rem',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--fg)',
            lineHeight: 1.1,
          }}
        >
          {formatCopExact(expected)}
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
        </div>
        {feeUndefinedCount > 0 && (
          <p style={{ margin: '14px 0 0', fontSize: '0.68rem', color: 'var(--warning)' }}>
            Fee sin definir: {feeUndefinedCount} cliente{feeUndefinedCount === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </div>
  );
}
