import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import type {
  ServiceMutationResult,
  Strategy,
  StrategyHistory,
  StrategyInput,
  StrategyStatus,
  Task,
} from '../lib/supabase';
import {
  createStrategy,
  listStrategies,
  listStrategyHistory,
  updateStrategy,
  updateStrategyStatus,
} from '../services/strategies';
import { createTasksFromChecklist } from '../services/tasks';

type HistoryMap = Record<string, StrategyHistory[]>;

export function useStrategies(clientId?: string) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [historyByStrategy, setHistoryByStrategy] = useState<HistoryMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistoryIds, setLoadingHistoryIds] = useState<Record<string, boolean>>({});
  const [generatingTaskIds, setGeneratingTaskIds] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listStrategies(clientId);
      setStrategies(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar las estrategias.';
      setError(message);
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (
      input: StrategyInput,
      options: { changeSummary?: string | null } = {},
    ): Promise<ServiceMutationResult<Strategy>> => {
      setSaving(true);
      const result = await createStrategy(input, options);
      if (result.data) {
        await load();
      } else if (result.error) {
        setError(result.error);
      }
      setSaving(false);
      return result;
    },
    [load],
  );

  const edit = useCallback(
    async (
      id: string,
      input: StrategyInput,
      options: { changeSummary?: string | null } = {},
    ): Promise<ServiceMutationResult<Strategy>> => {
      setSaving(true);
      const result = await updateStrategy(id, input, options);
      if (result.data) {
        await Promise.all([load(), listStrategyHistory(id).then((history) => {
          setHistoryByStrategy((current) => ({ ...current, [id]: history }));
        })]);
      } else if (result.error) {
        setError(result.error);
      }
      setSaving(false);
      return result;
    },
    [load],
  );

  const updateStatus = useCallback(
    async (
      id: string,
      status: StrategyStatus,
      changeSummary?: string,
    ): Promise<ServiceMutationResult<Strategy>> => {
      setSaving(true);
      const result = await updateStrategyStatus(id, status, changeSummary);
      if (result.data) {
        await Promise.all([load(), listStrategyHistory(id).then((history) => {
          setHistoryByStrategy((current) => ({ ...current, [id]: history }));
        })]);
      } else if (result.error) {
        setError(result.error);
      }
      setSaving(false);
      return result;
    },
    [load],
  );

  const loadHistory = useCallback(async (strategyId: string): Promise<StrategyHistory[]> => {
    if (!strategyId) return [];

    setLoadingHistoryIds((current) => ({ ...current, [strategyId]: true }));
    try {
      const data = await listStrategyHistory(strategyId);
      setHistoryByStrategy((current) => ({ ...current, [strategyId]: data }));
      return data;
    } finally {
      setLoadingHistoryIds((current) => ({ ...current, [strategyId]: false }));
    }
  }, []);

  const generateTasks = useCallback(
    async (
      strategyId: string,
      checklist?: Strategy['ai_checklist'],
    ): Promise<ServiceMutationResult<Task[]>> => {
      const strategy = strategies.find((entry) => entry.id === strategyId);
      if (!strategy) {
        return { data: null, error: 'La estrategia no esta disponible en pantalla.' };
      }

      setGeneratingTaskIds((current) => ({ ...current, [strategyId]: true }));
      try {
        const result = await createTasksFromChecklist({
          clientId: strategy.client_id,
          strategyId,
          checklist: checklist ?? strategy.ai_checklist,
          type: 'general',
        });

        if (result.error) {
          setError(result.error);
        }

        return result;
      } finally {
        setGeneratingTaskIds((current) => ({ ...current, [strategyId]: false }));
      }
    },
    [strategies],
  );

  return {
    strategies,
    historyByStrategy,
    loading,
    saving,
    error,
    reload: load,
    createStrategy: create,
    updateStrategy: edit,
    updateStatus,
    loadHistory,
    generateTasks,
    isConfigured: isSupabaseConfigured,
    loadingHistoryIds,
    generatingTaskIds,
  };
}
