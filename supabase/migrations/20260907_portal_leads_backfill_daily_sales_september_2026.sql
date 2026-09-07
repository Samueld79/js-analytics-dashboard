-- One-time backfill: recompute daily_sales.total_sales from portal_leads for
-- every (client_id, date) in September 2026 that has portal_daily_entries
-- activity -- brings the current month in line with the new derived-total
-- logic (portal_leads_recalc_daily_sales_trg) retroactively.
--
-- Scoped to September 2026 only, deliberately NOT applied to all history:
-- earlier dates (e.g. Optica 2026-08-28, a real $2,020,000 manual entry with
-- zero linked portal_leads) were populated through the manual "venta total
-- del dia" form being removed in this same change, and have no portal_leads
-- data to recompute from -- recalculating them here would have zeroed out
-- real, legitimate revenue that predates this feature entirely.
--
-- Applied directly against the project via Supabase MCP; kept here for
-- history/tracking. Result verified: Optica Punto Lentes September 2026
-- daily_sales total = $2,485,000 after this ran (2026-09 1 through 5).

do $$
declare
  r record;
  v_entry_id uuid;
begin
  for r in
    select distinct client_id, date
    from public.portal_daily_entries
    where date >= '2026-09-01' and date < '2026-10-01'
  loop
    select id into v_entry_id
    from public.portal_daily_entries
    where client_id = r.client_id and date = r.date
    limit 1;

    perform public.portal_recalc_daily_sales_for_entry(v_entry_id);
  end loop;
end $$;
