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

/** Compute the ISO date string for Monday of the current week (Monday-based). */
export function getWeekStart(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon, …
  const daysToMonday = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  return monday.toISOString().slice(0, 10);
}

/** Returns today's ISO date string (YYYY-MM-DD). */
export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the current month key (YYYY-MM). */
export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}
