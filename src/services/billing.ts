import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type BillingInvoice,
  type BillingInvoiceIssuerKey,
  type BillingInvoiceItem,
  type BillingIssuer,
  type BillingIssuerInput,
  type BillingPaymentPeriod,
  type ClientBilling,
  type ClientBillingInput,
  type ClientBillingPayment,
  type ClientBillingPaymentInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { getCurrentUserId } from './serviceHelpers';

// SOLO admin — RLS en client_billing exige public.is_agency_admin(). No
// importar ni llamar desde ninguna página pública (/portal/:id, /cliente/:slug):
// anon no tiene ninguna política en esta tabla, así que ahí siempre
// devolvería [] / error silencioso, pero igual no debe consultarse.
export async function listClientBilling(): Promise<ClientBilling[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.from('client_billing').select('*');
  if (error) {
    console.error('[billing] listClientBilling', error);
    return [];
  }

  return (data ?? []) as ClientBilling[];
}

export async function upsertClientBilling(
  input: ClientBillingInput,
): Promise<ServiceMutationResult<ClientBilling>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const updated_by = await getCurrentUserId();
  const payload = { ...input, updated_by };

  const { data, error } = await supabase
    .from('client_billing')
    .upsert(payload, { onConflict: 'client_id' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[billing] upsertClientBilling', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar la facturación.') };
  }

  return { data: (data ?? null) as ClientBilling | null, error: null };
}

// ── Estado de pago mensual — mismo gate SOLO admin (RLS). Tabla pequeña (un
// puñado de clientes activos x meses), se trae completa y se filtra en el
// cliente, igual que listClientBilling de arriba. ──────────────────────────

export async function listClientBillingPayments(): Promise<ClientBillingPayment[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.from('client_billing_payments').select('*');
  if (error) {
    console.error('[billing] listClientBillingPayments', error);
    return [];
  }

  return (data ?? []) as ClientBillingPayment[];
}

export async function upsertClientBillingPayment(
  input: ClientBillingPaymentInput,
): Promise<ServiceMutationResult<ClientBillingPayment>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const updated_by = await getCurrentUserId();
  const payload = { ...input, updated_by };

  const { data, error } = await supabase
    .from('client_billing_payments')
    .upsert(payload, { onConflict: 'client_id,month,period' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[billing] upsertClientBillingPayment', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar el estado de pago.') };
  }

  return { data: (data ?? null) as ClientBillingPayment | null, error: null };
}

// Liquidación en lote del saldo entre socios — un solo upsert con todos los
// cobros compartidos que se marcan partner_paid=true de una vez (ver
// "Liquidar saldo" en FacturacionPage), en vez de una petición por fila.
export async function upsertClientBillingPaymentsBatch(
  inputs: ClientBillingPaymentInput[],
): Promise<ServiceMutationResult<ClientBillingPayment[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }
  if (inputs.length === 0) return { data: [], error: null };

  const updated_by = await getCurrentUserId();
  const payload = inputs.map((input) => ({ ...input, updated_by }));

  const { data, error } = await supabase
    .from('client_billing_payments')
    .upsert(payload, { onConflict: 'client_id,month,period' })
    .select('*');

  if (error) {
    console.error('[billing] upsertClientBillingPaymentsBatch', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo liquidar el saldo.') };
  }

  return { data: (data ?? []) as ClientBillingPayment[], error: null };
}

// ── Emisores de cuenta de cobro (billing_issuers) — SOLO admin ─────────────
// Nunca loguear ni imprimir el contenido de estas filas (NIT, cuenta, etc.):
// solo se usan para pasarlos a la vista imprimible / al formulario.

export async function listBillingIssuers(): Promise<BillingIssuer[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.from('billing_issuers').select('*');
  if (error) {
    console.error('[billing] listBillingIssuers', error);
    return [];
  }

  return (data ?? []) as BillingIssuer[];
}

export async function upsertBillingIssuer(
  input: BillingIssuerInput,
): Promise<ServiceMutationResult<BillingIssuer>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const { data, error } = await supabase
    .from('billing_issuers')
    .upsert(input, { onConflict: 'key' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[billing] upsertBillingIssuer', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar el emisor.') };
  }

  return { data: (data ?? null) as BillingIssuer | null, error: null };
}

// ── Cuentas de cobro emitidas (billing_invoices) — SOLO admin ──────────────

export async function listBillingInvoices(): Promise<BillingInvoice[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('billing_invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[billing] listBillingInvoices', error);
    return [];
  }

  return (data ?? []) as BillingInvoice[];
}

export async function getBillingInvoice(id: string): Promise<BillingInvoice | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.from('billing_invoices').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[billing] getBillingInvoice', error);
    return null;
  }

  return (data ?? null) as BillingInvoice | null;
}

// Numera SIEMPRE con el RPC take_invoice_number (consecutivo atómico por
// emisor) — nunca calcular el número de cuenta de cobro en el cliente.
export async function createBillingInvoice(params: {
  clientId: string;
  issuerKey: BillingInvoiceIssuerKey;
  month: string;
  period: BillingPaymentPeriod;
  items: BillingInvoiceItem[];
  total: number;
}): Promise<ServiceMutationResult<BillingInvoice>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const { data: invoiceNumber, error: rpcError } = await supabase.rpc('take_invoice_number', {
    p_issuer: params.issuerKey,
  });

  if (rpcError || invoiceNumber == null) {
    console.error('[billing] take_invoice_number', rpcError);
    return { data: null, error: getErrorMessage(rpcError, 'No se pudo generar el número de la cuenta de cobro.') };
  }

  const created_by = await getCurrentUserId();
  const { data, error } = await supabase
    .from('billing_invoices')
    .insert({
      client_id: params.clientId,
      issuer_key: params.issuerKey,
      invoice_number: invoiceNumber,
      month: params.month,
      period: params.period,
      items: params.items,
      total: params.total,
      created_by,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[billing] createBillingInvoice', error);
    return {
      data: null,
      error: getErrorMessage(
        error,
        `Se generó el número de cuenta de cobro #${invoiceNumber} pero no se pudo guardar. Avisa para revisar el consecutivo antes de reintentar.`,
      ),
    };
  }

  return { data: (data ?? null) as BillingInvoice | null, error: null };
}
