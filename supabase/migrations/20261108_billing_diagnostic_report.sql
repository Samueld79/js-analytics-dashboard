-- Facturación interna (client_billing) + Pre-Diagnóstico (client_diagnostics)
-- + campos no sensibles en clients (has_whatsapp_api, whatsapp_api_since,
-- monthly_ad_budget) + 3 clientes nuevos (Capital Store, Legend Perfumería,
-- Oral Estética).
--
-- NO APLICADA AÚN — ver resumen de la tarea. Esta sesión no tuvo acceso al
-- MCP de Supabase (que es como se aplicaron las migraciones anteriores de
-- este repo, ver 20260907_portal_edit_lead_rpc.sql) ni a una service-role
-- key / connection string local. Queda lista para aplicarse vía MCP, SQL
-- Editor de Supabase, o `supabase db push` con el CLI vinculado.
--
-- Adaptada contra el esquema real (supabase/schema.sql + phase-*.sql):
--   - clients.status ya acepta 'active' (CHECK en schema.sql línea 88-89) —
--     el INSERT de clientes nuevos no necesita ajuste ahí.
--   - user_profiles.role NO tiene un valor 'internal' (CHECK en schema.sql
--     línea 52-63: admin/team/strategist/operator/partner/client/
--     client_viewer). La política de client_diagnostics se adaptó para
--     reusar public.is_internal_user(), que ya filtra exactamente por esos
--     5 roles "internos" (misma definición que usa el frontend en
--     src/hooks/useAuth.tsx: isInternal = !isPortalRole(role) && role !==
--     'anonymous'). No se creó una función nueva para esto.
--   - Se reusa el trigger genérico public.set_updated_at() (schema.sql
--     línea 15-23) en vez de crear touch_updated_at() — ya es el patrón de
--     todas las tablas de este repo (ver phase-8-ad-campaign-metrics.sql).
--   - is_agency_admin() sí es nueva: ninguna función existente filtra por
--     role='admin' específicamente (is_internal_user() acepta 5 roles,
--     demasiado amplio para datos de facturación).
--
-- NO incluye `ALTER TABLE public.ad_campaign_metrics ENABLE ROW LEVEL
-- SECURITY`. Verificado con la anon key (REST, solo lectura) que
-- ClientDetailPage.tsx — renderizada sin ningún guard en la ruta pública
-- /portal/:id — lee ad_campaign_metrics desde el navegador con el cliente
-- Supabase anon (src/services/adCampaignMetrics.ts), sin ningún scoping de
-- client_id a nivel de base de datos. phase-8-ad-campaign-metrics.sql ya
-- deja escrito `ENABLE ROW LEVEL SECURITY` + políticas solo para
-- `authenticated` (sin política para anon) pero esa parte del archivo
-- nunca se aplicó contra producción: confirmé con la anon key que hoy se
-- pueden leer campañas de cualquier cliente. Aplicar ENABLE ROW LEVEL
-- SECURITY tal cual rompería /portal/:id para los 11 clientes activos. El
-- SQL para activarlo (igual al de phase-8) queda al final de este archivo,
-- comentado, pendiente de que el acceso público se mueva a un endpoint
-- server-side (/api/portal/*, service role) o se agregue una política
-- anon con scoping real por cliente.

begin;

-- ============================================================
-- 1) Helper: ¿el usuario actual es admin interno activo?
-- Más estricto que public.is_internal_user() (que acepta 5 roles) —
-- facturación es solo para role = 'admin'.
-- ============================================================
create or replace function public.is_agency_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

revoke all on function public.is_agency_admin() from public;
grant execute on function public.is_agency_admin() to authenticated;

-- ============================================================
-- 2) Campos nuevos no sensibles en clients
-- monthly_ad_budget es visible para el equipo interno (ClientsPage), pero
-- NUNCA se expone en /portal/:id ni /cliente/:slug — ver Fase 2.
-- ============================================================
alter table public.clients
  add column if not exists has_whatsapp_api boolean not null default false,
  add column if not exists whatsapp_api_since date,
  add column if not exists monthly_ad_budget numeric(14,2);

-- ============================================================
-- 3) Facturación privada — honorarios que cada cliente paga a la agencia.
-- Sin política para anon => anon no puede leer ni escribir nada.
-- ============================================================
create table if not exists public.client_billing (
  client_id uuid primary key references public.clients(id) on delete cascade,
  monthly_fee numeric(14,2),
  currency text not null default 'COP',
  billing_day smallint check (billing_day between 1 and 31),
  contract_start date,
  contract_end date,
  payment_status text not null default 'al_dia'
    check (payment_status in ('al_dia', 'pendiente', 'vencido', 'pausado')),
  includes_ad_spend boolean not null default false,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.client_billing enable row level security;

drop policy if exists client_billing_admin_all on public.client_billing;
create policy client_billing_admin_all
on public.client_billing
for all
to authenticated
using (public.is_agency_admin())
with check (public.is_agency_admin());

revoke all on public.client_billing from anon;
grant select, insert, update, delete on public.client_billing to authenticated;

drop trigger if exists set_updated_at_client_billing on public.client_billing;
create trigger set_updated_at_client_billing
before update on public.client_billing
for each row
execute function public.set_updated_at();

-- ============================================================
-- 4) Pre-Diagnóstico — uno por cliente, interno (5 roles de
-- is_internal_user, no solo admin).
-- ============================================================
create table if not exists public.client_diagnostics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  diagnostic_date date,
  company_contact text,
  -- 01 Objetivo y expectativas
  main_objective text,
  expected_3_months text,
  -- 02 Ventas y ticket promedio
  avg_monthly_sales_cop numeric(16,2),
  avg_ticket_cop numeric(14,2),
  avg_daily_sales numeric(10,2),
  avg_margin text,
  -- 03 Inversión en pauta
  ad_budget_range text check (ad_budget_range in ('lt_500k', '500k_1_5m', '1_5m_3m', '3m_5m', 'gt_5m')),
  willing_to_scale text check (willing_to_scale in ('si_rentable', 'depende', 'no_fijo')),
  prior_advertising text check (prior_advertising in ('si_buenos', 'si_regulares_malos', 'nunca')),
  prior_platforms text,
  months_in_market integer,
  prior_ad_spend_notes text,
  -- 04 Área comercial
  sales_team text check (sales_team in ('equipo_dedicado', 'dueno', 'compartido', 'no_tienen')),
  service_channels text[] not null default '{}',
  response_time text check (response_time in ('lt_30min', '30min_2h', 'mismo_dia', 'gt_1_dia')),
  -- 05 Contenido
  content_creator text check (content_creator in ('interno', 'externo', 'dueno', 'no_tienen')),
  content_pieces_per_month integer,
  audiovisual_material text check (audiovisual_material in ('bastante', 'necesita_refresco', 'muy_poco', 'nada')),
  -- 06 Operación
  operational_capacity text check (operational_capacity in ('listos', 'ajustes_menores', 'necesitan_tiempo')),
  top_sales_channel text check (top_sales_channel in ('punto_fisico', 'redes_whatsapp', 'web_ecommerce', 'otro')),
  top_sales_channel_other text,
  -- 07 Ajuste y compromiso
  data_driven text check (data_driven in ('totalmente', 'con_confianza', 'paso_a_paso')),
  upcoming_dates text,
  motivation text,
  extra_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.client_diagnostics enable row level security;

drop policy if exists client_diagnostics_internal on public.client_diagnostics;
create policy client_diagnostics_internal
on public.client_diagnostics
for all
to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

revoke all on public.client_diagnostics from anon;
grant select, insert, update, delete on public.client_diagnostics to authenticated;

drop trigger if exists set_updated_at_client_diagnostics on public.client_diagnostics;
create trigger set_updated_at_client_diagnostics
before update on public.client_diagnostics
for each row
execute function public.set_updated_at();

-- ============================================================
-- 5) Clientes nuevos — no duplica si el slug ya existe.
-- ============================================================
insert into public.clients (name, slug, status, has_whatsapp_api)
select v.name, v.slug, 'active', false
from (
  values
    ('Capital Store', 'capital-store'),
    ('Legend Perfumería', 'legend-perfumeria'),
    ('Oral Estética', 'oral-estetica')
) as v(name, slug)
where not exists (select 1 from public.clients c where c.slug = v.slug);

-- ============================================================
-- 6) Fila vacía en client_billing por cada cliente activo (incluye los 3
-- nuevos insertados arriba, en la misma transacción). monthly_fee queda
-- NULL a propósito — Muel lo llena a mano, no se inventa ningún valor.
-- ============================================================
insert into public.client_billing (client_id)
select c.id
from public.clients c
where c.status = 'active'
on conflict (client_id) do nothing;

commit;

-- ============================================================
-- Verificación manual pendiente (no se pudo ejecutar desde esta sesión —
-- ver resumen de la tarea). Correr en el SQL Editor de Supabase o vía MCP
-- después de aplicar lo de arriba:
-- ============================================================

-- set local role anon;
-- select * from public.client_billing;      -- debe dar 0 filas o error de permisos
-- select * from public.client_diagnostics;  -- debe dar 0 filas o error de permisos
-- reset role;

-- select id, email, role, active from public.user_profiles where role = 'admin' and active = true;
-- -- debe devolver exactamente samueld79@outlook.com y juandca20@gmail.com

-- select name, slug, status from public.clients where slug in ('capital-store', 'legend-perfumeria', 'oral-estetica');
-- -- debe devolver las 3 filas nuevas

-- ============================================================
-- PENDIENTE — RLS de ad_campaign_metrics (hallazgo confirmado, ver nota al
-- inicio del archivo). NO ejecutar hasta que /portal/:id deje de leer esta
-- tabla con la anon key sin scoping por cliente a nivel de base de datos.
-- ============================================================

-- alter table public.ad_campaign_metrics enable row level security;
--
-- drop policy if exists ad_campaign_metrics_select on public.ad_campaign_metrics;
-- create policy ad_campaign_metrics_select
-- on public.ad_campaign_metrics
-- for select
-- to authenticated
-- using (public.is_internal_user());
--
-- drop policy if exists ad_campaign_metrics_write on public.ad_campaign_metrics;
-- create policy ad_campaign_metrics_write
-- on public.ad_campaign_metrics
-- for all
-- to authenticated
-- using (public.is_internal_user())
-- with check (public.is_internal_user());
--
-- grant select, insert, update, delete on public.ad_campaign_metrics to authenticated;
-- -- Sin política para anon: esto es lo que rompería /portal/:id hoy.
