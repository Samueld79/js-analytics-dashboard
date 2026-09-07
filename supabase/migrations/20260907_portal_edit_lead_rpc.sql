-- Editing an existing portal_leads row (nombre_cliente/numero_contacto/monto)
-- never existed before -- only add (portal_add_lead) and remove-the-most-
-- recent-one (portal_remove_last_lead). The old manual "venta total del dia"
-- form only ever edited the day-level total in daily_sales, never an
-- individual lead. Built fresh here, PIN-gated the same way as the rest of
-- Registro/Seguimiento (pin_registro, via api/portal/edit-lead.ts).
--
-- Deliberately does not touch `tipo` -- changing cita<->compra would need to
-- also adjust portal_daily_entries.citas/compras, which is out of scope
-- (the ask was to fix a mistyped name/phone/monto, not recategorize a visit).
-- Editing `monto` on a tipo='compra' row fires portal_leads_recalc_daily_sales_trg
-- (already in place from the sales-unification migration) same as
-- insert/delete, so daily_sales stays in sync.
--
-- Applied directly against the project via Supabase MCP; kept here for
-- history/tracking. Verified end-to-end against a throwaway future-dated
-- lead: edit succeeded, daily_sales.total_sales updated to match the new
-- monto via the trigger, empty-name/monto<=0/wrong-client all correctly
-- rejected, then fully cleaned up.

drop function if exists public.portal_edit_lead(uuid, uuid, text, text, numeric);

create or replace function public.portal_edit_lead(
  p_client_id uuid,
  p_lead_id uuid,
  p_nombre_cliente text,
  p_numero_contacto text,
  p_monto numeric
)
returns setof public.portal_leads
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tipo text;
  v_lead public.portal_leads;
begin
  select tipo into v_tipo
  from public.portal_leads
  where id = p_lead_id and client_id = p_client_id;

  if v_tipo is null then
    raise exception 'Lead no encontrado';
  end if;

  if coalesce(trim(p_nombre_cliente), '') = '' or coalesce(trim(p_numero_contacto), '') = '' then
    raise exception 'Nombre y numero de contacto son obligatorios';
  end if;

  if v_tipo = 'compra' and (p_monto is null or p_monto <= 0) then
    raise exception 'El monto debe ser mayor a 0 para una compra';
  end if;

  update public.portal_leads
  set nombre_cliente = trim(p_nombre_cliente),
      numero_contacto = trim(p_numero_contacto),
      monto = case when v_tipo = 'compra' then p_monto else null end
  where id = p_lead_id and client_id = p_client_id
  returning * into v_lead;

  return next v_lead;
end;
$$;
