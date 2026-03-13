# n8n Meta Daily Import Contract

Contrato técnico para el workflow diario de import de Meta Ads en Fase 1.

## Objetivo

Todos los días a las `06:05` `America/Bogota`, n8n debe:
- abrir un `import run`,
- consultar Meta Ads por cada cuenta activa,
- normalizar métricas del día anterior,
- hacer `upsert` en `ad_metrics`,
- cerrar el `import run`,
- crear alertas si falla total o parcialmente.

## Tablas que toca

- `public.ad_accounts`
  Entrada del workflow.
  Filtro:
  - `platform = 'meta'`
  - `status = 'active'`

- `public.ad_import_runs`
  Bitácora técnica del job.

- `public.ad_metrics`
  Destino principal del import diario.

- `public.alerts`
  Solo si falla el import o si se detecta inconsistencia.

## Payload normalizado por fila

Cada cuenta debe terminar convertida a una fila así:

```json
{
  "client_id": "uuid",
  "ad_account_id": "uuid",
  "import_run_id": "uuid",
  "date": "2026-03-12",
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
  "raw_actions": [
    { "action_type": "onsite_conversion.messaging_conversation_started_7d", "value": "132" },
    { "action_type": "lead", "value": "54" },
    { "action_type": "purchase", "value": "18" }
  ],
  "source": "meta_api"
}
```

## Reglas de normalización

- `client_id` sale de `ad_accounts.client_id`
- `ad_account_id` es el `UUID` interno de `public.ad_accounts`, no el `meta_account_id`
- `date` siempre es el día anterior
- cualquier métrica faltante se convierte a `0`
- cualquier métrica negativa invalida la fila
- `raw_actions` conserva la evidencia original de Meta para auditar derivaciones

## Flujo n8n

### 1. Abrir import run

Insertar:

```sql
INSERT INTO public.ad_import_runs (
  platform,
  run_date,
  date_from,
  date_to,
  status,
  requested_by,
  started_at
) VALUES (
  'meta',
  CURRENT_DATE,
  CURRENT_DATE - INTERVAL '1 day',
  CURRENT_DATE - INTERVAL '1 day',
  'running',
  'n8n',
  now()
)
RETURNING id;
```

### 2. Seleccionar cuentas activas

```sql
SELECT id, client_id, meta_account_id, name
FROM public.ad_accounts
WHERE platform = 'meta'
  AND status = 'active';
```

### 3. Consultar Meta Ads Insights

Parámetros mínimos:
- `time_range = {since: ayer, until: ayer}`
- `level = account`
- `fields = spend,reach,impressions,clicks,cpm,cpc,ctr,frequency,actions,action_values`

### 4. Hacer upsert en `ad_metrics`

Clave lógica:
- `client_id`
- `ad_account_id`
- `date`

Ejemplo SQL:

```sql
INSERT INTO public.ad_metrics (
  client_id,
  ad_account_id,
  import_run_id,
  date,
  spend,
  reach,
  impressions,
  clicks,
  cpm,
  cpc,
  ctr,
  messages,
  leads,
  purchases,
  purchase_value,
  roas,
  cpr,
  cpl,
  cpa,
  frequency,
  raw_actions,
  source
) VALUES (
  :client_id,
  :ad_account_id,
  :import_run_id,
  :date,
  :spend,
  :reach,
  :impressions,
  :clicks,
  :cpm,
  :cpc,
  :ctr,
  :messages,
  :leads,
  :purchases,
  :purchase_value,
  :roas,
  :cpr,
  :cpl,
  :cpa,
  :frequency,
  :raw_actions::jsonb,
  'meta_api'
)
ON CONFLICT (client_id, ad_account_id, date)
DO UPDATE SET
  import_run_id = EXCLUDED.import_run_id,
  spend = EXCLUDED.spend,
  reach = EXCLUDED.reach,
  impressions = EXCLUDED.impressions,
  clicks = EXCLUDED.clicks,
  cpm = EXCLUDED.cpm,
  cpc = EXCLUDED.cpc,
  ctr = EXCLUDED.ctr,
  messages = EXCLUDED.messages,
  leads = EXCLUDED.leads,
  purchases = EXCLUDED.purchases,
  purchase_value = EXCLUDED.purchase_value,
  roas = EXCLUDED.roas,
  cpr = EXCLUDED.cpr,
  cpl = EXCLUDED.cpl,
  cpa = EXCLUDED.cpa,
  frequency = EXCLUDED.frequency,
  raw_actions = EXCLUDED.raw_actions,
  source = EXCLUDED.source,
  updated_at = now();
```

### 5. Actualizar cuenta

```sql
UPDATE public.ad_accounts
SET last_sync_at = now()
WHERE id = :ad_account_id;
```

### 6. Cerrar import run

Completado:

```sql
UPDATE public.ad_import_runs
SET
  status = 'completed',
  accounts_processed = :accounts_processed,
  rows_upserted = :rows_upserted,
  finished_at = now(),
  metadata = :metadata::jsonb
WHERE id = :import_run_id;
```

Parcial o fallido:

```sql
UPDATE public.ad_import_runs
SET
  status = :status,
  accounts_processed = :accounts_processed,
  rows_upserted = :rows_upserted,
  error_message = :error_message,
  finished_at = now(),
  metadata = :metadata::jsonb
WHERE id = :import_run_id;
```

## Alertas técnicas mínimas

Crear alerta `critical` si:
- no se pudo crear el `import run`
- fallaron todas las cuentas
- el workflow queda en `failed`

Crear alerta `warning` si:
- una o más cuentas fallan pero el job termina `partial`
- una cuenta activa no retorna datos y no está pausada

Ejemplo:

```sql
INSERT INTO public.alerts (
  client_id,
  type,
  rule_key,
  title,
  body,
  severity,
  triggered_by,
  metadata
) VALUES (
  :client_id,
  'meta_import_failed',
  CONCAT('meta_import_failed_', :date, '_', :ad_account_id),
  'Falló el import diario de Meta Ads',
  :body,
  'critical',
  'n8n',
  :metadata::jsonb
);
```

## Recomendación de implementación en n8n

- usar `Cron`
- usar `Supabase` o `HTTP Request` al REST de Supabase con `service_role`
- iterar cuentas con `Split In Batches`
- capturar errores por cuenta sin abortar todo el workflow
- consolidar resultado final y cerrar el `import run` una sola vez
