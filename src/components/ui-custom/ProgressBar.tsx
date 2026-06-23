import { formatCop } from '../../lib/utils';

interface ProgressBarProps {
  current:         number;
  target:          number;
  showPercentage?: boolean;
  showLabels?:     boolean;
}

export function ProgressBar({ current, target, showPercentage = true, showLabels = false }: ProgressBarProps) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  const gradient =
    pct >= 100 ? 'linear-gradient(90deg, var(--cyan), var(--success))' :
    pct >=  60 ? 'linear-gradient(90deg, var(--cyan), var(--cyan-glow))' :
    pct >=  30 ? 'linear-gradient(90deg, var(--warning), oklch(0.86 0.16 90))' :
                 'linear-gradient(90deg, var(--danger), oklch(0.72 0.22 30))';

  const pctColor =
    pct >= 100 ? 'var(--success)' :
    pct >=  60 ? 'var(--cyan)'    :
    pct >=  30 ? 'var(--warning)' :
                 'var(--danger)';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <span style={{ fontSize: '0.52rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em', color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
          Meta mensual
        </span>
        {showPercentage && (
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: pctColor, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
      <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: gradient,
          borderRadius: 999,
          transition: 'width 0.6s ease-out',
        }} />
      </div>
      {showLabels && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{formatCop(current)}</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Meta: {formatCop(target)}</span>
        </div>
      )}
    </div>
  );
}
