# Meta Ads Real Flow

Runbook técnico-operativo del flujo real de Meta Ads en Agency OS / `js-analytics-dashboard`.

## 1. Propósito del flujo

- Leer todas las cuentas Meta activas desde Supabase.
- Consultar Meta Ads Insights para la ventana operativa vigente.
- Normalizar métricas por cuenta.
- Hacer `upsert` en `public.ad_metrics`.
- Actualizar `public.ad_accounts.last_sync_at` solo si la escritura fue exitosa.
- Dejar trazabilidad de la corrida en `public.ad_import_runs` y de fallos por cuenta en `public.ad_import_errors`.

## 2. Tablas involucradas

- `public.ad_accounts`
  Fuente de cuentas activas. Campos clave: `id`, `client_id`, `meta_account_id`, `platform`, `status`, `is_primary`, `last_sync_at`.
- `public.ad_metrics`
  Destino operativo de métricas Ads. Clave única: `(client_id, ad_account_id, date)`.
- `public.ad_import_runs`
  Bitácora de la corrida completa.
- `public.ad_import_errors`
  Bitácora de errores por cuenta y etapa.
- `public.v_client_monthly_operating_kpis`
  Vista agregada que usa el frontend para KPIs MTD. Se alimenta indirectamente desde `ad_metrics`.

## 3. Orden real del workflow n8n

1. `Schedule Trigger` inicia la corrida diaria.
2. Se calcula la ventana snapshot:
   - `date_start`: primer día del mes actual
   - `date_stop`: ayer
3. Se crea una fila en `public.ad_import_runs` con estado `running`.
4. Se leen cuentas desde `public.ad_accounts` con:
   - `platform = 'meta'`
   - `status = 'active'`
5. El workflow procesa una cuenta a la vez.
6. Para cada cuenta se consulta Meta Insights con la ventana `date_start -> date_stop`.
7. Se mergea la respuesta de Meta con el contexto de la cuenta y del run.
8. Se normaliza la respuesta a un payload limpio para `public.ad_metrics`.
9. Si la normalización marca `skip_upsert = true`, no se escribe en métricas y se registra error por cuenta.
10. Si `skip_upsert = false`, se hace `POST` a Supabase REST:

```text
/rest/v1/ad_metrics?on_conflict=client_id,ad_account_id,date
```

Con header:

```text
Prefer: resolution=merge-duplicates,return=representation
```

11. Si el `upsert` responde `2xx`, se hace `PATCH` a `public.ad_accounts.last_sync_at`.
12. Si el `upsert` falla o el `PATCH` falla, se registra una fila en `public.ad_import_errors`.
13. El workflow agrega resultados de todas las cuentas.
14. Al final actualiza `public.ad_import_runs` con `finished_at`, `status`, `total_accounts`, `success_accounts` y `failed_accounts`.

## 4. Qué se guarda en `ad_metrics`

Se guarda una fila normalizada por `client_id + ad_account_id + date`.

Campos operativos principales:
- `client_id`
- `ad_account_id`
- `import_run_id`
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

No deben enviarse a `ad_metrics` campos internos del workflow como:
- `skip_upsert`
- `sync_status`
- `sync_error_message`

Nota operativa:
- El frontend no lee Meta desde `ad_accounts` para KPIs.
- Los KPIs MTD salen de `public.v_client_monthly_operating_kpis`, que agrega datos ya escritos en `ad_metrics`.

## 5. Cuándo se actualiza `ad_accounts.last_sync_at`

`last_sync_at` se actualiza solo si el `upsert` en `public.ad_metrics` terminó con éxito.

No se actualiza si:
- Meta devolvió error.
- No hubo fila válida para normalizar.
- La normalización produjo `skip_upsert = true`.
- El `upsert` a `ad_metrics` falló.

## 6. Cómo se detecta un error por cuenta

Una cuenta se considera fallida si ocurre cualquiera de estos casos:

- La petición a Meta responde no `2xx`.
- Meta no devuelve una fila útil para la ventana pedida.
- Falta `client_id` o el payload no puede normalizarse.
- La normalización marca `skip_upsert = true`.
- El `upsert` a `public.ad_metrics` responde no `2xx`.
- El `PATCH` a `public.ad_accounts.last_sync_at` responde no `2xx`.

En esos casos:
- Se inserta una fila en `public.ad_import_errors`.
- La corrida sigue con la siguiente cuenta.
- El cierre del run debe terminar en `partial_success` o `failed`, según el total de fallos.

## 7. Qué validar en Supabase si algo falla

### Cuentas activas

```sql
select id, client_id, name, meta_account_id, status, last_sync_at
from public.ad_accounts
where platform = 'meta'
  and status = 'active'
order by name;
```

### Última corrida

```sql
select *
from public.ad_import_runs
order by started_at desc
limit 5;
```

### Errores por cuenta

```sql
select run_id, client_id, ad_account_id, stage, error_code, error_message, created_at
from public.ad_import_errors
order by created_at desc
limit 20;
```

### Métricas escritas para una cuenta

```sql
select client_id, ad_account_id, date, spend, messages, leads, purchases, purchase_value, import_run_id
from public.ad_metrics
where ad_account_id = 'UUID_DE_AD_ACCOUNT'
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

Qué mirar en esa validación:
- que la cuenta exista y siga `active`
- que `last_sync_at` cambie solo cuando hubo escritura real
- que exista `import_run_id` en `ad_metrics`
- que el run cierre con conteos coherentes
- que los errores tengan `stage` y `error_message` útiles
- que la vista MTD refleje lo escrito en `ad_metrics`

## 8. Checklist para cambiar el token de Meta sin romper el flujo

- Confirmar que el nuevo token tiene permisos sobre las 10 cuentas activas.
- Reemplazar `META_ACCESS_TOKEN` en n8n Cloud. No tocar `SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE`.
- No cambiar la versión de Graph API en el workflow si no hay una validación aparte.
- Ejecutar una corrida manual con una sola cuenta antes del batch completo si el entorno lo permite.
- Confirmar que Meta sigue devolviendo `spend`, `reach`, `impressions`, `clicks`, `cpm`, `cpc`, `ctr`, `frequency`, `actions` y `action_values`.
- Confirmar que no cambió el formato de `actions` o `action_values`.
- Revisar que el `upsert` siga llegando a `ad_metrics` sin campos internos extra.
- Confirmar que `last_sync_at` se actualiza solo en cuentas exitosas.
- Confirmar que un fallo controlado siga creando fila en `ad_import_errors`.

## 9. Checklist de prueba después de cada cambio

- Ejecutar el workflow manualmente en n8n.
- Verificar que se crea un registro en `public.ad_import_runs` con `running`.
- Verificar que el run cierra con `success`, `partial_success` o `failed`.
- Verificar que `total_accounts`, `success_accounts` y `failed_accounts` sean correctos.
- Verificar que `public.ad_metrics` recibió filas para las cuentas exitosas.
- Verificar que `public.ad_accounts.last_sync_at` se actualizó solo en las cuentas exitosas.
- Verificar que las cuentas fallidas generaron fila en `public.ad_import_errors`.
- Verificar que `public.v_client_monthly_operating_kpis` refleja los datos nuevos.
- Verificar en frontend que el cliente muestre:
  - última sync Meta
  - estado `OK`, `Desactualizado` o `Sin datos`
  - KPIs MTD con datos reales o estado vacío útil
