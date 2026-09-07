-- daily_sales.total_sales is no longer entered by hand through the portal --
-- it is derived from portal_leads (tipo='compra', monto) for every lead whose
-- daily_entry_id resolves to that (client_id, date). Recomputed automatically
-- on every insert/update/delete of a portal_leads row, so the two sources of
-- truth this portal used to have (a loose daily total vs. individual leads
-- with a name/phone attached) can never drift apart again.
--
-- Applied directly against the project via Supabase MCP; kept here for
-- history/tracking. Verified end-to-end (insert + delete) against a
-- throwaway future-dated row, cleaned up after.

create or replace function public.portal_recalc_daily_sales_for_entry(p_daily_entry_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client_id uuid;
  v_date date;
  v_total numeric;
begin
  select client_id, date into v_client_id, v_date
  from public.portal_daily_entries
  where id = p_daily_entry_id;

  -- The entry itself may already be gone (shouldn't happen today -- entries
  -- are only ever decremented, never deleted -- but this keeps the function
  -- safe if that ever changes).
  if v_client_id is null then
    return;
  end if;

  select coalesce(sum(l.monto), 0) into v_total
  from public.portal_leads l
  join public.portal_daily_entries e on e.id = l.daily_entry_id
  where e.client_id = v_client_id
    and e.date = v_date
    and l.tipo = 'compra';

  insert into public.daily_sales (client_id, date, total_sales, source, status)
  values (v_client_id, v_date, v_total, 'client_portal', 'submitted')
  on conflict (client_id, date) do update set
    total_sales = excluded.total_sales,
    source = excluded.source,
    status = excluded.status,
    updated_at = now();
end;
$$;

-- No WHEN clause: Postgres forbids a combined INSERT/UPDATE/DELETE trigger's
-- WHEN condition from referencing NEW (NEW doesn't exist on DELETE), so the
-- tipo='compra' short-circuit lives in the function body instead. Runs on
-- every portal_leads write (also cita ones) but the recompute itself is a
-- no-op in effect for those -- cheap enough at this write volume.
create or replace function public.portal_leads_recalc_daily_sales()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.portal_recalc_daily_sales_for_entry(OLD.daily_entry_id);
    return OLD;
  elsif TG_OP = 'UPDATE' then
    perform public.portal_recalc_daily_sales_for_entry(NEW.daily_entry_id);
    if NEW.daily_entry_id is distinct from OLD.daily_entry_id then
      perform public.portal_recalc_daily_sales_for_entry(OLD.daily_entry_id);
    end if;
    return NEW;
  else
    perform public.portal_recalc_daily_sales_for_entry(NEW.daily_entry_id);
    return NEW;
  end if;
end;
$$;

drop trigger if exists portal_leads_recalc_daily_sales_trg on public.portal_leads;
create trigger portal_leads_recalc_daily_sales_trg
after insert or update or delete on public.portal_leads
for each row
execute function public.portal_leads_recalc_daily_sales();
