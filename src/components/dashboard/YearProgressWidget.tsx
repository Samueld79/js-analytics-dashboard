import { motion, type Transition } from 'framer-motion';
import { useYearProgress } from '../../hooks/useYearProgress';

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const RING_RADIUS = 70;
const RING_CENTER = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function YearProgressWidget() {
  const { year, percent, daysRemaining, angleDeg, months } = useYearProgress();

  const dashOffset = RING_CIRCUMFERENCE * (1 - percent / 100);
  const markerRad = ((angleDeg - 90) * Math.PI) / 180;
  const markerX = RING_CENTER + RING_RADIUS * Math.cos(markerRad);
  const markerY = RING_CENTER + RING_RADIUS * Math.sin(markerRad);

  return (
    <div className="year-progress-widget">
      <div className="ypw-scanlines" aria-hidden="true" />

      {/* ── Ring ── */}
      <div className="ypw-ring-col">
        <svg viewBox="0 0 180 180" width={180} height={180}>
          <circle className="ypw-ring-bg" cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} />
          <circle
            className="ypw-ring-progress"
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
          />
          <motion.circle
            className="ypw-ring-marker"
            cx={markerX}
            cy={markerY}
            r={5}
            animate={{ opacity: [1, 0.45, 1], scale: [1, 1.25, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' } as Transition}
          />
        </svg>
        <div className="ypw-ring-label">
          <span className="ypw-percent">{percent}%</span>
          <span className="ypw-percent-sub">DEL {year}</span>
        </div>
      </div>

      <div className="ypw-divider" />

      {/* ── Full-year calendar ── */}
      <div className="ypw-calendar">
        <div className="ypw-calendar-header">
          <span>PROGRESO DEL AÑO</span>
          <span>{daysRemaining} días restantes</span>
        </div>
        <div className="ypw-months-grid">
          {months.map((month) => (
            <div key={month.index} className={`ypw-month${month.isCurrent ? ' is-current' : ''}`}>
              <p className="ypw-month-label">{month.label}</p>
              <div className="ypw-weekday-row">
                {WEEKDAY_LABELS.map((w, i) => <span key={`${month.index}-${i}`}>{w}</span>)}
              </div>
              <div className="ypw-days-grid">
                {Array.from({ length: month.leadingBlanks }).map((_, i) => (
                  <span key={`b-${i}`} className="ypw-day-blank" />
                ))}
                {month.days.map((day) => (
                  <span
                    key={day.date}
                    className={`ypw-day ${day.isToday ? 'is-today' : day.isPast ? 'is-past' : 'is-future'}`}
                    title={`${day.date} de ${month.label}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
