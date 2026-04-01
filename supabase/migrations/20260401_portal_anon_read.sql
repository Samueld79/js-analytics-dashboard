-- ============================================================
-- Portal público — políticas de lectura anónima
-- ============================================================
-- Permite que el anon key de Supabase lea los datos necesarios
-- para el portal de cliente en /portal/:clientId.
--
-- Seguridad: el clientId (UUID v4) en la URL actúa como token
-- de acceso. La app filtra por client_id en cada query.
-- Si quieres restringir aún más, puedes reemplazar USING (true)
-- por USING (client_id = <uuid-conocido>) en cada política.
--
-- EJECUTAR en Supabase SQL Editor.
-- ============================================================

-- ── clients ─────────────────────────────────────────────────
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_anon_read_clients" ON public.clients;
CREATE POLICY "portal_anon_read_clients"
  ON public.clients
  FOR SELECT
  TO anon
  USING (true);

-- ── ad_campaign_metrics ──────────────────────────────────────
ALTER TABLE public.ad_campaign_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_anon_read_campaign_metrics" ON public.ad_campaign_metrics;
CREATE POLICY "portal_anon_read_campaign_metrics"
  ON public.ad_campaign_metrics
  FOR SELECT
  TO anon
  USING (true);

-- ── daily_sales ──────────────────────────────────────────────
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_anon_read_daily_sales" ON public.daily_sales;
CREATE POLICY "portal_anon_read_daily_sales"
  ON public.daily_sales
  FOR SELECT
  TO anon
  USING (true);

-- ── strategies ───────────────────────────────────────────────
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_anon_read_strategies" ON public.strategies;
CREATE POLICY "portal_anon_read_strategies"
  ON public.strategies
  FOR SELECT
  TO anon
  USING (true);

-- ── ad_metrics (legacy) ──────────────────────────────────────
ALTER TABLE public.ad_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_anon_read_ad_metrics" ON public.ad_metrics;
CREATE POLICY "portal_anon_read_ad_metrics"
  ON public.ad_metrics
  FOR SELECT
  TO anon
  USING (true);

-- ── monthly_operating_kpis (si existe la tabla base) ─────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'monthly_operating_kpis'
  ) THEN
    EXECUTE 'ALTER TABLE public.monthly_operating_kpis ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "portal_anon_read_monthly_kpis" ON public.monthly_operating_kpis';
    EXECUTE $p$
      CREATE POLICY "portal_anon_read_monthly_kpis"
        ON public.monthly_operating_kpis
        FOR SELECT TO anon USING (true)
    $p$;
  END IF;
END $$;

-- ── social_monthly_metrics (si existe) ───────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'social_monthly_metrics'
  ) THEN
    EXECUTE 'ALTER TABLE public.social_monthly_metrics ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "portal_anon_read_social" ON public.social_monthly_metrics';
    EXECUTE $p$
      CREATE POLICY "portal_anon_read_social"
        ON public.social_monthly_metrics
        FOR SELECT TO anon USING (true)
    $p$;
  END IF;
END $$;

-- ── GRANT SELECT al rol anon en las tablas base ───────────────
-- (Supabase normalmente ya lo concede, pero lo reafirmamos)
GRANT SELECT ON public.clients               TO anon;
GRANT SELECT ON public.ad_campaign_metrics   TO anon;
GRANT SELECT ON public.daily_sales           TO anon;
GRANT SELECT ON public.strategies            TO anon;
GRANT SELECT ON public.ad_metrics            TO anon;
