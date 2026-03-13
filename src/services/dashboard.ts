import {
  isSupabaseConfigured,
  supabase,
  type Client,
  type ClientHealthScore,
  type ClientDailyOperatingKpi,
  type ClientMonthlyOperatingKpi,
} from '../lib/supabase';
import { runOperationalChecks } from './operationalChecks';

function getSinceDate(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString().split('T')[0];
}

function getMonthFloor(monthsBack: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - monthsBack);
  return date.toISOString().split('T')[0];
}

type DailyOperatingParams = {
  clientId?: string;
  days?: number;
};

type MonthlyOperatingParams = {
  clientId?: string;
  monthsBack?: number;
};

export async function listDailyOperatingKpis({
  clientId,
  days = 30,
}: DailyOperatingParams = {}): Promise<ClientDailyOperatingKpi[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('v_client_daily_operating_kpis')
    .select('*')
    .gte('date', getSinceDate(days))
    .order('date', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) {
    console.error('[dashboard] listDailyOperatingKpis', error);
    return [];
  }

  return (data ?? []) as ClientDailyOperatingKpi[];
}

export async function listMonthlyOperatingKpis({
  clientId,
  monthsBack = 5,
}: MonthlyOperatingParams = {}): Promise<ClientMonthlyOperatingKpi[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('v_client_monthly_operating_kpis')
    .select('*')
    .gte('month', getMonthFloor(monthsBack))
    .order('month', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) {
    console.error('[dashboard] listMonthlyOperatingKpis', error);
    return [];
  }

  return (data ?? []) as ClientMonthlyOperatingKpi[];
}

export type DashboardSnapshot = {
  clients: Client[];
  dailyKpis: ClientDailyOperatingKpi[];
  monthlyKpis: ClientMonthlyOperatingKpi[];
  alerts: import('../lib/supabase').Alert[];
  tasks: import('../lib/supabase').Task[];
  healthByClient: Record<string, ClientHealthScore>;
  issuesByClient: Record<string, import('../lib/supabase').OperationalIssue[]>;
};

export async function getDashboardSnapshot(days = 30): Promise<DashboardSnapshot> {
  const [operationalSnapshot, monthlyKpis] = await Promise.all([
    runOperationalChecks({ days, syncAlertsAndTasks: true }),
    listMonthlyOperatingKpis(),
  ]);

  return {
    clients: operationalSnapshot.clients,
    dailyKpis: operationalSnapshot.dailyKpis.filter((row) => row.date >= getSinceDate(days)),
    monthlyKpis,
    alerts: operationalSnapshot.alerts,
    tasks: operationalSnapshot.tasks,
    healthByClient: operationalSnapshot.healthByClient,
    issuesByClient: operationalSnapshot.issuesByClient,
  };
}
