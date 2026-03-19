-- 006_fix_campaign_dates.sql
-- Root cause: Excel imports stored all rows with date = '2026-03-17' regardless
-- of the actual campaign month. This migration infers the correct month from
-- campaign_name keywords, distributing rows to their real calendar month.
--
-- Only touches rows with source = 'excel_import' and date = '2026-03-17'.
-- IValent rows imported with distinct dates are NOT affected.
-- Run this in your Supabase SQL editor AFTER reviewing the row counts below.
--
-- Preview queries (run first to audit):
--   SELECT campaign_name, count(*) FROM ad_campaign_metrics
--     WHERE date = '2026-03-17' AND source = 'excel_import'
--     GROUP BY campaign_name ORDER BY campaign_name;

-- ── October / November / December / Enero campaigns → January 31 ─────────────
UPDATE ad_campaign_metrics
SET date = '2026-01-31'
WHERE date = '2026-03-17'
  AND source = 'excel_import'
  AND (
       campaign_name ILIKE '%ENE%'
    OR campaign_name ILIKE '%ENERO%'
    OR campaign_name ILIKE '%DIC%'
    OR campaign_name ILIKE '%DICIEMBRE%'
    OR campaign_name ILIKE '%NOV%'
    OR campaign_name ILIKE '%NOVIEMBRE%'
    OR campaign_name ILIKE '%OCT%'
    OR campaign_name ILIKE '%OCTUBRE%'
    OR campaign_name ILIKE '%SEP%'
    OR campaign_name ILIKE '%SEPTIEMBRE%'
  );

-- ── February campaigns → February 28 ────────────────────────────────────────
UPDATE ad_campaign_metrics
SET date = '2026-02-28'
WHERE date = '2026-03-17'
  AND source = 'excel_import'
  AND (
       campaign_name ILIKE '%FEB%'
    OR campaign_name ILIKE '%FEBRERO%'
    OR campaign_name ILIKE '%24 FEB%'
    OR campaign_name ILIKE '%10 FEB%'
  );

-- ── Remaining '2026-03-17' rows are March campaigns — no change needed ───────
-- Verify final distribution:
--   SELECT date, count(*) FROM ad_campaign_metrics
--     WHERE source = 'excel_import'
--     GROUP BY date ORDER BY date;
