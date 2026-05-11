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

// Fetches 2 years of ad_campaign_metrics and aggregates them by month.
// clientId=undefined → all clients (MetricsPage "Todos los clientes" mode).
// clientId=UUID      → filtered to that client.
export function useCampaignMonthlyHistory(clientId?: string) {
  const [byMonth, setByMonth] = useState<CampaignAggregateByMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const prevDataRef = useRef<CampaignAggregateByMonth[] | null>(null);

  const load = useCallback(async () => {
    if (!prevDataRef.current) setLoading(true);
    try {
      const rows = await listAdCampaignMetrics({ clientId, days: 730 });
      console.log('[useCampaignMonthlyHistory] clientId:', clientId, 'rows:', rows.length, 'months:', [...new Set(rows.map((r) => r.date.slice(0, 7)))]);
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

/**
 * Shared hook for Dashboard and ClientDetailPage.
 * Fetches 365 days of ad_campaign_metrics so all historical months are available.
 * byMonth is the union of months with data PLUS the current calendar month,
 * ensuring the current month always appears as a period option even before data arrives.
 */
export function useCampaignSummary(clientId?: string, days = 365) {
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

  const byMonth = useMemo(() => {
    const fromData = aggregateCampaignMetricsByMonth(rows);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const hasCurrentMonth = fromData.some((m) => m.month === currentMonth);
    if (hasCurrentMonth) return fromData;
    // Append current month as empty placeholder so selectors always show it
    return [
      ...fromData,
      { month: currentMonth, spend: 0, reach: 0, impressions: 0, cpm: 0, frequency: 0, messages: 0, profileVisits: 0, leads: 0, purchases: 0, purchaseValue: 0, linkClicks: 0, pageEngagement: 0, postEngagement: 0, videoViews: 0, thruplays: 0, campaignCount: 0, adRoas: 0, costPerConversation: null, costPerProfileVisit: null },
    ];
  }, [rows]);

  // rows exposed so callers can filter by period and call aggregateCampaignKpisByClient
  return { rows, byMonth, loading, reload: load };
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
