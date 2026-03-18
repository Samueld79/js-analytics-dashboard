-- 005_fix_result_types.sql
-- Corrects the `objective` column in ad_campaign_metrics.
-- The Excel import stored Meta result_type values (messages, profile_visit, reach, etc.)
-- in the `objective` column. Many rows were imported as 'reach' by default.
-- This migration infers the correct objective from the campaign name.
--
-- NOTE: The app TypeScript type calls this column `objective` (not result_type).
-- Run this in your Supabase SQL editor.

-- ── Step 1: Interacción / Mensajes campaigns ─────────────────────────────────
UPDATE ad_campaign_metrics
SET objective = 'messages'
WHERE (
  campaign_name ILIKE '%INTER%'
  OR campaign_name ILIKE '%INTERACC%'
  OR campaign_name ILIKE '%VENTAS%'
  OR campaign_name ILIKE '%CONVER%'
)
AND objective = 'reach';

-- ── Step 2: Tráfico al perfil campaigns ──────────────────────────────────────
UPDATE ad_campaign_metrics
SET objective = 'profile_visit'
WHERE (
  campaign_name ILIKE '%TRAFI%'
  OR campaign_name ILIKE '%TRAF%'
  OR campaign_name ILIKE '%TRAFICO%'
  OR campaign_name ILIKE '%PRESENT%'
)
AND objective = 'reach';

-- ── Step 3: Reconocimiento / awareness campaigns ─────────────────────────────
-- Only relabel rows that are genuinely reach/awareness and haven't already
-- been corrected to messages, purchases, or leads.
UPDATE ad_campaign_metrics
SET objective = 'reach'
WHERE (
  campaign_name ILIKE '%RECONOC%'
  OR campaign_name ILIKE '%AWARENESS%'
)
AND objective NOT IN ('messages', 'purchases', 'leads', 'profile_visit');

-- ── Step 4: Any remaining row that actually generated messages should be messages
-- Conservative: only apply when objective is still NULL or 'reach' AND messages > 50
-- (threshold avoids flipping traffic campaigns that got a handful of messages)
UPDATE ad_campaign_metrics
SET objective = 'messages'
WHERE messages > 50
AND (objective IS NULL OR objective = 'reach' OR objective = '');
