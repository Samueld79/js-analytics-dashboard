# Frecuencia Operativa n8n → Supabase

Nota operativa breve para dejar claro qué vive automático y qué sigue manual en la app real.

## Automático

- Ads / Meta:
  - sync diario desde n8n hacia `ad_metrics`
  - actualización de `ad_accounts.last_sync_at`
  - consumo en dashboard, cliente, métricas y salud operativa

- Alertas operativas:
  - evaluación automática frecuente sobre señales de operación
  - persistencia en `alerts`
  - tareas derivadas cuando aplica

## Manual

- Ventas:
  - captura directa en Supabase vía `daily_sales`
  - registro manual desde la UI

- Estrategia con IA:
  - generación bajo demanda desde la app
  - no corre en lote ni por cron
  - debe usar contexto real del cliente y, cuando exista, endpoint server-side serio

- Cierres mensuales:
  - social / métricas especiales / históricos
  - carga manual al cierre cuando aplica

## Recomendación operativa vigente

- Ads: `1 vez al día`
- Alertas operativas: `varias veces al día` o al menos `cada 2-4 horas`
- Ventas: `manual`
- IA de estrategia: `bajo demanda`
- Cierres mensuales manuales: `una vez por cliente al cierre`

## Nota de producto

- No usar Google Sheets como fuente oficial en esta fase.
- No usar login personal de ChatGPT dentro del producto.
- Si luego se activa IA server-side, el frontend ya debe seguir invocando un endpoint backend/Edge Function, no credenciales personales.
