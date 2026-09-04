import { CalendarClock } from 'lucide-react';
import { GlassCard } from '../ui-custom/GlassCard';
import { ProgressBar } from '../dashboard/ProgressBar';
import { useMonthProgress } from '../../hooks/useMonthProgress';
import { formatCop } from '../../lib/utils';

const RING_RADIUS = 34;
const RING_CENTER = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface PortalIndicatorsProps {
  monthSales:  number;
  monthlyGoal: number | null;
  yearSales:   number;
  year:        number;
}

export function PortalIndicators({ monthSales, monthlyGoal, yearSales, year }: PortalIndicatorsProps) {
  const { monthLabel, percent, daysRemaining } = useMonthProgress();
  const dashOffset = RING_CIRCUMFERENCE * (1 - percent / 100);

  return (
    <GlassCard style={{ padding: 20 }}>
      <div className="portal-indicators-grid">

        {/* ── Progreso del mes ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0, width: 84, height: 84 }}>
            <svg viewBox="0 0 84 84" width={84} height={84}>
              <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} fill="none" stroke="var(--border)" strokeWidth={6} />
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke="var(--cyan)"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
                style={{ filter: 'drop-shadow(0 0 4px var(--cyan))', transition: 'stroke-dashoffset 600ms ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg)' }}>
                {percent}%
              </span>
            </div>
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '0.58rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace' }}>
              Progreso del mes
            </p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--fg)', fontWeight: 600 }}>{monthLabel}</p>
            <p style={{ margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
              <CalendarClock size={11} />
              {daysRemaining} día{daysRemaining !== 1 ? 's' : ''} restante{daysRemaining !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ── Meta mensual ── */}
        <div>
          {monthlyGoal && monthlyGoal > 0 ? (
            <ProgressBar current={monthSales} target={monthlyGoal} />
          ) : (
            <>
              <p style={{ margin: '0 0 6px', fontSize: '0.52rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Ventas del mes
              </p>
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg)', fontFamily: 'JetBrains Mono, monospace' }}>
                {formatCop(monthSales)}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.62rem', color: 'var(--fg-muted)' }}>Sin meta mensual definida</p>
            </>
          )}
        </div>

        {/* ── Acumulado del año ── */}
        <div>
          <p style={{ margin: '0 0 6px', fontSize: '0.52rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Acumulado {year}
          </p>
          <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg)', fontFamily: 'JetBrains Mono, monospace' }}>
            {formatCop(yearSales)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.62rem', color: 'var(--fg-muted)' }}>Total del año, informativo</p>
        </div>

      </div>
    </GlassCard>
  );
}
