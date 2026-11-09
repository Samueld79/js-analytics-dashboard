import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
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
    .upsert(payload, { onConflict: 'client_id,month' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[billing] upsertClientBillingPayment', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar el estado de pago.') };
  }

  return { data: (data ?? null) as ClientBillingPayment | null, error: null };
}
