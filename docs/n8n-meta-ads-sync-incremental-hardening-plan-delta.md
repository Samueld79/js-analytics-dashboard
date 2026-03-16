# Meta Ads Sync - Incremental Hardening Plan Delta

Delta corregido sobre [docs/n8n-meta-ads-sync-incremental-hardening-plan.md](./n8n-meta-ads-sync-incremental-hardening-plan.md).

Estado:
- este delta aplica solo si decides implementar el endurecimiento pendiente
- no significa que `ad_import_runs` o `ad_import_errors` ya formen parte del flujo activo actual

Este delta reemplaza solo los bloques que hoy tienen:
- referencias frágiles entre nodos dentro de `Code`
- bodies HTTP ambiguos en n8n

No cambia:
- la lógica validada de normalización
- el `upsert` base a `ad_metrics`
- `on_conflict=client_id,ad_account_id,date`
- la regla de actualizar `last_sync_at` solo después de `upsert` exitoso
- la regla de no escribir `import_run_id` en `ad_metrics`

## 1. Bloques del plan que deben cambiar

- Agregar 2 nodos nuevos:
  - `Merge - Snapshot + Run Context`
  - `Merge - Run Context + Accounts Response`
- Reemplazar la versión de estos nodos:
  - `HTTP - Create Import Run`
  - `Code - Extract Run Row`
  - `Code - Attach Run Context To Accounts`
  - `Code - Normalize Metrics`
  - `Code - Build Normalize Error Record`
  - `Code - Build Meta Error Record`
  - `Code - Build Upsert Payload`
  - `HTTP - Upsert ad_metrics`
  - `HTTP - Update ad_accounts.last_sync_at`
  - `HTTP - Insert Import Error`
  - `Code - Build Upsert Error Record`
  - `Code - Build Update Error Record`
  - `Code - Emit Failure Result`
  - `Code - Emit Success Result`
  - `Code - Aggregate Account Results`
  - `HTTP - Finalize Import Run`
- Corregir conexiones del bloque inicial de contexto y del cierre final.

## 2. Conexiones corregidas

Reemplaza el bloque inicial por esto:

```text
Schedule Trigger
  -> Code - Init Snapshot Window

Code - Init Snapshot Window
  -> HTTP - Create Import Run
Code - Init Snapshot Window
  -> Merge - Snapshot + Run Context (Input 1)

HTTP - Create Import Run
  -> Code - Extract Run Row
Code - Extract Run Row
  -> Merge - Snapshot + Run Context (Input 2)

Merge - Snapshot + Run Context
  -> HTTP - Fetch Active Meta Accounts
Merge - Snapshot + Run Context
  -> Merge - Run Context + Accounts Response (Input 1)

HTTP - Fetch Active Meta Accounts
  -> Merge - Run Context + Accounts Response (Input 2)

Merge - Run Context + Accounts Response
  -> Code - Attach Run Context To Accounts
  -> IF - Has Active Accounts?
```

El resto del flujo por cuenta se mantiene, con estas dos reglas:
- Todas las ramas de error deben seguir en `HTTP - Insert Import Error -> Code - Emit Failure Result -> Loop Over Items`
- La salida `done` de `Loop Over Items - One Account At A Time` sigue hacia `Code - Aggregate Account Results -> HTTP - Finalize Import Run`

## 3. Nodos NUEVOS a agregar

### `Merge - Snapshot + Run Context`

- Tipo: `Merge`
- Mode: `Combine`
- Combine By: `Position`
- Input 1: `Code - Init Snapshot Window`
- Input 2: `Code - Extract Run Row`

### `Merge - Run Context + Accounts Response`

- Tipo: `Merge`
- Mode: `Combine`
- Combine By: `Position`
- Input 1: `Merge - Snapshot + Run Context`
- Input 2: `HTTP - Fetch Active Meta Accounts`

## 4. Nodos corregidos

### `HTTP - Create Import Run`

Mantén URL, headers y opciones. Cambia solo el body a forma segura.

- Body mode: `Using Raw Body`
- Content-Type: `application/json`
- Raw Body:

```javascript
={{ JSON.stringify({
  source: $json.source,
  started_at: $json.run_started_at,
  status: 'running',
  total_accounts: 0,
  success_accounts: 0,
  failed_accounts: 0,
  notes: null,
  metadata: {
    workflow: $json.workflow_name,
    trigger: 'schedule',
    date_start: $json.date_start,
    date_stop: $json.date_stop,
  },
}) }}
```

### `Code - Extract Run Row`

Reemplaza el código completo.

```javascript
const body = $json.body ?? $json;
const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [body];
const row = rows[0];

if (!row?.id) {
  throw new Error('Create Import Run did not return an ad_import_runs row with id');
}

return [
  {
    json: {
      run_id: row.id,
      run_source: row.source ?? 'meta',
    },
  },
];
```

### `Code - Attach Run Context To Accounts`

Reemplaza el código completo.

```javascript
const inputItems = $input.all();

if (inputItems.length === 0) {
  return [];
}

const context = inputItems[0].json;
const responseBody = context.body ?? context;
const rows = Array.isArray(responseBody)
  ? responseBody
  : Array.isArray(responseBody?.data)
    ? responseBody.data
    : [];

const snapshot = {
  workflow_name: context.workflow_name,
  date_start: context.date_start,
  date_stop: context.date_stop,
};

const run = {
  id: context.run_id,
  source: context.run_source ?? 'meta',
};

if (rows.length === 0) {
  return [
    {
      json: {
        has_accounts: false,
        run_id: run.id,
        run,
        snapshot,
      },
    },
  ];
}

return rows.map((row) => ({
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
    run_id: run.id,
    run,
    snapshot,
  },
}));
```

### `Code - Normalize Metrics`

No cambies fórmulas ni mappings. Solo reemplaza el nodo para que también adjunte `snapshot` en todos los outputs.

```javascript
const account = $json.account;
const run = $json.run;
const snapshot = $json.snapshot;
const responseBody = $json.body ?? {};
const insight = Array.isArray(responseBody.data) ? responseBody.data[0] ?? null : null;

function toFiniteNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toInt(value) {
  return Math.max(0, Math.round(toFiniteNumber(value)));
}

function toMoney(value, decimals = 2) {
  const n = Math.max(0, toFiniteNumber(value));
  return Number(n.toFixed(decimals));
}

function toRate(value, decimals = 4) {
  const n = Math.max(0, toFiniteNumber(value));
  return Number(n.toFixed(decimals));
}

function sumAction(entries, keys) {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((sum, entry) => {
    if (!keys.includes(entry?.action_type)) return sum;
    const value = Number(entry?.value ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

if (!account?.client_id) {
  return [
    {
      json: {
        run_id: run.id,
        client_id: null,
        ad_account_id: account?.id ?? null,
        meta_account_id: account?.meta_account_id ?? null,
        snapshot,
        stage: 'normalize_metrics',
        skip_upsert: true,
        sync_status: 'failed',
        sync_error_message: 'Missing client_id for ad account',
        raw_payload: responseBody,
      },
    },
  ];
}

if (!insight) {
  return [
    {
      json: {
        run_id: run.id,
        client_id: account.client_id,
        ad_account_id: account.id,
        meta_account_id: account.meta_account_id,
        snapshot,
        stage: 'normalize_metrics',
        skip_upsert: true,
        sync_status: 'failed',
        sync_error_message: 'Meta returned no data row for the requested snapshot window',
        raw_payload: responseBody,
      },
    },
  ];
}

const actions = Array.isArray(insight.actions) ? insight.actions : [];
const actionValues = Array.isArray(insight.action_values) ? insight.action_values : [];

const spend = toMoney(insight.spend);
const reach = toInt(insight.reach);
const impressions = toInt(insight.impressions);
const clicks = toInt(insight.clicks);
const cpm = toRate(insight.cpm);
const cpc = toRate(insight.cpc);
const ctr = toRate(insight.ctr);
const frequency = toRate(insight.frequency);

const messages = toInt(sumAction(actions, [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.messaging_user_depth_2_message_send',
]));

const leads = toInt(sumAction(actions, ['lead']));
const purchases = toInt(sumAction(actions, ['purchase']));
const purchaseValue = toMoney(sumAction(actionValues, ['purchase']));
const roas = spend > 0 ? toRate(purchaseValue / spend) : 0;
const cpr = messages > 0 ? toRate(spend / messages) : 0;
const cpl = leads > 0 ? toRate(spend / leads) : 0;
const cpa = purchases > 0 ? toRate(spend / purchases) : 0;

return [
  {
    json: {
      client_id: account.client_id,
      ad_account_id: account.id,
      run_id: run.id,
      snapshot,
      date: snapshot.date_stop,
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
      purchase_value: purchaseValue,
      roas,
      cpr,
      cpl,
      cpa,
      frequency,
      raw_actions: actions,
      source: 'meta_api',
      skip_upsert: false,
      sync_status: 'ready',
      sync_error_message: null,
      meta_account_id: account.meta_account_id,
      account_name: account.name,
    },
  },
];
```

### `Code - Build Normalize Error Record`

Reemplaza el código completo.

```javascript
return [
  {
    json: {
      run_id: $json.run_id,
      client_id: $json.client_id ?? null,
      ad_account_id: $json.ad_account_id ?? null,
      snapshot: $json.snapshot ?? null,
      stage: 'normalize_metrics',
      error_code: 'skip_upsert',
      error_message: $json.sync_error_message ?? 'Normalization produced skip_upsert=true',
      raw_payload: {
        meta_account_id: $json.meta_account_id ?? null,
        sync_status: $json.sync_status ?? null,
        payload: $json.raw_payload ?? null,
      },
    },
  },
];
```

### `Code - Build Meta Error Record`

Reemplaza el código completo.

```javascript
const body = $json.body ?? null;

return [
  {
    json: {
      run_id: $json.run.id,
      client_id: $json.account.client_id ?? null,
      ad_account_id: $json.account.id ?? null,
      snapshot: $json.snapshot ?? null,
      stage: 'fetch_meta_insights',
      error_code: String($json.statusCode ?? 'meta_request_failed'),
      error_message:
        body?.error?.message ??
        body?.message ??
        `Meta request failed with status ${$json.statusCode ?? 'unknown'}`,
      raw_payload: {
        statusCode: $json.statusCode ?? null,
        body,
        snapshot: $json.snapshot ?? null,
        meta_account_id: $json.account.meta_account_id ?? null,
      },
    },
  },
];
```

### `Code - Build Upsert Payload`

Reemplaza el código completo. Mantiene `run_id` y `snapshot` en el item, pero no los envía a `ad_metrics`.

```javascript
return [
  {
    json: {
      run_id: $json.run_id,
      snapshot: $json.snapshot ?? null,
      client_id: $json.client_id,
      ad_account_id: $json.ad_account_id,
      date: $json.date,
      spend: $json.spend,
      reach: $json.reach,
      impressions: $json.impressions,
      clicks: $json.clicks,
      cpm: $json.cpm,
      cpc: $json.cpc,
      ctr: $json.ctr,
      messages: $json.messages,
      leads: $json.leads,
      purchases: $json.purchases,
      purchase_value: $json.purchase_value,
      roas: $json.roas,
      cpr: $json.cpr,
      cpl: $json.cpl,
      cpa: $json.cpa,
      frequency: $json.frequency,
      raw_actions: $json.raw_actions,
      source: $json.source,
    },
  },
];
```

### `HTTP - Upsert ad_metrics`

Mantén URL, headers y opciones. Cambia solo el body a forma segura.

- Body mode: `Using Raw Body`
- Content-Type: `application/json`
- Raw Body:

```javascript
={{ JSON.stringify({
  client_id: $json.client_id,
  ad_account_id: $json.ad_account_id,
  date: $json.date,
  spend: $json.spend,
  reach: $json.reach,
  impressions: $json.impressions,
  clicks: $json.clicks,
  cpm: $json.cpm,
  cpc: $json.cpc,
  ctr: $json.ctr,
  messages: $json.messages,
  leads: $json.leads,
  purchases: $json.purchases,
  purchase_value: $json.purchase_value,
  roas: $json.roas,
  cpr: $json.cpr,
  cpl: $json.cpl,
  cpa: $json.cpa,
  frequency: $json.frequency,
  raw_actions: $json.raw_actions,
  source: $json.source,
}) }}
```

### `HTTP - Update ad_accounts.last_sync_at`

Mantén URL, headers y opciones. Cambia solo el body a forma segura.

- Body mode: `Using Raw Body`
- Content-Type: `application/json`
- Raw Body:

```javascript
={{ JSON.stringify({
  last_sync_at: $now.toISO(),
}) }}
```

### `HTTP - Insert Import Error`

Mantén URL, headers y opciones. Cambia solo el body a forma segura.

- Body mode: `Using Raw Body`
- Content-Type: `application/json`
- Raw Body:

```javascript
={{ JSON.stringify({
  run_id: $json.run_id,
  client_id: $json.client_id ?? null,
  ad_account_id: $json.ad_account_id ?? null,
  stage: $json.stage,
  error_code: $json.error_code ?? null,
  error_message: $json.error_message,
  raw_payload: $json.raw_payload ?? null,
}) }}
```

### `Code - Build Upsert Error Record`

Reemplaza el código completo.

```javascript
const body = $json.body ?? null;

return [
  {
    json: {
      run_id: $json.run_id,
      client_id: $json.client_id,
      ad_account_id: $json.ad_account_id,
      snapshot: $json.snapshot ?? null,
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

### `Code - Build Update Error Record`

Reemplaza el código completo.

```javascript
const body = $json.body ?? null;

return [
  {
    json: {
      run_id: $json.run_id,
      client_id: $json.client_id,
      ad_account_id: $json.ad_account_id,
      snapshot: $json.snapshot ?? null,
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

### `Code - Emit Failure Result`

Reemplaza el código completo.

```javascript
return [
  {
    json: {
      run_id: $json.run_id,
      client_id: $json.client_id ?? null,
      ad_account_id: $json.ad_account_id ?? null,
      snapshot: $json.snapshot ?? null,
      success: false,
      result: 'failed',
      stage: $json.stage,
      error_code: $json.error_code ?? null,
      error_message: $json.error_message ?? 'Unknown error',
    },
  },
];
```

### `Code - Emit Success Result`

Reemplaza el código completo.

```javascript
return [
  {
    json: {
      run_id: $json.run_id,
      client_id: $json.client_id,
      ad_account_id: $json.ad_account_id,
      snapshot: $json.snapshot ?? null,
      success: true,
      result: 'success',
      stage: 'completed',
      error_code: null,
      error_message: null,
    },
  },
];
```

### `Code - Aggregate Account Results`

Reemplaza el código completo. Ya no usa referencias a otros nodos.

```javascript
const items = $input.all().map((item) => item.json);

if (items.length === 0) {
  throw new Error('Aggregate Account Results received no account results');
}

const first = items[0];
const snapshot = first.snapshot ?? {};
const totalAccounts = items.length;
const successItems = items.filter((item) => item.success === true);
const failedItems = items.filter((item) => item.success !== true);

let status = 'success';
if (failedItems.length > 0 && successItems.length > 0) status = 'partial_success';
if (failedItems.length > 0 && successItems.length === 0) status = 'failed';

return [
  {
    json: {
      run_id: first.run_id,
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
        workflow: snapshot.workflow_name ?? null,
        date_start: snapshot.date_start ?? null,
        date_stop: snapshot.date_stop ?? null,
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

### `HTTP - Finalize Import Run`

Mantén URL, headers y opciones. Cambia solo el body a forma segura.

- Body mode: `Using Raw Body`
- Content-Type: `application/json`
- Raw Body:

```javascript
={{ JSON.stringify({
  finished_at: $json.finished_at,
  status: $json.status,
  total_accounts: $json.total_accounts,
  success_accounts: $json.success_accounts,
  failed_accounts: $json.failed_accounts,
  notes: $json.notes,
  metadata: $json.metadata,
}) }}
```

## 5. Qué validar después de aplicar este delta

- `Code - Attach Run Context To Accounts` ya no usa `$('Node').first()` ni `$node[...]`
- `Code - Aggregate Account Results` ya no usa `$('Node').first()` ni `$node[...]`
- todas las ramas de éxito y error siguen cargando `run_id` y `snapshot`
- todos los HTTP con body usan `Raw Body + JSON.stringify(...)`
- `HTTP - Upsert ad_metrics` no envía `run_id`, `snapshot` ni `import_run_id`
- `HTTP - Update ad_accounts.last_sync_at` sigue saliendo solo desde `IF - Upsert OK?` rama `true`
