import { formatCopExact } from '../../../lib/utils';
import type { DueItem } from './types';

interface Props {
  items: DueItem[];
  todayIso: string;
}

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Mini línea de tiempo de los próximos 7 días (HTML/CSS, no hace falta SVG
// para una fila de celdas). Agrupa los DueItem por fecha de vencimiento.
// Sin envoltorio propio (card/título) — vive dentro de DueTabsCard.
export function UpcomingTimeline({ items, todayIso }: Props) {
  const days = Array.from({ length: 8 }, (_, i) => addDays(todayIso, i));
  const byDate = new Map<string, DueItem[]>();
  for (const item of items) {
    const list = byDate.get(item.dueDate) ?? [];
    list.push(item);
    byDate.set(item.dueDate, list);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
        {days.map((date) => {
          const dayItems = byDate.get(date) ?? [];
          const d = new Date(`${date}T00:00:00Z`);
          const isToday = date === todayIso;
          const total = dayItems.reduce((sum, i) => sum + i.amount, 0);

          return (
            <div
              key={date}
              title={dayItems.length > 0 ? dayItems.map((i) => `${i.client.name}: ${formatCopExact(i.amount)}`).join('\n') : undefined}
              style={{
                borderRadius: 'var(--r-sm)',
                border: `1px solid ${isToday ? 'var(--cyan-border)' : 'var(--border)'}`,
                background: isToday ? 'var(--cyan-dim)' : 'transparent',
                padding: '8px 6px',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.56rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {WEEKDAY_SHORT[d.getUTCDay()]} {d.getUTCDate()}
              </p>
              {dayItems.length > 0 ? (
                <>
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {dayItems.length}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.56rem', color: 'var(--fg-muted)' }}>{formatCopExact(total)}</p>
                </>
              ) : (
                <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--border)' }}>—</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
