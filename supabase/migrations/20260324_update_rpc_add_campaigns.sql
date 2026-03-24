-- ============================================================
-- MIGRATION: update save_strategy_with_history RPC
-- Adds p_campaigns (JSONB) and p_is_optimizing (BOOLEAN) params
-- so the function writes the campaigns and is_optimizing columns.
--
-- PREREQUISITE: run these first if not already done:
--   20260324_add_campaigns_jsonb.sql
--   20260324_add_is_optimizing.sql
--   20260324_fix_status_constraint.sql
--
-- RUN IN: Supabase SQL Editor (once, idempotent)
-- ============================================================

-- 1. Drop old signature (without p_campaigns / p_is_optimizing)
DROP FUNCTION IF EXISTS public.save_strategy_with_history(
  UUID, TEXT, DATE, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT,
  JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, TEXT, JSONB, TEXT, TEXT, UUID
);

-- 2. Re-create with new parameters
CREATE OR REPLACE FUNCTION public.save_strategy_with_history(
  p_client_id        UUID,
  p_title            TEXT,
  p_month            DATE,
  p_status           TEXT      DEFAULT 'pending',
  p_monthly_budget   NUMERIC   DEFAULT NULL,
  p_responsible_id   UUID      DEFAULT NULL,
  p_created_by       UUID      DEFAULT auth.uid(),
  p_raw_input        TEXT      DEFAULT NULL,
  p_notes            TEXT      DEFAULT NULL,
  p_campaigns_new    JSONB     DEFAULT '[]'::jsonb,
  p_campaigns_off    JSONB     DEFAULT '[]'::jsonb,
  p_campaigns_optimize JSONB   DEFAULT '[]'::jsonb,
  p_segmentation     JSONB     DEFAULT '{}'::jsonb,
  p_creatives        JSONB     DEFAULT '[]'::jsonb,
  p_drive_links      JSONB     DEFAULT '[]'::jsonb,
  p_ai_summary       TEXT      DEFAULT NULL,
  p_ai_checklist     JSONB     DEFAULT '[]'::jsonb,
  p_ai_diff          TEXT      DEFAULT NULL,
  p_change_summary   TEXT      DEFAULT NULL,
  p_strategy_id      UUID      DEFAULT NULL,
  p_campaigns        JSONB     DEFAULT NULL,   -- NEW: rich campaign builder data
  p_is_optimizing    BOOLEAN   DEFAULT FALSE   -- NEW: optimization mode flag
)
RETURNS public.strategies
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_strategy public.strategies;
  v_existing public.strategies;
  v_version  INTEGER;
BEGIN
  -- ── CREATE ──────────────────────────────────────────────────────────────
  IF p_strategy_id IS NULL THEN
    INSERT INTO public.strategies (
      client_id,
      title,
      month,
      status,
      monthly_budget,
      responsible_id,
      created_by,
      raw_input,
      notes,
      campaigns_new,
      campaigns_off,
      campaigns_optimize,
      segmentation,
      creatives,
      drive_links,
      ai_summary,
      ai_checklist,
      ai_diff,
      campaigns,
      is_optimizing,
      latest_version
    )
    VALUES (
      p_client_id,
      btrim(p_title),
      p_month,
      COALESCE(p_status, 'pending'),
      p_monthly_budget,
      p_responsible_id,
      p_created_by,
      NULLIF(btrim(COALESCE(p_raw_input,   '')), ''),
      NULLIF(btrim(COALESCE(p_notes,        '')), ''),
      COALESCE(p_campaigns_new,      '[]'::jsonb),
      COALESCE(p_campaigns_off,      '[]'::jsonb),
      COALESCE(p_campaigns_optimize, '[]'::jsonb),
      COALESCE(p_segmentation,       '{}'::jsonb),
      COALESCE(p_creatives,          '[]'::jsonb),
      COALESCE(p_drive_links,        '[]'::jsonb),
      NULLIF(btrim(COALESCE(p_ai_summary, '')), ''),
      COALESCE(p_ai_checklist, '[]'::jsonb),
      NULLIF(btrim(COALESCE(p_ai_diff, '')), ''),
      p_campaigns,                         -- can be NULL (no campaigns)
      COALESCE(p_is_optimizing, FALSE),
      1
    )
    RETURNING * INTO v_strategy;

    INSERT INTO public.strategy_history (
      strategy_id, version, snapshot, change_summary, changed_by
    )
    VALUES (
      v_strategy.id,
      1,
      to_jsonb(v_strategy),
      COALESCE(NULLIF(btrim(COALESCE(p_change_summary, '')), ''), 'Creacion inicial'),
      p_created_by
    );

    RETURN v_strategy;
  END IF;

  -- ── UPDATE ──────────────────────────────────────────────────────────────
  SELECT * INTO v_existing
  FROM public.strategies
  WHERE id = p_strategy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Strategy % not found', p_strategy_id;
  END IF;

  v_version := COALESCE(v_existing.latest_version, 1) + 1;

  UPDATE public.strategies
  SET
    client_id          = p_client_id,
    title              = btrim(p_title),
    month              = p_month,
    status             = COALESCE(p_status, v_existing.status),
    monthly_budget     = p_monthly_budget,
    responsible_id     = p_responsible_id,
    created_by         = COALESCE(v_existing.created_by, p_created_by),
    raw_input          = NULLIF(btrim(COALESCE(p_raw_input,  '')), ''),
    notes              = NULLIF(btrim(COALESCE(p_notes,       '')), ''),
    campaigns_new      = COALESCE(p_campaigns_new,      '[]'::jsonb),
    campaigns_off      = COALESCE(p_campaigns_off,      '[]'::jsonb),
    campaigns_optimize = COALESCE(p_campaigns_optimize, '[]'::jsonb),
    segmentation       = COALESCE(p_segmentation,       '{}'::jsonb),
    creatives          = COALESCE(p_creatives,          '[]'::jsonb),
    drive_links        = COALESCE(p_drive_links,        '[]'::jsonb),
    ai_summary         = NULLIF(btrim(COALESCE(p_ai_summary, '')), ''),
    ai_checklist       = COALESCE(p_ai_checklist, '[]'::jsonb),
    ai_diff            = NULLIF(btrim(COALESCE(p_ai_diff, '')), ''),
    -- Preserve existing campaigns when p_campaigns is NULL (caller didn't change them)
    campaigns          = CASE WHEN p_campaigns IS NOT NULL
                              THEN p_campaigns
                              ELSE v_existing.campaigns
                         END,
    is_optimizing      = COALESCE(p_is_optimizing, v_existing.is_optimizing, FALSE),
    latest_version     = v_version
  WHERE id = p_strategy_id
  RETURNING * INTO v_strategy;

  INSERT INTO public.strategy_history (
    strategy_id, version, snapshot, change_summary, changed_by
  )
  VALUES (
    v_strategy.id,
    v_version,
    to_jsonb(v_strategy),
    NULLIF(btrim(COALESCE(p_change_summary, '')), ''),
    p_created_by
  );

  RETURN v_strategy;
END;
$$;

-- 3. Grant to anon and authenticated (new signature with 22 params)
GRANT EXECUTE ON FUNCTION public.save_strategy_with_history(
  UUID, TEXT, DATE, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT,
  JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, TEXT, JSONB, TEXT, TEXT, UUID,
  JSONB, BOOLEAN
) TO anon, authenticated;
