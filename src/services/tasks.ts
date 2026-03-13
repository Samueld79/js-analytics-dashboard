import {
  getErrorMessage,
  isSupabaseConfigured,
  type OperationalIssue,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type ChecklistItem,
  type Task,
  type TaskInput,
  type TaskPriority,
  type TaskUpdateInput,
  type ServiceMutationResult,
} from '../lib/supabase';
import { getCurrentUserId, normalizeOptionalText } from './serviceHelpers';

type ListTasksParams = {
  clientId?: string;
  strategyId?: string;
};

function normalizeTaskPriority(priority?: string | null): TaskPriority {
  const normalized = priority?.trim().toLowerCase();
  if (normalized === 'urgent' || normalized === 'urgente') return 'urgent';
  if (normalized === 'high' || normalized === 'alta') return 'high';
  if (normalized === 'low' || normalized === 'baja') return 'low';
  return 'medium';
}

export async function listTasks({ clientId, strategyId }: ListTasksParams = {}): Promise<Task[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);
  if (strategyId) query = query.eq('strategy_id', strategyId);

  const { data, error } = await query;
  if (error) {
    console.error('[tasks] listTasks', error);
    return [];
  }

  return (data ?? []) as Task[];
}

export async function updateTask(
  id: string,
  updates: TaskUpdateInput,
): Promise<ServiceMutationResult<Task>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const payload = { ...updates };
  if (updates.status === 'done' && !updates.completed_at) {
    payload.completed_at = new Date().toISOString();
  }
  if (updates.status && updates.status !== 'done') {
    payload.completed_at = null;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[tasks] updateTask', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo actualizar la tarea.') };
  }

  return { data: (data ?? null) as Task | null, error: null };
}

export async function createTasks(
  tasks: TaskInput[],
): Promise<ServiceMutationResult<Task[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (tasks.length === 0) {
    return { data: [], error: null };
  }

  const createdBy = await getCurrentUserId();
  const payload = tasks.map((task) => ({
    client_id: task.client_id,
    strategy_id: task.strategy_id ?? null,
    alert_id: task.alert_id ?? null,
    title: task.title.trim(),
    description: normalizeOptionalText(task.description),
    type: task.type,
    priority: task.priority,
    status: task.status,
    due_date: task.due_date ?? null,
    assigned_to: task.assigned_to ?? null,
    created_by: task.created_by ?? createdBy,
  }));

  const { data, error } = await supabase.from('tasks').insert(payload).select('*');
  if (error) {
    console.error('[tasks] createTasks', error);
    return { data: null, error: getErrorMessage(error, 'No se pudieron crear las tareas.') };
  }

  return { data: (data ?? []) as Task[], error: null };
}

export async function createTasksFromChecklist(params: {
  clientId: string;
  strategyId?: string | null;
  checklist: ChecklistItem[];
  type?: TaskInput['type'];
  dueDate?: string | null;
}): Promise<ServiceMutationResult<Task[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const openStatuses = ['pending', 'in_progress'];
  const candidates = params.checklist
    .map((item) => ({
      title: item.task.trim(),
      description: normalizeOptionalText(item.notes),
      priority: normalizeTaskPriority(item.priority),
    }))
    .filter((item) => item.title);

  if (candidates.length === 0) {
    return { data: [], error: null };
  }

  let existingQuery = supabase
    .from('tasks')
    .select('id,title,status')
    .eq('client_id', params.clientId)
    .in('status', openStatuses)
    .in(
      'title',
      candidates.map((item) => item.title),
    );

  if (params.strategyId) {
    existingQuery = existingQuery.eq('strategy_id', params.strategyId);
  }

  const { data: existingTasks, error: existingError } = await existingQuery;
  if (existingError) {
    console.error('[tasks] createTasksFromChecklist existing', existingError);
    return {
      data: null,
      error: getErrorMessage(existingError, 'No se pudo validar tareas existentes.'),
    };
  }

  const openTitles = new Set((existingTasks ?? []).map((task) => task.title));
  const tasksToCreate: TaskInput[] = candidates
    .filter((item) => !openTitles.has(item.title))
    .map((item) => ({
      client_id: params.clientId,
      strategy_id: params.strategyId ?? null,
      alert_id: null,
      title: item.title,
      description: item.description,
      type: params.type ?? 'general',
      priority: item.priority,
      status: 'pending',
      due_date: params.dueDate ?? null,
      assigned_to: null,
      created_by: null,
    }));

  if (tasksToCreate.length === 0) {
    return { data: [], error: null };
  }

  return createTasks(tasksToCreate);
}

export async function createTasksFromOperationalIssues(
  issues: OperationalIssue[],
): Promise<ServiceMutationResult<Task[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const candidates = issues
    .filter((issue) => issue.should_create_task && issue.task_title)
    .map((issue) => ({
      client_id: issue.client_id,
      strategy_id: null,
      alert_id: null,
      title: issue.task_title as string,
      description: normalizeOptionalText(issue.task_description ?? issue.body),
      type: issue.task_type ?? 'general',
      priority: issue.task_priority ?? normalizeTaskPriority(issue.severity),
      status: 'pending' as const,
      due_date: new Date().toISOString().split('T')[0],
      assigned_to: null,
      created_by: null,
    }));

  if (candidates.length === 0) {
    return { data: [], error: null };
  }

  const uniqueCandidates = candidates.filter(
    (candidate, index, current) =>
      current.findIndex(
        (entry) => entry.client_id === candidate.client_id && entry.title === candidate.title,
      ) === index,
  );

  const openStatuses = ['pending', 'in_progress'];
  const clientIds = [...new Set(uniqueCandidates.map((candidate) => candidate.client_id))];
  const titles = [...new Set(uniqueCandidates.map((candidate) => candidate.title))];

  const { data: existingTasks, error: existingError } = await supabase
    .from('tasks')
    .select('client_id,title,status')
    .in('client_id', clientIds)
    .in('title', titles)
    .in('status', openStatuses);

  if (existingError) {
    console.error('[tasks] createTasksFromOperationalIssues existing', existingError);
    return {
      data: null,
      error: getErrorMessage(existingError, 'No se pudo validar tareas operativas existentes.'),
    };
  }

  const existingKeys = new Set(
    (existingTasks ?? []).map((task) => `${task.client_id}:${task.title}`),
  );

  const tasksToCreate = uniqueCandidates.filter(
    (candidate) => !existingKeys.has(`${candidate.client_id}:${candidate.title}`),
  );

  if (tasksToCreate.length === 0) {
    return { data: [], error: null };
  }

  return createTasks(tasksToCreate);
}
