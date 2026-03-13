import { useCallback, useEffect, useState } from 'react';
import { listAdMetrics } from '../services/adMetrics';
import { listTasks, updateTask as saveTask } from '../services/tasks';
import type {
  AdMetric,
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

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listAdMetrics({ clientId, days });
    setMetrics(data);
    setLoading(false);
  }, [clientId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  return { metrics, loading, reload: load };
}

export function useTasks(clientId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listTasks({ clientId });
    setTasks(data);
    setLoading(false);
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

  return { tasks, loading, updateTask, reload: load };
}
