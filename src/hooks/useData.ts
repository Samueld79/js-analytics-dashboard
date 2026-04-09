import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listAdMetrics } from '../services/adMetrics';
import {
  listAdCampaignMetrics,
  aggregateCampaignMetricsByMonth,
} from '../services/adCampaignMetrics';
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
    return result;
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

// Module-level caches — survive navigation within the app session.
// Key: clientId or '__all__'
const _monthlyHistoryCache = new Map<string, CampaignAggregateByMonth[]>();
const _campaignSummaryCache = new Map<string, AdCampaignMetric[]>();

// Fetches 1 year of ad_campaign_metrics and aggregates them by month.
// clientId=undefined → all clients (MetricsPage "Todos los clientes" mode).
// clientId=UUID      → filtered to that client.
// Results are cached in memory — use reload(true) to force a fresh fetch.
export function useCampaignMonthlyHistory(clientId?: string) {
  const cacheKey = clientId ?? '__all__';
  const [byMonth, setByMonth] = useState<CampaignAggregateByMonth[]>(
    () => _monthlyHistoryCache.get(cacheKey) ?? [],
  );
  const [loading, setLoading] = useState(!_monthlyHistoryCache.has(cacheKey));

  const load = useCallback(async (force = false) => {
    if (!force && _monthlyHistoryCache.has(cacheKey)) return;
    setLoading(true);
    try {
      const rows = await listAdCampaignMetrics({ clientId, days: 365 });
      const agg = aggregateCampaignMetricsByMonth(rows);
      _monthlyHistoryCache.set(cacheKey, agg);
      setByMonth(agg);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientId, cacheKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { byMonth, loading, reload: () => load(true) };
}

/**
 * Shared hook for Dashboard and ClientsPage.
 * Primary source: ad_campaign_metrics (covers Jan/Feb/Mar excel imports).
 * Returns:
 *   - byMonth: all months aggregated (total across all / one client)
 *   - currentPeriod: most recent month aggregate
 *   - byClient: per-client aggregate for the current period (Map<clientId, KPIs>)
 *   - loading
 *
 * Pass clientId to scope to a single client; omit for all clients.
 * days=90 covers the three available periods (2026-01-31, 2026-02-28, 2026-03-17).
 */
// enabled=false → skip fetch (use when clientId may be temporarily undefined before data loads)
export function useCampaignSummary(clientId?: string, days = 90, enabled = true) {
  const cacheKey = `${clientId ?? '__all__'}:${days}`;
  const [rows, setRows] = useState<AdCampaignMetric[]>(
    () => _campaignSummaryCache.get(cacheKey) ?? [],
  );
  const [loading, setLoading] = useState(enabled && !_campaignSummaryCache.has(cacheKey));

  const load = useCallback(async (force = false) => {
    if (!enabled) return;
    if (!force && _campaignSummaryCache.has(cacheKey)) return;
    setLoading(true);
    try {
      const data = await listAdCampaignMetrics({ clientId, days });
      _campaignSummaryCache.set(cacheKey, data);
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientId, days, cacheKey, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const byMonth = useMemo(() => aggregateCampaignMetricsByMonth(rows), [rows]);

  // rows exposed so callers can filter by period and call aggregateCampaignKpisByClient
  return { rows, byMonth, loading, reload: () => load(true) };
}

export function useAdCampaignMetrics(clientId?: string, days = 90) {
  const [rows, setRows] = useState<AdCampaignMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const prevDataRef = useRef<AdCampaignMetric[] | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return; // wait for real UUID
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
