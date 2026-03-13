import { useCallback, useEffect, useState } from 'react';
import type {
  Alert,
  Client,
  ClientHealthScore,
  ClientFile,
  ClientFileInput,
  ClientDailyOperatingKpi,
  ClientMonthlyOperatingKpi,
  DailySaleInput,
  OperationalIssue,
  ServiceMutationResult,
  Strategy,
  Task,
} from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import { listAdMetrics } from '../services/adMetrics';
import { listAlerts } from '../services/alerts';
import { getClientByIdOrSlug } from '../services/clients';
import { listDailyOperatingKpis, listMonthlyOperatingKpis } from '../services/dashboard';
import { listDailySales, upsertDailySale } from '../services/dailySales';
import { createClientFile, listClientFiles } from '../services/files';
import { buildOperationalSnapshot } from '../services/operationalChecks';
import { listStrategies } from '../services/strategies';
import { listTasks, updateTask } from '../services/tasks';

type WorkspaceState = {
  client: Client | null;
  metrics: import('../lib/supabase').AdMetric[];
  dailyKpis: ClientDailyOperatingKpi[];
  monthlyKpis: ClientMonthlyOperatingKpi[];
  sales: import('../lib/supabase').DailySale[];
  strategies: Strategy[];
  tasks: Task[];
  alerts: Alert[];
  files: ClientFile[];
  health: ClientHealthScore | null;
  issues: OperationalIssue[];
};

const EMPTY_WORKSPACE: WorkspaceState = {
  client: null,
  metrics: [],
  dailyKpis: [],
  monthlyKpis: [],
  sales: [],
  strategies: [],
  tasks: [],
  alerts: [],
  files: [],
  health: null,
  issues: [],
};

export function useClientWorkspace(clientId?: string, days = 30) {
  const [data, setData] = useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setData(EMPTY_WORKSPACE);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [client, metrics, dailyKpis, monthlyKpis, sales, strategies, tasks, alerts, files] = await Promise.all([
        getClientByIdOrSlug(clientId),
        listAdMetrics({ clientId, days }),
        listDailyOperatingKpis({ clientId, days }),
        listMonthlyOperatingKpis({ clientId, monthsBack: 2 }),
        listDailySales({ clientId, days }),
        listStrategies(clientId),
        listTasks({ clientId }),
        listAlerts({ clientId }),
        listClientFiles({ clientId }),
      ]);

      const operationalSnapshot = buildOperationalSnapshot({
        clients: client ? [client] : [],
        dailySales: sales,
        dailyKpis,
        alerts,
        tasks,
      });
      const health = client ? operationalSnapshot.healthByClient[client.id] ?? null : null;
      const issues = client ? operationalSnapshot.issuesByClient[client.id] ?? [] : [];

      setData({
        client,
        metrics,
        dailyKpis,
        monthlyKpis,
        sales,
        strategies,
        tasks,
        alerts,
        files,
        health,
        issues,
      });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el workspace.';
      setError(message);
      setData(EMPTY_WORKSPACE);
    } finally {
      setLoading(false);
    }
  }, [clientId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const addSale = useCallback(
    async (sale: DailySaleInput): Promise<ServiceMutationResult<import('../lib/supabase').DailySale>> => {
      const result = await upsertDailySale(sale);
      if (!result.error) {
        await load();
      }
      return result;
    },
    [load],
  );

  const updateWorkspaceTask = useCallback(
    async (
      id: string,
      updates: import('../lib/supabase').TaskUpdateInput,
    ): Promise<ServiceMutationResult<Task>> => {
      const result = await updateTask(id, updates);
      if (result.data) {
        await load();
      }
      return result;
    },
    [load],
  );

  const addFile = useCallback(
    async (file: ClientFileInput): Promise<ServiceMutationResult<ClientFile>> => {
      const result = await createClientFile(file);
      if (result.data) {
        setData((current) => ({
          ...current,
          files: [result.data as ClientFile, ...current.files],
        }));
      }
      return result;
    },
    [],
  );

  return {
    ...data,
    loading,
    error,
    reload: load,
    addSale,
    addFile,
    updateTask: updateWorkspaceTask,
    isConfigured: isSupabaseConfigured,
  };
}
