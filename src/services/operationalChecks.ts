import type {
  Alert,
  Client,
  ClientDailyOperatingKpi,
  ClientHealthScore,
  DailySale,
  OperationalIssue,
  OperationalIssueType,
  Task,
} from '../lib/supabase';
import {
  createCriticalOpenAlertsAlert,
  createLowRealRoasAlert,
  createMissingSalesYesterdayAlert,
  createOptimizeEvery5DaysAlert,
  createOverdueTasksAlert,
  listAlerts,
  resolveOperationalAlert,
} from './alerts';
import { listClients } from './clients';
import { listDailyOperatingKpis } from './dashboard';
import { listDailySales } from './dailySales';
import { createTasksFromOperationalIssues, listTasks } from './tasks';

const OPTIMIZATION_THRESHOLD_DAYS = 5;
const REAL_ROAS_THRESHOLD = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

const ISSUE_TYPES: OperationalIssueType[] = [
  'missing_sales_yesterday',
  'optimize_every_5_days',
  'critical_open_alerts',
  'low_real_roas',
  'overdue_tasks',
];

type OperationalData = {
  clients: Client[];
  dailySales: DailySale[];
  dailyKpis: ClientDailyOperatingKpi[];
  alerts: Alert[];
  tasks: Task[];
};

export type OperationalCheckSnapshot = OperationalData & {
  issues: OperationalIssue[];
  issuesByClient: Record<string, OperationalIssue[]>;
  healthByClient: Record<string, ClientHealthScore>;
};

function getDateString(offsetDays = 0): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

function getSinceDate(days: number): string {
  return getDateString(-days);
}

function daysBetween(dateValue?: string | null): number | null {
  if (!dateValue) return null;

  const today = new Date(getDateString(0));
  const target = new Date(dateValue);
  const diff = Math.floor((today.getTime() - target.getTime()) / DAY_MS);
  return Number.isFinite(diff) ? Math.max(diff, 0) : null;
}

function summarizeRealRoas(rows: ClientDailyOperatingKpi[]): number {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const sales = rows.reduce((sum, row) => sum + row.total_sales, 0);
  return spend > 0 ? sales / spend : 0;
}

function buildIssue(params: Omit<OperationalIssue, 'rule_key'>): OperationalIssue {
  return {
    ...params,
    rule_key: params.type,
  };
}

function buildClientOperationalIssues(params: {
  client: Client;
  dailySales: DailySale[];
  dailyKpis: ClientDailyOperatingKpi[];
  alerts: Alert[];
  tasks: Task[];
}): ClientHealthScore {
  const yesterday = getDateString(-1);
  const today = getDateString(0);
  const issues: OperationalIssue[] = [];

  const clientSales = params.dailySales.filter((sale) => sale.client_id === params.client.id);
  const clientKpis = params.dailyKpis.filter((row) => row.client_id === params.client.id);
  const clientAlerts = params.alerts.filter((alert) => alert.client_id === params.client.id);
  const clientTasks = params.tasks.filter((task) => task.client_id === params.client.id);

  const hasSalesYesterday = clientSales.some((sale) => sale.date === yesterday && sale.total_sales > 0);
  if (!hasSalesYesterday) {
    issues.push(
      buildIssue({
        client_id: params.client.id,
        type: 'missing_sales_yesterday',
        severity: 'warning',
        title: 'Falta registro de ventas de ayer',
        body: `El cliente no ha registrado ventas para ${yesterday}.`,
        metadata: { expected_date: yesterday },
        score_penalty: 18,
        should_create_task: true,
        task_title: 'Solicitar registro de ventas de ayer',
        task_description: `Validar y cargar ventas del ${yesterday}.`,
        task_priority: 'high',
        task_type: 'sales_followup',
      }),
    );
  }

  const openCriticalAlerts = clientAlerts.filter(
    (alert) =>
      alert.severity === 'critical' &&
      ['unread', 'read'].includes(alert.status) &&
      alert.type !== 'critical_open_alerts',
  );

  if (openCriticalAlerts.length > 0) {
    issues.push(
      buildIssue({
        client_id: params.client.id,
        type: 'critical_open_alerts',
        severity: 'warning',
        title: 'Hay alertas criticas abiertas',
        body: `${openCriticalAlerts.length} alerta(s) critica(s) siguen abiertas para este cliente.`,
        metadata: { count: openCriticalAlerts.length },
        score_penalty: 22,
        should_create_task: false,
      }),
    );
  }

  const daysSinceOptimization = daysBetween(params.client.last_optimization_at);
  if (daysSinceOptimization == null || daysSinceOptimization > OPTIMIZATION_THRESHOLD_DAYS) {
    issues.push(
      buildIssue({
        client_id: params.client.id,
        type: 'optimize_every_5_days',
        severity: daysSinceOptimization != null && daysSinceOptimization > 8 ? 'critical' : 'warning',
        title: 'Toca optimizacion de campanas',
        body:
          daysSinceOptimization == null
            ? 'No hay registro de optimizacion para este cliente.'
            : `Han pasado ${daysSinceOptimization} dias desde la ultima optimizacion.`,
        metadata: { days_since_optimization: daysSinceOptimization },
        score_penalty: 18,
        should_create_task: true,
        task_title: 'Realizar optimizacion de campanas',
        task_description:
          daysSinceOptimization == null
            ? 'Registrar y ejecutar una optimizacion inicial.'
            : `Revisar campanas y actualizar optimizacion tras ${daysSinceOptimization} dias.`,
        task_priority: 'high',
        task_type: 'optimization',
      }),
    );
  }

  const overdueTasks = clientTasks.filter(
    (task) =>
      ['pending', 'in_progress'].includes(task.status) &&
      Boolean(task.due_date) &&
      (task.due_date as string) < today,
  );

  if (overdueTasks.length > 0) {
    issues.push(
      buildIssue({
        client_id: params.client.id,
        type: 'overdue_tasks',
        severity: overdueTasks.length >= 3 ? 'critical' : 'warning',
        title: 'Hay tareas vencidas',
        body: `${overdueTasks.length} tarea(s) operativa(s) estan vencidas.`,
        metadata: { count: overdueTasks.length },
        score_penalty: 14,
        should_create_task: false,
      }),
    );
  }

  const recentKpis = clientKpis.filter((row) => row.date >= getSinceDate(7));
  const realRoas = summarizeRealRoas(recentKpis.filter((row) => row.spend > 0));
  if (realRoas > 0 && realRoas < REAL_ROAS_THRESHOLD) {
    issues.push(
      buildIssue({
        client_id: params.client.id,
        type: 'low_real_roas',
        severity: realRoas < 1 ? 'critical' : 'warning',
        title: 'ROAS real bajo el umbral',
        body: `El ROAS real reciente esta en ${realRoas.toFixed(2)}x y esta por debajo del umbral ${REAL_ROAS_THRESHOLD.toFixed(2)}x.`,
        metadata: { real_roas: realRoas, threshold: REAL_ROAS_THRESHOLD },
        score_penalty: 22,
        should_create_task: true,
        task_title: 'Revisar caida de ROAS real',
        task_description: `Analizar ventas vs inversion. ROAS real reciente ${realRoas.toFixed(2)}x.`,
        task_priority: realRoas < 1 ? 'urgent' : 'high',
        task_type: 'review',
      }),
    );
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      100 - issues.reduce((sum, issue) => sum + issue.score_penalty, 0),
    ),
  );

  const status =
    openCriticalAlerts.length > 0 || issues.some((issue) => issue.severity === 'critical') || score < 55
      ? 'critical'
      : issues.length > 0 || score < 80
        ? 'warning'
        : 'healthy';

  return {
    client_id: params.client.id,
    score,
    status,
    issue_count: issues.length,
    open_critical_alerts: openCriticalAlerts.length,
    overdue_tasks: overdueTasks.length,
    missing_sales_yesterday: !hasSalesYesterday,
    optimize_overdue: daysSinceOptimization == null || daysSinceOptimization > OPTIMIZATION_THRESHOLD_DAYS,
    low_real_roas: realRoas > 0 && realRoas < REAL_ROAS_THRESHOLD,
    real_roas: realRoas,
    days_since_optimization: daysSinceOptimization,
    issues,
  };
}

function issueAlertHandler(issue: OperationalIssue) {
  switch (issue.type) {
    case 'missing_sales_yesterday':
      return createMissingSalesYesterdayAlert(issue);
    case 'optimize_every_5_days':
      return createOptimizeEvery5DaysAlert(issue);
    case 'critical_open_alerts':
      return createCriticalOpenAlertsAlert(issue);
    case 'low_real_roas':
      return createLowRealRoasAlert(issue);
    case 'overdue_tasks':
      return createOverdueTasksAlert(issue);
    default:
      return Promise.resolve({ data: null, error: null });
  }
}

export function buildOperationalSnapshot(data: OperationalData): OperationalCheckSnapshot {
  const healthByClient: Record<string, ClientHealthScore> = {};
  const issuesByClient: Record<string, OperationalIssue[]> = {};
  const issues: OperationalIssue[] = [];

  for (const client of data.clients) {
    const health = buildClientOperationalIssues({
      client,
      dailySales: data.dailySales,
      dailyKpis: data.dailyKpis,
      alerts: data.alerts,
      tasks: data.tasks,
    });

    healthByClient[client.id] = health;
    issuesByClient[client.id] = health.issues;
    issues.push(...health.issues);
  }

  return {
    ...data,
    issues,
    issuesByClient,
    healthByClient,
  };
}

export async function syncOperationalAlertsAndTasks(
  snapshot: OperationalCheckSnapshot,
): Promise<void> {
  const activeIssueMap = new Map(
    snapshot.issues.map((issue) => [`${issue.client_id}:${issue.type}`, issue]),
  );

  for (const issue of snapshot.issues) {
    const result = await issueAlertHandler(issue);
    if (result.error) {
      console.error('[operationalChecks] sync alert', issue.type, result.error);
    }
  }

  for (const client of snapshot.clients) {
    for (const type of ISSUE_TYPES) {
      if (!activeIssueMap.has(`${client.id}:${type}`)) {
        await resolveOperationalAlert(client.id, type);
      }
    }
  }

  const taskResult = await createTasksFromOperationalIssues(snapshot.issues);
  if (taskResult.error) {
    console.error('[operationalChecks] sync tasks', taskResult.error);
  }
}

export async function runOperationalChecks(params: {
  days?: number;
  syncAlertsAndTasks?: boolean;
} = {}): Promise<OperationalCheckSnapshot> {
  const days = params.days ?? 7;
  const [clients, dailySales, dailyKpis, alerts, tasks] = await Promise.all([
    listClients(),
    listDailySales({ days }),
    listDailyOperatingKpis({ days }),
    listAlerts(),
    listTasks(),
  ]);

  const snapshot = buildOperationalSnapshot({
    clients,
    dailySales,
    dailyKpis,
    alerts,
    tasks,
  });

  if (params.syncAlertsAndTasks) {
    await syncOperationalAlertsAndTasks(snapshot);
    const [syncedAlerts, syncedTasks] = await Promise.all([listAlerts(), listTasks()]);
    return buildOperationalSnapshot({
      clients,
      dailySales,
      dailyKpis,
      alerts: syncedAlerts,
      tasks: syncedTasks,
    });
  }

  return snapshot;
}
