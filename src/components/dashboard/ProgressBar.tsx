const FMT = new Intl.NumberFormat('es-CO', {
  style:                 'currency',
  currency:              'COP',
  notation:              'compact',
  maximumFractionDigits: 1,
});

function fmtCompact(v: number): string {
  return FMT.format(v);
}

interface ProgressBarProps {
  current: number;
  target:  number;
}

export function ProgressBar({ current, target }: ProgressBarProps) {
  const raw     = target > 0 ? (current / target) * 100 : 0;
  const pct     = Math.min(Math.round(raw), 120);
  const barPct  = Math.min(pct, 100);

  const color =
    pct >= 80 ? '#22c55e' :
    pct >= 50 ? '#f59e0b' :
                '#ef4444';

  const gradient =
    pct >= 80 ? 'linear-gradient(90deg,#22c55e,#16a34a)' :
    pct >= 50 ? 'linear-gradient(90deg,#f59e0b,#d97706)' :
                'linear-gradient(90deg,#ef4444,#dc2626)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '0.52rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Meta mensual
        </span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color, fontVariantNumeric: 'tabular-nums' }}>
          {pct}%
        </span>
      </div>

      {/* Track */}
      <div style={{ height: 6, background: 'var(--cc-divider)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${barPct}%`,
          borderRadius: 999,
          background: gradient,
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: '0.56rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
          {fmtCompact(current)}
        </span>
        <span style={{ fontSize: '0.56rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
          Meta: {fmtCompact(target)}
        </span>
      </div>
    </div>
  );
}
