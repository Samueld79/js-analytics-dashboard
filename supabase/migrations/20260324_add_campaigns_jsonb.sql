-- Add campaigns jsonb column to strategies table (if it doesn't already exist).
-- This stores the rich campaign builder data from StrategyFormModal:
-- name, objective, budget, budgetType (ABO/CBO), and nested adsets with
-- creatives, locations, placements, age range, gender, welcome message, etc.

ALTER TABLE strategies ADD COLUMN IF NOT EXISTS campaigns jsonb;

-- Optional: backfill comment
-- UPDATE strategies SET campaigns = '[]'::jsonb WHERE campaigns IS NULL;
