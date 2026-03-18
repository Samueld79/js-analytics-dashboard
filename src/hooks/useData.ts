import { useCallback, useEffect, useRef, useState } from 'react';
import { listAdMetrics } from '../services/adMetrics';
import { listAdCampaignMetrics, aggregateCampaignMetricsByMonth } from '../services/adCampaignMetrics';
import { listMonthlyOperatingKpis } from '../services/dashboard';
import { listMetaAccountSyncRows } from '../services/meta';
import { listTasks, updateTask as saveTask, deleteTask as removeTask } from '../services/tasks';
import type {
  AdCampaignMetric,
  AdMetric,
  AdAccountSyncRow,
  CampaignAggregateByMonth,
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

// Fetches 2 years of ad_campaign_metrics and aggregates them by month.
// Used in MetricsPage to fill historical months that ad_metrics doesn't cover.
export function useCampaignMonthlyHistory(clientId?: string) {
  const [byMonth, setByMonth] = useState<CampaignAggregateByMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const prevDataRef = useRef<CampaignAggregateByMonth[] | null>(null);

  const load = useCallback(async () => {
    if (!prevDataRef.current) setLoading(true);
    try {
      const rows = await listAdCampaignMetrics({ clientId, days: 730 });
      const agg = aggregateCampaignMetricsByMonth(rows);
      prevDataRef.current = agg;
      setByMonth(agg);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { byMonth, loading, reload: load };
}

export function useAdCampaignMetrics(clientId?: string, days = 90) {
  const [rows, setRows] = useState<AdCampaignMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const prevDataRef = useRef<AdCampaignMetric[] | null>(null);

  const load = useCallback(async () => {
    if (!prevDataRef.current) setLoading(true);
    try {
      const data = await listAdCampaignMetrics({ clientId, days });
      prevDataRef.current = data;
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, reload: load };
}
