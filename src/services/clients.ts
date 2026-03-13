import {
  isSupabaseConfigured,
  supabase,
  type Client,
} from '../lib/supabase';

export async function listClients(): Promise<Client[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.from('clients').select('*').order('name');
  if (error) {
    console.error('[clients] listClients', error);
    return [];
  }

  return (data ?? []) as Client[];
}

export async function getClientByIdOrSlug(identifier: string): Promise<Client | null> {
  if (!identifier || !isSupabaseConfigured || !supabase) return null;

  const byId = await supabase.from('clients').select('*').eq('id', identifier).maybeSingle();
  if (byId.data) return byId.data as Client;

  const bySlug = await supabase.from('clients').select('*').eq('slug', identifier).maybeSingle();
  if (bySlug.error) {
    console.error('[clients] getClientByIdOrSlug', bySlug.error);
    return null;
  }

  return (bySlug.data ?? null) as Client | null;
}
