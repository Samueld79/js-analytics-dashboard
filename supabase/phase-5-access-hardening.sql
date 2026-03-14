-- ============================================================
-- AGENCY OS — Phase 5 Access Hardening
-- Final access model:
-- - internal roles see the full Agency OS
-- - client role only sees its assigned company
-- - client role does not see dashboard general or internal modules
-- - client role can still read client_files for its own company
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_primary_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.client_id
  FROM public.client_memberships cm
  WHERE cm.user_id = auth.uid()
    AND cm.status = 'active'
  ORDER BY cm.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_client_access(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.is_internal_user() THEN true
      WHEN public.current_user_role() = 'client'
        THEN target_client_id = public.current_user_primary_client_id()
      ELSE EXISTS (
        SELECT 1
        FROM public.client_memberships cm
        WHERE cm.client_id = target_client_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'active'
      )
    END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_write_client_sales(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.is_internal_user() THEN true
      WHEN public.current_user_role() = 'client'
        THEN target_client_id = public.current_user_primary_client_id()
      ELSE EXISTS (
        SELECT 1
        FROM public.client_memberships cm
        WHERE cm.client_id = target_client_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'active'
          AND cm.access_level IN ('manager', 'client')
      )
    END;
$$;

DROP POLICY IF EXISTS strategies_select ON public.strategies;
CREATE POLICY strategies_select
ON public.strategies
FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS strategy_history_select ON public.strategy_history;
CREATE POLICY strategy_history_select
ON public.strategy_history
FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS alerts_select ON public.alerts;
CREATE POLICY alerts_select
ON public.alerts
FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select
ON public.tasks
FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS client_files_select ON public.client_files;
CREATE POLICY client_files_select
ON public.client_files
FOR SELECT
TO authenticated
USING (public.user_has_client_access(client_id));

DROP POLICY IF EXISTS client_memory_select ON public.client_memory;
CREATE POLICY client_memory_select
ON public.client_memory
FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS memory_entries_select ON public.memory_entries;
CREATE POLICY memory_entries_select
ON public.memory_entries
FOR SELECT
TO authenticated
USING (public.is_internal_user());
