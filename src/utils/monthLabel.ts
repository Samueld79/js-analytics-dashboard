const monthFormatter = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
});

export function getMonthLabel(monthKey: string): string {
  if (!monthKey) return '—';

  const [year, month] = monthKey.split('-');
  const monthDate = new Date(Number(year), Number(month) - 1, 1);
  if (!Number.isFinite(monthDate.getTime())) return monthKey;

  const label = monthFormatter.format(monthDate);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
