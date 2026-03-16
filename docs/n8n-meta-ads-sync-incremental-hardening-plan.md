# Meta Ads Sync - Incremental Hardening Plan

Plan incremental sobre el workflow ya validado `Meta Ads Sync - All Active Accounts`.

Estado:
- este plan es endurecimiento pendiente
- no implica que `ad_import_runs` o `ad_import_errors` ya esten activos
- para ejecutar este plan sin referencias fragiles, aplicar tambien el delta documentado en [docs/n8n-meta-ads-sync-incremental-hardening-plan-delta.md](/Users/samueldiaz/js-analytics-dashboard/docs/n8n-meta-ads-sync-incremental-hardening-plan-delta.md)

Reglas de este plan:
- no tocar `public.ad_metrics`
- no escribir `import_run_id` en `ad_metrics`
- no rehacer la normalización ni el upsert base
- agregar trazabilidad en `public.ad_import_runs` y `public.ad_import_errors`
- mantener tolerancia a fallos por cuenta

Si en n8n Cloud tus labels actuales difieren, aplica cada cambio al nodo equivalente. No renombres nodos que ya están validados salvo los nodos nuevos listados aquí.

## 1. Nodos NUEVOS a agregar

- `Code - Init Snapshot Window`
- `HTTP - Create Import Run`
- `Code - Extract Run Row`
- `Code - Attach Run Context To Accounts`
- `IF - Has Active Accounts?`
- `Code - Build Zero Summary`
- `IF - Meta Request OK?`
- `Code - Build Meta Error Record`
- `HTTP - Insert Import Error`
- `Code - Emit Failure Result`
- `Merge - Upsert Context + Response`
- `IF - Upsert OK?`
- `Code - Build Upsert Error Record`
- `Merge - Update Context + Response`
- `IF - Update Account OK?`
- `Code - Build Update Error Record`
- `Code - Emit Success Result`
- `Code - Aggregate Account Results`
- `HTTP - Finalize Import Run`

## 2. Nodos EXISTENTES a modificar

- `Schedule Trigger` o trigger equivalente
- `HTTP - Fetch Active Meta Accounts`
- `HTTP - Meta Insights`
- `Merge - Account + Meta Response`
- `Code - Normalize Metrics`
- `IF - Skip Upsert?`
- `Code - Build Upsert Payload`
- `HTTP - Upsert ad_metrics`
- `HTTP - Update ad_accounts.last_sync_at`
- `Loop Over Items - One Account At A Time`

## 3. Nodos EXISTENTES que deben quedar intactos

- La URL base y filtros de `HTTP - Fetch Active Meta Accounts` si ya filtra `platform=meta` y `status=active`
- La lógica de métricas dentro de `Code - Normalize Metrics`
- La condición de `IF - Skip Upsert?`: `{{$json.skip_upsert === true}}`
- El body funcional de `HTTP - Upsert ad_metrics` hacia columnas reales de `ad_metrics`
- El `on_conflict=client_id,ad_account_id,date`
- El body de `HTTP - Update ad_accounts.last_sync_at`: solo `last_sync_at`
- El batch size `1` del loop si ya está así

## 4. Orden exacto de implementación

1. Agrega el bloque de apertura de run.
2. Conecta el fetch de cuentas al contexto de run.
3. Agrega el bloque de cero cuentas.
4. Endurece la llamada a Meta con rama de error por cuenta.
5. Endurece la rama `skip_upsert=true`.
6. Endurece el `upsert` a `ad_metrics`.
7. Endurece el `PATCH` de `last_sync_at`.
8. Agrega agregación final y cierre del run.
9. Ejecuta pruebas bloque por bloque antes de seguir.

## 5. Nodos NUEVOS: configuración exacta

### A. Apertura de run

`Code - Init Snapshot Window`
- Tipo: `Code`
- Mode: `Run Once for All Items`
- Código:

```javascript
const TZ = 'America/Bogota';

function toParts(date, timeZone = TZ) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return map;
}

function formatDateUTC(date) {
  return date.toISOString().slice(0, 10);
}

const todayParts = toParts(new Date());
const year = Number(todayParts.year);
const month = Number(todayParts.month);
const day = Number(todayParts.day);

const bogotaToday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
const yesterday = new Date(bogotaToday);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);

const firstDayCurrentMonth = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));

return [
  {
    json: {
      workflow_name: 'Meta Ads Sync - All Active Accounts',
      source: 'meta',
      run_started_at: new Date().toISOString(),
      date_start: formatDateUTC(firstDayCurrentMonth),
      date_stop: formatDateUTC(yesterday),
    },
  },
];
```

`HTTP - Create Import Run`
- Tipo: `HTTP Request`
- Method: `POST`
- URL: `{{SUPABASE_URL}}/rest/v1/ad_import_runs`
- Response Format: `JSON`
- Options:
  - `Never Error = true`
  - `Include Response Headers and Status = true`
- Headers:
  - `apikey: {{SUPABASE_SERVICE_ROLE}}`
  - `Authorization: Bearer {{SUPABASE_SERVICE_ROLE}}`
  - `Content-Type: application/json`
  - `Prefer: return=representation`
- Body JSON:

```json
{
  "source": "={{$json.source}}",
  "started_at": "={{$json.run_started_at}}",
  "status": "running",
  "total_accounts": 0,
  "success_accounts": 0,
  "failed_accounts": 0,
  "notes": null,
  "metadata": {
    "workflow": "={{$json.workflow_name}}",
    "trigger": "schedule",
    "date_start": "={{$json.date_start}}",
    "date_stop": "={{$json.date_stop}}"
  }
}
```

`Code - Extract Run Row`
- Tipo: `Code`
- Mode: `Run Once for All Items`
- Código:

```javascript
const body = $json.body ?? $json;
const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [body];
const row = rows[0];

if (!row?.id) {
  throw new Error('Create Import Run did not return an ad_import_runs row with id');
}

return [{ json: row }];
```

`Code - Attach Run Context To Accounts`
- Tipo: `Code`
- Mode: `Run Once for All Items`
- Código:

```javascript
const run = $('Code - Extract Run Row').first().json;
const window = $('Code - Init Snapshot Window').first().json;

const rawInput = $input.all().flatMap((item) => {
  const body = item.json.body ?? item.json;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return body?.id ? [body] : [];
});

if (rawInput.length === 0) {
  return [
    {
      json: {
        has_accounts: false,
        run_id: run.id,
        snapshot: {
          date_start: window.date_start,
          date_stop: window.date_stop,
          workflow_name: window.workflow_name,
        },
      },
    },
  ];
}

return rawInput.map((row) => ({
  json: {
    has_accounts: true,
    account: {
      id: row.id,
      client_id: row.client_id ?? null,
      meta_account_id: row.meta_account_id,
      name: row.name ?? null,
      currency_code: row.currency_code ?? null,
      timezone: row.timezone ?? null,
    },
    run: {
      id: run.id,
      source: 'meta',
    },
    snapshot: {
      date_start: window.date_start,
      date_stop: window.date_stop,
      workflow_name: window.workflow_name,
    },
  },
}));
```

`IF - Has Active Accounts?`
- Tipo: `IF`
- Condición:

```javascript
{{$json.has_accounts === true}}
```

`Code - Build Zero Summary`
- Tipo: `Code`
- Mode: `Run Once for Each Item`
- Código:

```javascript
return [
  {
    json: {
      run_id: $json.run_id,
      finished_at: new Date().toISOString(),
      status: 'success',
      total_accounts: 0,
      success_accounts: 0,
      failed_accounts: 0,
      notes: 'No active Meta ad accounts found',
      metadata: {
        workflow: $json.snapshot.workflow_name,
        date_start: $json.snapshot.date_start,
        date_stop: $json.snapshot.date_stop,
      },
    },
  },
];
```

### B. Error por cuenta en llamada a Meta

`IF - Meta Request OK?`
- Tipo: `IF`
- Condición:

```javascript
{{Number($json.statusCode) >= 200 && Number($json.statusCode) < 300}}
```

`Code - Build Meta Error Record`
- Tipo: `Code`
- Mode: `Run Once for Each Item`
- Código:

```javascript
const body = $json.body ?? null;

return [
  {
    json: {
      run_id: $json.run.id,
      client_id: $json.account.client_id ?? null,
      ad_account_id: $json.account.id ?? null,
      stage: 'fetch_meta_insights',
      error_code: String($json.statusCode ?? 'meta_request_failed'),
      error_message:
        body?.error?.message ??
        body?.message ??
        `Meta request failed with status ${$json.statusCode ?? 'unknown'}`,
      raw_payload: {
        statusCode: $json.statusCode ?? null,
        body,
        snapshot: $json.snapshot,
        meta_account_id: $json.account.meta_account_id ?? null,
      },
    },
  },
];
```

`HTTP - Insert Import Error`
- Tipo: `HTTP Request`
- Method: `POST`
- URL: `{{SUPABASE_URL}}/rest/v1/ad_import_errors`
- Response Format: `JSON`
- Options:
  - `Never Error = true`
- Headers:
  - `apikey: {{SUPABASE_SERVICE_ROLE}}`
  - `Authorization: Bearer {{SUPABASE_SERVICE_ROLE}}`
  - `Content-Type: application/json`
  - `Prefer: return=minimal`
- Body JSON:

```json
{
  "run_id": "={{$json.run_id}}",
  "client_id": "={{$json.client_id}}",
  "ad_account_id": "={{$json.ad_account_id}}",
  "stage": "={{$json.stage}}",
  "error_code": "={{$json.error_code}}",
  "error_message": "={{$json.error_message}}",
  "raw_payload": ={{$json.raw_payload}}
}
```

`Code - Emit Failure Result`
- Tipo: `Code`
- Mode: `Run Once for Each Item`
- Código:

```javascript
return [
  {
    json: {
      run_id: $json.run_id,
      client_id: $json.client_id ?? null,
      ad_account_id: $json.ad_account_id ?? null,
      success: false,
      result: 'failed',
      stage: $json.stage,
      error_code: $json.error_code ?? null,
      error_message: $json.error_message ?? 'Unknown error',
    },
  },
];
```

### C. Hardening de upsert y update

`Merge - Upsert Context + Response`
- Tipo: `Merge`
- Mode: `Combine`
- Combine By: `Position`
- Input 1: `Code - Build Upsert Payload`
- Input 2: `HTTP - Upsert ad_metrics`

`IF - Upsert OK?`
- Tipo: `IF`
- Condición:

```javascript
{{Number($json.statusCode) >= 200 && Number($json.statusCode) < 300}}
```

`Code - Build Upsert Error Record`
- Tipo: `Code`
- Mode: `Run Once for Each Item`
- Código:

```javascript
const body = $json.body ?? null;

return [
  {
    json: {
      run_id: $json.run_id,
      client_id: $json.client_id,
      ad_account_id: $json.ad_account_id,
      stage: 'upsert_ad_metrics',
      error_code: String($json.statusCode ?? 'upsert_failed'),
      error_message:
        body?.message ??
        body?.error_description ??
        body?.hint ??
        `Supabase upsert failed with status ${$json.statusCode ?? 'unknown'}`,
      raw_payload: {
        statusCode: $json.statusCode ?? null,
        body,
        payload: {
          client_id: $json.client_id,
          ad_account_id: $json.ad_account_id,
          date: $json.date,
        },
      },
    },
  },
];
```

`Merge - Update Context + Response`
- Tipo: `Merge`
- Mode: `Combine`
- Combine By: `Position`
- Input 1: `Merge - Upsert Context + Response`
- Input 2: `HTTP - Update ad_accounts.last_sync_at`

`IF - Update Account OK?`
- Tipo: `IF`
- Condición:

```javascript
{{Number($json.statusCode) >= 200 && Number($json.statusCode) < 300}}
```

`Code - Build Update Error Record`
- Tipo: `Code`
- Mode: `Run Once for Each Item`
- Código:

```javascript
const body = $json.body ?? null;

return [
  {
    json: {
      run_id: $json.run_id,
      client_id: $json.client_id,
      ad_account_id: $json.ad_account_id,
      stage: 'update_ad_account_last_sync',
      error_code: String($json.statusCode ?? 'account_update_failed'),
      error_message:
        body?.message ??
        body?.error_description ??
        `Supabase account update failed with status ${$json.statusCode ?? 'unknown'}`,
      raw_payload: {
        statusCode: $json.statusCode ?? null,
        body,
      },
    },
  },
];
```

`Code - Emit Success Result`
- Tipo: `Code`
- Mode: `Run Once for Each Item`
- Código:

```javascript
return [
  {
    json: {
      run_id: $json.run_id,
      client_id: $json.client_id,
      ad_account_id: $json.ad_account_id,
      success: true,
      result: 'success',
      stage: 'completed',
      error_code: null,
      error_message: null,
    },
  },
];
```

### D. Cierre del run

`Code - Aggregate Account Results`
- Tipo: `Code`
- Mode: `Run Once for All Items`
- Código:

```javascript
const items = $input.all().map((item) => item.json);
const run = $('Code - Extract Run Row').first().json;
const window = $('Code - Init Snapshot Window').first().json;

const totalAccounts = items.length;
const successItems = items.filter((item) => item.success === true);
const failedItems = items.filter((item) => item.success !== true);

let status = 'success';
if (failedItems.length > 0 && successItems.length > 0) status = 'partial_success';
if (failedItems.length > 0 && successItems.length === 0) status = 'failed';

return [
  {
    json: {
      run_id: run.id,
      finished_at: new Date().toISOString(),
      status,
      total_accounts: totalAccounts,
      success_accounts: successItems.length,
      failed_accounts: failedItems.length,
      notes:
        failedItems.length === 0
          ? `Meta sync finished successfully for ${successItems.length} account(s)`
          : `Meta sync finished with ${failedItems.length} failed account(s) out of ${totalAccounts}`,
      metadata: {
        workflow: window.workflow_name,
        date_start: window.date_start,
        date_stop: window.date_stop,
        failures: failedItems.slice(0, 25).map((item) => ({
          client_id: item.client_id,
          ad_account_id: item.ad_account_id,
          stage: item.stage,
          error_code: item.error_code,
          error_message: item.error_message,
        })),
      },
    },
  },
];
```

`HTTP - Finalize Import Run`
- Tipo: `HTTP Request`
- Method: `PATCH`
- URL: `{{SUPABASE_URL}}/rest/v1/ad_import_runs?id=eq.{{$json.run_id}}`
- Response Format: `JSON`
- Options:
  - `Never Error = true`
  - `Include Response Headers and Status = true`
- Headers:
  - `apikey: {{SUPABASE_SERVICE_ROLE}}`
  - `Authorization: Bearer {{SUPABASE_SERVICE_ROLE}}`
  - `Content-Type: application/json`
  - `Prefer: return=representation`
- Body JSON:

```json
{
  "finished_at": "={{$json.finished_at}}",
  "status": "={{$json.status}}",
  "total_accounts": ={{$json.total_accounts}},
  "success_accounts": ={{$json.success_accounts}},
  "failed_accounts": ={{$json.failed_accounts}},
  "notes": "={{$json.notes}}",
  "metadata": ={{$json.metadata}}
}
```

## 6. Nodos MODIFICADOS: cambio exacto

### `Schedule Trigger` o trigger equivalente

- Conexión anterior: `Trigger -> HTTP - Fetch Active Meta Accounts`
- Conexión nueva: `Trigger -> Code - Init Snapshot Window -> HTTP - Create Import Run -> Code - Extract Run Row -> HTTP - Fetch Active Meta Accounts`

### `HTTP - Fetch Active Meta Accounts`

- Conexión anterior: `HTTP - Fetch Active Meta Accounts -> Loop Over Items - One Account At A Time`
- Conexión nueva: `HTTP - Fetch Active Meta Accounts -> Code - Attach Run Context To Accounts -> IF - Has Active Accounts?`

### `Loop Over Items - One Account At A Time`

- Conexión anterior: salida principal al bloque actual por cuenta
- Conexión nueva adicional: salida `done` -> `Code - Aggregate Account Results`

### `HTTP - Meta Insights`

- Campo: `Options.Never Error`
  - anterior: `false`
  - nuevo: `true`
- Campo: `Options.Include Response Headers and Status`
  - anterior: `false`
  - nuevo: `true`
- Campo: `Options.Retry On Fail`
  - anterior: `false`
  - nuevo: `true`
- Campo: `Options.Max Tries`
  - anterior: vacío
  - nuevo: `3`
- Campo: `Options.Wait Between Tries`
  - anterior: vacío
  - nuevo: `1500 ms`

### `Merge - Account + Meta Response`

- Conexión anterior: `Merge - Account + Meta Response -> Code - Normalize Metrics`
- Conexión nueva: `Merge - Account + Meta Response -> IF - Meta Request OK?`

### `Code - Normalize Metrics`

- Cambio mínimo: agregar `run_id: run.id` en los outputs de error y en el output exitoso
- Valor anterior: no emitía `run_id`
- Valor nuevo: emite `run_id`
- No tocar fórmulas ni mappings ya validados

### `IF - Skip Upsert?`

- Rama `true`
  - anterior: detener flujo o dejar item sin persistencia
  - nuevo: `Code - Build Normalize Error Record -> HTTP - Insert Import Error -> Code - Emit Failure Result -> Loop Over Items`
- Rama `false`
  - anterior: `Code - Build Upsert Payload`
  - nuevo: igual

### `Code - Build Upsert Payload`

- Cambio mínimo: agregar `run_id` al item para trazabilidad posterior
- Valor anterior: no emitía `run_id`
- Valor nuevo: emite `run_id`
- Mantener intacto el payload real de `ad_metrics`

### `HTTP - Upsert ad_metrics`

- Campo: `Options.Never Error`
  - anterior: `false`
  - nuevo: `true`
- Campo: `Options.Include Response Headers and Status`
  - anterior: `false`
  - nuevo: `true`
- Campo: `Header.Prefer`
  - anterior: mantener si ya es correcto
  - nuevo: `resolution=merge-duplicates,return=representation`
- Conexión anterior: `HTTP - Upsert ad_metrics -> HTTP - Update ad_accounts.last_sync_at`
- Conexión nueva:
  - `Code - Build Upsert Payload -> Merge - Upsert Context + Response`
  - `HTTP - Upsert ad_metrics -> Merge - Upsert Context + Response`
  - `Merge - Upsert Context + Response -> IF - Upsert OK?`

### `HTTP - Update ad_accounts.last_sync_at`

- Campo: `Options.Never Error`
  - anterior: `false`
  - nuevo: `true`
- Campo: `Options.Include Response Headers and Status`
  - anterior: `false`
  - nuevo: `true`
- Campo: `Header.Prefer`
  - anterior: vacío o distinto
  - nuevo: `return=representation`
- Conexión anterior: venía directo del upsert
- Conexión nueva: solo desde `IF - Upsert OK?` rama `true`

## 7. Qué probar después de cada bloque

### Bloque 1: apertura y cero cuentas

- Ejecuta con cuentas activas.
- Verifica que se crea fila en `ad_import_runs` con `status='running'`.
- Desactiva temporalmente todas las cuentas y ejecuta.
- Verifica que el run cierra con `success`, `total_accounts=0`, `failed_accounts=0`.

### Bloque 2: error en Meta por cuenta

- Fuerza token inválido.
- Verifica que una cuenta fallida crea fila en `ad_import_errors` con `stage='fetch_meta_insights'`.
- Verifica que el workflow no se cae en la primera cuenta.

### Bloque 3: rama `skip_upsert`

- Fuerza `skip_upsert=true` en una cuenta de prueba.
- Verifica fila en `ad_import_errors` con `stage='normalize_metrics'`.
- Verifica que no hay escritura nueva en `ad_metrics`.

### Bloque 4: error en upsert

- Rompe el payload de una cuenta de prueba.
- Verifica fila en `ad_import_errors` con `stage='upsert_ad_metrics'`.
- Verifica que `last_sync_at` no cambia para esa cuenta.

### Bloque 5: error en update de cuenta

- Fuerza fallo en `PATCH ad_accounts`.
- Verifica fila en `ad_import_errors` con `stage='update_ad_account_last_sync'`.
- Verifica que el resultado de esa cuenta queda como fallo.

### Bloque 6: cierre final

- Ejecuta con varias cuentas: al menos una exitosa y una fallida.
- Verifica que el run cierra en `partial_success`.
- Verifica que `total_accounts`, `success_accounts`, `failed_accounts` cuadran.

## 8. Validación en Supabase

### Últimos runs

```sql
select id, source, started_at, finished_at, status, total_accounts, success_accounts, failed_accounts, notes
from public.ad_import_runs
order by started_at desc
limit 10;
```

### Errores recientes

```sql
select run_id, client_id, ad_account_id, stage, error_code, error_message, created_at
from public.ad_import_errors
order by created_at desc
limit 20;
```

### Relación run -> errores

```sql
select
  r.id,
  r.status,
  r.total_accounts,
  r.success_accounts,
  r.failed_accounts,
  count(e.id) as error_rows
from public.ad_import_runs r
left join public.ad_import_errors e on e.run_id = r.id
group by r.id, r.status, r.total_accounts, r.success_accounts, r.failed_accounts
order by max(r.started_at) desc
limit 10;
```

### Verificación de `ad_metrics`

```sql
select client_id, ad_account_id, date, spend, messages, leads, purchases, purchase_value
from public.ad_metrics
order by date desc
limit 20;
```

### Verificación de `last_sync_at`

```sql
select id, client_id, name, meta_account_id, last_sync_at
from public.ad_accounts
where platform = 'meta'
  and status = 'active'
order by name;
```

Checks finales:
- `ad_metrics` sigue escribiendo igual que antes
- `ad_metrics` no recibe `import_run_id`
- `last_sync_at` solo cambia en cuentas exitosas
- `ad_import_errors` registra fallos por cuenta
- `ad_import_runs` cierra siempre con conteos correctos
