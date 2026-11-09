import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type ClientBilling,
  type ClientBillingInput,
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
