BEGIN;

-- ============================================================
-- SOCIAL MONTHLY METRICS: SPECIAL MONTHLY FIELDS
-- Extiende el cierre mensual con métricas especiales reportadas.
-- ============================================================

ALTER TABLE public.social_monthly_metrics
  ADD COLUMN IF NOT EXISTS whatsapp_clicks INTEGER,
  ADD COLUMN IF NOT EXISTS link_clicks INTEGER,
  ADD COLUMN IF NOT EXISTS new_customers_reported INTEGER,
  ADD COLUMN IF NOT EXISTS returning_customers_reported INTEGER,
  ADD COLUMN IF NOT EXISTS store_visits_reported INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_monthly_metrics_whatsapp_clicks_check'
      AND conrelid = 'public.social_monthly_metrics'::regclass
  ) THEN
    ALTER TABLE public.social_monthly_metrics
      ADD CONSTRAINT social_monthly_metrics_whatsapp_clicks_check
      CHECK (whatsapp_clicks IS NULL OR whatsapp_clicks >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_monthly_metrics_link_clicks_check'
      AND conrelid = 'public.social_monthly_metrics'::regclass
  ) THEN
    ALTER TABLE public.social_monthly_metrics
      ADD CONSTRAINT social_monthly_metrics_link_clicks_check
      CHECK (link_clicks IS NULL OR link_clicks >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_monthly_metrics_new_customers_reported_check'
      AND conrelid = 'public.social_monthly_metrics'::regclass
  ) THEN
    ALTER TABLE public.social_monthly_metrics
      ADD CONSTRAINT social_monthly_metrics_new_customers_reported_check
      CHECK (new_customers_reported IS NULL OR new_customers_reported >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_monthly_metrics_returning_customers_reported_check'
      AND conrelid = 'public.social_monthly_metrics'::regclass
  ) THEN
    ALTER TABLE public.social_monthly_metrics
      ADD CONSTRAINT social_monthly_metrics_returning_customers_reported_check
      CHECK (
        returning_customers_reported IS NULL
        OR returning_customers_reported >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_monthly_metrics_store_visits_reported_check'
      AND conrelid = 'public.social_monthly_metrics'::regclass
  ) THEN
    ALTER TABLE public.social_monthly_metrics
      ADD CONSTRAINT social_monthly_metrics_store_visits_reported_check
      CHECK (store_visits_reported IS NULL OR store_visits_reported >= 0);
  END IF;
END
$$;

COMMENT ON COLUMN public.social_monthly_metrics.whatsapp_clicks IS 'Clicks de WhatsApp reportados al cierre mensual.';
COMMENT ON COLUMN public.social_monthly_metrics.link_clicks IS 'Clicks al link reportados al cierre mensual.';
COMMENT ON COLUMN public.social_monthly_metrics.new_customers_reported IS 'Nuevos clientes reportados al cierre mensual.';
COMMENT ON COLUMN public.social_monthly_metrics.returning_customers_reported IS 'Clientes de recompra reportados al cierre mensual.';
COMMENT ON COLUMN public.social_monthly_metrics.store_visits_reported IS 'Visitas a tienda reportadas al cierre mensual.';

CREATE OR REPLACE VIEW public.v_client_monthly_social_metrics
WITH (security_invoker = true) AS
SELECT
  id,
  client_id,
  to_char(month, 'YYYY-MM') AS month,
  new_followers,
  profile_visits,
  whatsapp_clicks,
  link_clicks,
  new_customers_reported,
  returning_customers_reported,
  store_visits_reported,
  source,
  notes,
  created_by,
  created_at,
  updated_at
FROM public.social_monthly_metrics;

COMMIT;
