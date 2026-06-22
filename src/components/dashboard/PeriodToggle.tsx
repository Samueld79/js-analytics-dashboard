import { useState } from 'react';

const FMT_COMPACT = new Intl.NumberFormat('es-CO', {
  style:                 'currency',
  currency:              'COP',
  notation:              'compact',
  maximumFractionDigits: 1,
});

function fmtCop(v: number): string {
  return v > 0 ? FMT_COMPACT.format(v) : '—';
}

interface PeriodToggleProps {
  dayValue:  number;
  weekValue: number;
  weekDelta: number | null;
}

type Period = 'day' | 'week';

const TABS: { id: Period; label: string }[] = [
  { id: 'day',  label: 'DÍA'    },
  { id: 'week', label: 'SEMANA' },
];

export function PeriodToggle({ dayValue, weekValue, weekDelta }: PeriodToggleProps) {
  const [active, setActive] = useState<Period>('week');

  const value = active === 'day' ? dayValue : weekValue;

  return (
    <div>
      {/* Tab row */}
      <div
        role="tablist"
        aria-label="Período de rendimiento"
        style={{
          display: 'flex',
          background: 'var(--cc-tab-bg)',
          borderRadius: 8,
          padding: 2,
          gap: 2,
          marginBottom: 10,
        }}
      >
        {TABS.map((tab) => {
          const isCurrent = active === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isCurrent}
              onClick={() => setActive(tab.id)}
              style={{
                flex: 1,
                padding: '5px 8px',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.56rem',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                transition: 'all 0.15s ease',
                background: isCurrent ? 'var(--cc-tab-active)' : 'transparent',
                color: isCurrent ? 'var(--cc-accent)' : 'var(--color-text-muted)',
                borderBottom: isCurrent ? '2px solid var(--cc-accent)' : '2px solid transparent',
                outline: 'none',
              }}
              onFocus={(e)  => { e.currentTarget.style.outline = `2px solid var(--cc-accent)`; }}
              onBlur={(e)   => { e.currentTarget.style.outline = 'none'; }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Value */}
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
        <p style={{ margin: '0 0 3px', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
          {fmtCop(value)}
        </p>
        {active === 'week' && weekDelta !== null && (
          <p style={{ margin: 0, fontSize: '0.62rem', fontWeight: 600, color: weekDelta >= 0 ? '#22c55e' : '#ef4444' }}>
            {weekDelta >= 0 ? '↑' : '↓'} {Math.abs(weekDelta).toFixed(1)}% vs sem. anterior
          </p>
        )}
      </div>
    </div>
  );
}
