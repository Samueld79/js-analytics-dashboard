-- Ensure the strategies.status column allows all current status values
-- including the new 'active' status added in the kanban simplification.
-- Run this in Supabase SQL Editor if you get a constraint violation on status.

ALTER TABLE strategies DROP CONSTRAINT IF EXISTS strategies_status_check;

ALTER TABLE strategies ADD CONSTRAINT strategies_status_check
  CHECK (status IN ('draft', 'pending', 'active', 'mounted', 'reviewed', 'approved', 'archived'));
