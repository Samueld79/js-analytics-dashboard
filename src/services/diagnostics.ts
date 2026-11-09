import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type ClientDiagnostic,
  type ClientDiagnosticInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { getCurrentUserId } from './serviceHelpers';

// Interno (is_internal_user: admin/team/strategist/operator/partner). No
// importar desde /portal/:id ni /cliente/:slug.
export async function getClientDiagnostic(clientId: string): Promise<ClientDiagnostic | null> {
  if (!isSupabaseConfigured || !supabase || !clientId) return null;

  const { data, error } = await supabase
    .from('client_diagnostics')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) {
    console.error('[diagnostics] getClientDiagnostic', error);
    return null;
  }

  return (data ?? null) as ClientDiagnostic | null;
}

export async function upsertClientDiagnostic(
  input: ClientDiagnosticInput,
): Promise<ServiceMutationResult<ClientDiagnostic>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const created_by = await getCurrentUserId();
  const payload = { ...input, created_by };

  const { data, error } = await supabase
    .from('client_diagnostics')
    .upsert(payload, { onConflict: 'client_id' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[diagnostics] upsertClientDiagnostic', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar el diagnóstico.') };
  }

  return { data: (data ?? null) as ClientDiagnostic | null, error: null };
}
