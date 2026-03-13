import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type CampaignEntry,
  type ChecklistItem,
  type CreativeEntry,
  type DriveLink,
  type SegmentationData,
  type ServiceMutationResult,
  type Strategy,
  type StrategyHistory,
  type StrategyInput,
  type StrategyStatus,
} from '../lib/supabase';
import {
  getCurrentUserId,
  isMissingRpcFunction,
  normalizeMonthDate,
  normalizeMoney,
  normalizeOptionalText,
  normalizeStringArray,
} from './serviceHelpers';
import { syncApprovedStrategyMemory } from './memory';

function normalizeCampaignEntries(value: unknown): CampaignEntry[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<CampaignEntry[]>((accumulator, entry) => {
      if (!entry || typeof entry !== 'object') return accumulator;
      const item = entry as Record<string, unknown>;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) return accumulator;

      accumulator.push({
        name,
        objective: typeof item.objective === 'string' ? item.objective.trim() : undefined,
        budget:
          typeof item.budget === 'number'
            ? normalizeMoney(item.budget) ?? undefined
            : undefined,
        audience: typeof item.audience === 'string' ? item.audience.trim() : undefined,
        notes: typeof item.notes === 'string' ? item.notes.trim() : undefined,
        reason: typeof item.reason === 'string' ? item.reason.trim() : undefined,
        action: typeof item.action === 'string' ? item.action.trim() : undefined,
        priority: typeof item.priority === 'string' ? item.priority.trim() : undefined,
      } satisfies CampaignEntry);

      return accumulator;
    }, []);
}

function normalizeCreatives(value: unknown): CreativeEntry[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<CreativeEntry[]>((accumulator, entry) => {
      if (!entry || typeof entry !== 'object') return accumulator;
      const item = entry as Record<string, unknown>;
      const description =
        typeof item.description === 'string' ? item.description.trim() : undefined;
      const link = typeof item.link === 'string' ? item.link.trim() : undefined;
      const type = typeof item.type === 'string' ? item.type.trim() : undefined;
      if (!description && !link && !type) return accumulator;

      accumulator.push({ description, link, type } satisfies CreativeEntry);
      return accumulator;
    }, []);
}

function normalizeDriveLinks(value: unknown): DriveLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      if (!label || !url) return null;
      return { label, url } satisfies DriveLink;
    })
    .filter((entry): entry is DriveLink => Boolean(entry));
}

function normalizeChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<ChecklistItem[]>((accumulator, entry) => {
      if (!entry || typeof entry !== 'object') return accumulator;
      const item = entry as Record<string, unknown>;
      const task = typeof item.task === 'string' ? item.task.trim() : '';
      if (!task) return accumulator;

      accumulator.push({
        task,
        priority: typeof item.priority === 'string' ? item.priority.trim() : undefined,
        notes: typeof item.notes === 'string' ? item.notes.trim() : undefined,
        done: Boolean(item.done),
      } satisfies ChecklistItem);

      return accumulator;
    }, []);
}

function normalizeSegmentation(value: unknown): SegmentationData {
  if (!value || typeof value !== 'object') return {};

  const item = value as Record<string, unknown>;
  return {
    ages: typeof item.ages === 'string' ? item.ages.trim() : undefined,
    cities: normalizeStringArray(item.cities),
    exclusions: normalizeStringArray(item.exclusions),
    audiences: normalizeStringArray(item.audiences),
  };
}

export function normalizeStrategy(strategy: Strategy): Strategy {
  return {
    ...strategy,
    month: normalizeMonthDate(strategy.month),
    raw_input: normalizeOptionalText(strategy.raw_input),
    notes: normalizeOptionalText(strategy.notes),
    ai_summary: normalizeOptionalText(strategy.ai_summary),
    ai_diff: normalizeOptionalText(strategy.ai_diff),
    campaigns_new: normalizeCampaignEntries(strategy.campaigns_new),
    campaigns_off: normalizeCampaignEntries(strategy.campaigns_off),
    campaigns_optimize: normalizeCampaignEntries(strategy.campaigns_optimize),
    segmentation: normalizeSegmentation(strategy.segmentation),
    creatives: normalizeCreatives(strategy.creatives),
    drive_links: normalizeDriveLinks(strategy.drive_links),
    ai_checklist: normalizeChecklist(strategy.ai_checklist),
    version: strategy.version ?? strategy.latest_version ?? 1,
    latest_version: strategy.latest_version ?? strategy.version ?? 1,
  };
}

function toStrategyPayload(
  input: StrategyInput,
  createdBy: string | null,
  latestVersion?: number,
) {
  return {
    client_id: input.client_id,
    title: input.title.trim(),
    month: normalizeMonthDate(input.month),
    status: input.status ?? 'pending',
    monthly_budget: normalizeMoney(input.monthly_budget),
    responsible_id: input.responsible_id ?? null,
    created_by: input.created_by ?? createdBy,
    raw_input: normalizeOptionalText(input.raw_input),
    notes: normalizeOptionalText(input.notes),
    campaigns_new: normalizeCampaignEntries(input.campaigns_new),
    campaigns_off: normalizeCampaignEntries(input.campaigns_off),
    campaigns_optimize: normalizeCampaignEntries(input.campaigns_optimize),
    segmentation: normalizeSegmentation(input.segmentation),
    creatives: normalizeCreatives(input.creatives),
    drive_links: normalizeDriveLinks(input.drive_links),
    ai_summary: normalizeOptionalText(input.ai_summary),
    ai_checklist: normalizeChecklist(input.ai_checklist),
    ai_diff: normalizeOptionalText(input.ai_diff),
    latest_version: latestVersion ?? input.latest_version ?? 1,
  };
}

function toStrategyInput(strategy: Strategy): StrategyInput {
  return {
    client_id: strategy.client_id,
    title: strategy.title,
    month: strategy.month,
    status: strategy.status,
    monthly_budget: strategy.monthly_budget ?? null,
    responsible_id: strategy.responsible_id ?? null,
    created_by: strategy.created_by ?? null,
    campaigns_new: strategy.campaigns_new,
    campaigns_off: strategy.campaigns_off,
    campaigns_optimize: strategy.campaigns_optimize,
    segmentation: strategy.segmentation,
    creatives: strategy.creatives,
    drive_links: strategy.drive_links,
    notes: strategy.notes ?? null,
    ai_summary: strategy.ai_summary ?? null,
    ai_checklist: strategy.ai_checklist,
    ai_diff: strategy.ai_diff ?? null,
    raw_input: strategy.raw_input ?? null,
    latest_version: strategy.latest_version ?? strategy.version ?? 1,
  };
}

export async function listStrategies(clientId?: string): Promise<Strategy[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('strategies')
    .select('*')
    .order('month', { ascending: false })
    .order('updated_at', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) {
    console.error('[strategies] listStrategies', error);
    return [];
  }

  return ((data ?? []) as Strategy[]).map(normalizeStrategy);
}

export async function getStrategyById(id: string): Promise<Strategy | null> {
  if (!id || !isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.from('strategies').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[strategies] getStrategyById', error);
    return null;
  }

  return data ? normalizeStrategy(data as Strategy) : null;
}

export async function listStrategyHistory(strategyId: string): Promise<StrategyHistory[]> {
  if (!strategyId || !isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('strategy_history')
    .select('*')
    .eq('strategy_id', strategyId)
    .order('version', { ascending: false });

  if (error) {
    console.error('[strategies] listStrategyHistory', error);
    return [];
  }

  return ((data ?? []) as StrategyHistory[]).map((row) => ({
    ...row,
    snapshot: normalizeStrategy(row.snapshot as Strategy),
  }));
}

async function createHistorySnapshot(params: {
  strategy: Strategy;
  version: number;
  changedBy: string | null;
  changeSummary?: string | null;
}): Promise<string | null> {
  if (!supabase) return SUPABASE_MISSING_MESSAGE;

  const { error } = await supabase.from('strategy_history').insert({
    strategy_id: params.strategy.id,
    version: params.version,
    snapshot: params.strategy,
    changed_by: params.changedBy,
    change_summary: normalizeOptionalText(params.changeSummary) ?? null,
  });

  if (error) {
    console.error('[strategies] createHistorySnapshot', error);
    return getErrorMessage(error, 'No se pudo guardar el historial de la estrategia.');
  }

  return null;
}

async function saveStrategyViaRpc(params: {
  strategyId?: string;
  input: StrategyInput;
  changeSummary?: string | null;
  changedBy: string | null;
}): Promise<ServiceMutationResult<Strategy> | null> {
  if (!supabase) return { data: null, error: SUPABASE_MISSING_MESSAGE };

  const rpcPayload = {
    p_strategy_id: params.strategyId ?? null,
    p_client_id: params.input.client_id,
    p_title: params.input.title.trim(),
    p_month: normalizeMonthDate(params.input.month),
    p_status: params.input.status ?? 'pending',
    p_monthly_budget: normalizeMoney(params.input.monthly_budget),
    p_responsible_id: params.input.responsible_id ?? null,
    p_created_by: params.input.created_by ?? params.changedBy,
    p_raw_input: normalizeOptionalText(params.input.raw_input),
    p_notes: normalizeOptionalText(params.input.notes),
    p_campaigns_new: normalizeCampaignEntries(params.input.campaigns_new),
    p_campaigns_off: normalizeCampaignEntries(params.input.campaigns_off),
    p_campaigns_optimize: normalizeCampaignEntries(params.input.campaigns_optimize),
    p_segmentation: normalizeSegmentation(params.input.segmentation),
    p_creatives: normalizeCreatives(params.input.creatives),
    p_drive_links: normalizeDriveLinks(params.input.drive_links),
    p_ai_summary: normalizeOptionalText(params.input.ai_summary),
    p_ai_checklist: normalizeChecklist(params.input.ai_checklist),
    p_ai_diff: normalizeOptionalText(params.input.ai_diff),
    p_change_summary: normalizeOptionalText(params.changeSummary),
  };

  const { data, error } = await supabase.rpc('save_strategy_with_history', rpcPayload);
  if (error) {
    if (isMissingRpcFunction(error, 'save_strategy_with_history')) {
      return null;
    }

    console.error('[strategies] saveStrategyViaRpc', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo guardar la estrategia.'),
    };
  }

  return {
    data: data ? normalizeStrategy(data as Strategy) : null,
    error: null,
  };
}

async function manualCreateStrategy(
  input: StrategyInput,
  changedBy: string | null,
  changeSummary?: string | null,
): Promise<ServiceMutationResult<Strategy>> {
  if (!supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const payload = toStrategyPayload(input, changedBy, 1);
  const { data, error } = await supabase
    .from('strategies')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[strategies] createStrategy', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo crear la estrategia.') };
  }

  const strategy = normalizeStrategy(data as Strategy);
  const historyError = await createHistorySnapshot({
    strategy,
    version: 1,
    changedBy,
    changeSummary: changeSummary ?? 'Creacion inicial',
  });

  if (historyError) {
    const { error: rollbackError } = await supabase.from('strategies').delete().eq('id', strategy.id);
    if (rollbackError) {
      console.error('[strategies] create rollback', rollbackError);
    }
    return { data: null, error: historyError };
  }

  if (strategy.status === 'approved') {
    await syncApprovedStrategyMemory(strategy);
  }

  return { data: strategy, error: null };
}

async function manualUpdateStrategy(
  strategyId: string,
  input: StrategyInput,
  changedBy: string | null,
  changeSummary?: string | null,
): Promise<ServiceMutationResult<Strategy>> {
  if (!supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const existing = await getStrategyById(strategyId);
  if (!existing) {
    return { data: null, error: 'La estrategia no existe o no esta disponible.' };
  }

  const nextVersion = (existing.latest_version ?? existing.version ?? 1) + 1;
  const payload = toStrategyPayload(
    {
      ...toStrategyInput(existing),
      ...input,
      created_by: existing.created_by ?? input.created_by ?? changedBy,
      latest_version: nextVersion,
    },
    existing.created_by ?? changedBy,
    nextVersion,
  );

  const { data, error } = await supabase
    .from('strategies')
    .update(payload)
    .eq('id', strategyId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[strategies] updateStrategy', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo actualizar la estrategia.') };
  }

  const updatedStrategy = normalizeStrategy(data as Strategy);
  const historyError = await createHistorySnapshot({
    strategy: updatedStrategy,
    version: nextVersion,
    changedBy,
    changeSummary,
  });

  if (historyError) {
    const rollbackPayload = toStrategyPayload(
      toStrategyInput(existing),
      existing.created_by ?? changedBy,
      existing.latest_version ?? existing.version ?? 1,
    );
    const { error: rollbackError } = await supabase
      .from('strategies')
      .update(rollbackPayload)
      .eq('id', strategyId);

    if (rollbackError) {
      console.error('[strategies] update rollback', rollbackError);
    }

    return { data: null, error: historyError };
  }

  if (updatedStrategy.status === 'approved') {
    await syncApprovedStrategyMemory(updatedStrategy);
  }

  return { data: updatedStrategy, error: null };
}

export async function createStrategy(
  input: StrategyInput,
  options: { changeSummary?: string | null } = {},
): Promise<ServiceMutationResult<Strategy>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (!input.client_id || !input.title.trim()) {
    return { data: null, error: 'Cliente y titulo son obligatorios.' };
  }

  const changedBy = input.created_by ?? (await getCurrentUserId());
  const rpcResult = await saveStrategyViaRpc({
    input,
    changeSummary: options.changeSummary,
    changedBy,
  });

  const result = rpcResult ?? (await manualCreateStrategy(input, changedBy, options.changeSummary));
  if (result.data?.status === 'approved') {
    await syncApprovedStrategyMemory(result.data);
  }
  return result;
}

export async function updateStrategy(
  strategyId: string,
  input: StrategyInput,
  options: { changeSummary?: string | null } = {},
): Promise<ServiceMutationResult<Strategy>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (!strategyId) {
    return { data: null, error: 'La estrategia a editar es obligatoria.' };
  }

  if (!input.client_id || !input.title.trim()) {
    return { data: null, error: 'Cliente y titulo son obligatorios.' };
  }

  const changedBy = input.created_by ?? (await getCurrentUserId());
  const rpcResult = await saveStrategyViaRpc({
    strategyId,
    input,
    changeSummary: options.changeSummary,
    changedBy,
  });

  const result = rpcResult ?? (await manualUpdateStrategy(strategyId, input, changedBy, options.changeSummary));
  if (result.data?.status === 'approved') {
    await syncApprovedStrategyMemory(result.data);
  }
  return result;
}

export async function updateStrategyStatus(
  id: string,
  status: StrategyStatus,
  changeSummary?: string,
): Promise<ServiceMutationResult<Strategy>> {
  const strategy = await getStrategyById(id);
  if (!strategy) {
    return { data: null, error: 'La estrategia no existe o no esta disponible.' };
  }

  return updateStrategy(
    id,
    {
      ...toStrategyInput(strategy),
      status,
    },
    {
      changeSummary: changeSummary ?? `Cambio de estado a ${status}`,
    },
  );
}
