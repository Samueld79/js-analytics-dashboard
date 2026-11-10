import type { BillingPaymentFrequency, BillingPaymentPeriod } from './supabase';

// mensual/anticipado => un solo cobro ('mes'). quincenal => dos ('q1','q2'),
// cada uno por fee/2. Cambiar de modalidad nunca borra pagos ya guardados
// del otro esquema, solo deja de mostrarlos.
export function periodsForFrequency(freq: BillingPaymentFrequency | null | undefined): BillingPaymentPeriod[] {
  return freq === 'quincenal' ? ['q1', 'q2'] : ['mes'];
}

// Día(s) de pago por defecto cuando el cliente es quincenal y no tiene
// pay_days configurado todavía.
export const DEFAULT_PAY_DAYS: readonly [number, number] = [1, 15];

export function sortedPayDays(payDays: number[] | null | undefined): number[] {
  return payDays && payDays.length > 0 ? [...payDays].sort((a, b) => a - b) : [];
}

// Día de pago efectivo para un periodo dado. 'mes' solo tiene día si
// pay_days trae exactamente uno (ej. {15}); si no, no hay día específico.
// 'q1'/'q2' siempre resuelven a un día: el propio pay_days si trae dos
// valores, o {1,15} por defecto.
export function payDayForPeriod(
  period: BillingPaymentPeriod,
  payDays: number[] | null | undefined,
): number | null {
  const sorted = sortedPayDays(payDays);
  if (period === 'mes') return sorted.length === 1 ? sorted[0] : null;
  const days = sorted.length === 2 ? sorted : DEFAULT_PAY_DAYS;
  return period === 'q1' ? days[0] : days[1];
}

export function periodLabel(period: BillingPaymentPeriod, payDays: number[] | null | undefined): string {
  const day = payDayForPeriod(period, payDays);
  if (period === 'mes') return day != null ? `Vence el ${day}` : 'Mes completo';
  return day != null ? `Pago del ${day}` : period === 'q1' ? 'Primera quincena' : 'Segunda quincena';
}

// ── Selector "Día(s) de pago" de /admin/facturacion ────────────────────────

export type PayDaysPreset = '15' | '1-15' | '1' | '30' | 'custom';

export const PAY_DAYS_PRESET_LABELS: Record<PayDaysPreset, string> = {
  '15': '15',
  '1-15': '1 y 15',
  '1': '1',
  '30': '30',
  custom: 'Otro día',
};

export const PAY_DAYS_PRESET_VALUES: Record<Exclude<PayDaysPreset, 'custom'>, number[]> = {
  '15': [15],
  '1-15': [1, 15],
  '1': [1],
  '30': [30],
};

export function presetForPayDays(payDays: number[] | null | undefined): PayDaysPreset {
  const sorted = sortedPayDays(payDays);
  if (sorted.length === 1 && sorted[0] === 15) return '15';
  if (sorted.length === 1 && sorted[0] === 1) return '1';
  if (sorted.length === 1 && sorted[0] === 30) return '30';
  if (sorted.length === 2 && sorted[0] === 1 && sorted[1] === 15) return '1-15';
  return 'custom';
}

// ── Texto de periodo y fecha por defecto para cuentas de cobro ─────────────

const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

// "del 1 al 15 de noviembre de 2026" / "del 16 al 30 de noviembre de 2026" /
// "del 1 al 30 de noviembre de 2026" (mes completo) — para la descripción
// por defecto de "Servicios de Growth Marketing" en la cuenta de cobro.
export function periodDateRangeText(month: string, period: BillingPaymentPeriod): string {
  const [y, m] = month.split('-').map(Number);
  const monthName = MONTH_NAMES_ES[m - 1];
  const lastDay = lastDayOfMonth(y, m - 1);
  if (period === 'q1') return `del 1 al 15 de ${monthName} de ${y}`;
  if (period === 'q2') return `del 16 al ${lastDay} de ${monthName} de ${y}`;
  return `del 1 al ${lastDay} de ${monthName} de ${y}`;
}

// Versión corta para tablas, ej. "1–15 nov 2026" / "16–30 nov 2026".
export function periodRangeShort(month: string, period: BillingPaymentPeriod): string {
  const [y, m] = month.split('-').map(Number);
  const lastDay = lastDayOfMonth(y, m - 1);
  const monthAbbr = MONTH_NAMES_ES[m - 1].slice(0, 3);
  if (period === 'q1') return `1–15 ${monthAbbr} ${y}`;
  if (period === 'q2') return `16–${lastDay} ${monthAbbr} ${y}`;
  return `1–${lastDay} ${monthAbbr} ${y}`;
}

// Fecha por defecto de la cuenta de cobro (issue_date), editable en el
// modal: q1 -> día 1, q2 -> día 15, 'mes' -> el primer pay_day si existe,
// o el día 1 (cubre tanto anticipado como mensual sin pay_days definido).
export function defaultIssueDateForPeriod(
  month: string,
  period: BillingPaymentPeriod,
  payDays: number[] | null | undefined,
): string {
  const [y, m] = month.split('-').map(Number);
  let day: number;
  if (period === 'q1') day = 1;
  else if (period === 'q2') day = 15;
  else {
    const sorted = sortedPayDays(payDays);
    day = sorted.length > 0 ? sorted[0] : 1;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
