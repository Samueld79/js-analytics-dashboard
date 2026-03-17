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

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
    }

    try {
      const data = await listDailySales(params);
      setSales(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar las ventas.';
      setError(message);
      if (!silent) {
        setSales([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  const addSale = useCallback(
    async (sale: DailySaleInput): Promise<ServiceMutationResult<DailySale>> => {
      const result = await upsertDailySale(sale);
      if (!result.error) {
        const savedSale = result.data;
        if (savedSale) {
          setSales((current) => {
            const next = current.filter(
              (entry) =>
                entry.id !== savedSale.id &&
                !(entry.client_id === savedSale.client_id && entry.date === savedSale.date),
            );
            return [savedSale, ...next].sort((left, right) => right.date.localeCompare(left.date));
          });
        }
        void load({ silent: true });
      }
      return result;
    },
    [load],
  );

  const removeSale = useCallback(
    async (sale: Pick<DailySale, 'id' | 'client_id' | 'date' | 'total_sales'>): Promise<ServiceMutationResult<null>> => {
      const result = await deleteDailySale(sale);
      if (!result.error) {
        setSales((current) => current.filter((entry) => entry.id !== sale.id));
        void load({ silent: true });
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
