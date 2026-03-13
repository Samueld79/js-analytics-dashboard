-- ============================================================
-- PHASE 1 — Operating Views
-- Re-apply these if you need to refresh only the operational
-- reporting layer without re-running the full schema.
-- ============================================================

CREATE OR REPLACE VIEW public.v_client_daily_operating_kpis
WITH (security_invoker = true) AS
WITH ad_daily AS (
  SELECT
    client_id,
    date,
    SUM(spend)::NUMERIC(14,2) AS spend,
    SUM(reach)::BIGINT AS reach,
    SUM(impressions)::BIGINT AS impressions,
    SUM(clicks)::BIGINT AS clicks,
    SUM(messages)::BIGINT AS messages,
    SUM(leads)::BIGINT AS leads,
    SUM(purchases)::BIGINT AS purchases,
    SUM(purchase_value)::NUMERIC(14,2) AS purchase_value
  FROM public.ad_metrics
  GROUP BY client_id, date
),
sales_daily AS (
  SELECT
    client_id,
    date,
    SUM(total_sales)::NUMERIC(14,2) AS total_sales,
    SUM(new_client_sales)::NUMERIC(14,2) AS new_client_sales,
    SUM(repeat_sales)::NUMERIC(14,2) AS repeat_sales,
    SUM(physical_store_sales)::NUMERIC(14,2) AS physical_store_sales,
    SUM(online_sales)::NUMERIC(14,2) AS online_sales
  FROM public.daily_sales
  GROUP BY client_id, date
)
SELECT
  COALESCE(a.client_id, s.client_id) AS client_id,
  COALESCE(a.date, s.date) AS date,
  COALESCE(a.spend, 0)::NUMERIC(14,2) AS spend,
  COALESCE(a.reach, 0)::BIGINT AS reach,
  COALESCE(a.impressions, 0)::BIGINT AS impressions,
  COALESCE(a.clicks, 0)::BIGINT AS clicks,
  COALESCE(a.messages, 0)::BIGINT AS messages,
  COALESCE(a.leads, 0)::BIGINT AS leads,
  COALESCE(a.purchases, 0)::BIGINT AS purchases,
  COALESCE(a.purchase_value, 0)::NUMERIC(14,2) AS purchase_value,
  COALESCE(s.total_sales, 0)::NUMERIC(14,2) AS total_sales,
  COALESCE(s.new_client_sales, 0)::NUMERIC(14,2) AS new_client_sales,
  COALESCE(s.repeat_sales, 0)::NUMERIC(14,2) AS repeat_sales,
  COALESCE(s.physical_store_sales, 0)::NUMERIC(14,2) AS physical_store_sales,
  COALESCE(s.online_sales, 0)::NUMERIC(14,2) AS online_sales,
  CASE
    WHEN COALESCE(a.spend, 0) > 0
      THEN ROUND(COALESCE(a.purchase_value, 0) / NULLIF(a.spend, 0), 4)
    ELSE 0
  END AS ad_roas,
  CASE
    WHEN COALESCE(a.spend, 0) > 0
      THEN ROUND(COALESCE(s.total_sales, 0) / NULLIF(a.spend, 0), 4)
    ELSE 0
  END AS real_roas
FROM ad_daily a
FULL OUTER JOIN sales_daily s
  ON s.client_id = a.client_id
 AND s.date = a.date;

CREATE OR REPLACE VIEW public.v_client_monthly_operating_kpis
WITH (security_invoker = true) AS
SELECT
  client_id,
  date_trunc('month', date)::DATE AS month,
  SUM(spend)::NUMERIC(14,2) AS spend,
  SUM(reach)::BIGINT AS reach,
  SUM(impressions)::BIGINT AS impressions,
  SUM(clicks)::BIGINT AS clicks,
  SUM(messages)::BIGINT AS messages,
  SUM(leads)::BIGINT AS leads,
  SUM(purchases)::BIGINT AS purchases,
  SUM(purchase_value)::NUMERIC(14,2) AS purchase_value,
  SUM(total_sales)::NUMERIC(14,2) AS total_sales,
  SUM(new_client_sales)::NUMERIC(14,2) AS new_client_sales,
  SUM(repeat_sales)::NUMERIC(14,2) AS repeat_sales,
  SUM(physical_store_sales)::NUMERIC(14,2) AS physical_store_sales,
  SUM(online_sales)::NUMERIC(14,2) AS online_sales,
  CASE
    WHEN SUM(spend) > 0 THEN ROUND(SUM(purchase_value) / NULLIF(SUM(spend), 0), 4)
    ELSE 0
  END AS ad_roas,
  CASE
    WHEN SUM(spend) > 0 THEN ROUND(SUM(total_sales) / NULLIF(SUM(spend), 0), 4)
    ELSE 0
  END AS real_roas
FROM public.v_client_daily_operating_kpis
GROUP BY client_id, date_trunc('month', date);

GRANT SELECT ON public.v_client_daily_operating_kpis TO authenticated;
GRANT SELECT ON public.v_client_monthly_operating_kpis TO authenticated;
