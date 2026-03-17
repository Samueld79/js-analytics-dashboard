BEGIN;

-- ============================================================
-- Campaign-level performance base
-- This repo currently uses phase SQL files + schema.sql as the
-- canonical source, not supabase/migrations/ from the CLI.
-- Reuses public.set_updated_at() already defined in schema.sql.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ad_campaign_metrics (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ad_account_id        UUID NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  campaign_id          TEXT NOT NULL,
  campaign_name        TEXT NOT NULL,
  objective            TEXT,
  effective_status     TEXT,
  date                 DATE NOT NULL,
  spend                NUMERIC(14,2) NOT NULL DEFAULT 0,
  reach                INTEGER NOT NULL DEFAULT 0,
  impressions          INTEGER NOT NULL DEFAULT 0,
  clicks               INTEGER NOT NULL DEFAULT 0,
  cpm                  NUMERIC(12,4) NOT NULL DEFAULT 0,
  cpc                  NUMERIC(12,4) NOT NULL DEFAULT 0,
  ctr                  NUMERIC(8,4) NOT NULL DEFAULT 0,
  frequency            NUMERIC(10,4),
  messages             INTEGER NOT NULL DEFAULT 0,
  messaging_started    INTEGER NOT NULL DEFAULT 0,
  messaging_connections INTEGER NOT NULL DEFAULT 0,
  messaging_first_reply INTEGER NOT NULL DEFAULT 0,
  leads                INTEGER NOT NULL DEFAULT 0,
  purchases            INTEGER NOT NULL DEFAULT 0,
  purchase_value       NUMERIC(14,2) NOT NULL DEFAULT 0,
  link_clicks          INTEGER NOT NULL DEFAULT 0,
  page_engagement      INTEGER NOT NULL DEFAULT 0,
  post_engagement      INTEGER NOT NULL DEFAULT 0,
  video_views          INTEGER NOT NULL DEFAULT 0,
  thruplays            INTEGER NOT NULL DEFAULT 0,
  profile_visits       INTEGER NOT NULL DEFAULT 0,
  raw_actions          JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_action_values    JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata             JSONB,
  source               TEXT NOT NULL DEFAULT 'meta_api_campaign',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_campaign_metrics
  ADD COLUMN IF NOT EXISTS objective TEXT,
  ADD COLUMN IF NOT EXISTS effective_status TEXT,
  ADD COLUMN IF NOT EXISTS frequency NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS messages INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messaging_started INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messaging_connections INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messaging_first_reply INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchases INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_clicks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_engagement INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_engagement INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_views INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thruplays INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_visits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_action_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'meta_api_campaign',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.ad_campaign_metrics
SET
  spend = COALESCE(spend, 0),
  reach = COALESCE(reach, 0),
  impressions = COALESCE(impressions, 0),
  clicks = COALESCE(clicks, 0),
  cpm = COALESCE(cpm, 0),
  cpc = COALESCE(cpc, 0),
  ctr = COALESCE(ctr, 0),
  messages = COALESCE(messages, 0),
  messaging_started = COALESCE(messaging_started, 0),
  messaging_connections = COALESCE(messaging_connections, 0),
  messaging_first_reply = COALESCE(messaging_first_reply, 0),
  leads = COALESCE(leads, 0),
  purchases = COALESCE(purchases, 0),
  purchase_value = COALESCE(purchase_value, 0),
  link_clicks = COALESCE(link_clicks, 0),
  page_engagement = COALESCE(page_engagement, 0),
  post_engagement = COALESCE(post_engagement, 0),
  video_views = COALESCE(video_views, 0),
  thruplays = COALESCE(thruplays, 0),
  profile_visits = COALESCE(profile_visits, 0),
  raw_actions = COALESCE(raw_actions, '[]'::jsonb),
  raw_action_values = COALESCE(raw_action_values, '[]'::jsonb),
  source = COALESCE(NULLIF(source, ''), 'meta_api_campaign'),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, created_at, now());

ALTER TABLE public.ad_campaign_metrics
  ALTER COLUMN spend SET DEFAULT 0,
  ALTER COLUMN spend SET NOT NULL,
  ALTER COLUMN reach SET DEFAULT 0,
  ALTER COLUMN reach SET NOT NULL,
  ALTER COLUMN impressions SET DEFAULT 0,
  ALTER COLUMN impressions SET NOT NULL,
  ALTER COLUMN clicks SET DEFAULT 0,
  ALTER COLUMN clicks SET NOT NULL,
  ALTER COLUMN cpm SET DEFAULT 0,
  ALTER COLUMN cpm SET NOT NULL,
  ALTER COLUMN cpc SET DEFAULT 0,
  ALTER COLUMN cpc SET NOT NULL,
  ALTER COLUMN ctr SET DEFAULT 0,
  ALTER COLUMN ctr SET NOT NULL,
  ALTER COLUMN messages SET DEFAULT 0,
  ALTER COLUMN messages SET NOT NULL,
  ALTER COLUMN messaging_started SET DEFAULT 0,
  ALTER COLUMN messaging_started SET NOT NULL,
  ALTER COLUMN messaging_connections SET DEFAULT 0,
  ALTER COLUMN messaging_connections SET NOT NULL,
  ALTER COLUMN messaging_first_reply SET DEFAULT 0,
  ALTER COLUMN messaging_first_reply SET NOT NULL,
  ALTER COLUMN leads SET DEFAULT 0,
  ALTER COLUMN leads SET NOT NULL,
  ALTER COLUMN purchases SET DEFAULT 0,
  ALTER COLUMN purchases SET NOT NULL,
  ALTER COLUMN purchase_value SET DEFAULT 0,
  ALTER COLUMN purchase_value SET NOT NULL,
  ALTER COLUMN link_clicks SET DEFAULT 0,
  ALTER COLUMN link_clicks SET NOT NULL,
  ALTER COLUMN page_engagement SET DEFAULT 0,
  ALTER COLUMN page_engagement SET NOT NULL,
  ALTER COLUMN post_engagement SET DEFAULT 0,
  ALTER COLUMN post_engagement SET NOT NULL,
  ALTER COLUMN video_views SET DEFAULT 0,
  ALTER COLUMN video_views SET NOT NULL,
  ALTER COLUMN thruplays SET DEFAULT 0,
  ALTER COLUMN thruplays SET NOT NULL,
  ALTER COLUMN profile_visits SET DEFAULT 0,
  ALTER COLUMN profile_visits SET NOT NULL,
  ALTER COLUMN raw_actions SET DEFAULT '[]'::jsonb,
  ALTER COLUMN raw_actions SET NOT NULL,
  ALTER COLUMN raw_action_values SET DEFAULT '[]'::jsonb,
  ALTER COLUMN raw_action_values SET NOT NULL,
  ALTER COLUMN source SET DEFAULT 'meta_api_campaign',
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_campaign_id_not_blank;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_campaign_name_not_blank;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_source_not_blank;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_spend_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_reach_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_impressions_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_clicks_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_cpm_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_cpc_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_ctr_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_frequency_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_messages_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_messaging_started_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_messaging_connections_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_messaging_first_reply_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_leads_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_purchases_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_purchase_value_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_link_clicks_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_page_engagement_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_post_engagement_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_video_views_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_thruplays_non_negative;
ALTER TABLE public.ad_campaign_metrics DROP CONSTRAINT IF EXISTS ad_campaign_metrics_profile_visits_non_negative;

ALTER TABLE public.ad_campaign_metrics
  ADD CONSTRAINT ad_campaign_metrics_campaign_id_not_blank CHECK (btrim(campaign_id) <> ''),
  ADD CONSTRAINT ad_campaign_metrics_campaign_name_not_blank CHECK (btrim(campaign_name) <> ''),
  ADD CONSTRAINT ad_campaign_metrics_source_not_blank CHECK (btrim(source) <> ''),
  ADD CONSTRAINT ad_campaign_metrics_spend_non_negative CHECK (spend >= 0),
  ADD CONSTRAINT ad_campaign_metrics_reach_non_negative CHECK (reach >= 0),
  ADD CONSTRAINT ad_campaign_metrics_impressions_non_negative CHECK (impressions >= 0),
  ADD CONSTRAINT ad_campaign_metrics_clicks_non_negative CHECK (clicks >= 0),
  ADD CONSTRAINT ad_campaign_metrics_cpm_non_negative CHECK (cpm >= 0),
  ADD CONSTRAINT ad_campaign_metrics_cpc_non_negative CHECK (cpc >= 0),
  ADD CONSTRAINT ad_campaign_metrics_ctr_non_negative CHECK (ctr >= 0),
  ADD CONSTRAINT ad_campaign_metrics_frequency_non_negative CHECK (frequency IS NULL OR frequency >= 0),
  ADD CONSTRAINT ad_campaign_metrics_messages_non_negative CHECK (messages >= 0),
  ADD CONSTRAINT ad_campaign_metrics_messaging_started_non_negative CHECK (messaging_started >= 0),
  ADD CONSTRAINT ad_campaign_metrics_messaging_connections_non_negative CHECK (messaging_connections >= 0),
  ADD CONSTRAINT ad_campaign_metrics_messaging_first_reply_non_negative CHECK (messaging_first_reply >= 0),
  ADD CONSTRAINT ad_campaign_metrics_leads_non_negative CHECK (leads >= 0),
  ADD CONSTRAINT ad_campaign_metrics_purchases_non_negative CHECK (purchases >= 0),
  ADD CONSTRAINT ad_campaign_metrics_purchase_value_non_negative CHECK (purchase_value >= 0),
  ADD CONSTRAINT ad_campaign_metrics_link_clicks_non_negative CHECK (link_clicks >= 0),
  ADD CONSTRAINT ad_campaign_metrics_page_engagement_non_negative CHECK (page_engagement >= 0),
  ADD CONSTRAINT ad_campaign_metrics_post_engagement_non_negative CHECK (post_engagement >= 0),
  ADD CONSTRAINT ad_campaign_metrics_video_views_non_negative CHECK (video_views >= 0),
  ADD CONSTRAINT ad_campaign_metrics_thruplays_non_negative CHECK (thruplays >= 0),
  ADD CONSTRAINT ad_campaign_metrics_profile_visits_non_negative CHECK (profile_visits >= 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ad_campaign_metrics_unique_row'
      AND conrelid = 'public.ad_campaign_metrics'::regclass
  ) THEN
    ALTER TABLE public.ad_campaign_metrics
      ADD CONSTRAINT ad_campaign_metrics_unique_row
      UNIQUE (client_id, ad_account_id, campaign_id, date);
  END IF;
END
$$;

COMMENT ON TABLE public.ad_campaign_metrics IS 'Performance real diaria a nivel campana para reporting por objetivo y top campaigns.';
COMMENT ON COLUMN public.ad_campaign_metrics.objective IS 'Objetivo real de la campana si existe en metadata de Meta.';
COMMENT ON COLUMN public.ad_campaign_metrics.messages IS 'Resultado principal usable para costo por conversacion. Normalmente messaging_started.';
COMMENT ON COLUMN public.ad_campaign_metrics.raw_actions IS 'Actions crudas devueltas por Meta Insights para la campana.';
COMMENT ON COLUMN public.ad_campaign_metrics.raw_action_values IS 'Action values crudos devueltos por Meta Insights para la campana.';
COMMENT ON COLUMN public.ad_campaign_metrics.metadata IS 'Metadata auxiliar de import, por ejemplo lookup de objective o status.';

CREATE INDEX IF NOT EXISTS idx_ad_campaign_metrics_client_date
  ON public.ad_campaign_metrics(client_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_campaign_metrics_account_date
  ON public.ad_campaign_metrics(ad_account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_campaign_metrics_campaign_date
  ON public.ad_campaign_metrics(campaign_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_campaign_metrics_client_objective_date
  ON public.ad_campaign_metrics(client_id, objective, date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_campaign_metrics_date
  ON public.ad_campaign_metrics(date DESC);

DROP TRIGGER IF EXISTS set_updated_at_ad_campaign_metrics ON public.ad_campaign_metrics;
CREATE TRIGGER set_updated_at_ad_campaign_metrics
BEFORE UPDATE ON public.ad_campaign_metrics
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ad_campaign_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_campaign_metrics_select ON public.ad_campaign_metrics;
CREATE POLICY ad_campaign_metrics_select
ON public.ad_campaign_metrics
FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS ad_campaign_metrics_write ON public.ad_campaign_metrics;
CREATE POLICY ad_campaign_metrics_write
ON public.ad_campaign_metrics
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaign_metrics TO authenticated;

COMMIT;

-- ============================================================
-- Validation queries
-- ============================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ad_campaign_metrics'
ORDER BY ordinal_position;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ad_campaign_metrics'
ORDER BY indexname;
