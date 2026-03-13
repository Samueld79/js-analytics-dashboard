import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type ClientFile,
  type ClientFileInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { getCurrentUserId, normalizeOptionalText } from './serviceHelpers';

type ListClientFilesParams = {
  clientId?: string;
  strategyId?: string;
};

export async function listClientFiles({
  clientId,
  strategyId,
}: ListClientFilesParams = {}): Promise<ClientFile[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('client_files')
    .select('*')
    .order('created_at', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);
  if (strategyId) query = query.eq('strategy_id', strategyId);

  const { data, error } = await query;
  if (error) {
    console.error('[files] listClientFiles', error);
    return [];
  }

  return (data ?? []) as ClientFile[];
}

export async function createClientFile(
  input: ClientFileInput,
): Promise<ServiceMutationResult<ClientFile>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (!input.client_id || !input.name.trim() || !input.drive_url.trim()) {
    return { data: null, error: 'Cliente, nombre y URL de Drive son obligatorios.' };
  }

  const createdBy = input.created_by ?? (await getCurrentUserId());
  const payload = {
    client_id: input.client_id,
    strategy_id: input.strategy_id ?? null,
    file_type: input.file_type,
    name: input.name.trim(),
    drive_url: input.drive_url.trim(),
    drive_file_id: normalizeOptionalText(input.drive_file_id),
    created_by: createdBy,
  };

  const { data, error } = await supabase
    .from('client_files')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[files] createClientFile', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo registrar el archivo.'),
    };
  }

  return { data: (data ?? null) as ClientFile | null, error: null };
}
