import { useCallback, useEffect, useRef, useState } from 'react';
import { getDashboardSnapshot, type DashboardSnapshot } from '../services/dashboard';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';

const EMPTY_DASHBOARD: DashboardSnapshot = {
  clients: [],
  dailyKpis: [],
  monthlyKpis: [],
  alerts: [],
  tasks: [],
  healthByClient: {},
  issuesByClient: {},
  metaByClient: {},
};

export function useDashboard(days = 30) {
  const { initialized, session } = useAuth();
  const [data, setData] = useState<DashboardSnapshot>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const prevDataRef = useRef<DashboardSnapshot | null>(null);

  const load = useCallback(async () => {
    if (isSupabaseConfigured && !initialized) {
      return;
    }

    if (isSupabaseConfigured && initialized && !session) {
      setData(EMPTY_DASHBOARD);
      setError(null);
      setLoading(false);
      return;
    }

    if (!prevDataRef.current) setLoading(true);
    try {
      const snapshot = await getDashboardSnapshot(days);
      prevDataRef.current = snapshot;
      setData(snapshot);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el dashboard.';
      setError(message);
      if (!prevDataRef.current) setData(EMPTY_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [days, initialized, session]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    ...data,
    loading,
    error,
    reload: load,
    isConfigured: isSupabaseConfigured,
  };
}
