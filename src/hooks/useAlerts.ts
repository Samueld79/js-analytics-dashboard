import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import {
  isSupabaseConfigured,
  type Alert,
  type AlertStatus,
  type ServiceMutationResult,
} from '../lib/supabase';
import { listAlerts, updateAlertStatus } from '../services/alerts';

export function useAlerts() {
  const { isInternal } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isInternal) {
      setAlerts([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await listAlerts();
      setAlerts(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar las alertas.';
      setError(message);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [isInternal]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = useCallback(async (id: string, status: AlertStatus): Promise<ServiceMutationResult<Alert>> => {
    const result = await updateAlertStatus(id, status);
    if (result.data) {
      setAlerts((current) => current.map((alert) => (alert.id === id ? result.data ?? alert : alert)));
    }
    return result;
  }, []);

  const markRead = useCallback((id: string) => changeStatus(id, 'read'), [changeStatus]);
  const resolve = useCallback((id: string) => changeStatus(id, 'resolved'), [changeStatus]);
  const dismiss = useCallback((id: string) => changeStatus(id, 'dismissed'), [changeStatus]);

  const unreadCount = useMemo(
    () => alerts.filter((alert) => alert.status === 'unread').length,
    [alerts],
  );

  return {
    alerts,
    loading,
    error,
    unreadCount,
    reload: load,
    markRead,
    resolve,
    dismiss,
    isConfigured: isSupabaseConfigured,
  };
}
