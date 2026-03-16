import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import type {
  ActivityLog,
  Alert,
  HistoricalMonthlyAdMetricInput,
  HistoricalMonthlySaleInput,
  SocialMonthlyMetricInput,
  Client,
  ClientHealthScore,
  ClientMetaOverview,
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
import { listAdMetrics, upsertHistoricalMonthlyAdMetric } from '../services/adMetrics';
import { listActivityLog } from '../services/activityLog';
import { listAlerts } from '../services/alerts';
import { getClientByIdOrSlug } from '../services/clients';
import { listDailyOperatingKpis, listMonthlyOperatingKpis } from '../services/dashboard';
import { listDailySales, upsertDailySale, upsertHistoricalMonthlySale } from '../services/dailySales';
import { createClientFile, listClientFiles } from '../services/files';
import { buildClientMetaOverviewByClient, listMetaAccountSyncRows } from '../services/meta';
import { buildOperationalSnapshot } from '../services/operationalChecks';
import { listSocialMonthlyMetrics, upsertSocialMonthlyMetric } from '../services/socialMetrics';
import { listStrategies } from '../services/strategies';
import { listTasks, updateTask } from '../services/tasks';

type WorkspaceSection =
  | 'client'
  | 'metrics'
  | 'dailyKpis'
  | 'monthlyKpis'
  | 'sales'
  | 'strategies'
  | 'tasks'
  | 'alerts'
  | 'files'
  | 'activityLog'
  | 'meta'
  | 'social'
  | 'operational';

export type WorkspaceSectionError = {
  section: WorkspaceSection;
  message: string;
};

type WorkspaceState = {
  client: Client | null;
  metrics: import('../lib/supabase').AdMetric[];
  dailyKpis: ClientDailyOperatingKpi[];
  monthlyKpis: ClientMonthlyOperatingKpi[];
  sales: import('../lib/supabase').DailySale[];
  socialMonthlyMetrics: import('../lib/supabase').SocialMonthlyMetric[];
  strategies: Strategy[];
  tasks: Task[];
  alerts: Alert[];
  files: ClientFile[];
  activityLog: ActivityLog[];
  health: ClientHealthScore | null;
  issues: OperationalIssue[];
  meta: ClientMetaOverview | null;
};

const EMPTY_WORKSPACE: WorkspaceState = {
  client: null,
  metrics: [],
  dailyKpis: [],
  monthlyKpis: [],
  sales: [],
  socialMonthlyMetrics: [],
  strategies: [],
  tasks: [],
  alerts: [],
  files: [],
  activityLog: [],
  health: null,
  issues: [],
  meta: null,
};

export function useClientWorkspace(clientId?: string, days = 30) {
  const { isInternal } = useAuth();
  const [data, setData] = useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<WorkspaceSectionError[]>([]);

  const load = useCallback(async () => {
    if (!clientId) {
      setData(EMPTY_WORKSPACE);
      setError(null);
      setSectionErrors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSectionErrors([]);
    try {
      const client = await getClientByIdOrSlug(clientId);
      if (!client) {
        setData(EMPTY_WORKSPACE);
        setError(null);
        setSectionErrors([]);
        return;
      }

      const results = await Promise.allSettled([
        listAdMetrics({ clientId, days }),
        listDailyOperatingKpis({ clientId, days }),
        listMonthlyOperatingKpis({ clientId, monthsBack: 6 }),
        listDailySales({ clientId, days }),
        listSocialMonthlyMetrics({ clientId, monthsBack: 12 }),
        isInternal ? listStrategies(clientId) : Promise.resolve([]),
        isInternal ? listTasks({ clientId }) : Promise.resolve([]),
        isInternal ? listAlerts({ clientId }) : Promise.resolve([]),
        listClientFiles({ clientId }),
        isInternal ? listActivityLog({ clientId, limit: 14 }) : Promise.resolve([]),
        listMetaAccountSyncRows({ clientId }),
      ] as const);

      const nextSectionErrors: WorkspaceSectionError[] = [];
      const readResult = <T,>(
        index: number,
        section: WorkspaceSection,
        fallback: T,
      ): T => {
        const result = results[index];
        if (result.status === 'fulfilled') return result.value as T;

        const message =
          result.reason instanceof Error ? result.reason.message : `No se pudo cargar ${section}.`;
        nextSectionErrors.push({ section, message });
        return fallback;
      };

      const metrics = readResult(0, 'metrics', [] as WorkspaceState['metrics']);
      const dailyKpis = readResult(1, 'dailyKpis', [] as WorkspaceState['dailyKpis']);
      const monthlyKpis = readResult(2, 'monthlyKpis', [] as WorkspaceState['monthlyKpis']);
      const sales = readResult(3, 'sales', [] as WorkspaceState['sales']);
      const socialMonthlyMetrics = readResult(
        4,
        'social',
        [] as WorkspaceState['socialMonthlyMetrics'],
      );
      const strategies = readResult(5, 'strategies', [] as WorkspaceState['strategies']);
      const tasks = readResult(6, 'tasks', [] as WorkspaceState['tasks']);
      const alerts = readResult(7, 'alerts', [] as WorkspaceState['alerts']);
      const files = readResult(8, 'files', [] as WorkspaceState['files']);
      const activityLog = readResult(9, 'activityLog', [] as WorkspaceState['activityLog']);
      const syncRows = readResult(10, 'meta', []);

      let health: ClientHealthScore | null = null;
      let issues: OperationalIssue[] = [];

      try {
        const operationalSnapshot = buildOperationalSnapshot({
          clients: [client],
          dailySales: sales,
          dailyKpis,
          alerts,
          tasks,
        });
        health = operationalSnapshot.healthByClient[client.id] ?? null;
        issues = operationalSnapshot.issuesByClient[client.id] ?? [];
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo construir la salud operativa.';
        nextSectionErrors.push({ section: 'operational', message });
      }

      let meta: ClientMetaOverview | null = null;
      try {
        const metaByClient = buildClientMetaOverviewByClient({
          clientIds: [client.id],
          monthlyKpis,
          syncRows,
        });
        meta = metaByClient[client.id] ?? null;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo construir el estado Meta.';
        nextSectionErrors.push({ section: 'meta', message });
      }

      setData({
        client,
        metrics,
        dailyKpis,
        monthlyKpis,
        sales,
        socialMonthlyMetrics,
        strategies,
        tasks,
        alerts,
        files,
        activityLog,
        health,
        issues,
        meta,
      });
      setError(null);
      setSectionErrors(nextSectionErrors);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el workspace.';
      setError(message);
      setData(EMPTY_WORKSPACE);
      setSectionErrors([{ section: 'client', message }]);
    } finally {
      setLoading(false);
    }
  }, [clientId, days, isInternal]);

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

  const addHistoricalAds = useCallback(
    async (
      input: Omit<HistoricalMonthlyAdMetricInput, 'client_id'>,
    ): Promise<ServiceMutationResult<import('../lib/supabase').AdMetric>> => {
      if (!clientId) {
        return { data: null, error: 'Cliente inválido.' };
      }

      const result = await upsertHistoricalMonthlyAdMetric({
        ...input,
        client_id: clientId,
      });
      if (!result.error) {
        await load();
      }
      return result;
    },
    [clientId, load],
  );

  const addHistoricalSales = useCallback(
    async (
      input: Omit<HistoricalMonthlySaleInput, 'client_id'>,
    ): Promise<ServiceMutationResult<import('../lib/supabase').DailySale>> => {
      if (!clientId) {
        return { data: null, error: 'Cliente inválido.' };
      }

      const result = await upsertHistoricalMonthlySale({
        ...input,
        client_id: clientId,
      });
      if (!result.error) {
        await load();
      }
      return result;
    },
    [clientId, load],
  );

  const addSocialMonthlyMetric = useCallback(
    async (
      input: Omit<SocialMonthlyMetricInput, 'client_id'>,
    ): Promise<ServiceMutationResult<import('../lib/supabase').SocialMonthlyMetric>> => {
      if (!clientId) {
        return { data: null, error: 'Cliente inválido.' };
      }

      const result = await upsertSocialMonthlyMetric({
        ...input,
        client_id: clientId,
      });
      if (!result.error) {
        await load();
      }
      return result;
    },
    [clientId, load],
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
        await load();
      }
      return result;
    },
    [load],
  );

  return {
    ...data,
    loading,
    error,
    sectionErrors,
    reload: load,
    addSale,
    addHistoricalAds,
    addHistoricalSales,
    addSocialMonthlyMetric,
    addFile,
    updateTask: updateWorkspaceTask,
    isConfigured: isSupabaseConfigured,
  };
}
