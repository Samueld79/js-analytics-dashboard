import { formatCopExact } from '../../../lib/utils';
import type { ReceiverTotals } from './types';

interface PartnerColumnProps {
  name: string;
  accentVar: string;
  totals: ReceiverTotals;
}

function PartnerColumn({ name, accentVar, totals }: PartnerColumnProps) {
  const percent = totals.expected > 0 ? Math.min(100, (totals.collected / totals.expected) * 100) : 0;

  return (
    <div>
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

interface Props {
  samuel: ReceiverTotals;
  juanca: ReceiverTotals;
}

// Lo que cada socio cobra (su 100% + lo que cobra de compartidos), usando
// byReceiver tal cual ya lo calcula FacturacionPage (ya trae el 50/50 de
// compartido repartido) — dos columnas en una sola tarjeta en vez de dos
// tarjetas repetidas.
export function PartnerPairCard({ samuel, juanca }: Props) {
  return (
    <div className="card-glass card-padded">
      <p className="number-label" style={{ fontSize: '0.64rem', color: 'var(--fg-muted)', marginBottom: 14 }}>Por socio</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24 }}>
        <PartnerColumn name="Samuel" accentVar="--cyan" totals={samuel} />
        <PartnerColumn name="Juanca" accentVar="--color-accent-purple" totals={juanca} />
      </div>
    </div>
  );
}
