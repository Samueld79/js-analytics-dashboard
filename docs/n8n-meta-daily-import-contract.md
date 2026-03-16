# n8n Meta Daily Import Contract

Contrato operativo del flujo base que hoy ya esta validado.

## Estado

- activo hoy:
  - leer cuentas activas desde `public.ad_accounts`
  - consultar Meta por cuenta
  - normalizar metricas
  - hacer `upsert` en `public.ad_metrics`
  - actualizar `public.ad_accounts.last_sync_at`
- no obligatorio hoy:
  - `ad_import_runs`
  - `ad_import_errors`

Los docs de hardening existen para el siguiente paso. No describen el flujo base activo.

## Ventana snapshot

- `date_start`: primer dia del mes actual
- `date_stop`: ayer
- la fila escrita en `ad_metrics` usa `date = date_stop`

## Fuente de cuentas

Tabla:
- `public.ad_accounts`

Filtro:
- `platform = 'meta'`
- `status = 'active'`

Campos minimos:
- `id`
- `client_id`
- `meta_account_id`
- `name`

## Destino principal

Tabla:
- `public.ad_metrics`

Clave logica de `upsert`:
- `client_id`
- `ad_account_id`
- `date`

REST esperado:

```text
POST /rest/v1/ad_metrics?on_conflict=client_id,ad_account_id,date
Prefer: resolution=merge-duplicates,return=representation
```

## Payload que si va a `ad_metrics`

```json
{
  "client_id": "uuid",
  "ad_account_id": "uuid",
  "date": "2026-03-14",
  "spend": 1450000.25,
  "reach": 54000,
  "impressions": 167000,
  "clicks": 3120,
  "cpm": 8.68,
  "cpc": 464.74,
  "ctr": 1.87,
  "messages": 132,
  "leads": 54,
  "purchases": 18,
  "purchase_value": 6215000,
  "roas": 4.2862,
  "cpr": 10984.85,
  "cpl": 26851.86,
  "cpa": 80555.57,
  "frequency": 2.14,
  "raw_actions": [],
  "source": "meta_api"
}
```

No enviar:
- `import_run_id` como dependencia obligatoria
- `skip_upsert`
- `sync_status`
- `sync_error_message`

## Update de cuenta

Solo despues de `upsert` exitoso:

```text
PATCH /rest/v1/ad_accounts?id=eq.<AD_ACCOUNT_UUID>
```

Body:

```json
{
  "last_sync_at": "2026-03-15T06:05:00.000Z"
}
```

## Validacion minima

- la cuenta existe y sigue activa en `ad_accounts`
- hay fila nueva o actualizada en `ad_metrics`
- `last_sync_at` cambio solo para la cuenta exitosa
- `v_client_monthly_operating_kpis` refleja el dato nuevo

## Pendiente de endurecimiento

Si luego activas trazabilidad por corrida:
- `ad_import_runs`
- `ad_import_errors`

Eso se documenta en:
- [docs/n8n-meta-ads-sync-all-active-accounts-spec.md](/Users/samueldiaz/js-analytics-dashboard/docs/n8n-meta-ads-sync-all-active-accounts-spec.md)
- [docs/n8n-meta-ads-sync-incremental-hardening-plan.md](/Users/samueldiaz/js-analytics-dashboard/docs/n8n-meta-ads-sync-incremental-hardening-plan.md)
- [docs/n8n-meta-ads-sync-incremental-hardening-plan-delta.md](/Users/samueldiaz/js-analytics-dashboard/docs/n8n-meta-ads-sync-incremental-hardening-plan-delta.md)
