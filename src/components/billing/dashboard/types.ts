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

// Una fila del "Cruce entre socios": un cliente compartido o un ingreso
// extra sin liquidar del mes seleccionado.
export type CrossRow = {
  key: string;
  label: string;
  collector: BillingInvoiceIssuerKey;
  half: number;
};
