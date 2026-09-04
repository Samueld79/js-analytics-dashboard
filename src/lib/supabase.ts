import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key'),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const SUPABASE_MISSING_MESSAGE =
  'Supabase no esta configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.';

export function getErrorMessage(
  error: { message?: string } | null | undefined,
  fallback: string,
): string {
  return error?.message?.trim() || fallback;
}

export type ClientStatus = 'active' | 'paused' | 'churned';
export type StrategyStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'mounted'    // legacy — maps to 'active' in UI
  | 'reviewed'   // legacy — maps to 'active' in UI
  | 'approved'   // legacy — maps to 'active' in UI
  | 'archived';
export type UserRole =
  | 'admin'
  | 'team'
  | 'strategist'
  | 'operator'
  | 'partner'
  | 'client'
  | 'client_viewer'
  | 'anonymous';
export type ClientAccessLevel = 'manager' | 'operator' | 'viewer' | 'client';
export type TaskType =
  | 'optimization'
  | 'review'
  | 'budget'
  | 'creative'
  | 'sales_followup'
  | 'alert'
  | 'general';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'unread' | 'read' | 'resolved' | 'dismissed';
export type MemorySourceType =
  | 'strategy'
  | 'note'
  | 'alert'
  | 'task'
  | 'sales'
  | 'ads'
  | 'manual';
export type MemoryType = 'fact' | 'audience' | 'creative' | 'learning' | 'summary' | 'warning';
export type OperationalIssueType =
  | 'missing_sales_yesterday'
  | 'optimize_every_5_days'
  | 'critical_open_alerts'
  | 'low_real_roas'
  | 'overdue_tasks';
export type HealthStatus = 'healthy' | 'warning' | 'critical';

export type UserProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientMembership = {
  id: string;
  client_id: string;
  user_id: string;
  access_level: ClientAccessLevel;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  name: string;
  slug: string;
  niche?: string | null;
  logo_url?: string | null;
  drive_folder_url?: string | null;
  ad_account_id?: string | null;
  status: ClientStatus;
  currency_code?: string | null;
  reporting_timezone?: string | null;
  main_city?: string | null;
  target_cities?: string[] | null;
  notes?: string | null;
  monthly_goal?: number | null;
  dashboard_hidden?: boolean | null;
  last_optimization_at?: string | null;
  last_sales_entry_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientInput = Omit<
  Client,
  'id' | 'created_at' | 'updated_at' | 'last_optimization_at' | 'last_sales_entry_at' | 'slug'
> & {
  slug?: string | null;
  target_cities?: string[] | null;
  created_by?: string | null;
};

export type AdAccountStatus = 'active' | 'paused' | 'archived';
export type MetaSyncStatus = 'ok' | 'stale' | 'no_data';

export type AdAccountSyncRow = {
  id: string;
  client_id: string;
  name: string;
  meta_account_id: string;
  status: AdAccountStatus;
  is_primary: boolean;
  last_sync_at?: string | null;
};

export type ClientMetaOverview = {
  client_id: string;
  sync_status: MetaSyncStatus;
  last_sync_at?: string | null;
  active_accounts: number;
  synced_accounts: number;
  stale_accounts: number;
  missing_sync_accounts: number;
  has_mtd_data: boolean;
  mtd_spend: number;
  mtd_messages: number;
  mtd_leads: number;
  mtd_purchases: number;
  mtd_purchase_value: number;
  mtd_ad_roas: number;
  mtd_real_roas: number;
};

export type AdMetric = {
  id: string;
  client_id: string;
  ad_account_id: string;
  import_run_id?: string | null;
  date: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  messages: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  roas: number;
  cpr: number;
  cpl: number;
  cpa: number;
  frequency?: number | null;
  raw_actions?: unknown[];
  source: string;
  created_at: string;
  updated_at?: string;
};

export type MetaActionItem = {
  action_type?: string;
  value?: string | number | null;
};

export type AdCampaignMetric = {
  id: string;
  client_id: string;
  ad_account_id: string;
  campaign_id: string;
  campaign_name: string;
  objective?: string | null;
  effective_status?: string | null;
  date: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  frequency?: number | null;
  messages: number;
  messaging_started: number;
  messaging_connections: number;
  messaging_first_reply: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  link_clicks: number;
  page_engagement: number;
  post_engagement: number;
  video_views: number;
  thruplays: number;
  profile_visits: number;
  raw_actions?: MetaActionItem[];
  raw_action_values?: MetaActionItem[];
  metadata?: Record<string, unknown> | null;
  source: string;
  created_at: string;
  updated_at?: string;
};

export type RawAdCampaignImportRow = {
  client_id: string;
  ad_account_id: string;
  campaign_id: string | number;
  campaign_name: string;
  date: string;
  objective?: string | null;
  effective_status?: string | null;
  spend?: string | number | null;
  reach?: string | number | null;
  impressions?: string | number | null;
  clicks?: string | number | null;
  cpm?: string | number | null;
  cpc?: string | number | null;
  ctr?: string | number | null;
  frequency?: string | number | null;
  actions?: MetaActionItem[] | unknown;
  action_values?: MetaActionItem[] | unknown;
  raw_actions?: MetaActionItem[] | unknown;
  raw_action_values?: MetaActionItem[] | unknown;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CampaignActionMetrics = {
  messages: number;
  messaging_started: number;
  messaging_connections: number;
  messaging_first_reply: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  link_clicks: number;
  page_engagement: number;
  post_engagement: number;
  video_views: number;
  thruplays: number;
  profile_visits: number;
};

export type NormalizedAdCampaignImportRow = Omit<
  AdCampaignMetric,
  'id' | 'created_at' | 'updated_at'
>;

export type CampaignAggregateByCampaign = {
  campaignId: string;
  campaignName: string;
  objective: string | null;
  effectiveStatus: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  messages: number;
  messagingStarted: number;
  messagingConnections: number;
  messagingFirstReply: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  linkClicks: number;
  pageEngagement: number;
  postEngagement: number;
  videoViews: number;
  thruplays: number;
  profileVisits: number;
  adRoas: number;
  costPerConversation: number | null;
  costPerProfileVisit: number | null;
  days: number;
};

export type CampaignAggregateByObjective = {
  objective: string;
  spend: number;
  messages: number;
  profileVisits: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  linkClicks: number;
  pageEngagement: number;
  postEngagement: number;
  videoViews: number;
  thruplays: number;
  campaignCount: number;
  adRoas: number;
  costPerConversation: number | null;
  costPerProfileVisit: number | null;
  shareOfSpend: number;
};

export type CampaignAggregateByMonth = {
  month: string;
  spend: number;
  reach: number;
  impressions: number;
  cpm: number;
  frequency: number;
  messages: number;
  profileVisits: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  linkClicks: number;
  pageEngagement: number;
  postEngagement: number;
  videoViews: number;
  thruplays: number;
  campaignCount: number;
  adRoas: number;
  costPerConversation: number | null;
  costPerProfileVisit: number | null;
};

export type CampaignPerformanceSummary = {
  rowCount: number;
  campaignCount: number;
  spend: number;
  messages: number;
  profileVisits: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  adRoas: number;
  costPerConversation: number | null;
  costPerProfileVisit: number | null;
  topCampaignsBySpend: CampaignAggregateByCampaign[];
  topCampaignsByConversations: CampaignAggregateByCampaign[];
  spendByObjective: CampaignAggregateByObjective[];
  mixRealByObjective: Array<{
    objective: string;
    spend: number;
    shareOfSpend: number;
  }>;
  byMonth: CampaignAggregateByMonth[];
};

export type DailySale = {
  id: string;
  client_id: string;
  date: string;
  total_sales: number;
  new_client_sales: number;
  repeat_sales: number;
  physical_store_sales: number;
  online_sales: number;
  observations?: string | null;
  status?: 'draft' | 'submitted' | 'validated';
  registered_by?: string | null;
  validated_by?: string | null;
  validated_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type DailySaleInput = Omit<DailySale, 'id' | 'created_at' | 'updated_at'>;

// ── Portal Cliente ────────────────────────────────────────────────────────────

export type ClientPortalSettings = {
  id: string;
  client_id: string;
  enabled: boolean;
  public_slug: string;
  pin_registro: string;
  pin_ventas: string;
  pin_required: boolean;
  created_at: string;
  updated_at: string;
};

export type PortalAssetType = 'image' | 'video';

export type PortalCreativeAsset = {
  id: string;
  client_id: string;
  ad_id: string;
  conjunto_label: string | null;
  asset_url: string;
  asset_type: PortalAssetType;
  uploaded_at: string;
};

export const PORTAL_OBJECTION_OPTIONS = [
  'Sin objecion',
  'Precio',
  'Disponibilidad de cita',
  'No respondio',
  'Indeciso',
  'Otro',
] as const;
export type PortalObjection = (typeof PORTAL_OBJECTION_OPTIONS)[number];

export const PORTAL_VISIT_OPTIONS = [
  'Va a visitar',
  'No va a visitar',
  'Tal vez',
] as const;
export type PortalVisitStatus = (typeof PORTAL_VISIT_OPTIONS)[number];

export type PortalDailyEntry = {
  id: string;
  client_id: string;
  date: string;
  campaign_id: string;
  citas: number;
  compras: number;
  objecion: PortalObjection | null;
  visita_punto_fisico: PortalVisitStatus | null;
  nota: string | null;
  updated_at: string;
};

export type PortalDailyEntryInput = {
  client_id: string;
  date: string;
  campaign_id: string;
  citas: number;
  compras: number;
  objecion: PortalObjection | null;
  visita_punto_fisico: PortalVisitStatus | null;
  nota: string | null;
};

export type PortalLeadTipo = 'cita' | 'compra';

export type PortalLead = {
  id: string;
  client_id: string;
  daily_entry_id: string;
  tipo: PortalLeadTipo;
  nombre_cliente: string;
  numero_contacto: string;
  monto: number | null;
  created_at: string;
};

export type PortalLeadWithEntry = PortalLead & {
  // daily_entry.campaign_id: the underlying portal_daily_entries column is
  // still named campaign_id, but as of the ad-level migration new rows store
  // an ad_id in it (not a campaign_id) — see portal_ad_daily_metrics.
  daily_entry: { date: string; campaign_id: string } | null;
};

// ── Portal Cliente — ad-level metrics (separate from ad_campaign_metrics,
// which stays campaign-level for the rest of the app) ─────────────────────────

export type PortalAdDailyMetric = {
  id: string;
  client_id: string;
  date: string;
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string | null;
  messages: number;
  effective_status: string | null;
  // Real spend for this ad on this date. effective_status='ACTIVE' alone is
  // not a reliable "active today" signal — Meta keeps old promoted posts in
  // ACTIVE status indefinitely with no budget running. "Active today" =
  // effective_status === 'ACTIVE' AND spend > 0.
  spend: number;
  created_at: string;
  updated_at: string;
};

export const PORTAL_OBJECTION_TALLY_CATEGORIES = [
  'Precio',
  'Disponibilidad de cita',
  'No respondio',
  'Indeciso',
  'Otro',
] as const;
export type PortalObjectionCategory = (typeof PORTAL_OBJECTION_TALLY_CATEGORIES)[number];

export const PORTAL_VISIT_TALLY_CATEGORIES = [
  'Va a visitar',
  'No va a visitar',
  'Tal vez',
] as const;
export type PortalVisitCategory = (typeof PORTAL_VISIT_TALLY_CATEGORIES)[number];

export type PortalTallyTipo = 'objecion' | 'visita';

export type PortalObjectionTally = {
  id: string;
  client_id: string;
  date: string;
  ad_id: string;
  tipo: PortalTallyTipo;
  categoria: string;
  count: number;
  updated_at: string;
};

// ── Pulso de Satisfacción ────────────────────────────────────────────────────

export type PulseSettings = {
  id: string;
  client_id: string;
  enabled: boolean;
  public_slug: string;
  created_at: string;
  updated_at: string;
};

export const PULSE_MOOD_LABELS = ['Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente'] as const;
export type PulseMoodLabel = (typeof PULSE_MOOD_LABELS)[number];

export function pulseMoodLabelFromScore(score: number): PulseMoodLabel {
  if (score <= 20) return 'Muy mal';
  if (score <= 40) return 'Mal';
  if (score <= 60) return 'Regular';
  if (score <= 80) return 'Bien';
  return 'Excelente';
}

export const PULSE_MOOD_EMOJI: Record<PulseMoodLabel, string> = {
  'Muy mal': '😞',
  'Mal': '😕',
  'Regular': '😐',
  'Bien': '🙂',
  'Excelente': '😍',
};

// Same options for every client for now, per spec — not client-configurable yet.
export const PULSE_TAG_OPTIONS = ['Reportes', 'Comunicación', 'Resultados', 'Creatividad', 'Rapidez'] as const;
export type PulseTag = (typeof PULSE_TAG_OPTIONS)[number];

export type PulseResponse = {
  id: string;
  client_id: string;
  month: string;
  mood_score: number;
  mood_label: PulseMoodLabel;
  liked_tags: string[];
  improve_tags: string[];
  note: string | null;
  submitted_at: string;
};

export type HistoricalMonthlyAdMetricInput = {
  client_id: string;
  month: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  messages: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  roas: number;
  cpr: number;
  cpl: number;
  cpa: number;
  frequency?: number | null;
  source?: string;
};

export type HistoricalMonthlySaleInput = {
  client_id: string;
  month: string;
  total_sales: number;
  new_client_sales: number;
  repeat_sales: number;
  physical_store_sales: number;
  online_sales: number;
  observations?: string | null;
  status?: 'draft' | 'submitted' | 'validated';
  registered_by?: string | null;
};

export type SocialMonthlyMetric = {
  id: string;
  client_id: string;
  month: string;
  new_followers: number;
  profile_visits?: number | null;
  whatsapp_clicks?: number | null;
  link_clicks?: number | null;
  new_customers_reported?: number | null;
  returning_customers_reported?: number | null;
  store_visits_reported?: number | null;
  source: string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialMonthlyMetricInput = {
  client_id: string;
  month: string;
  new_followers: number;
  profile_visits?: number | null;
  whatsapp_clicks?: number | null;
  link_clicks?: number | null;
  new_customers_reported?: number | null;
  returning_customers_reported?: number | null;
  store_visits_reported?: number | null;
  source: string;
  notes?: string | null;
  created_by?: string | null;
};

export type CampaignEntry = {
  name: string;
  objective?: string;
  budget?: number;
  audience?: string;
  notes?: string;
  reason?: string;
  action?: string;
  priority?: string;
};

export type CreativeFormEntry = {
  description?: string;
  type?: string;
  existingUrl?: string;
  publicationType?: 'nueva' | 'existente';
  notes?: string;
  imageBase64?: string;
};

export type MetaAdEntry = {
  adType?: string;
  description?: string;
  publicationType?: 'nueva' | 'existente';
  existingUrl?: string;
  referenceUrl?: string | null;
  notes?: string;
  imageBase64?: string;
  welcomeMessage?: string;
  suggestedQuestions?: string;
  // Leads (Clientes Potenciales) copy fields
  copyV1?: string;
  copyV2?: string;
  copyV3?: string;
  headline?: string;
  ctaButton?: string;
  creativeType?: string;
  creativeIdea?: string;
};

// ─── Clientes Potenciales (Leads) campaign data structures ─────────────────

export type LeadsInstantFormQuestion = {
  id: string;
  field: 'nombre' | 'whatsapp' | 'email' | 'ciudad' | 'custom';
  label?: string;
  questionType?: 'short' | 'multiple' | 'conditional';
  options?: string[];
  enabled: boolean;
};

export type LeadsInstantForm = {
  formName?: string;
  formType?: 'volume' | 'intent';
  introTitle?: string;
  introDescription?: string;
  introCoverImage?: string;
  questions?: LeadsInstantFormQuestion[];
  privacyUrl?: string;
  privacyDisclaimer?: string;
  thankYouTitle?: string;
  thankYouDescription?: string;
  thankYouButton?: 'whatsapp' | 'website' | 'download' | 'none';
  thankYouButtonUrl?: string;
};

export type LeadsMessagesConfig = {
  platforms?: string[];
  whatsappNumber?: string;
  greeting?: string;
  questions?: string[];
};

export type LeadsLandingConfig = {
  landingUrl?: string;
  headline?: string;
  subheadline?: string;
  valueProposition?: string;
  benefits?: string[];
  socialProof?: string;
  cta?: string;
  formFields?: string[];
};

export type LeadsPostLead = {
  contactChannel?: string;
  responseTime?: string;
  followUpMessage?: string;
  responsible?: string;
};

export type LeadsMetrics = {
  expectedCpl?: number;
  expectedCtr?: string;
  monthlyLeadsGoal?: number;
  kpiChecklist?: string[];
  scalingCriteria?: string;
  pauseCriteria?: string;
};

export type AdSetEntry = {
  // Identification
  name?: string;
  // ABO budget (used when campaign budgetType is ABO)
  aboBudgetType?: 'diario' | 'total';
  aboBudgetAmount?: number;
  // Scheduling
  startDate?: string;
  endDate?: string;
  hasEndDate?: boolean;
  // Optimization
  optimizationGoal?: string;
  // Conditional fields by campaign objective
  trafficDestination?: string;
  interactionType?: string;
  messageDestinations?: string[];
  conversionDestination?: string;
  leadsType?: string;
  // Audience
  ageMin?: number;
  ageMax?: number;
  gender?: 'all' | 'male' | 'female';
  locations?: string[];
  detailedTargeting?: string;
  interests?: string;
  behaviors?: string;
  hasCustomAudience?: boolean;
  customAudienceName?: string;
  lookalikeAudiences?: string;
  exclusions?: string;
  // Placements (legacy — values: Feed, Reels, Stories, Explore, Messenger, Audience Network)
  placementsOption?: 'auto' | 'manual';
  placements?: string[];
  // Platforms — Meta social channels (replaces placements in new data)
  platforms?: string[];
  // Adset-level strategic notes
  notes?: string | null;
  // Leads (Clientes Potenciales) optimization
  leadsOptimizationEvent?: string;
  leadsConversionWindow?: string;
  leadsBidStrategy?: string;
  // Ventas-specific optimization
  salesConversionEvent?: string;
  salesConversionWindow?: string;
  salesBidStrategy?: string;
  salesBidAmount?: number;
  salesRoasTarget?: string;
  salesMessageDestinations?: string[];
  // Ads (Level 3)
  ads?: MetaAdEntry[];
  // Legacy fields (backward compat)
  adType?: string;
  creatives?: CreativeFormEntry[];
  chatRecommended?: boolean;
  welcomeMessage?: string;
  customAudiences?: string;
};

export type StrategyCampaign = {
  name: string;
  budget?: number;
  budgetType?: 'ABO' | 'CBO';
  objective?: string;
  adsets?: AdSetEntry[];
  // Ventas campaign config
  salesConversionLocation?: string;
  // Clientes Potenciales (Leads) campaign config
  leadsConversionLocation?: string;
  leadsInstantForm?: LeadsInstantForm | null;
  leadsMessages?: LeadsMessagesConfig | null;
  leadsLanding?: LeadsLandingConfig | null;
  leadsPostLead?: LeadsPostLead | null;
  leadsMetrics?: LeadsMetrics | null;
};

export type SegmentationData = {
  ages?: string;
  cities?: string[];
  exclusions?: string[];
  audiences?: string[];
};

export type CreativeEntry = {
  type?: string;
  link?: string;
  description?: string;
};

export type DriveLink = {
  label: string;
  url: string;
};

export type ChecklistItem = {
  task: string;
  priority?: string;
  notes?: string;
  done?: boolean;
};

export type Strategy = {
  id: string;
  client_id: string;
  title: string;
  month?: string | null;
  status: StrategyStatus;
  monthly_budget?: number | null;
  responsible_id?: string | null;
  created_by?: string | null;
  campaigns_new: CampaignEntry[];
  campaigns_off: CampaignEntry[];
  campaigns_optimize: CampaignEntry[];
  segmentation: SegmentationData;
  creatives: CreativeEntry[];
  drive_links: DriveLink[];
  notes?: string | null;
  ai_summary?: string | null;
  ai_checklist: ChecklistItem[];
  ai_diff?: string | null;
  raw_input?: string | null;
  campaigns?: StrategyCampaign[] | null;
  is_optimizing?: boolean | null;
  version?: number;
  latest_version?: number;
  created_at: string;
  updated_at: string;
};

export type StrategyInput = Omit<
  Strategy,
  'id' | 'created_at' | 'updated_at' | 'version' | 'latest_version'
> & {
  status?: StrategyStatus;
  latest_version?: number;
};

export type StrategyHistory = {
  id: string;
  strategy_id: string;
  version: number;
  snapshot: Strategy;
  change_summary?: string | null;
  changed_by?: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  client_id?: string | null;
  strategy_id?: string | null;
  alert_id?: string | null;
  title: string;
  description?: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string | null;
  assigned_to?: string | null;
  completed_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskInput = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'> & {
  completed_at?: string | null;
};

export type TaskUpdateInput = Partial<
  Pick<Task, 'title' | 'description' | 'priority' | 'status' | 'due_date' | 'assigned_to' | 'completed_at'>
>;

export type Alert = {
  id: string;
  client_id?: string | null;
  type: string;
  rule_key: string;
  title: string;
  body?: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  triggered_by: string;
  first_triggered_at?: string;
  last_triggered_at?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
};

export type ClientMemory = {
  id: string;
  client_id: string;
  niche?: string | null;
  main_cities?: string[] | null;
  frequent_objectives?: string[] | null;
  historical_audiences: Record<string, unknown>[];
  historical_campaigns: Record<string, unknown>[];
  creative_patterns: Record<string, unknown>[];
  recurring_notes?: string | null;
  learnings?: string | null;
  created_at?: string;
  updated_at: string;
};

export type MemoryEntry = {
  id: string;
  client_id: string;
  source_type: MemorySourceType;
  source_id?: string | null;
  memory_type: MemoryType;
  content: string;
  tags: string[];
  importance: number;
  effective_date?: string | null;
  embedding?: unknown;
  created_by?: string | null;
  created_at: string;
};

export type MemoryEntryInput = Omit<MemoryEntry, 'id' | 'created_at'>;

export type ClientFileType = 'creative' | 'strategy_doc' | 'report' | 'landing' | 'other';

export type ClientFile = {
  id: string;
  client_id: string;
  strategy_id?: string | null;
  file_type: ClientFileType;
  name: string;
  drive_url: string;
  drive_file_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientFileInput = Omit<ClientFile, 'id' | 'created_at' | 'updated_at'>;

export type OperationalIssue = {
  client_id: string;
  type: OperationalIssueType;
  severity: AlertSeverity;
  title: string;
  body: string;
  rule_key: string;
  metadata?: Record<string, unknown>;
  score_penalty: number;
  should_create_task: boolean;
  task_title?: string;
  task_description?: string;
  task_priority?: TaskPriority;
  task_type?: TaskType;
};

export type ClientHealthScore = {
  client_id: string;
  score: number;
  status: HealthStatus;
  issue_count: number;
  open_critical_alerts: number;
  overdue_tasks: number;
  missing_sales_yesterday: boolean;
  optimize_overdue: boolean;
  low_real_roas: boolean;
  real_roas: number;
  days_since_optimization: number | null;
  issues: OperationalIssue[];
};

export type ClientDailyOperatingKpi = {
  client_id: string;
  date: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  messages: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  total_sales: number;
  new_client_sales: number;
  repeat_sales: number;
  physical_store_sales: number;
  online_sales: number;
  ad_roas: number;
  real_roas: number;
};

export type ClientMonthlyOperatingKpi = {
  client_id: string;
  month: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  messages: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  total_sales: number;
  new_client_sales: number;
  repeat_sales: number;
  physical_store_sales: number;
  online_sales: number;
  ad_roas: number;
  real_roas: number;
};

export type AdImportRun = {
  id: string;
  platform: 'meta';
  run_date: string;
  date_from: string;
  date_to: string;
  status: 'running' | 'completed' | 'partial' | 'failed';
  requested_by: string;
  accounts_processed: number;
  rows_upserted: number;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  started_at: string;
  finished_at?: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  client_id?: string | null;
  user_id?: string | null;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type ActivityLogInput = Omit<ActivityLog, 'id' | 'user_id' | 'created_at'> & {
  user_id?: string | null;
};

export type ServiceMutationResult<T> = {
  data: T | null;
  error: string | null;
};

export type DailyChecklistEntry = {
  id: string;
  user_name: 'juanca' | 'samuel';
  task_id: string;
  task_name: string;
  task_points: number;
  completed: boolean;
  date: string; // YYYY-MM-DD
  week_number: number;
  year: number;
  created_at: string;
};
