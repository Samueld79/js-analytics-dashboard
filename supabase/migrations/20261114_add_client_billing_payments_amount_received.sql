-- Monto real recibido por cobro (PROMPT_FACTURACION_V10 — meta mensual).
--
-- YA APLICADA en producción — este archivo es solo copia de referencia,
-- no la vuelvas a correr.
--
-- Caso de uso: un cobro puntual puede llegar por un monto distinto al fee
-- normal (ej. Capital Store paga 600.000 en vez de 750.000 en una
-- quincena). Si esta columna no es null para un (client_id, month, period),
-- se usa en vez de periodAmountFor(monthly_fee, …) SOLO para ese cobro, en:
-- totales cobrado/esperado del mes, la gráfica de tendencia y la meta
-- mensual de Samuel. Si es null, el comportamiento es el de siempre.
-- Nunca incluye contenido/pass-through: es solo el fee.

alter table public.client_billing_payments
  add column if not exists amount_received numeric;
