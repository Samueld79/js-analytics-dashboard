import { useCallback, useEffect, useRef, useState } from 'react';
import { listAdMetrics } from '../services/adMetrics';
import { listMonthlyOperatingKpis } from '../services/dashboard';
import { listMetaAccountSyncRows } from '../services/meta';
import { listTasks, updateTask as saveTask, deleteTask as removeTask } from '../services/tasks';
import type {
  AdMetric,
  AdAccountSyncRow,
  ClientMonthlyOperatingKpi,
  Task,
  TaskUpdateInput,
} from '../lib/supabase';

export { useAlerts } from './useAlerts';
export { useClient, useClients } from './useClients';
export { useDailySales } from './useDailySales';
export { useDashboard } from './useDashboard';
export { useStrategies } from './useStrategies';

export function useAdMetrics(clientId?: string, days = 30) {
  const [metrics, setMetrics] = useState<AdMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const prevDataRef = useRef<AdMetric[] | null>(null);

  const load = useCallback(async () => {
    if (!prevDataRef.current) setLoading(true);
    try {
      const data = await listAdMetrics({ clientId, days });
      prevDataRef.current = data;
      setMetrics(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  return { metrics, loading, reload: load };
}

export function useMonthlyOperatingKpis(clientId?: string, monthsBack = 6) {
  const [monthlyKpis, setMonthlyKpis] = useState<ClientMonthlyOperatingKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const prevDataRef = useRef<ClientMonthlyOperatingKpi[] | null>(null);

  const load = useCallback(async () => {
    if (!prevDataRef.current) setLoading(true);
    try {
      const data = await listMonthlyOperatingKpis({ clientId, monthsBack });
      prevDataRef.current = data;
      setMonthlyKpis(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientId, monthsBack]);

  useEffect(() => {
    void load();
  }, [load]);

  return { monthlyKpis, loading, reload: load };
}

export function useMetaSyncRows(clientId?: string) {
  const [syncRows, setSyncRows] = useState<AdAccountSyncRow[]>([]);
  const [loading, setLoading] = useState(true);
  const prevDataRef = useRef<AdAccountSyncRow[] | null>(null);

  const load = useCallback(async () => {
    if (!prevDataRef.current) setLoading(true);
    try {
      const data = await listMetaAccountSyncRows({ clientId });
      prevDataRef.current = data;
      setSyncRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { syncRows, loading, reload: load };
}

export function useTasks(clientId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const prevDataRef = useRef<Task[] | null>(null);

  const load = useCallback(async () => {
    if (!prevDataRef.current) setLoading(true);
    try {
      const data = await listTasks({ clientId });
      prevDataRef.current = data;
      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateTask = async (id: string, updates: TaskUpdateInput) => {
    const result = await saveTask(id, updates);
    if (result.data) {
      setTasks((current) => current.map((task) => (task.id === id ? result.data ?? task : task)));
    }
  };

  const deleteTask = async (id: string) => {
    const result = await removeTask(id);
    if (!result.error) {
      setTasks((current) => current.filter((task) => task.id !== id));
    }
    return result;
  };

  return { tasks, loading, updateTask, deleteTask, reload: load };
}
