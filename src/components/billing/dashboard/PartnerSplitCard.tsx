import { formatCopExact } from '../../../lib/utils';
import type { ReceiverTotals } from './types';

interface Props {
  name: string;
  accentVar: string;
  totals: ReceiverTotals;
}

export function PartnerSplitCard({ name, accentVar, totals }: Props) {
  const percent = totals.expected > 0 ? Math.min(100, (totals.collected / totals.expected) * 100) : 0;

  return (
    <div className="card-glass card-padded">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(${accentVar})`, display: 'inline-block' }} />
        <p className="number-label" style={{ fontSize: '0.72rem', color: 'var(--fg)' }}>{name}</p>
      </div>
      <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg)' }}>
        {formatCopExact(totals.expected)}
      </p>
      <p style={{ margin: '2px 0 10px', fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
        esperado · cobrado {formatCopExact(totals.collected)}
      </p>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name}: ${Math.round(percent)}% cobrado`}
        style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}
      >
        <div style={{ height: '100%', width: `${percent}%`, background: `var(${accentVar})`, borderRadius: 999, transition: 'width 600ms ease-out' }} />
      </div>
    </div>
  );
}
