import { useCallback, useEffect, useState } from 'react';
import {
  type ServiceMutationResult,
  type SocialMonthlyMetric,
  type SocialMonthlyMetricInput,
} from '../lib/supabase';
import { listSocialMonthlyMetrics, upsertSocialMonthlyMetric } from '../services/socialMetrics';

export function useSocialMonthlyMetrics(clientId?: string, monthsBack = 6) {
  const [metrics, setMetrics] = useState<SocialMonthlyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSocialMonthlyMetrics({ clientId, monthsBack });
      setMetrics(data);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudieron cargar los cierres sociales mensuales.';
      setMetrics([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [clientId, monthsBack]);

  useEffect(() => {
    void load();
  }, [load]);

  const upsert = useCallback(
    async (
      input: SocialMonthlyMetricInput,
    ): Promise<ServiceMutationResult<SocialMonthlyMetric>> => {
      const result = await upsertSocialMonthlyMetric(input);
      if (!result.error) {
        await load();
      }
      return result;
    },
    [load],
  );

  return {
    metrics,
    loading,
    error,
    reload: load,
    upsert,
  };
}
