import { isSupabaseConfigured, supabase, type ClientNote } from '../lib/supabase';

// Notas aptas para cliente — visibility='client' únicamente. Nunca lee ni
// expone notas internas. Funciona tanto desde /portal/:id (anon key, ver
// migración 20261108_billing_diagnostic_report.sql sección 7) como desde la
// vista interna (authenticated, política client_notes_select existente).
export async function listPublicClientNotes(clientId: string): Promise<ClientNote[]> {
  if (!isSupabaseConfigured || !supabase || !clientId) return [];

  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('client_id', clientId)
    .eq('visibility', 'client')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[clientNotes] listPublicClientNotes', error);
    return [];
  }

  return (data ?? []) as ClientNote[];
}
