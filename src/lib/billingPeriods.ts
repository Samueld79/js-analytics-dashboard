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
