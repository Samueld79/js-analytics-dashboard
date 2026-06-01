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
 * Returns the ISO date string for the start of the "current week window"
 * used in goal tracking.
 *
 * Rule: the larger of (today − 7 days) and (first day of current month).
 * This prevents sales from the previous month from bleeding into the weekly
 * goal at the start of a new month (e.g. June 1 would otherwise pull from
 * May 25 if we simply used a raw 7-day lookback).
 */
export function getWeekStart(): string {
  const today = new Date();

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const start = sevenDaysAgo > firstOfMonth ? sevenDaysAgo : firstOfMonth;
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
