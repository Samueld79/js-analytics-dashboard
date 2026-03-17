import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  isSupabaseConfigured,
  type DailySale,
  type DailySaleInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { deleteDailySale, listDailySales, upsertDailySale } from '../services/dailySales';

type UseDailySalesParams = {
  clientId?: string;
  days?: number;
  startDate?: string;
  endDate?: string;
};

export function useDailySales(clientIdOrParams?: string | UseDailySalesParams, days = 30) {
  const params = useMemo(
    () =>
      typeof clientIdOrParams === 'string'
        ? { clientId: clientIdOrParams, days }
        : { days, ...(clientIdOrParams ?? {}) },
    [clientIdOrParams, days],
  );
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDailySales(params);
      setSales(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar las ventas.';
      setError(message);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  const addSale = useCallback(
    async (sale: DailySaleInput): Promise<ServiceMutationResult<DailySale>> => {
      const result = await upsertDailySale(sale);
      if (!result.error) {
        void load();
      }
      return result;
    },
    [load],
  );

  const removeSale = useCallback(
    async (sale: Pick<DailySale, 'id' | 'client_id' | 'date' | 'total_sales'>): Promise<ServiceMutationResult<null>> => {
      const result = await deleteDailySale(sale);
      if (!result.error) {
        void load();
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
    removeSale,
    isConfigured: isSupabaseConfigured,
  };
}
