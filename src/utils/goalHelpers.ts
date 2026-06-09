export function getGoalStatus(actual: number, goal: number): 'green' | 'yellow' | 'red' {
  if (goal <= 0) return 'green';
  const pct = actual / goal;
  if (pct >= 0.75) return 'green';
  if (pct >= 0.40) return 'yellow';
  return 'red';
}

export function getGoalPercent(actual: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((actual / goal) * 100));
}

export function formatCOP(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toLocaleString('es-CO')}`;
}

/**
 * Returns the ISO date string for the Monday of the current calendar week,
 * clamped to the first day of the current month so we never cross months.
 *
 * Examples (week Mon–Sun):
 *   Mon 2026-06-09 → '2026-06-09'  (today is Monday, use today)
 *   Wed 2026-06-11 → '2026-06-09'  (Monday of this week)
 *   Mon 2026-06-02 → '2026-06-02'  (first Monday of June)
 *   Mon 2026-06-01 (if June starts Monday) → '2026-06-01'
 *
 * Clamping to the first of the month ensures that data entered on Monday
 * for the *previous* week (e.g. catching up on Sunday's sales) is NOT
 * counted in the current week's goal window.
 */
export function getWeekStart(): string {
  const today = new Date();

  // Find the Monday of the current ISO week (getDay: 0=Sun, 1=Mon...6=Sat)
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysToMonday);
  thisMonday.setHours(0, 0, 0, 0);

  // Clamp to first day of the month so the window never crosses a month boundary
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const start = thisMonday >= firstOfMonth ? thisMonday : firstOfMonth;
  return start.toISOString().slice(0, 10);
}

/** Returns today's ISO date string (YYYY-MM-DD). */
export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the current month key (YYYY-MM). */
export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}
