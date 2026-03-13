import { useCallback, useEffect, useState } from 'react';
import {
  isSupabaseConfigured,
  type DailySale,
  type DailySaleInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { listDailySales, upsertDailySale } from '../services/dailySales';

export function useDailySales(clientId?: string, days = 30) {
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDailySales({ clientId, days });
      setSales(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar las ventas.';
      setError(message);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const addSale = useCallback(
    async (sale: DailySaleInput): Promise<ServiceMutationResult<DailySale>> => {
      const result = await upsertDailySale(sale);
      if (!result.error) {
        await load();
      }
      return result;
    },
    [load],
  );

  return {
    sales,
    loading,
    error,
    reload: load,
    addSale,
    isConfigured: isSupabaseConfigured,
  };
}
