-- ============================================================
-- AGENCY OS — Phase 9 Client Viewer Role
-- Minimal, idempotent role extension for portal client access.
-- Adds `client_viewer` to public.user_profiles.role check constraint.
-- ============================================================

DO $$
DECLARE
  constraint_has_client_viewer BOOLEAN := false;
BEGIN
  SELECT COALESCE(pg_get_constraintdef(c.oid) ILIKE '%client_viewer%', false)
  INTO constraint_has_client_viewer
  FROM pg_constraint c
  JOIN pg_class t
    ON t.oid = c.conrelid
  JOIN pg_namespace n
    ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'user_profiles'
    AND c.conname = 'user_profiles_role_check';

  IF NOT constraint_has_client_viewer THEN
    ALTER TABLE public.user_profiles
      DROP CONSTRAINT IF EXISTS user_profiles_role_check;

    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_role_check
      CHECK (
        role IN (
          'admin',
          'team',
          'strategist',
          'operator',
          'partner',
          'client',
          'client_viewer'
        )
      );
  END IF;
END
$$;
