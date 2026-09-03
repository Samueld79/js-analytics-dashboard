-- Agrega la columna dashboard_hidden a clients.
-- Permite ocultar/mostrar una empresa del Dashboard General sin afectar
-- su status ni su visibilidad en reportes, perfil o listados.
--
-- EJECUTAR en Supabase SQL Editor.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS dashboard_hidden boolean NOT NULL DEFAULT false;
