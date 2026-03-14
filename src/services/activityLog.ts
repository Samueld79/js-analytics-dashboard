import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type ActivityLog,
  type ActivityLogInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { getCurrentUserId, normalizeOptionalText } from './serviceHelpers';

type ListActivityLogParams = {
  clientId?: string;
  limit?: number;
};

let internalRoleCache:
  | {
      userId: string;
      isInternal: boolean;
      fetchedAt: number;
    }
  | null = null;

async function canCurrentUserWriteActivityLog(): Promise<boolean> {
  if (!supabase) return false;

  const userId = await getCurrentUserId();
  if (!userId) return false;

  if (
    internalRoleCache &&
    internalRoleCache.userId === userId &&
    Date.now() - internalRoleCache.fetchedAt < 60_000
  ) {
    return internalRoleCache.isInternal;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[activityLog] canCurrentUserWriteActivityLog', error);
    return false;
  }

  const isInternal = data?.role !== 'client';
  internalRoleCache = {
    userId,
    isInternal,
    fetchedAt: Date.now(),
  };

  return isInternal;
}

export async function listActivityLog({
  clientId,
  limit = 20,
}: ListActivityLogParams = {}): Promise<ActivityLog[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[activityLog] listActivityLog', error);
    return [];
  }

  return (data ?? []) as ActivityLog[];
}

export async function logActivity(
  input: ActivityLogInput,
): Promise<ServiceMutationResult<ActivityLog>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (!input.entity_type.trim() || !input.action.trim()) {
    return { data: null, error: 'entity_type y action son obligatorios.' };
  }

  const canWrite = await canCurrentUserWriteActivityLog();
  if (!canWrite) {
    return { data: null, error: null };
  }

  const userId = input.user_id ?? (await getCurrentUserId());
  const payload = {
    client_id: input.client_id ?? null,
    user_id: userId,
    entity_type: input.entity_type.trim(),
    entity_id: input.entity_id ?? null,
    action: input.action.trim(),
    description: normalizeOptionalText(input.description),
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from('activity_log')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('[activityLog] logActivity', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo registrar la actividad.'),
    };
  }

  return { data: (data ?? null) as ActivityLog | null, error: null };
}

export async function logActivitySafe(input: ActivityLogInput): Promise<void> {
  const result = await logActivity(input);
  if (result.error) {
    console.warn('[activityLog] logActivitySafe', result.error);
  }
}
