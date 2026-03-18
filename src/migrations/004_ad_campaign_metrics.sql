-- 004_ad_campaign_metrics.sql
-- Campaign-level Meta Ads metrics (one row per campaign × date)
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS ad_campaign_metrics (
  id                     uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id              uuid          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id          text          NOT NULL,
  campaign_id            text          NOT NULL,
  campaign_name          text          NOT NULL DEFAULT '',
  objective              text,
  effective_status       text,
  date                   date          NOT NULL,
  spend                  numeric(14,2) NOT NULL DEFAULT 0,
  reach                  integer       NOT NULL DEFAULT 0,
  impressions            integer       NOT NULL DEFAULT 0,
  clicks                 integer       NOT NULL DEFAULT 0,
  cpm                    numeric(14,4) NOT NULL DEFAULT 0,
  cpc                    numeric(14,4) NOT NULL DEFAULT 0,
  ctr                    numeric(10,4) NOT NULL DEFAULT 0,
  frequency              numeric(10,4),
  messages               integer       NOT NULL DEFAULT 0,
  messaging_started      integer       NOT NULL DEFAULT 0,
  messaging_connections  integer       NOT NULL DEFAULT 0,
  messaging_first_reply  integer       NOT NULL DEFAULT 0,
  leads                  integer       NOT NULL DEFAULT 0,
  purchases              integer       NOT NULL DEFAULT 0,
  purchase_value         numeric(14,2) NOT NULL DEFAULT 0,
  link_clicks            integer       NOT NULL DEFAULT 0,
  page_engagement        integer       NOT NULL DEFAULT 0,
  post_engagement        integer       NOT NULL DEFAULT 0,
  video_views            integer       NOT NULL DEFAULT 0,
  thruplays              integer       NOT NULL DEFAULT 0,
  profile_visits         integer       NOT NULL DEFAULT 0,
  raw_actions            jsonb,
  raw_action_values      jsonb,
  metadata               jsonb,
  source                 text          NOT NULL DEFAULT 'manual',
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT ad_campaign_metrics_unique_row
    UNIQUE (client_id, ad_account_id, campaign_id, date)
);

CREATE INDEX IF NOT EXISTS ad_campaign_metrics_client_date_idx
  ON ad_campaign_metrics (client_id, date DESC);

CREATE INDEX IF NOT EXISTS ad_campaign_metrics_campaign_id_idx
  ON ad_campaign_metrics (campaign_id);

ALTER TABLE ad_campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Internal users: full access
CREATE POLICY "internal_full_access_ad_campaign_metrics"
  ON ad_campaign_metrics FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal')
  );

-- Client users: read-only access to their own data
CREATE POLICY "client_read_own_ad_campaign_metrics"
  ON ad_campaign_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_users cu
      WHERE cu.user_id = auth.uid() AND cu.client_id = ad_campaign_metrics.client_id
    )
  );
