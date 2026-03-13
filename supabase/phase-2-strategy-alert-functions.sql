-- ============================================================
-- PHASE 2 - STRATEGIES + ALERTS HELPER FUNCTIONS
-- Optional but recommended: the frontend falls back to client-side logic
-- if these RPC functions are not installed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_strategy_with_history(
  p_strategy_id UUID DEFAULT NULL,
  p_client_id UUID,
  p_title TEXT,
  p_month DATE,
  p_status TEXT DEFAULT 'pending',
  p_monthly_budget NUMERIC DEFAULT NULL,
  p_responsible_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid(),
  p_raw_input TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_campaigns_new JSONB DEFAULT '[]'::jsonb,
  p_campaigns_off JSONB DEFAULT '[]'::jsonb,
  p_campaigns_optimize JSONB DEFAULT '[]'::jsonb,
  p_segmentation JSONB DEFAULT '{}'::jsonb,
  p_creatives JSONB DEFAULT '[]'::jsonb,
  p_drive_links JSONB DEFAULT '[]'::jsonb,
  p_ai_summary TEXT DEFAULT NULL,
  p_ai_checklist JSONB DEFAULT '[]'::jsonb,
  p_ai_diff TEXT DEFAULT NULL,
  p_change_summary TEXT DEFAULT NULL
)
RETURNS public.strategies
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_strategy public.strategies;
  v_existing public.strategies;
  v_version INTEGER;
BEGIN
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
      NULLIF(btrim(COALESCE(p_raw_input, '')), ''),
      NULLIF(btrim(COALESCE(p_notes, '')), ''),
      COALESCE(p_campaigns_new, '[]'::jsonb),
      COALESCE(p_campaigns_off, '[]'::jsonb),
      COALESCE(p_campaigns_optimize, '[]'::jsonb),
      COALESCE(p_segmentation, '{}'::jsonb),
      COALESCE(p_creatives, '[]'::jsonb),
      COALESCE(p_drive_links, '[]'::jsonb),
      NULLIF(btrim(COALESCE(p_ai_summary, '')), ''),
      COALESCE(p_ai_checklist, '[]'::jsonb),
      NULLIF(btrim(COALESCE(p_ai_diff, '')), ''),
      1
    )
    RETURNING * INTO v_strategy;

    INSERT INTO public.strategy_history (
      strategy_id,
      version,
      snapshot,
      change_summary,
      changed_by
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

  SELECT *
  INTO v_existing
  FROM public.strategies
  WHERE id = p_strategy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Strategy % not found', p_strategy_id;
  END IF;

  v_version := COALESCE(v_existing.latest_version, 1) + 1;

  UPDATE public.strategies
  SET
    client_id = p_client_id,
    title = btrim(p_title),
    month = p_month,
    status = COALESCE(p_status, v_existing.status),
    monthly_budget = p_monthly_budget,
    responsible_id = p_responsible_id,
    created_by = COALESCE(v_existing.created_by, p_created_by),
    raw_input = NULLIF(btrim(COALESCE(p_raw_input, '')), ''),
    notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
    campaigns_new = COALESCE(p_campaigns_new, '[]'::jsonb),
    campaigns_off = COALESCE(p_campaigns_off, '[]'::jsonb),
    campaigns_optimize = COALESCE(p_campaigns_optimize, '[]'::jsonb),
    segmentation = COALESCE(p_segmentation, '{}'::jsonb),
    creatives = COALESCE(p_creatives, '[]'::jsonb),
    drive_links = COALESCE(p_drive_links, '[]'::jsonb),
    ai_summary = NULLIF(btrim(COALESCE(p_ai_summary, '')), ''),
    ai_checklist = COALESCE(p_ai_checklist, '[]'::jsonb),
    ai_diff = NULLIF(btrim(COALESCE(p_ai_diff, '')), ''),
    latest_version = v_version
  WHERE id = p_strategy_id
  RETURNING * INTO v_strategy;

  INSERT INTO public.strategy_history (
    strategy_id,
    version,
    snapshot,
    change_summary,
    changed_by
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

GRANT EXECUTE ON FUNCTION public.save_strategy_with_history(
  UUID,
  UUID,
  TEXT,
  DATE,
  TEXT,
  NUMERIC,
  UUID,
  UUID,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  JSONB,
  JSONB,
  JSONB,
  JSONB,
  TEXT,
  JSONB,
  TEXT,
  TEXT
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_operational_alert(
  p_client_id UUID,
  p_type TEXT,
  p_rule_key TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'info',
  p_triggered_by TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.alerts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_alert public.alerts;
BEGIN
  INSERT INTO public.alerts (
    client_id,
    type,
    rule_key,
    title,
    body,
    severity,
    status,
    triggered_by,
    metadata,
    first_triggered_at,
    last_triggered_at
  )
  VALUES (
    p_client_id,
    btrim(p_type),
    lower(regexp_replace(btrim(p_rule_key), '\s+', '-', 'g')),
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_body, '')), ''),
    COALESCE(p_severity, 'info'),
    'unread',
    COALESCE(p_triggered_by, 'system'),
    COALESCE(p_metadata, '{}'::jsonb),
    now(),
    now()
  )
  ON CONFLICT (client_id, rule_key)
    WHERE status IN ('unread', 'read')
  DO UPDATE
  SET
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    severity = EXCLUDED.severity,
    status = 'unread',
    triggered_by = EXCLUDED.triggered_by,
    metadata = EXCLUDED.metadata,
    last_triggered_at = now(),
    updated_at = now()
  RETURNING * INTO v_alert;

  RETURN v_alert;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_operational_alert(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO anon, authenticated;
