BEGIN;

-- ============================================================
-- MONTHLY SOCIAL METRICS
-- Seguidores cargados por cierre mensual, sin inferir desde Ads.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.social_monthly_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month           DATE NOT NULL,
  new_followers   INTEGER NOT NULL DEFAULT 0 CHECK (new_followers >= 0),
  profile_visits  INTEGER CHECK (profile_visits IS NULL OR profile_visits >= 0),
  source          TEXT NOT NULL DEFAULT 'manual_monthly_followers',
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_monthly_metrics_month_floor_check
    CHECK (month = date_trunc('month', month)::DATE),
  CONSTRAINT social_monthly_metrics_source_not_blank_check
    CHECK (btrim(source) <> ''),
  UNIQUE (client_id, month)
);

COMMENT ON TABLE public.social_monthly_metrics IS 'Cierre mensual manual de seguidores y visitas al perfil por cliente.';
COMMENT ON COLUMN public.social_monthly_metrics.month IS 'Primer dia del mes en formato DATE.';
COMMENT ON COLUMN public.social_monthly_metrics.new_followers IS 'Nuevos seguidores reales del mes. Nunca se infieren desde Ads.';

CREATE OR REPLACE VIEW public.v_client_monthly_social_metrics
WITH (security_invoker = true) AS
SELECT
  id,
  client_id,
  to_char(month, 'YYYY-MM') AS month,
  new_followers,
  profile_visits,
  source,
  notes,
  created_by,
  created_at,
  updated_at
FROM public.social_monthly_metrics;

COMMENT ON VIEW public.v_client_monthly_social_metrics IS 'Vista de cierres sociales mensuales con month en formato YYYY-MM.';

CREATE INDEX IF NOT EXISTS idx_social_monthly_metrics_client_month
  ON public.social_monthly_metrics(client_id, month DESC);

CREATE INDEX IF NOT EXISTS idx_social_monthly_metrics_month
  ON public.social_monthly_metrics(month DESC);

DROP TRIGGER IF EXISTS set_updated_at_social_monthly_metrics ON public.social_monthly_metrics;
CREATE TRIGGER set_updated_at_social_monthly_metrics
BEFORE UPDATE ON public.social_monthly_metrics
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.social_monthly_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_monthly_metrics_select ON public.social_monthly_metrics;
CREATE POLICY social_monthly_metrics_select
ON public.social_monthly_metrics
FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS social_monthly_metrics_write ON public.social_monthly_metrics;
CREATE POLICY social_monthly_metrics_write
ON public.social_monthly_metrics
FOR ALL
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_monthly_metrics TO authenticated;
GRANT SELECT ON public.v_client_monthly_social_metrics TO authenticated;

COMMIT;
