-- Contenido aparte del fee en client_billing (PROMPT_FACTURACION_V9).
--
-- YA APLICADA en producción — este archivo es solo copia de referencia,
-- no la vuelvas a correr.
--
-- Caso de uso: Oral Estética paga 2.200.000/mes en total, pero solo
-- 1.000.000 es fee de la agencia (lo que ya vivía en monthly_fee). El resto
-- (1.200.000) es creación de contenido que se le paga a la creadora y
-- NUNCA es ingreso de la agencia — por eso vive aparte, en estas dos
-- columnas, y nunca entra a expected/collected/byReceiver/saldo
-- neto/proyección/liquidación (eso sigue usando solo monthly_fee).

alter table public.client_billing
  add column if not exists pass_through_monthly numeric,
  add column if not exists pass_through_label text;

-- Oral Estética: pass_through_monthly = 1200000, pass_through_label = 'Creación de contenido'
