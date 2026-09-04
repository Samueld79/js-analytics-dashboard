-- Permite desactivar la proteccion por PIN del Portal Cliente, por cliente
-- individual, sin quitar el mecanismo de PIN del sistema.
--
-- EJECUTAR en Supabase SQL Editor.

ALTER TABLE public.client_portal_settings
  ADD COLUMN IF NOT EXISTS pin_required boolean NOT NULL DEFAULT true;

-- A peticion del cliente: Optica Punto Lentes ya no requiere PIN para
-- registrar citas/compras/nota del dia ni ventas en su portal publico.
UPDATE public.client_portal_settings
SET pin_required = false
WHERE public_slug = 'optica-punto-lentes-lww7aszg';
