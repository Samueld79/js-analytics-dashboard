-- ============================================================
-- Rol restringido: portal_ad_metrics_writer
-- ============================================================
-- POR QUE EXISTE:
-- Rutina externa (Claude Cowork) que inserta filas placeholder
-- (spend=0, messages=0) en portal_ad_daily_metrics para los 9
-- anuncios fijos del portal de Optica Punto Lentes, corriendo con
-- una API key propia -- nunca con la anon key ni con la
-- service_role key.
--
-- QUE PUEDE HACER:
--   - INSERT en public.portal_ad_daily_metrics
--   - solo columnas de datos (no id/created_at/updated_at)
--   - solo filas donde:
--       client_id = '5c3978a0-9338-5c29-8cdd-9833a4d0639b' (Optica Punto Lentes)
--       ad_id     = uno de los 9 anuncios fijos del portal de Optica
--       date      = hoy (America/Bogota)
--       spend     = 0
--       messages  = 0
--
-- QUE NO PUEDE HACER (todo lo demas queda denegado por defecto,
-- Postgres/RLS son deny-by-default -- esto es documentacion, no
-- revocaciones necesarias):
--   - SELECT / UPDATE / DELETE sobre portal_ad_daily_metrics
--   - Nada sobre ninguna otra tabla del schema public
--   - Insertar spend o messages distintos de 0
--   - Insertar filas de cualquier client_id o ad_id distinto de
--     los 9 fijos de Optica, o de una fecha distinta a hoy
--
-- COMO SE USA: ver docs/supabase-role-portal-ad-metrics-writer.md
-- para como obtener la API key/JWT asociada a este rol desde el
-- dashboard de Supabase.
--
-- EJECUTAR en Supabase SQL Editor (requiere permisos de owner/admin;
-- la anon key y esta misma key restringida no alcanzan para correr
-- este script).
-- ============================================================

-- ── 1. Crear el rol ────────────────────────────────────────────
-- NOLOGIN: nunca se conecta directo a Postgres, solo via PostgREST
--          haciendo SET ROLE a partir del claim "role" del JWT.
-- NOINHERIT: no hereda privilegios de otros roles de los que sea
--          miembro (no aplica hoy, pero evita sorpresas a futuro).
-- NOBYPASSRLS: explicito aunque ya es el default -- este rol nunca
--          debe saltarse Row Level Security.
CREATE ROLE portal_ad_metrics_writer NOLOGIN NOINHERIT NOBYPASSRLS;

COMMENT ON ROLE portal_ad_metrics_writer IS
  'Rol restringido para la rutina externa (Claude Cowork) que inserta '
  'filas placeholder (spend=0, messages=0) en portal_ad_daily_metrics '
  'para los 9 anuncios fijos del portal de Optica Punto Lentes '
  '(client_id 5c3978a0-9338-5c29-8cdd-9833a4d0639b). Creado 2026-09-04. '
  'Ver docs/supabase-role-portal-ad-metrics-writer.md para el detalle '
  'completo y como obtener/rotar su API key.';

-- PostgREST se conecta como el rol "authenticator" y hace SET ROLE
-- al valor del claim "role" del JWT entrante. Para que ese SET ROLE
-- sea posible, "authenticator" debe ser miembro de este rol. Sin
-- este GRANT, cualquier JWT firmado con role=portal_ad_metrics_writer
-- fallaria con "permission denied to set role".
GRANT portal_ad_metrics_writer TO authenticator;

-- ── 2. Privilegios minimos ─────────────────────────────────────
-- Defensivo/explicito: este rol parte sin ningun privilegio (todo
-- rol nuevo en Postgres es deny-by-default), pero dejamos el REVOKE
-- ALL explicito para que quede documentado que la ausencia de
-- privilegios es intencional, no un descuido.
REVOKE ALL ON SCHEMA public FROM portal_ad_metrics_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM portal_ad_metrics_writer;

-- Necesario para poder ver/usar cualquier objeto del schema.
GRANT USAGE ON SCHEMA public TO portal_ad_metrics_writer;

-- INSERT unicamente, y solo en las columnas de datos -- nunca
-- id/created_at/updated_at, que deben quedar en sus defaults.
GRANT INSERT (
  client_id,
  date,
  ad_id,
  ad_name,
  adset_name,
  campaign_name,
  messages,
  spend,
  effective_status
) ON public.portal_ad_daily_metrics TO portal_ad_metrics_writer;

-- ── 3. Row Level Security ──────────────────────────────────────
-- Ya deberia estar habilitado (portal_ad_daily_metrics tiene lectura
-- anonima via RLS para el portal publico), pero es idempotente.
ALTER TABLE public.portal_ad_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_ad_metrics_writer_insert ON public.portal_ad_daily_metrics;
CREATE POLICY portal_ad_metrics_writer_insert
  ON public.portal_ad_daily_metrics
  FOR INSERT
  TO portal_ad_metrics_writer
  WITH CHECK (
    client_id = '5c3978a0-9338-5c29-8cdd-9833a4d0639b'::uuid
    AND ad_id IN (
      'IMG_4705', 'IMG_4710', 'IMG_4712',
      'AQOQ4zem', 'AQOXs0Ib', 'AQNSEJ8W',
      'VD-1', 'VD-2', 'VD-3'
    )
    -- "hoy" en la zona horaria del cliente, no en UTC -- evita que
    -- una corrida entre 7pm y medianoche Bogota escriba la fecha
    -- equivocada.
    AND date = (now() AT TIME ZONE 'America/Bogota')::date
    AND spend = 0
    AND messages = 0
  );

COMMENT ON POLICY portal_ad_metrics_writer_insert ON public.portal_ad_daily_metrics IS
  'Restringe portal_ad_metrics_writer a insertar SOLO filas placeholder '
  '(spend=0, messages=0) de hoy, para los 9 ad_id fijos del portal de '
  'Optica Punto Lentes, y para ningun otro client_id. Ver '
  'docs/supabase-role-portal-ad-metrics-writer.md.';
