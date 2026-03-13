import {
  isSupabaseConfigured,
  supabase,
  type AdMetric,
} from '../lib/supabase';

type ListAdMetricsParams = {
  clientId?: string;
  days?: number;
};

function getSinceDate(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString().split('T')[0];
}

export async function listAdMetrics({
  clientId,
  days = 30,
}: ListAdMetricsParams = {}): Promise<AdMetric[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('ad_metrics')
    .select('*')
    .gte('date', getSinceDate(days))
    .order('date', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) {
    console.error('[adMetrics] listAdMetrics', error);
    return [];
  }

  return (data ?? []) as AdMetric[];
}
