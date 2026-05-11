import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getErrorMessage,
  isSupabaseConfigured,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type AdCampaignMetric,
  type CampaignActionMetrics,
  type CampaignAggregateByCampaign,
  type CampaignAggregateByMonth,
  type CampaignAggregateByObjective,
  type CampaignPerformanceSummary,
  type MetaActionItem,
  type NormalizedAdCampaignImportRow,
  type RawAdCampaignImportRow,
  type ServiceMutationResult,
} from '../lib/supabase';
import { toFiniteNumber } from '../lib/utils';

type ListAdCampaignMetricsParams = {
  clientId?: string;
  campaignId?: string;
  monthKey?: string;
  days?: number;
};

type UpsertAdCampaignMetricsParams = {
  rows: RawAdCampaignImportRow[];
  client?: SupabaseClient;
};

type MutableCampaignAggregate = Omit<
  CampaignAggregateByCampaign,
  'adRoas' | 'costPerConversation' | 'costPerProfileVisit'
>;

type MutableObjectiveAggregate = Omit<
  CampaignAggregateByObjective,
  'adRoas' | 'costPerConversation' | 'costPerProfileVisit' | 'shareOfSpend' | 'campaignCount'
> & {
  campaignIds: Set<string>;
};

type MutableMonthAggregate = Omit<
  CampaignAggregateByMonth,
  'adRoas' | 'costPerConversation' | 'costPerProfileVisit' | 'campaignCount' | 'cpm' | 'frequency'
> & {
  campaignIds: Set<string>;
};

const ACTION_TYPE_ALIASES = {
  messagingStarted: ['onsite_conversion.messaging_conversation_started_7d'],
  messagingConnections: ['onsite_conversion.total_messaging_connection'],
  messagingFirstReply: ['onsite_conversion.messaging_first_reply'],
  leads: [
    'lead',
    'onsite_conversion.lead',
    'onsite_web_lead',
    'onsite_conversion.lead_grouped',
  ],
  purchases: [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
  ],
  linkClicks: ['link_click'],
  pageEngagement: ['page_engagement'],
  postEngagement: ['post_engagement'],
  videoViews: ['video_view', 'video_play'],
  thruplays: ['video_thruplay_watched_actions', 'thruplay'],
  profileVisits: ['profile_visit_view', 'profile_visit'],
} as const;

export const AD_CAMPAIGN_METRICS_ON_CONFLICT =
  'client_id,ad_account_id,campaign_id,date' as const;
export const CAMPAIGN_ACTION_TYPE_ALIASES = ACTION_TYPE_ALIASES;

function getSinceDate(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString().split('T')[0];
}

function getMonthBounds(monthKey: string): { start: string; end: string } | null {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDate(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }

  throw new Error('La fila campaign-level requiere una fecha valida.');
}

function normalizeInteger(value: unknown): number {
  const normalized = toFiniteNumber(value);
  if (normalized <= 0) return 0;
  return Math.round(normalized);
}

function normalizeDecimal(value: unknown, decimals = 4): number {
  const normalized = toFiniteNumber(value);
  if (normalized <= 0) return 0;
  const factor = 10 ** decimals;
  return Math.round(normalized * factor) / factor;
}

function normalizeMoney(value: unknown): number {
  const normalized = toFiniteNumber(value);
  if (normalized <= 0) return 0;
  return Math.round(normalized * 100) / 100;
}

function normalizeNullableDecimal(value: unknown): number | null {
  const normalized = toFiniteNumber(value);
  if (normalized <= 0) return null;
  return Math.round(normalized * 10_000) / 10_000;
}

function normalizeActionItems(raw: unknown): MetaActionItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.reduce<MetaActionItem[]>((items, entry) => {
    if (!entry || typeof entry !== 'object') return items;

    const actionType =
      'action_type' in entry && typeof entry.action_type === 'string'
        ? entry.action_type.trim()
        : '';
    if (!actionType) return items;

    const value =
      'value' in entry && (typeof entry.value === 'string' || typeof entry.value === 'number')
        ? entry.value
        : null;

    items.push({ action_type: actionType, value });
    return items;
  }, []);
}

function sumActionValues(actions: MetaActionItem[], actionTypes: readonly string[]): number {
  if (!actions.length) return 0;

  const allowed = new Set(actionTypes);
  return actions.reduce((total, action) => {
    if (!action.action_type || !allowed.has(action.action_type)) return total;
    return total + toFiniteNumber(action.value);
  }, 0);
}

function sumPurchaseValue(actionValues: MetaActionItem[]): number {
  return normalizeMoney(sumActionValues(actionValues, ACTION_TYPE_ALIASES.purchases));
}

function resolveMessages(metrics: Pick<
  CampaignActionMetrics,
  'messaging_started' | 'messaging_connections'
>): number {
  if (metrics.messaging_started > 0) return metrics.messaging_started;
  if (metrics.messaging_connections > 0) return metrics.messaging_connections;
  return 0;
}

function resolveObjective(row: RawAdCampaignImportRow): string | null {
  const direct = normalizeText(row.objective);
  if (direct) return direct;

  const metadataObjective =
    row.metadata && typeof row.metadata === 'object' && typeof row.metadata.objective === 'string'
      ? row.metadata.objective.trim()
      : '';

  return metadataObjective || null;
}

function resolveEffectiveStatus(row: RawAdCampaignImportRow): string | null {
  const direct = normalizeText(row.effective_status);
  if (direct) return direct;

  const metadataStatus =
    row.metadata && typeof row.metadata === 'object' && typeof row.metadata.effective_status === 'string'
      ? row.metadata.effective_status.trim()
      : '';

  return metadataStatus || null;
}

/**
 * Infers a human-readable objective category from the campaign name.
 * Matching is case-insensitive and keyword-based.
 */
export function inferObjectiveFromName(name: string): string {
  const u = (name ?? '').toUpperCase();
  if (u.includes('RECO')) return 'Reconocimiento';
  if (u.includes('INTER')) return 'Interacción';
  if (u.includes('TRAF')) return 'Tráfico';
  if (u.includes('VENT')) return 'Ventas';
  if (u.includes('C.P') || u.includes('POTENCIAL')) return 'Clientes Potenciales';
  if (u.includes('PRESENT')) return 'Presentación';
  if (u.includes('EVA')) return 'Evaluación';
  return 'Otro';
}

function getMonthKey(date: string): string {
  return date.slice(0, 7);
}

function computeAdRoas(spend: number, purchaseValue: number): number {
  if (spend <= 0) return 0;
  return Math.round((purchaseValue / spend) * 10_000) / 10_000;
}

function computeUnitCost(spend: number, result: number): number | null {
  if (spend <= 0 || result <= 0) return null;
  return Math.round((spend / result) * 10_000) / 10_000;
}

function finalizeCampaignAggregate(
  aggregate: MutableCampaignAggregate,
): CampaignAggregateByCampaign {
  return {
    ...aggregate,
    adRoas: computeAdRoas(aggregate.spend, aggregate.purchaseValue),
    costPerConversation: computeUnitCost(aggregate.spend, aggregate.messages),
    costPerProfileVisit: computeUnitCost(aggregate.spend, aggregate.profileVisits),
  };
}

function finalizeObjectiveAggregate(
  aggregate: MutableObjectiveAggregate,
  totalSpend: number,
): CampaignAggregateByObjective {
  return {
    objective: aggregate.objective,
    spend: aggregate.spend,
    messages: aggregate.messages,
    profileVisits: aggregate.profileVisits,
    leads: aggregate.leads,
    purchases: aggregate.purchases,
    purchaseValue: aggregate.purchaseValue,
    linkClicks: aggregate.linkClicks,
    pageEngagement: aggregate.pageEngagement,
    postEngagement: aggregate.postEngagement,
    videoViews: aggregate.videoViews,
    thruplays: aggregate.thruplays,
    campaignCount: aggregate.campaignIds.size,
    adRoas: computeAdRoas(aggregate.spend, aggregate.purchaseValue),
    costPerConversation: computeUnitCost(aggregate.spend, aggregate.messages),
    costPerProfileVisit: computeUnitCost(aggregate.spend, aggregate.profileVisits),
    shareOfSpend: totalSpend > 0 ? Math.round((aggregate.spend / totalSpend) * 10_000) / 10_000 : 0,
  };
}

function finalizeMonthAggregate(aggregate: MutableMonthAggregate): CampaignAggregateByMonth {
  // impressions is stored in thousands in the DB, so CPM = spend / impressions (no ×1000 needed)
  const cpm =
    aggregate.impressions > 0
      ? Math.round((aggregate.spend / aggregate.impressions) * 100) / 100
      : 0;
  const frequency =
    aggregate.reach > 0
      ? Math.round((aggregate.impressions / aggregate.reach) * 100) / 100
      : 0;
  return {
    month: aggregate.month,
    spend: aggregate.spend,
    reach: aggregate.reach,
    impressions: aggregate.impressions,
    cpm,
    frequency,
    messages: aggregate.messages,
    profileVisits: aggregate.profileVisits,
    leads: aggregate.leads,
    purchases: aggregate.purchases,
    purchaseValue: aggregate.purchaseValue,
    linkClicks: aggregate.linkClicks,
    pageEngagement: aggregate.pageEngagement,
    postEngagement: aggregate.postEngagement,
    videoViews: aggregate.videoViews,
    thruplays: aggregate.thruplays,
    campaignCount: aggregate.campaignIds.size,
    adRoas: computeAdRoas(aggregate.spend, aggregate.purchaseValue),
    costPerConversation: computeUnitCost(aggregate.spend, aggregate.messages),
    costPerProfileVisit: computeUnitCost(aggregate.spend, aggregate.profileVisits),
  };
}

export function extractCampaignActionMetrics(
  rawActions: unknown,
  rawActionValues: unknown,
): CampaignActionMetrics {
  const actions = normalizeActionItems(rawActions);
  const actionValues = normalizeActionItems(rawActionValues);

  const messaging_started = normalizeInteger(
    sumActionValues(actions, ACTION_TYPE_ALIASES.messagingStarted),
  );
  const messaging_connections = normalizeInteger(
    sumActionValues(actions, ACTION_TYPE_ALIASES.messagingConnections),
  );
  const messaging_first_reply = normalizeInteger(
    sumActionValues(actions, ACTION_TYPE_ALIASES.messagingFirstReply),
  );
  const leads = normalizeInteger(sumActionValues(actions, ACTION_TYPE_ALIASES.leads));
  const purchases = normalizeInteger(sumActionValues(actions, ACTION_TYPE_ALIASES.purchases));
  const purchase_value = sumPurchaseValue(actionValues);
  const link_clicks = normalizeInteger(sumActionValues(actions, ACTION_TYPE_ALIASES.linkClicks));
  const page_engagement = normalizeInteger(
    sumActionValues(actions, ACTION_TYPE_ALIASES.pageEngagement),
  );
  const post_engagement = normalizeInteger(
    sumActionValues(actions, ACTION_TYPE_ALIASES.postEngagement),
  );
  const video_views = normalizeInteger(sumActionValues(actions, ACTION_TYPE_ALIASES.videoViews));
  const thruplays = normalizeInteger(sumActionValues(actions, ACTION_TYPE_ALIASES.thruplays));
  const profile_visits = normalizeInteger(
    sumActionValues(actions, ACTION_TYPE_ALIASES.profileVisits),
  );

  return {
    messages: resolveMessages({ messaging_started, messaging_connections }),
    messaging_started,
    messaging_connections,
    messaging_first_reply,
    leads,
    purchases,
    purchase_value,
    link_clicks,
    page_engagement,
    post_engagement,
    video_views,
    thruplays,
    profile_visits,
  };
}

export function buildAdCampaignMetricPayload(
  row: RawAdCampaignImportRow,
): NormalizedAdCampaignImportRow {
  const client_id = normalizeText(row.client_id);
  const ad_account_id = normalizeText(row.ad_account_id);
  const campaign_id = normalizeText(String(row.campaign_id ?? ''));
  const campaign_name = normalizeText(row.campaign_name);
  const date = normalizeDate(row.date);

  if (!client_id) throw new Error('La fila campaign-level requiere client_id.');
  if (!ad_account_id) throw new Error('La fila campaign-level requiere ad_account_id.');
  if (!campaign_id) throw new Error('La fila campaign-level requiere campaign_id.');
  if (!campaign_name) throw new Error('La fila campaign-level requiere campaign_name.');

  const raw_actions = normalizeActionItems(row.actions ?? row.raw_actions);
  const raw_action_values = normalizeActionItems(row.action_values ?? row.raw_action_values);
  const actionMetrics = extractCampaignActionMetrics(raw_actions, raw_action_values);

  return {
    client_id,
    ad_account_id,
    campaign_id,
    campaign_name,
    objective: resolveObjective(row),
    effective_status: resolveEffectiveStatus(row),
    date,
    spend: normalizeMoney(row.spend),
    reach: normalizeInteger(row.reach),
    impressions: normalizeInteger(row.impressions),
    clicks: normalizeInteger(row.clicks),
    cpm: normalizeDecimal(row.cpm),
    cpc: normalizeDecimal(row.cpc),
    ctr: normalizeDecimal(row.ctr),
    frequency: normalizeNullableDecimal(row.frequency),
    messages: actionMetrics.messages,
    messaging_started: actionMetrics.messaging_started,
    messaging_connections: actionMetrics.messaging_connections,
    messaging_first_reply: actionMetrics.messaging_first_reply,
    leads: actionMetrics.leads,
    purchases: actionMetrics.purchases,
    purchase_value: actionMetrics.purchase_value,
    link_clicks: actionMetrics.link_clicks,
    page_engagement: actionMetrics.page_engagement,
    post_engagement: actionMetrics.post_engagement,
    video_views: actionMetrics.video_views,
    thruplays: actionMetrics.thruplays,
    profile_visits: actionMetrics.profile_visits,
    raw_actions,
    raw_action_values,
    metadata: row.metadata ?? null,
    source: normalizeText(row.source) || 'meta_api_campaign',
  };
}

export function prepareAdCampaignMetricPayloads(
  rows: RawAdCampaignImportRow[],
): NormalizedAdCampaignImportRow[] {
  return rows.map(buildAdCampaignMetricPayload);
}

export async function listAdCampaignMetrics({
  clientId,
  campaignId,
  monthKey,
  days = 90,
}: ListAdCampaignMetricsParams = {}): Promise<AdCampaignMetric[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('ad_campaign_metrics')
    .select('*')
    .order('date', { ascending: false })
    .order('spend', { ascending: false });

  if (monthKey) {
    const bounds = getMonthBounds(monthKey);
    if (bounds) {
      query = query.gte('date', bounds.start).lte('date', bounds.end);
    }
  } else {
    query = query.gte('date', getSinceDate(days));
  }

  if (clientId) query = query.eq('client_id', clientId);
  if (campaignId) query = query.eq('campaign_id', campaignId);

  const { data, error } = await query;
  if (error) {
    console.error('[adCampaignMetrics] listAdCampaignMetrics', error);
    return [];
  }

  return (data ?? []) as AdCampaignMetric[];
}

export async function upsertAdCampaignMetrics({
  rows,
  client,
}: UpsertAdCampaignMetricsParams): Promise<ServiceMutationResult<AdCampaignMetric[]>> {
  const currentClient = client ?? supabase;
  if (!currentClient) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  if (!rows.length) {
    return { data: [], error: null };
  }

  let payload: NormalizedAdCampaignImportRow[];
  try {
    payload = prepareAdCampaignMetricPayloads(rows);
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : 'No se pudo normalizar el payload campaign-level.',
    };
  }

  const { data, error } = await currentClient
    .from('ad_campaign_metrics')
    .upsert(payload, { onConflict: AD_CAMPAIGN_METRICS_ON_CONFLICT })
    .select('*');

  if (error) {
    console.error('[adCampaignMetrics] upsertAdCampaignMetrics', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo guardar la performance campaign-level.'),
    };
  }

  return { data: (data ?? []) as AdCampaignMetric[], error: null };
}

export function aggregateCampaignMetricsByCampaign(
  rows: AdCampaignMetric[],
): CampaignAggregateByCampaign[] {
  const grouped = new Map<string, MutableCampaignAggregate>();

  rows.forEach((row) => {
    const key = row.campaign_id;
    const current = grouped.get(key);
    if (current) {
      current.spend += normalizeMoney(row.spend);
      current.reach += normalizeInteger(row.reach);
      current.impressions += normalizeInteger(row.impressions);
      current.clicks += normalizeInteger(row.clicks);
      current.messages += normalizeInteger(row.messages);
      current.messagingStarted += normalizeInteger(row.messaging_started);
      current.messagingConnections += normalizeInteger(row.messaging_connections);
      current.messagingFirstReply += normalizeInteger(row.messaging_first_reply);
      current.leads += normalizeInteger(row.leads);
      current.purchases += normalizeInteger(row.purchases);
      current.purchaseValue += normalizeMoney(row.purchase_value);
      current.linkClicks += normalizeInteger(row.link_clicks);
      current.pageEngagement += normalizeInteger(row.page_engagement);
      current.postEngagement += normalizeInteger(row.post_engagement);
      current.videoViews += normalizeInteger(row.video_views);
      current.thruplays += normalizeInteger(row.thruplays);
      current.profileVisits += normalizeInteger(row.profile_visits);
      current.days += 1;
      return;
    }

    grouped.set(key, {
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      objective: row.objective ?? null,
      effectiveStatus: row.effective_status ?? null,
      spend: normalizeMoney(row.spend),
      reach: normalizeInteger(row.reach),
      impressions: normalizeInteger(row.impressions),
      clicks: normalizeInteger(row.clicks),
      messages: normalizeInteger(row.messages),
      messagingStarted: normalizeInteger(row.messaging_started),
      messagingConnections: normalizeInteger(row.messaging_connections),
      messagingFirstReply: normalizeInteger(row.messaging_first_reply),
      leads: normalizeInteger(row.leads),
      purchases: normalizeInteger(row.purchases),
      purchaseValue: normalizeMoney(row.purchase_value),
      linkClicks: normalizeInteger(row.link_clicks),
      pageEngagement: normalizeInteger(row.page_engagement),
      postEngagement: normalizeInteger(row.post_engagement),
      videoViews: normalizeInteger(row.video_views),
      thruplays: normalizeInteger(row.thruplays),
      profileVisits: normalizeInteger(row.profile_visits),
      days: 1,
    });
  });

  return [...grouped.values()]
    .map(finalizeCampaignAggregate)
    .sort((a, b) => b.spend - a.spend);
}

export function aggregateCampaignMetricsByObjective(
  rows: AdCampaignMetric[],
): CampaignAggregateByObjective[] {
  const grouped = new Map<string, MutableObjectiveAggregate>();

  rows.forEach((row) => {
    const objective = inferObjectiveFromName(row.campaign_name ?? '');
    const current = grouped.get(objective);

    if (current) {
      current.spend += normalizeMoney(row.spend);
      current.messages += normalizeInteger(row.messages);
      current.profileVisits += normalizeInteger(row.profile_visits);
      current.leads += normalizeInteger(row.leads);
      current.purchases += normalizeInteger(row.purchases);
      current.purchaseValue += normalizeMoney(row.purchase_value);
      current.linkClicks += normalizeInteger(row.link_clicks);
      current.pageEngagement += normalizeInteger(row.page_engagement);
      current.postEngagement += normalizeInteger(row.post_engagement);
      current.videoViews += normalizeInteger(row.video_views);
      current.thruplays += normalizeInteger(row.thruplays);
      current.campaignIds.add(row.campaign_id);
      return;
    }

    grouped.set(objective, {
      objective,
      spend: normalizeMoney(row.spend),
      messages: normalizeInteger(row.messages),
      profileVisits: normalizeInteger(row.profile_visits),
      leads: normalizeInteger(row.leads),
      purchases: normalizeInteger(row.purchases),
      purchaseValue: normalizeMoney(row.purchase_value),
      linkClicks: normalizeInteger(row.link_clicks),
      pageEngagement: normalizeInteger(row.page_engagement),
      postEngagement: normalizeInteger(row.post_engagement),
      videoViews: normalizeInteger(row.video_views),
      thruplays: normalizeInteger(row.thruplays),
      campaignIds: new Set([row.campaign_id]),
    });
  });

  const totalSpend = rows.reduce((sum, row) => sum + normalizeMoney(row.spend), 0);
  return [...grouped.values()]
    .map((aggregate) => finalizeObjectiveAggregate(aggregate, totalSpend))
    .sort((a, b) => b.spend - a.spend);
}

export function aggregateCampaignMetricsByMonth(
  rows: AdCampaignMetric[],
): CampaignAggregateByMonth[] {
  const grouped = new Map<string, MutableMonthAggregate>();

  rows.forEach((row) => {
    const month = getMonthKey(row.date);
    const current = grouped.get(month);

    if (current) {
      current.spend += normalizeMoney(row.spend);
      current.reach += normalizeInteger(row.reach);
      current.impressions += normalizeInteger(row.impressions);
      current.messages += normalizeInteger(row.messages);
      current.profileVisits += normalizeInteger(row.profile_visits);
      current.leads += normalizeInteger(row.leads);
      current.purchases += normalizeInteger(row.purchases);
      current.purchaseValue += normalizeMoney(row.purchase_value);
      current.linkClicks += normalizeInteger(row.link_clicks);
      current.pageEngagement += normalizeInteger(row.page_engagement);
      current.postEngagement += normalizeInteger(row.post_engagement);
      current.videoViews += normalizeInteger(row.video_views);
      current.thruplays += normalizeInteger(row.thruplays);
      current.campaignIds.add(row.campaign_id);
      return;
    }

    grouped.set(month, {
      month,
      spend: normalizeMoney(row.spend),
      reach: normalizeInteger(row.reach),
      impressions: normalizeInteger(row.impressions),
      messages: normalizeInteger(row.messages),
      profileVisits: normalizeInteger(row.profile_visits),
      leads: normalizeInteger(row.leads),
      purchases: normalizeInteger(row.purchases),
      purchaseValue: normalizeMoney(row.purchase_value),
      linkClicks: normalizeInteger(row.link_clicks),
      pageEngagement: normalizeInteger(row.page_engagement),
      postEngagement: normalizeInteger(row.post_engagement),
      videoViews: normalizeInteger(row.video_views),
      thruplays: normalizeInteger(row.thruplays),
      campaignIds: new Set([row.campaign_id]),
    });
  });

  return [...grouped.values()]
    .map(finalizeMonthAggregate)
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Sums an array of monthly aggregates into a single CampaignAggregateByMonth.
 * Used for "Total año" mode. CPM and frequency are recomputed from totals.
 */
export function sumCampaignMonthAggregates(
  months: CampaignAggregateByMonth[],
  label = 'total',
): CampaignAggregateByMonth {
  if (months.length === 0) {
    return {
      month: label, spend: 0, reach: 0, impressions: 0, cpm: 0, frequency: 0,
      messages: 0, profileVisits: 0, leads: 0, purchases: 0, purchaseValue: 0,
      linkClicks: 0, pageEngagement: 0, postEngagement: 0, videoViews: 0,
      thruplays: 0, campaignCount: 0, adRoas: 0, costPerConversation: null,
      costPerProfileVisit: null,
    };
  }
  const spend = months.reduce((s, m) => s + m.spend, 0);
  const reach = months.reduce((s, m) => s + m.reach, 0);
  const impressions = months.reduce((s, m) => s + m.impressions, 0);
  const messages = months.reduce((s, m) => s + m.messages, 0);
  const profileVisits = months.reduce((s, m) => s + m.profileVisits, 0);
  const purchaseValue = months.reduce((s, m) => s + m.purchaseValue, 0);
  const campaignCount = months.reduce((s, m) => s + m.campaignCount, 0);
  const cpm = impressions > 0 ? Math.round((spend / impressions) * 100) / 100 : 0;
  const frequency = reach > 0 ? Math.round((impressions / reach) * 100) / 100 : 0;
  return {
    month: label, spend, reach, impressions, cpm, frequency, messages, profileVisits,
    leads: months.reduce((s, m) => s + m.leads, 0),
    purchases: months.reduce((s, m) => s + m.purchases, 0),
    purchaseValue,
    linkClicks: months.reduce((s, m) => s + m.linkClicks, 0),
    pageEngagement: months.reduce((s, m) => s + m.pageEngagement, 0),
    postEngagement: months.reduce((s, m) => s + m.postEngagement, 0),
    videoViews: months.reduce((s, m) => s + m.videoViews, 0),
    thruplays: months.reduce((s, m) => s + m.thruplays, 0),
    campaignCount,
    adRoas: spend > 0 ? Math.round((purchaseValue / spend) * 10_000) / 10_000 : 0,
    costPerConversation: messages > 0 ? Math.round((spend / messages) * 10_000) / 10_000 : null,
    costPerProfileVisit: profileVisits > 0 ? Math.round((spend / profileVisits) * 10_000) / 10_000 : null,
  };
}

/**
 * Aggregates pre-filtered AdCampaignMetric rows per client.
 * Caller is responsible for filtering rows to the desired period first.
 * Returns Map<clientId, CampaignAggregateByMonth> (summed across all months in rows).
 */
export function aggregateCampaignKpisByClient(
  rows: AdCampaignMetric[],
): Map<string, CampaignAggregateByMonth> {
  const grouped = new Map<string, AdCampaignMetric[]>();
  for (const row of rows) {
    if (!grouped.has(row.client_id)) grouped.set(row.client_id, []);
    grouped.get(row.client_id)!.push(row);
  }
  const result = new Map<string, CampaignAggregateByMonth>();
  for (const [clientId, clientRows] of grouped) {
    const agg = aggregateCampaignMetricsByMonth(clientRows);
    if (agg.length === 0) continue;
    result.set(clientId, agg.length === 1 ? agg[0] : sumCampaignMonthAggregates(agg));
  }
  return result;
}

export function computeCampaignPerformanceSummary(
  rows: AdCampaignMetric[],
): CampaignPerformanceSummary {
  const byCampaign = aggregateCampaignMetricsByCampaign(rows);
  const byObjective = aggregateCampaignMetricsByObjective(rows);
  const byMonth = aggregateCampaignMetricsByMonth(rows);

  const spend = rows.reduce((sum, row) => sum + normalizeMoney(row.spend), 0);
  const messages = rows.reduce((sum, row) => sum + normalizeInteger(row.messages), 0);
  const profileVisits = rows.reduce((sum, row) => sum + normalizeInteger(row.profile_visits), 0);
  const leads = rows.reduce((sum, row) => sum + normalizeInteger(row.leads), 0);
  const purchases = rows.reduce((sum, row) => sum + normalizeInteger(row.purchases), 0);
  const purchaseValue = rows.reduce((sum, row) => sum + normalizeMoney(row.purchase_value), 0);

  return {
    rowCount: rows.length,
    campaignCount: new Set(rows.map((row) => row.campaign_id)).size,
    spend,
    messages,
    profileVisits,
    leads,
    purchases,
    purchaseValue,
    adRoas: computeAdRoas(spend, purchaseValue),
    costPerConversation: computeUnitCost(spend, messages),
    costPerProfileVisit: computeUnitCost(spend, profileVisits),
    topCampaignsBySpend: byCampaign.slice(0, 5),
    topCampaignsByConversations: [...byCampaign]
      .sort((a, b) => b.messages - a.messages || b.spend - a.spend)
      .slice(0, 5),
    spendByObjective: byObjective,
    mixRealByObjective: byObjective.map((row) => ({
      objective: row.objective,
      spend: row.spend,
      shareOfSpend: row.shareOfSpend,
    })),
    byMonth,
  };
}
