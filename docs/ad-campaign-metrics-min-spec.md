# Ad Campaign Metrics - Minimal Import Contract

Base tecnica minima para desbloquear reporting real por campana sin romper el snapshot actual de `public.ad_metrics`.

## Convencion del repo

- Este repo hoy usa `supabase/phase-*.sql` + `supabase/schema.sql`.
- No hay una carpeta `supabase/migrations/` activa como fuente de verdad del proyecto.
- La migracion canónica de esta fase es:
  - `supabase/phase-8-ad-campaign-metrics.sql`

## Decision

- `public.ad_metrics` se mantiene como snapshot diario por cuenta.
- se agrega `public.ad_campaign_metrics` como capa diaria por campana.
- no se mezclan objetivos planeados de `strategies` con performance real.

## Meta import

Mantener el branch actual:
- `level=account` -> `public.ad_metrics`

Agregar branch nuevo:
- `level=campaign` -> `public.ad_campaign_metrics`

## Fields minimos a pedir en Insights

- `campaign_id`
- `campaign_name`
- `spend`
- `reach`
- `impressions`
- `clicks`
- `cpm`
- `cpc`
- `ctr`
- `frequency`
- `actions`
- `action_values`

## Objective

No asumir que `objective` viene confiable en Insights.

Recomendacion minima:
- lookup adicional por `campaign_id`
- endpoint de metadata de campana
- persistir `objective` y `effective_status` en la misma fila de `ad_campaign_metrics`

Esto evita agregar una tabla `ad_campaigns` en esta fase.

## Payload minimo persistido

Columnas clave:
- `client_id`
- `ad_account_id`
- `campaign_id`
- `campaign_name`
- `objective`
- `effective_status`
- `date`
- `spend`
- `reach`
- `impressions`
- `clicks`
- `cpm`
- `cpc`
- `ctr`
- `frequency`
- `messages`
- `messaging_started`
- `messaging_connections`
- `messaging_first_reply`
- `leads`
- `purchases`
- `purchase_value`
- `link_clicks`
- `page_engagement`
- `post_engagement`
- `video_views`
- `thruplays`
- `profile_visits`
- `raw_actions`
- `raw_action_values`
- `source`
- `metadata`

## Upsert

Clave logica:
- `client_id`
- `ad_account_id`
- `campaign_id`
- `date`

`on_conflict`:
- `client_id,ad_account_id,campaign_id,date`

## Auth / RLS para n8n

Recomendacion operativa:
- usar `service_role`

Motivo:
- `public.ad_campaign_metrics` tiene RLS activo
- las policies permiten lectura/escritura solo a usuarios internos
- `service_role` bypassa RLS y es la opcion correcta para un worker server-side como n8n

Si n8n usa un token `authenticated` comun:
- solo funcionara si ese JWT resuelve `public.is_internal_user() = true`
- eso depende de que exista una sesion real de Supabase Auth con perfil interno
- no es la opcion recomendada para automatizacion

Si n8n usa `service_role`:
- puede escribir aunque no exista sesion de usuario
- debe mantenerse solo del lado servidor
- no debe exponerse en frontend

## Reporting que desbloquea

- top campaigns
- spend real por objetivo
- costo por conversacion
- costo por visita al perfil
- mix real por objetivo
- ranking mensual por campana

## Lo que sigue pendiente aun con esta tabla

- presupuesto real por objetivo solo si se define una fuente adicional para budget por campana
- atribucion mas profunda por adset/ad solo si luego se necesita otra capa de granularidad
- ROAS real por campana con ventas reales: sigue faltando atribucion de ventas a nivel campaign
