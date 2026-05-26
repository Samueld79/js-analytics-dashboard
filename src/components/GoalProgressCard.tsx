import { formatCOP, getGoalPercent, getGoalStatus } from '../utils/goalHelpers';

type GoalProgressCardProps = {
  clientName: string;
  monthlyGoal: number;
  currentMonthlySales: number;
  currentWeeklySales: number;
};

const STATUS_COLORS = {
  green:  { bar: 'hsl(145,100%,45%)',  badge: 'hsl(145 100% 45% / 0.15)', text: 'hsl(145,100%,55%)' },
  yellow: { bar: 'hsl(38,100%,55%)',   badge: 'hsl(38 100% 55% / 0.15)',  text: 'hsl(38,100%,65%)' },
  red:    { bar: 'hsl(0,84%,60%)',     badge: 'hsl(0 84% 60% / 0.15)',    text: 'hsl(0,84%,70%)' },
};

const STATUS_LABELS = {
  green:  '✅ En objetivo',
  yellow: '⚠️ En riesgo',
  red:    '🚨 Acción inmediata',
};

function ProgressBar({ pct, color, inactive }: { pct: number; color: string; inactive?: boolean }) {
  if (inactive) {
    return (
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
        <span style={{ fontSize: '0.55rem', fontFamily: 'JetBrains Mono, monospace', color: 'hsl(215,15%,38%)', letterSpacing: '0.06em' }}>
          Sin actividad
        </span>
      </div>
    );
  }
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color, transition: 'width 0.6s ease' }} />
    </div>
  );
}

export function GoalProgressCard({ clientName, monthlyGoal, currentMonthlySales, currentWeeklySales }: GoalProgressCardProps) {
  const weeklyGoal    = monthlyGoal / 4;
  const monthStatus   = getGoalStatus(currentMonthlySales, monthlyGoal);
  const weekStatus    = getGoalStatus(currentWeeklySales, weeklyGoal);
  const monthPct      = getGoalPercent(currentMonthlySales, monthlyGoal);
  const weekPct       = getGoalPercent(currentWeeklySales, weeklyGoal);
  const monthColors   = STATUS_COLORS[monthStatus];
  const noMonthlyActivity = currentMonthlySales === 0;
  const noWeeklyActivity  = currentWeeklySales === 0;

  return (
    <div
      className="card-glass goal-card"
      style={{ padding: '12px 14px', borderLeft: `3px solid ${monthColors.bar}`, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>
          {clientName}
        </span>
        <span style={{
          fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999,
          background: monthColors.badge, color: monthColors.text,
          whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em',
        }}>
          {STATUS_LABELS[monthStatus]}
        </span>
      </div>

      {/* Monthly row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.58rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', color: 'hsl(215,15%,45%)', textTransform: 'uppercase' }}>
            Mensual
          </span>
          {!noMonthlyActivity && (
            <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text-secondary)' }}>
              {formatCOP(currentMonthlySales)} <span style={{ color: 'hsl(215,15%,38%)' }}>/ {formatCOP(monthlyGoal)}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProgressBar pct={monthPct} color={STATUS_COLORS[monthStatus].bar} inactive={noMonthlyActivity} />
          {!noMonthlyActivity && (
            <span style={{ fontSize: '0.64rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: STATUS_COLORS[monthStatus].text, minWidth: 30, textAlign: 'right' }}>
              {monthPct}%
            </span>
          )}
        </div>
      </div>

      {/* Weekly row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.58rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', color: 'hsl(215,15%,45%)', textTransform: 'uppercase' }}>
            Semanal (7 días)
          </span>
          {!noWeeklyActivity && (
            <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text-secondary)' }}>
              {formatCOP(currentWeeklySales)} <span style={{ color: 'hsl(215,15%,38%)' }}>/ {formatCOP(weeklyGoal)}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProgressBar pct={weekPct} color={STATUS_COLORS[weekStatus].bar} inactive={noWeeklyActivity} />
          {!noWeeklyActivity && (
            <span style={{ fontSize: '0.64rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: STATUS_COLORS[weekStatus].text, minWidth: 30, textAlign: 'right' }}>
              {weekPct}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
