import type { Session, User } from '@supabase/supabase-js';
import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type ClientMembership,
  type ServiceMutationResult,
  type UserProfile,
} from '../lib/supabase';

export type AuthContextSnapshot = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  memberships: ClientMembership[];
};

function buildFallbackContext(): AuthContextSnapshot {
  return {
    session: null,
    user: null,
    profile: null,
    memberships: [],
  };
}

async function ensureOwnUserProfile(user: User): Promise<UserProfile | null> {
  if (!supabase) return null;

  const payload = {
    id: user.id,
    email: user.email ?? null,
    full_name:
      (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
      (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
      null,
  };

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[auth] ensureOwnUserProfile', error);
    return null;
  }

  return (data ?? null) as UserProfile | null;
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[auth] getCurrentSession', error);
    return null;
  }

  return data.session ?? null;
}

export async function getCurrentUserProfile(user?: User | null): Promise<UserProfile | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const activeUser = user ?? (await getCurrentSession())?.user ?? null;
  if (!activeUser) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', activeUser.id)
    .maybeSingle();

  if (!error && data) {
    return data as UserProfile;
  }

  if (error) {
    console.warn('[auth] getCurrentUserProfile fallback', error);
  }

  return ensureOwnUserProfile(activeUser);
}

export async function listCurrentUserMemberships(userId?: string | null): Promise<ClientMembership[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('client_memberships')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[auth] listCurrentUserMemberships', error);
    return [];
  }

  return (data ?? []) as ClientMembership[];
}

export async function loadAuthContext(): Promise<AuthContextSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    return buildFallbackContext();
  }

  const session = await getCurrentSession();
  const user = session?.user ?? null;
  if (!user) {
    return buildFallbackContext();
  }

  const [profile, memberships] = await Promise.all([
    getCurrentUserProfile(user),
    listCurrentUserMemberships(user.id),
  ]);

  return {
    session,
    user,
    profile,
    memberships,
  };
}

export async function signInWithPassword(params: {
  email: string;
  password: string;
}): Promise<ServiceMutationResult<Session>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email.trim(),
    password: params.password,
  });

  if (error) {
    console.error('[auth] signInWithPassword', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo iniciar sesion.'),
    };
  }

  if (data.user) {
    await ensureOwnUserProfile(data.user);
  }

  return {
    data: data.session ?? null,
    error: null,
  };
}

export async function signOut(): Promise<ServiceMutationResult<null>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[auth] signOut', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo cerrar sesion.') };
  }

  return { data: null, error: null };
}
