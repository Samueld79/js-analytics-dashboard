-- Add is_optimizing boolean field to strategies.
-- Marks a strategy as currently in optimization mode.
-- Active strategies with this flag = true appear in the
-- "🔧 En optimización" subsection of the Activa kanban column.

ALTER TABLE strategies ADD COLUMN IF NOT EXISTS is_optimizing boolean DEFAULT false;

-- Migrate legacy statuses to the new 'active' status.
-- mounted / reviewed / approved all map to 'active' in the simplified 2-status model.
UPDATE strategies
SET status = 'active'
WHERE status IN ('mounted', 'reviewed', 'approved');
