import { useCallback, useEffect, useState } from 'react';
import type { MonthlySalesTarget } from '../lib/supabase';
import { listMonthlySalesTargets } from '../services/salesTargets';

export function useMonthlySalesTargets(clientId?: string) {
  const [targets, setTargets] = useState<MonthlySalesTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listMonthlySalesTargets(clientId);
    setTargets(data);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { targets, loading, reload: load };
}
