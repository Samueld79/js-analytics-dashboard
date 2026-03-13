import { useCallback, useEffect, useState } from 'react';
import { getDashboardSnapshot, type DashboardSnapshot } from '../services/dashboard';
import { isSupabaseConfigured } from '../lib/supabase';

const EMPTY_DASHBOARD: DashboardSnapshot = {
  clients: [],
  dailyKpis: [],
  monthlyKpis: [],
  alerts: [],
  tasks: [],
  healthByClient: {},
  issuesByClient: {},
};

export function useDashboard(days = 30) {
  const [data, setData] = useState<DashboardSnapshot>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDashboardSnapshot(days);
      setData(snapshot);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el dashboard.';
      setError(message);
      setData(EMPTY_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [days]);

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
