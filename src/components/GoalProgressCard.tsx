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

type ProgressBarProps = {
  pct: number;
  color: string;
};

function ProgressBar({ pct, color }: ProgressBarProps) {
  return (
    <div
      style={{
        height: 5,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 999,
          background: color,
          transition: 'width 0.6s ease',
        }}
      />
    </div>
  );
}

export function GoalProgressCard({
  clientName,
  monthlyGoal,
  currentMonthlySales,
  currentWeeklySales,
}: GoalProgressCardProps) {
  const weeklyGoal = monthlyGoal / 4;

  const monthStatus = getGoalStatus(currentMonthlySales, monthlyGoal);
  const weekStatus  = getGoalStatus(currentWeeklySales, weeklyGoal);

  const monthPct = getGoalPercent(currentMonthlySales, monthlyGoal);
  const weekPct  = getGoalPercent(currentWeeklySales, weeklyGoal);

  const monthColors = STATUS_COLORS[monthStatus];

  return (
    <div
      className="card-glass"
      style={{
        padding: '14px 16px',
        borderLeft: `3px solid ${monthColors.bar}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {clientName}
        </span>
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 999,
            background: monthColors.badge,
            color: monthColors.text,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.04em',
          }}
        >
          {STATUS_LABELS[monthStatus]}
        </span>
      </div>

      {/* Monthly row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: '0.6rem',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
              color: 'hsl(215,15%,48%)',
            }}
          >
            META MENSUAL
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--color-text-secondary)',
            }}
          >
            {formatCOP(currentMonthlySales)}{' '}
            <span style={{ color: 'hsl(215,15%,40%)' }}>/ {formatCOP(monthlyGoal)}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProgressBar pct={monthPct} color={STATUS_COLORS[monthStatus].bar} />
          <span
            style={{
              fontSize: '0.66rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: STATUS_COLORS[monthStatus].text,
              minWidth: 32,
              textAlign: 'right',
            }}
          >
            {monthPct}%
          </span>
        </div>
      </div>

      {/* Weekly row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: '0.6rem',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
              color: 'hsl(215,15%,48%)',
            }}
          >
            META SEMANAL
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--color-text-secondary)',
            }}
          >
            {formatCOP(currentWeeklySales)}{' '}
            <span style={{ color: 'hsl(215,15%,40%)' }}>/ {formatCOP(weeklyGoal)}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProgressBar pct={weekPct} color={STATUS_COLORS[weekStatus].bar} />
          <span
            style={{
              fontSize: '0.66rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: STATUS_COLORS[weekStatus].text,
              minWidth: 32,
              textAlign: 'right',
            }}
          >
            {weekPct}%
          </span>
        </div>
      </div>
    </div>
  );
}
