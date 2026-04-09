import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useDailySales(clientIdOrParams?: string | UseDailySalesParams, defaultDays = 30) {
  // Extract primitives immediately so inline-object callers don't cause re-fetch loops.
  const clientId =
    typeof clientIdOrParams === 'string' ? clientIdOrParams : clientIdOrParams?.clientId;
  const days =
    typeof clientIdOrParams === 'object' ? (clientIdOrParams?.days ?? defaultDays) : defaultDays;
  const startDate =
    typeof clientIdOrParams === 'object' ? clientIdOrParams?.startDate : undefined;
  const endDate = typeof clientIdOrParams === 'object' ? clientIdOrParams?.endDate : undefined;

  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevDataRef = useRef<DailySale[] | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent && !prevDataRef.current) {
      setLoading(true);
    }

    try {
      const data = await listDailySales({ clientId, days, startDate, endDate });
      prevDataRef.current = data;
      setSales(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar las ventas.';
      setError(message);
      if (!silent && !prevDataRef.current) {
        setSales([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [clientId, days, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

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
