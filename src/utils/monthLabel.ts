const monthFormatter = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
});

export function getMonthKey(value: string): string {
  if (!value) return '';

  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return '';

  return `${match[1]}-${match[2]}`;
}

export function compareMonthKeysDesc(left: string, right: string): number {
  return getMonthKey(right).localeCompare(getMonthKey(left));
}

export function listAvailableMonthKeys(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => getMonthKey(value ?? '')).filter(Boolean))].sort(
    compareMonthKeysDesc,
  );
}

export function getMonthLabel(monthKey: string): string {
  const normalizedMonth = getMonthKey(monthKey);
  if (!normalizedMonth) return '—';

  const [year, month] = normalizedMonth.split('-');
  const monthDate = new Date(Number(year), Number(month) - 1, 1);
  if (!Number.isFinite(monthDate.getTime())) return normalizedMonth;

  const label = monthFormatter.format(monthDate);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
