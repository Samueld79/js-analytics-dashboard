# Meta Ads Real Flow

Runbook tecnico-operativo del flujo Meta Ads que hoy si esta activo en el proyecto.

## Estado actual

- activo hoy:
  - lectura de cuentas desde `public.ad_accounts`
  - `upsert` de metricas en `public.ad_metrics`
  - actualizacion de `public.ad_accounts.last_sync_at`
  - consumo frontend via vistas SQL operativas
- pendiente de endurecimiento:
  - trazabilidad persistente por corrida en `ad_import_runs`
  - registro persistente por cuenta en `ad_import_errors`

No asumas que el endurecimiento ya esta activo solo porque existen docs de plan o spec.

## 1. Proposito del flujo

- sincronizar metricas reales de Meta Ads por cuenta activa
- dejar `ad_metrics` como base diaria/snapshot de Ads
- refrescar `last_sync_at` cuando una cuenta sincroniza bien
- alimentar KPIs MTD y estado operativo del frontend

## 2. Tablas y vistas que si participan hoy

- `public.ad_accounts`
  Fuente de cuentas Meta activas.
- `public.ad_metrics`
  Destino diario/snapshot de Ads.
- `public.v_client_daily_operating_kpis`
- `public.v_client_monthly_operating_kpis`

Tablas de endurecimiento:
- `public.ad_import_runs`
  Existe en `schema.sql`, pero no es requisito operativo del flujo activo base.
- `public.ad_import_errors`
  Sigue como endurecimiento pendiente. No asumirla activa en todos los entornos.

## 3. Orden real del workflow n8n activo

1. leer cuentas activas desde `public.ad_accounts`
2. consultar Meta Insights por cuenta
3. mergear config de cuenta + respuesta Meta
4. normalizar metricas
5. filtrar con `IF` usando `skip_upsert`
6. hacer `upsert` en `public.ad_metrics`
7. actualizar `public.ad_accounts.last_sync_at` solo si el `upsert` fue exitoso

## 4. Que se guarda en `ad_metrics`

`ad_metrics` actua como base diaria/snapshot para Ads.

Campos operativos reales:
- `client_id`
- `ad_account_id`
- `date`
- `spend`
- `reach`
- `impressions`
- `clicks`
- `cpm`
- `cpc`
- `ctr`
- `messages`
- `leads`
- `purchases`
- `purchase_value`
- `roas`
- `cpr`
- `cpl`
- `cpa`
- `frequency`
- `raw_actions`
- `source`

Nota:
- no dependas operativamente de `import_run_id`
- si la columna existe en algun entorno, no es la base del frontend ni del flujo actual
- los campos internos del workflow no deben viajar a `ad_metrics`

## 5. Cuando se actualiza `ad_accounts.last_sync_at`

Solo despues de un `upsert` exitoso en `ad_metrics`.

No debe cambiar si:
- Meta devolvio error
- la normalizacion marco `skip_upsert = true`
- el `upsert` fallo

## 6. Como detectar un error por cuenta hoy

Hoy la validacion operativa real se hace con:
- ejecucion/logs de n8n
- ausencia de fila esperada en `ad_metrics`
- `last_sync_at` sin actualizar
- KPIs MTD o estado Meta sin refresco en frontend

Si luego activas endurecimiento con `ad_import_runs` y `ad_import_errors`, esa trazabilidad pasa a complementar esto. No asumirlo como activo hoy.

## 7. Que validar en Supabase si algo falla

### Cuentas activas

```sql
select id, client_id, name, meta_account_id, status, last_sync_at
from public.ad_accounts
where platform = 'meta'
  and status = 'active'
order by name;
```

### Ultimas metricas escritas

```sql
select client_id, ad_account_id, date, spend, messages, leads, purchases, purchase_value, source
from public.ad_metrics
order by date desc
limit 20;
```

### Vista MTD del cliente

```sql
select *
from public.v_client_monthly_operating_kpis
where client_id = 'UUID_DE_CLIENT'
order by month desc
limit 6;
```

### Checks opcionales si activaste endurecimiento

```sql
select *
from public.ad_import_runs
order by started_at desc
limit 10;
```

```sql
select *
from public.ad_import_errors
order by created_at desc
limit 20;
```

## 8. Checklist para cambiar el token de Meta

- confirmar acceso del token a las cuentas activas reales
- reemplazar el token en n8n Cloud
- no tocar `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY`
- no exponer tokens en el repo ni en frontend
- correr una prueba manual
- confirmar escritura en `ad_metrics`
- confirmar update de `last_sync_at`

## 9. Checklist despues de cada cambio

- ejecutar el workflow manualmente
- verificar filas nuevas en `ad_metrics`
- verificar `last_sync_at` en cuentas exitosas
- verificar `v_client_monthly_operating_kpis`
- verificar frontend:
  - ultima sync Meta
  - estado `OK`, `Desactualizado` o `Sin datos`
  - KPIs MTD reales o estado vacio util
