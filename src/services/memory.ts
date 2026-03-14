import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type ClientMemory,
  type MemoryEntry,
  type MemoryEntryInput,
  type ServiceMutationResult,
  type Strategy,
  type StrategyInput,
} from '../lib/supabase';
import { logActivitySafe } from './activityLog';
import { getClientByIdOrSlug } from './clients';
import { getCurrentUserId, normalizeOptionalText } from './serviceHelpers';

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function mergeObjectsByKey<T extends Record<string, unknown>>(
  existing: T[],
  incoming: T[],
  key: keyof T,
): T[] {
  const map = new Map<string, T>();

  for (const item of existing) {
    const itemKey = String(item[key] ?? '').trim();
    if (!itemKey) continue;
    map.set(itemKey, item);
  }

  for (const item of incoming) {
    const itemKey = String(item[key] ?? '').trim();
    if (!itemKey) continue;
    map.set(itemKey, { ...(map.get(itemKey) ?? {}), ...item });
  }

  return [...map.values()];
}

function pickLearningSnippets(texts: Array<string | null | undefined>): string[] {
  const candidates = texts
    .flatMap((text) => (text ?? '').split(/[\n.;]+/))
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 14);

  const prioritized = candidates.filter((chunk) =>
    /(aprendiz|mejor|mejoro|funciona|convierte|fatiga|frecuencia|audiencia|creativo)/i.test(chunk),
  );

  return uniqueStrings((prioritized.length > 0 ? prioritized : candidates).slice(0, 3));
}

function buildSummaryFromStrategy(strategy: Strategy | StrategyInput): string {
  const parts: string[] = [];
  const monthLabel = strategy.month?.slice(0, 7);

  if (monthLabel) parts.push(`Estrategia ${monthLabel}`);
  if (strategy.monthly_budget != null) {
    parts.push(`presupuesto ${Intl.NumberFormat('es-CO').format(strategy.monthly_budget)}`);
  }
  if (strategy.campaigns_new.length > 0) {
    parts.push(`${strategy.campaigns_new.length} campanas nuevas`);
  }
  if (strategy.campaigns_off.length > 0) {
    parts.push(`${strategy.campaigns_off.length} campanas a apagar`);
  }
  if (strategy.campaigns_optimize.length > 0) {
    parts.push(`${strategy.campaigns_optimize.length} campanas a optimizar`);
  }
  if (strategy.segmentation.audiences?.length) {
    parts.push(`publicos ${strategy.segmentation.audiences.slice(0, 3).join(', ')}`);
  }

  return parts.join(' · ');
}

function buildStrategyMemoryEntries(
  strategy: Strategy,
  createdBy: string | null,
): MemoryEntryInput[] {
  const effectiveDate = strategy.month ?? null;
  const entries: MemoryEntryInput[] = [];
  const summary = normalizeOptionalText(strategy.ai_summary) ?? buildSummaryFromStrategy(strategy);

  if (summary) {
    entries.push({
      client_id: strategy.client_id,
      source_type: 'strategy',
      source_id: strategy.id,
      memory_type: 'summary',
      content: summary,
      tags: ['strategy', 'approved', 'summary'],
      importance: 5,
      effective_date: effectiveDate,
      embedding: null,
      created_by: createdBy,
    });
  }

  for (const audience of strategy.segmentation.audiences ?? []) {
    entries.push({
      client_id: strategy.client_id,
      source_type: 'strategy',
      source_id: strategy.id,
      memory_type: 'audience',
      content: audience,
      tags: ['strategy', 'approved', 'audience'],
      importance: 4,
      effective_date: effectiveDate,
      embedding: null,
      created_by: createdBy,
    });
  }

  for (const creative of strategy.creatives) {
    const creativeContent = [creative.type, creative.description, creative.link]
      .filter(Boolean)
      .join(' · ')
      .trim();

    if (!creativeContent) continue;

    entries.push({
      client_id: strategy.client_id,
      source_type: 'strategy',
      source_id: strategy.id,
      memory_type: 'creative',
      content: creativeContent,
      tags: ['strategy', 'approved', 'creative'],
      importance: 3,
      effective_date: effectiveDate,
      embedding: null,
      created_by: createdBy,
    });
  }

  for (const campaign of strategy.campaigns_new) {
    entries.push({
      client_id: strategy.client_id,
      source_type: 'strategy',
      source_id: strategy.id,
      memory_type: 'fact',
      content: `Nueva: ${campaign.name}${campaign.objective ? ` · objetivo ${campaign.objective}` : ''}`,
      tags: ['strategy', 'approved', 'campaign', 'new'],
      importance: 3,
      effective_date: effectiveDate,
      embedding: null,
      created_by: createdBy,
    });
  }

  for (const campaign of strategy.campaigns_off) {
    entries.push({
      client_id: strategy.client_id,
      source_type: 'strategy',
      source_id: strategy.id,
      memory_type: 'fact',
      content: `Off: ${campaign.name}${campaign.reason ? ` · ${campaign.reason}` : ''}`,
      tags: ['strategy', 'approved', 'campaign', 'off'],
      importance: 3,
      effective_date: effectiveDate,
      embedding: null,
      created_by: createdBy,
    });
  }

  for (const learning of pickLearningSnippets([
    strategy.notes,
    strategy.ai_diff,
    strategy.ai_summary,
  ])) {
    entries.push({
      client_id: strategy.client_id,
      source_type: 'strategy',
      source_id: strategy.id,
      memory_type: 'learning',
      content: learning,
      tags: ['strategy', 'approved', 'learning'],
      importance: 4,
      effective_date: effectiveDate,
      embedding: null,
      created_by: createdBy,
    });
  }

  return entries;
}

function buildDraftMemoryEntries(params: {
  clientId: string;
  strategy: StrategyInput;
  observations?: string[];
  rawInput?: string | null;
  createdBy: string | null;
}): MemoryEntryInput[] {
  const summary = normalizeOptionalText(params.strategy.ai_summary) ?? buildSummaryFromStrategy(params.strategy);
  const effectiveDate = params.strategy.month ?? null;
  const entries: MemoryEntryInput[] = [];

  if (summary) {
    entries.push({
      client_id: params.clientId,
      source_type: 'manual',
      source_id: null,
      memory_type: 'summary',
      content: `Draft IA: ${summary}`,
      tags: ['ai', 'draft', 'summary'],
      importance: 3,
      effective_date: effectiveDate,
      embedding: null,
      created_by: params.createdBy,
    });
  }

  for (const audience of params.strategy.segmentation.audiences ?? []) {
    entries.push({
      client_id: params.clientId,
      source_type: 'manual',
      source_id: null,
      memory_type: 'audience',
      content: audience,
      tags: ['ai', 'draft', 'audience'],
      importance: 3,
      effective_date: effectiveDate,
      embedding: null,
      created_by: params.createdBy,
    });
  }

  for (const learning of uniqueStrings([
    ...pickLearningSnippets([params.strategy.notes, params.strategy.ai_summary, params.rawInput]),
    ...(params.observations ?? []),
  ]).slice(0, 3)) {
    entries.push({
      client_id: params.clientId,
      source_type: 'manual',
      source_id: null,
      memory_type: 'learning',
      content: learning,
      tags: ['ai', 'draft', 'learning'],
      importance: 2,
      effective_date: effectiveDate,
      embedding: null,
      created_by: params.createdBy,
    });
  }

  return entries;
}

export async function getClientMemory(clientId: string): Promise<ClientMemory | null> {
  if (!clientId || !isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('client_memory')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) {
    console.error('[memory] getClientMemory', error);
    return null;
  }

  return (data ?? null) as ClientMemory | null;
}

export async function listMemoryEntries(
  clientId: string,
  limit = 12,
): Promise<MemoryEntry[]> {
  if (!clientId || !isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('memory_entries')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[memory] listMemoryEntries', error);
    return [];
  }

  return (data ?? []) as MemoryEntry[];
}

export async function saveMemoryEntries(
  entries: MemoryEntryInput[],
): Promise<ServiceMutationResult<MemoryEntry[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (entries.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase.from('memory_entries').insert(entries).select('*');
  if (error) {
    console.error('[memory] saveMemoryEntries', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudieron guardar entradas de memoria.'),
    };
  }

  return { data: (data ?? []) as MemoryEntry[], error: null };
}

export async function syncApprovedStrategyMemory(strategy: Strategy): Promise<void> {
  if (!isSupabaseConfigured || !supabase || strategy.status !== 'approved') return;

  const [client, currentMemory, createdBy] = await Promise.all([
    getClientByIdOrSlug(strategy.client_id),
    getClientMemory(strategy.client_id),
    getCurrentUserId(),
  ]);

  const mainCities = uniqueStrings([
    ...(strategy.segmentation.cities ?? []),
    ...(client?.target_cities ?? []),
    client?.main_city ?? null,
    ...(currentMemory?.main_cities ?? []),
  ]);

  const currentObjectives = uniqueStrings(
    strategy.campaigns_new.map((campaign) => campaign.objective).filter(Boolean),
  );

  const frequentObjectives = uniqueStrings([
    ...currentObjectives,
    ...(currentMemory?.frequent_objectives ?? []),
  ]);

  const audiences = mergeObjectsByKey(
    (currentMemory?.historical_audiences as Array<Record<string, unknown>> | undefined) ?? [],
    (strategy.segmentation.audiences ?? []).map((audience) => ({
      name: audience,
      last_used_at: strategy.month ?? strategy.updated_at,
      strategy_id: strategy.id,
      source: 'approved_strategy',
    })),
    'name',
  );

  const campaigns = mergeObjectsByKey(
    (currentMemory?.historical_campaigns as Array<Record<string, unknown>> | undefined) ?? [],
    [
      ...strategy.campaigns_new.map((campaign) => ({
        name: campaign.name,
        objective: campaign.objective ?? null,
        last_used_at: strategy.month ?? strategy.updated_at,
        strategy_id: strategy.id,
        status: 'new',
      })),
      ...strategy.campaigns_off.map((campaign) => ({
        name: campaign.name,
        objective: campaign.objective ?? null,
        last_used_at: strategy.month ?? strategy.updated_at,
        strategy_id: strategy.id,
        status: 'off',
      })),
      ...strategy.campaigns_optimize.map((campaign) => ({
        name: campaign.name,
        objective: campaign.objective ?? null,
        last_used_at: strategy.month ?? strategy.updated_at,
        strategy_id: strategy.id,
        status: 'optimize',
      })),
    ],
    'name',
  );

  const creativePatterns = mergeObjectsByKey(
    (currentMemory?.creative_patterns as Array<Record<string, unknown>> | undefined) ?? [],
    strategy.creatives.map((creative) => ({
      name: [creative.type, creative.description].filter(Boolean).join(' · '),
      type: creative.type ?? null,
      description: creative.description ?? null,
      link: creative.link ?? null,
      last_used_at: strategy.month ?? strategy.updated_at,
      strategy_id: strategy.id,
    })),
    'name',
  );

  const recurringNotes = uniqueStrings([
    currentMemory?.recurring_notes ?? null,
    strategy.notes ?? null,
    strategy.ai_summary ?? null,
  ]).slice(0, 3).join(' | ');

  const learnings = uniqueStrings([
    currentMemory?.learnings ?? null,
    ...pickLearningSnippets([strategy.notes, strategy.ai_diff, strategy.ai_summary]),
  ]).slice(0, 4).join(' | ');

  const snapshotPayload = {
    client_id: strategy.client_id,
    niche: client?.niche ?? currentMemory?.niche ?? null,
    main_cities: mainCities,
    frequent_objectives: frequentObjectives,
    historical_audiences: audiences,
    historical_campaigns: campaigns,
    creative_patterns: creativePatterns,
    recurring_notes: normalizeOptionalText(recurringNotes),
    learnings: normalizeOptionalText(learnings),
    last_source_strategy_id: strategy.id,
  };

  const { error: memoryError } = await supabase
    .from('client_memory')
    .upsert(snapshotPayload, { onConflict: 'client_id' });

  if (memoryError) {
    console.error('[memory] syncApprovedStrategyMemory snapshot', memoryError);
    return;
  }

  const { error: deleteError } = await supabase
    .from('memory_entries')
    .delete()
    .eq('client_id', strategy.client_id)
    .eq('source_type', 'strategy')
    .eq('source_id', strategy.id);

  if (deleteError) {
    console.error('[memory] syncApprovedStrategyMemory delete entries', deleteError);
    return;
  }

  const result = await saveMemoryEntries(buildStrategyMemoryEntries(strategy, createdBy));
  if (result.error) {
    console.error('[memory] syncApprovedStrategyMemory entries', result.error);
    return;
  }

  await logActivitySafe({
    client_id: strategy.client_id,
    entity_type: 'client_memory',
    entity_id: null,
    action: 'strategy_memory_synced',
    description: `Memoria sincronizada desde estrategia aprobada ${strategy.title}.`,
    metadata: {
      strategy_id: strategy.id,
      entries_saved: result.data?.length ?? 0,
    },
  });
}

export async function saveStructuredDraftToMemory(params: {
  clientId: string;
  strategy: StrategyInput;
  observations?: string[];
  rawInput?: string | null;
}): Promise<ServiceMutationResult<MemoryEntry[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const createdBy = await getCurrentUserId();
  const entries = buildDraftMemoryEntries({
    clientId: params.clientId,
    strategy: params.strategy,
    observations: params.observations,
    rawInput: params.rawInput,
    createdBy,
  });

  const result = await saveMemoryEntries(entries);
  if (!result.error) {
    await logActivitySafe({
      client_id: params.clientId,
      entity_type: 'client_memory',
      entity_id: null,
      action: 'draft_memory_saved',
      description: `Draft IA guardado en memoria con ${result.data?.length ?? 0} entrada${(result.data?.length ?? 0) !== 1 ? 's' : ''}.`,
      metadata: {
        entries_saved: result.data?.length ?? 0,
        month: params.strategy.month ?? null,
      },
    });
  }

  return result;
}
