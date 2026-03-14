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
  | 'mounted'
  | 'reviewed'
  | 'approved'
  | 'archived';
export type UserRole =
  | 'admin'
  | 'team'
  | 'strategist'
  | 'operator'
  | 'partner'
  | 'client'
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
  last_optimization_at?: string | null;
  last_sales_entry_at?: string | null;
  created_at: string;
  updated_at: string;
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

export type DailySaleValidation = {
  totalsMismatch: boolean;
  channelsMismatch: boolean;
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
  Pick<Task, 'description' | 'priority' | 'status' | 'due_date' | 'assigned_to' | 'completed_at'>
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
