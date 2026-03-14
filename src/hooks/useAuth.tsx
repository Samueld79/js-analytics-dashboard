import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  supabase,
  type ClientMembership,
  type ServiceMutationResult,
  type UserProfile,
  type UserRole,
} from '../lib/supabase';
import { loadAuthContext, signInWithPassword, signOut } from '../services/auth';

type AuthContextValue = {
  authEnabled: boolean;
  initialized: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  memberships: ClientMembership[];
  role: UserRole;
  isClient: boolean;
  isInternal: boolean;
  activeMemberships: ClientMembership[];
  accessibleClientIds: string[];
  primaryClientId: string | null;
  defaultClientId: string | null;
  clientWorkspacePath: string;
  signIn: (params: {
    email: string;
    password: string;
  }) => Promise<ServiceMutationResult<Session>>;
  signOut: () => Promise<ServiceMutationResult<null>>;
  refresh: () => Promise<void>;
  canAccessClient: (clientId?: string | null) => boolean;
  canWriteSales: (clientId?: string | null) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isMembershipWritable(membership: ClientMembership): boolean {
  return membership.status === 'active' && ['manager', 'client'].includes(membership.access_level);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(!isSupabaseConfigured);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<ClientMembership[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setMemberships([]);
      setLoading(false);
      setInitialized(true);
      return;
    }

    setLoading(true);
    try {
      const next = await loadAuthContext();
      setSession(next.session);
      setUser(next.user);
      setProfile(next.profile);
      setMemberships(next.memberships);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refresh]);

  const activeMemberships = useMemo(
    () => memberships.filter((membership) => membership.status === 'active'),
    [memberships],
  );
  const role: UserRole = profile?.role ?? (session ? 'operator' : 'anonymous');
  const isClient = role === 'client';
  const accessibleClientIds = useMemo(
    () =>
      [
        ...new Set(
          (isClient ? activeMemberships.slice(0, 1) : activeMemberships).map(
            (membership) => membership.client_id,
          ),
        ),
      ],
    [activeMemberships, isClient],
  );
  const primaryClientId = accessibleClientIds[0] ?? null;
  const defaultClientId = primaryClientId;
  const clientWorkspacePath = '/mi-espacio';
  const isInternal = role !== 'client' && role !== 'anonymous';
  const scopedMemberships = isClient ? activeMemberships.slice(0, 1) : activeMemberships;

  const handleSignIn = useCallback<AuthContextValue['signIn']>(async (params) => {
    const result = await signInWithPassword(params);
    if (!result.error) {
      await refresh();
    }
    return result;
  }, [refresh]);

  const handleSignOut = useCallback<AuthContextValue['signOut']>(async () => {
    const result = await signOut();
    if (!result.error) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setMemberships([]);
    }
    return result;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authEnabled: isSupabaseConfigured,
      initialized,
      loading,
      session,
      user,
      profile,
      memberships,
      role,
      isClient,
      isInternal,
      activeMemberships: scopedMemberships,
      accessibleClientIds,
      primaryClientId,
      defaultClientId,
      clientWorkspacePath,
      signIn: handleSignIn,
      signOut: handleSignOut,
      refresh,
      canAccessClient: (clientId?: string | null) => {
        if (!clientId) return false;
        return isInternal || clientId === primaryClientId;
      },
      canWriteSales: (clientId?: string | null) => {
        if (!clientId) return false;
        if (isInternal) return true;
        return scopedMemberships.some(
          (membership) => membership.client_id === clientId && isMembershipWritable(membership),
        );
      },
    }),
    [
      accessibleClientIds,
      clientWorkspacePath,
      defaultClientId,
      handleSignIn,
      handleSignOut,
      isClient,
      initialized,
      isInternal,
      loading,
      memberships,
      primaryClientId,
      profile,
      refresh,
      role,
      session,
      scopedMemberships,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return context;
}
