import type { BillingInvoiceIssuerKey, BillingIssuer, BillingPaymentPeriod, Client } from '../../../lib/supabase';

// Un cobro pendiente (periodo sin pagar) con su fecha de vencimiento
// calculada — usado por "Por cobrar ahora" y "Próximos 7 días".
export type DueItem = {
  client: Client;
  period: BillingPaymentPeriod;
  month: string;
  dueDate: string;
  amount: number;
  payDays: number[] | null | undefined;
  issuerKey: BillingInvoiceIssuerKey | null;
  issuer: BillingIssuer | undefined;
  existingInvoiceId: string | null;
};

export type TrendMonth = {
  monthKey: string;
  label: string;
  expected: number;
  collected: number;
};

export type ReceiverTotals = { expected: number; collected: number };

// Una fila del "Cruce entre socios" (tarjeta vieja, oculta — ver
// FacturacionPage/SHOW_LEGACY_NET_BALANCE_CARD): un cliente compartido o un
// ingreso extra sin liquidar del mes seleccionado.
export type CrossRow = {
  key: string;
  label: string;
  collector: BillingInvoiceIssuerKey;
  half: number;
};

// Una fila de "Ver cobros del mes" en la tarjeta nueva de meta mensual
// (PartnerGoalCard): un cliente compartido (uno por periodo) o un ingreso
// extra del mes, con el monto completo y su mitad.
export type PartnerGoalRow = {
  key: string;
  label: string;
  collector: BillingInvoiceIssuerKey;
  amount: number;
  half: number;
};
