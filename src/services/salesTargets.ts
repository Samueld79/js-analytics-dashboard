import {
  isSupabaseConfigured,
  supabase,
  type MonthlySalesTarget,
} from '../lib/supabase';

// clientId omitted -> all clients (mirrors listDailySales/listCampaignMetrics'
// "undefined = internal user loading everything" convention).
export async function listMonthlySalesTargets(clientId?: string): Promise<MonthlySalesTarget[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase.from('monthly_sales_targets').select('*').order('month', { ascending: true });
  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) {
    console.error('[salesTargets] listMonthlySalesTargets', error);
    return [];
  }

  return (data ?? []) as MonthlySalesTarget[];
}
