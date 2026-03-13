-- ============================================================
-- AGENCY OS — Final Supabase Schema
-- Fresh-project schema for the current repository.
-- If you already have a live database, convert this file into
-- incremental migrations instead of running it blindly.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- USERS / ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT,
  full_name           TEXT,
  role                TEXT NOT NULL DEFAULT 'operator'
                      CHECK (role IN ('admin', 'team', 'strategist', 'operator', 'partner', 'client')),
  avatar_url          TEXT,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CLIENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  niche               TEXT,
  logo_url            TEXT,
  drive_folder_url    TEXT,
  ad_account_id       TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'paused', 'churned')),
  currency_code       TEXT NOT NULL DEFAULT 'COP',
  reporting_timezone  TEXT NOT NULL DEFAULT 'America/Bogota',
  main_city           TEXT,
  target_cities       TEXT[] NOT NULL DEFAULT '{}',
  notes               TEXT,
  last_optimization_at TIMESTAMPTZ,
  last_sales_entry_at TIMESTAMPTZ,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_memberships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_level        TEXT NOT NULL DEFAULT 'viewer'
                      CHECK (access_level IN ('manager', 'operator', 'viewer', 'client')),
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

-- ============================================================
-- AD ACCOUNTS / IMPORTS / DAILY METRICS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL DEFAULT 'meta'
                      CHECK (platform IN ('meta')),
  meta_account_id     TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  currency_code       TEXT NOT NULL DEFAULT 'COP',
  timezone            TEXT NOT NULL DEFAULT 'America/Bogota',
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'paused', 'archived')),
  is_primary          BOOLEAN NOT NULL DEFAULT false,
  last_sync_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ad_import_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform            TEXT NOT NULL DEFAULT 'meta'
                      CHECK (platform IN ('meta')),
  run_date            DATE NOT NULL,
  date_from           DATE NOT NULL,
  date_to             DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  requested_by        TEXT NOT NULL DEFAULT 'n8n',
  accounts_processed  INTEGER NOT NULL DEFAULT 0 CHECK (accounts_processed >= 0),
  rows_upserted       INTEGER NOT NULL DEFAULT 0 CHECK (rows_upserted >= 0),
  error_message       TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ad_metrics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ad_account_id       UUID NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  import_run_id       UUID REFERENCES public.ad_import_runs(id) ON DELETE SET NULL,
  date                DATE NOT NULL,
  spend               NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (spend >= 0),
  reach               INTEGER NOT NULL DEFAULT 0 CHECK (reach >= 0),
  impressions         INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks              INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  cpm                 NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cpm >= 0),
  cpc                 NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cpc >= 0),
  ctr                 NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (ctr >= 0),
  messages            INTEGER NOT NULL DEFAULT 0 CHECK (messages >= 0),
  leads               INTEGER NOT NULL DEFAULT 0 CHECK (leads >= 0),
  purchases           INTEGER NOT NULL DEFAULT 0 CHECK (purchases >= 0),
  purchase_value      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (purchase_value >= 0),
  roas                NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (roas >= 0),
  cpr                 NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cpr >= 0),
  cpl                 NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cpl >= 0),
  cpa                 NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cpa >= 0),
  frequency           NUMERIC(10,4) CHECK (frequency >= 0),
  raw_actions         JSONB NOT NULL DEFAULT '[]'::jsonb,
  source              TEXT NOT NULL DEFAULT 'meta_api',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, ad_account_id, date)
);

-- ============================================================
-- SALES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.daily_sales (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date                    DATE NOT NULL,
  total_sales             NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
  new_client_sales        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (new_client_sales >= 0),
  repeat_sales            NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (repeat_sales >= 0),
  physical_store_sales    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (physical_store_sales >= 0),
  online_sales            NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (online_sales >= 0),
  observations            TEXT,
  status                  TEXT NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('draft', 'submitted', 'validated')),
  registered_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, date)
);

-- ============================================================
-- STRATEGIES / VERSION HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.strategies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  month               DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('draft', 'pending', 'mounted', 'reviewed', 'approved', 'archived')),
  monthly_budget      NUMERIC(14,2) CHECK (monthly_budget >= 0),
  responsible_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  raw_input           TEXT,
  notes               TEXT,
  campaigns_new       JSONB NOT NULL DEFAULT '[]'::jsonb,
  campaigns_off       JSONB NOT NULL DEFAULT '[]'::jsonb,
  campaigns_optimize  JSONB NOT NULL DEFAULT '[]'::jsonb,
  segmentation        JSONB NOT NULL DEFAULT '{}'::jsonb,
  creatives           JSONB NOT NULL DEFAULT '[]'::jsonb,
  drive_links         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_summary          TEXT,
  ai_checklist        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_diff             TEXT,
  latest_version      INTEGER NOT NULL DEFAULT 1 CHECK (latest_version >= 1),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.strategy_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id         UUID NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL CHECK (version >= 1),
  snapshot            JSONB NOT NULL,
  change_summary      TEXT,
  changed_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (strategy_id, version)
);

-- ============================================================
-- ALERTS / TASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  rule_key            TEXT NOT NULL,
  title               TEXT NOT NULL,
  body                TEXT,
  severity            TEXT NOT NULL DEFAULT 'info'
                      CHECK (severity IN ('info', 'warning', 'critical')),
  status              TEXT NOT NULL DEFAULT 'unread'
                      CHECK (status IN ('unread', 'read', 'resolved', 'dismissed')),
  triggered_by        TEXT NOT NULL DEFAULT 'system',
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_triggered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ,
  resolved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  strategy_id         UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  alert_id            UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  type                TEXT NOT NULL DEFAULT 'optimization'
                      CHECK (type IN ('optimization', 'review', 'budget', 'creative', 'sales_followup', 'alert', 'general')),
  priority            TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'done', 'skipped')),
  due_date            DATE,
  assigned_to         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FILES / NOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_files (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  strategy_id         UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  file_type           TEXT NOT NULL
                      CHECK (file_type IN ('creative', 'strategy_doc', 'report', 'landing', 'other')),
  name                TEXT NOT NULL,
  drive_url           TEXT NOT NULL,
  drive_file_id       TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  strategy_id         UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  note_type           TEXT NOT NULL DEFAULT 'general'
                      CHECK (note_type IN ('general', 'performance', 'sales', 'strategy', 'creative', 'meeting')),
  visibility          TEXT NOT NULL DEFAULT 'internal'
                      CHECK (visibility IN ('internal', 'client')),
  title               TEXT,
  body                TEXT NOT NULL,
  pinned              BOOLEAN NOT NULL DEFAULT false,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AI MEMORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_memory (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  niche                   TEXT,
  main_cities             TEXT[] NOT NULL DEFAULT '{}',
  frequent_objectives     TEXT[] NOT NULL DEFAULT '{}',
  historical_audiences    JSONB NOT NULL DEFAULT '[]'::jsonb,
  historical_campaigns    JSONB NOT NULL DEFAULT '[]'::jsonb,
  creative_patterns       JSONB NOT NULL DEFAULT '[]'::jsonb,
  recurring_notes         TEXT,
  learnings               TEXT,
  last_source_strategy_id UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memory_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_type         TEXT NOT NULL
                      CHECK (source_type IN ('strategy', 'note', 'alert', 'task', 'sales', 'ads', 'manual')),
  source_id           UUID,
  memory_type         TEXT NOT NULL
                      CHECK (memory_type IN ('fact', 'audience', 'creative', 'learning', 'summary', 'warning')),
  content             TEXT NOT NULL,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  importance          SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  effective_date      DATE,
  embedding           VECTOR(1536),
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type         TEXT NOT NULL,
  entity_id           UUID,
  action              TEXT NOT NULL,
  description         TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- VIEWS FOR DASHBOARD / CLIENT WORKSPACE
-- ============================================================

CREATE OR REPLACE VIEW public.v_client_daily_operating_kpis
WITH (security_invoker = true) AS
WITH ad_daily AS (
  SELECT
    client_id,
    date,
    SUM(spend)::NUMERIC(14,2) AS spend,
    SUM(reach)::BIGINT AS reach,
    SUM(impressions)::BIGINT AS impressions,
    SUM(clicks)::BIGINT AS clicks,
    SUM(messages)::BIGINT AS messages,
    SUM(leads)::BIGINT AS leads,
    SUM(purchases)::BIGINT AS purchases,
    SUM(purchase_value)::NUMERIC(14,2) AS purchase_value
  FROM public.ad_metrics
  GROUP BY client_id, date
),
sales_daily AS (
  SELECT
    client_id,
    date,
    SUM(total_sales)::NUMERIC(14,2) AS total_sales,
    SUM(new_client_sales)::NUMERIC(14,2) AS new_client_sales,
    SUM(repeat_sales)::NUMERIC(14,2) AS repeat_sales,
    SUM(physical_store_sales)::NUMERIC(14,2) AS physical_store_sales,
    SUM(online_sales)::NUMERIC(14,2) AS online_sales
  FROM public.daily_sales
  GROUP BY client_id, date
)
SELECT
  COALESCE(a.client_id, s.client_id) AS client_id,
  COALESCE(a.date, s.date) AS date,
  COALESCE(a.spend, 0)::NUMERIC(14,2) AS spend,
  COALESCE(a.reach, 0)::BIGINT AS reach,
  COALESCE(a.impressions, 0)::BIGINT AS impressions,
  COALESCE(a.clicks, 0)::BIGINT AS clicks,
  COALESCE(a.messages, 0)::BIGINT AS messages,
  COALESCE(a.leads, 0)::BIGINT AS leads,
  COALESCE(a.purchases, 0)::BIGINT AS purchases,
  COALESCE(a.purchase_value, 0)::NUMERIC(14,2) AS purchase_value,
  COALESCE(s.total_sales, 0)::NUMERIC(14,2) AS total_sales,
  COALESCE(s.new_client_sales, 0)::NUMERIC(14,2) AS new_client_sales,
  COALESCE(s.repeat_sales, 0)::NUMERIC(14,2) AS repeat_sales,
  COALESCE(s.physical_store_sales, 0)::NUMERIC(14,2) AS physical_store_sales,
  COALESCE(s.online_sales, 0)::NUMERIC(14,2) AS online_sales,
  CASE
    WHEN COALESCE(a.spend, 0) > 0
      THEN ROUND(COALESCE(a.purchase_value, 0) / NULLIF(a.spend, 0), 4)
    ELSE 0
  END AS ad_roas,
  CASE
    WHEN COALESCE(a.spend, 0) > 0
      THEN ROUND(COALESCE(s.total_sales, 0) / NULLIF(a.spend, 0), 4)
    ELSE 0
  END AS real_roas
FROM ad_daily a
FULL OUTER JOIN sales_daily s
  ON s.client_id = a.client_id
 AND s.date = a.date;

CREATE OR REPLACE VIEW public.v_client_monthly_operating_kpis
WITH (security_invoker = true) AS
SELECT
  client_id,
  date_trunc('month', date)::DATE AS month,
  SUM(spend)::NUMERIC(14,2) AS spend,
  SUM(reach)::BIGINT AS reach,
  SUM(impressions)::BIGINT AS impressions,
  SUM(clicks)::BIGINT AS clicks,
  SUM(messages)::BIGINT AS messages,
  SUM(leads)::BIGINT AS leads,
  SUM(purchases)::BIGINT AS purchases,
  SUM(purchase_value)::NUMERIC(14,2) AS purchase_value,
  SUM(total_sales)::NUMERIC(14,2) AS total_sales,
  SUM(new_client_sales)::NUMERIC(14,2) AS new_client_sales,
  SUM(repeat_sales)::NUMERIC(14,2) AS repeat_sales,
  SUM(physical_store_sales)::NUMERIC(14,2) AS physical_store_sales,
  SUM(online_sales)::NUMERIC(14,2) AS online_sales,
  CASE
    WHEN SUM(spend) > 0 THEN ROUND(SUM(purchase_value) / NULLIF(SUM(spend), 0), 4)
    ELSE 0
  END AS ad_roas,
  CASE
    WHEN SUM(spend) > 0 THEN ROUND(SUM(total_sales) / NULLIF(SUM(spend), 0), 4)
    ELSE 0
  END AS real_roas
FROM public.v_client_daily_operating_kpis
GROUP BY client_id, date_trunc('month', date);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_slug ON public.clients(slug);

CREATE INDEX IF NOT EXISTS idx_client_memberships_user ON public.client_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_client ON public.client_memberships(client_id);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_client_status ON public.ad_accounts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_primary ON public.ad_accounts(client_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_ad_import_runs_run_date ON public.ad_import_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_import_runs_status ON public.ad_import_runs(status);

CREATE INDEX IF NOT EXISTS idx_ad_metrics_client_date ON public.ad_metrics(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_account_date ON public.ad_metrics(ad_account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_import_run ON public.ad_metrics(import_run_id);

CREATE INDEX IF NOT EXISTS idx_daily_sales_client_date ON public.daily_sales(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_sales_status ON public.daily_sales(status);

CREATE INDEX IF NOT EXISTS idx_strategies_client_month ON public.strategies(client_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_strategies_status ON public.strategies(status);
CREATE INDEX IF NOT EXISTS idx_strategy_history_strategy_version ON public.strategy_history(strategy_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_client_status ON public.alerts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_client_severity ON public.alerts(client_id, severity);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_open_rule
  ON public.alerts(client_id, rule_key)
  WHERE status IN ('unread', 'read');

CREATE INDEX IF NOT EXISTS idx_tasks_client_status ON public.tasks(client_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_client_files_client_type ON public.client_files(client_id, file_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_files_drive_file
  ON public.client_files(client_id, drive_file_id)
  WHERE drive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_notes_client_created ON public.client_notes(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_notes_type ON public.client_notes(note_type);

CREATE INDEX IF NOT EXISTS idx_client_memory_client ON public.client_memory(client_id);

CREATE INDEX IF NOT EXISTS idx_memory_entries_client_created ON public.memory_entries(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_entries_tags ON public.memory_entries USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_activity_log_client_created ON public.activity_log(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);

GRANT SELECT ON public.v_client_daily_operating_kpis TO authenticated;
GRANT SELECT ON public.v_client_monthly_operating_kpis TO authenticated;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON public.user_profiles;
CREATE TRIGGER set_updated_at_user_profiles
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_clients ON public.clients;
CREATE TRIGGER set_updated_at_clients
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_client_memberships ON public.client_memberships;
CREATE TRIGGER set_updated_at_client_memberships
BEFORE UPDATE ON public.client_memberships
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_ad_accounts ON public.ad_accounts;
CREATE TRIGGER set_updated_at_ad_accounts
BEFORE UPDATE ON public.ad_accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_ad_metrics ON public.ad_metrics;
CREATE TRIGGER set_updated_at_ad_metrics
BEFORE UPDATE ON public.ad_metrics
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_daily_sales ON public.daily_sales;
CREATE TRIGGER set_updated_at_daily_sales
BEFORE UPDATE ON public.daily_sales
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_strategies ON public.strategies;
CREATE TRIGGER set_updated_at_strategies
BEFORE UPDATE ON public.strategies
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_alerts ON public.alerts;
CREATE TRIGGER set_updated_at_alerts
BEFORE UPDATE ON public.alerts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tasks ON public.tasks;
CREATE TRIGGER set_updated_at_tasks
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_client_files ON public.client_files;
CREATE TRIGGER set_updated_at_client_files
BEFORE UPDATE ON public.client_files
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_client_notes ON public.client_notes;
CREATE TRIGGER set_updated_at_client_notes
BEFORE UPDATE ON public.client_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_client_memory ON public.client_memory;
CREATE TRIGGER set_updated_at_client_memory
BEFORE UPDATE ON public.client_memory
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('admin', 'team', 'strategist', 'operator', 'partner');
$$;

CREATE OR REPLACE FUNCTION public.user_has_client_access(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_internal_user()
    OR EXISTS (
      SELECT 1
      FROM public.client_memberships cm
      WHERE cm.client_id = target_client_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_write_client_sales(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_internal_user()
    OR EXISTS (
      SELECT 1
      FROM public.client_memberships cm
      WHERE cm.client_id = target_client_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.access_level IN ('manager', 'client')
    );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select ON public.user_profiles;
CREATE POLICY user_profiles_select
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_internal_user());

DROP POLICY IF EXISTS user_profiles_insert ON public.user_profiles;
CREATE POLICY user_profiles_insert
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() OR public.is_internal_user());

DROP POLICY IF EXISTS user_profiles_update ON public.user_profiles;
CREATE POLICY user_profiles_update
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_internal_user())
WITH CHECK (id = auth.uid() OR public.is_internal_user());

DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select
ON public.clients
FOR SELECT
TO authenticated
USING (public.user_has_client_access(id));

DROP POLICY IF EXISTS clients_write ON public.clients;
CREATE POLICY clients_write
ON public.clients
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS client_memberships_select ON public.client_memberships;
CREATE POLICY client_memberships_select
ON public.client_memberships
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_internal_user());

DROP POLICY IF EXISTS client_memberships_write ON public.client_memberships;
CREATE POLICY client_memberships_write
ON public.client_memberships
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS ad_accounts_select ON public.ad_accounts;
CREATE POLICY ad_accounts_select
ON public.ad_accounts
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS ad_accounts_write ON public.ad_accounts;
CREATE POLICY ad_accounts_write
ON public.ad_accounts
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS ad_import_runs_select ON public.ad_import_runs;
CREATE POLICY ad_import_runs_select
ON public.ad_import_runs
FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS ad_import_runs_write ON public.ad_import_runs;
CREATE POLICY ad_import_runs_write
ON public.ad_import_runs
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS ad_metrics_select ON public.ad_metrics;
CREATE POLICY ad_metrics_select
ON public.ad_metrics
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS ad_metrics_write ON public.ad_metrics;
CREATE POLICY ad_metrics_write
ON public.ad_metrics
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS daily_sales_select ON public.daily_sales;
CREATE POLICY daily_sales_select
ON public.daily_sales
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS daily_sales_insert ON public.daily_sales;
CREATE POLICY daily_sales_insert
ON public.daily_sales
FOR INSERT
TO authenticated
WITH CHECK (public.user_can_write_client_sales(client_id));

DROP POLICY IF EXISTS daily_sales_update ON public.daily_sales;
CREATE POLICY daily_sales_update
ON public.daily_sales
FOR UPDATE
TO authenticated
USING (public.user_can_write_client_sales(client_id))
WITH CHECK (public.user_can_write_client_sales(client_id));

DROP POLICY IF EXISTS daily_sales_delete ON public.daily_sales;
CREATE POLICY daily_sales_delete
ON public.daily_sales
FOR DELETE
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS strategies_select ON public.strategies;
CREATE POLICY strategies_select
ON public.strategies
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS strategies_write ON public.strategies;
CREATE POLICY strategies_write
ON public.strategies
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS strategy_history_select ON public.strategy_history;
CREATE POLICY strategy_history_select
ON public.strategy_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.strategies s
    WHERE s.id = strategy_id
      AND public.user_has_client_access(s.client_id)
  )
);

DROP POLICY IF EXISTS strategy_history_write ON public.strategy_history;
CREATE POLICY strategy_history_write
ON public.strategy_history
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS alerts_select ON public.alerts;
CREATE POLICY alerts_select
ON public.alerts
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS alerts_write ON public.alerts;
CREATE POLICY alerts_write
ON public.alerts
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select
ON public.tasks
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS tasks_write ON public.tasks;
CREATE POLICY tasks_write
ON public.tasks
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS client_files_select ON public.client_files;
CREATE POLICY client_files_select
ON public.client_files
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS client_files_write ON public.client_files;
CREATE POLICY client_files_write
ON public.client_files
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS client_notes_select ON public.client_notes;
CREATE POLICY client_notes_select
ON public.client_notes
FOR SELECT
TO authenticated
USING (
  (public.is_internal_user() AND public.user_has_client_access(client_id))
  OR (visibility = 'client' AND public.user_has_client_access(client_id))
);

DROP POLICY IF EXISTS client_notes_write ON public.client_notes;
CREATE POLICY client_notes_write
ON public.client_notes
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS client_memory_select ON public.client_memory;
CREATE POLICY client_memory_select
ON public.client_memory
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS client_memory_write ON public.client_memory;
CREATE POLICY client_memory_write
ON public.client_memory
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS memory_entries_select ON public.memory_entries;
CREATE POLICY memory_entries_select
ON public.memory_entries
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS memory_entries_write ON public.memory_entries;
CREATE POLICY memory_entries_write
ON public.memory_entries
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS activity_log_select ON public.activity_log;
CREATE POLICY activity_log_select
ON public.activity_log
FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS activity_log_write ON public.activity_log;
CREATE POLICY activity_log_write
ON public.activity_log
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

-- ============================================================
-- NOTES
-- ============================================================
-- 1. n8n should use the Supabase service role for ad imports and alerts.
-- 2. The current repository can keep querying public.ad_metrics,
--    public.daily_sales, public.strategies, public.tasks and public.alerts
--    with minimal frontend rename pressure.
-- 3. Vector search is optional in MVP; if you are not using embeddings yet,
--    keep the column and ignore it until phase 3.
