# Meta Ads Sync - All Active Accounts

Especificación endurecida para n8n Cloud. Mantiene la lógica ya validada y agrega trazabilidad con `ad_import_runs` y `ad_import_errors`.

Nota de esquema:
- `public.ad_metrics` se mantiene sin cambios.
- Este workflow no escribe `import_run_id` en `ad_metrics`.
- La trazabilidad del job vive por separado en `ad_import_runs` y `ad_import_errors`.

## Placeholders obligatorios

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`
- `META_ACCESS_TOKEN`

Nota:
- En el nodo de Meta, conserva la misma versión de Graph API que ya tienes validada en tu workflow actual. No la cambio aquí para no romper una integración que ya corre.

## Estructura del workflow

1. `Schedule Trigger`
2. `Code - Init Snapshot Window`
3. `HTTP - Create Import Run`
4. `Code - Extract Run Row`
5. `HTTP - Fetch Active Meta Accounts`
6. `Code - Attach Run Context To Accounts`
7. `IF - Has Active Accounts?`
8. `Code - Build Zero Summary`
9. `Loop Over Items - One Account At A Time`
10. `HTTP - Meta Insights`
11. `Merge - Account + Meta Response`
12. `IF - Meta Request OK?`
13. `Code - Normalize Metrics`
14. `IF - Skip Upsert?`
15. `Code - Build Normalize Error Record`
16. `Code - Build Upsert Payload`
17. `HTTP - Upsert ad_metrics`
18. `Merge - Upsert Context + Response`
19. `IF - Upsert OK?`
20. `Code - Build Upsert Error Record`
21. `HTTP - Update ad_accounts.last_sync_at`
22. `Merge - Update Context + Response`
23. `IF - Update Account OK?`
24. `Code - Build Update Error Record`
25. `Code - Build Meta Error Record`
26. `HTTP - Insert Import Error`
27. `Code - Emit Failure Result`
28. `Code - Emit Success Result`
29. `Code - Aggregate Account Results`
30. `HTTP - Finalize Import Run`

## Conexiones

```text
Schedule Trigger
  -> Code - Init Snapshot Window
  -> HTTP - Create Import Run
  -> Code - Extract Run Row
  -> HTTP - Fetch Active Meta Accounts
  -> Code - Attach Run Context To Accounts
  -> IF - Has Active Accounts?

IF - Has Active Accounts? (false)
  -> Code - Build Zero Summary
  -> HTTP - Finalize Import Run

IF - Has Active Accounts? (true)
  -> Loop Over Items - One Account At A Time

Loop Over Items
  -> HTTP - Meta Insights
Loop Over Items
  -> Merge - Account + Meta Response (Input 1)
HTTP - Meta Insights
  -> Merge - Account + Meta Response (Input 2)

Merge - Account + Meta Response
  -> IF - Meta Request OK?

IF - Meta Request OK? (false)
  -> Code - Build Meta Error Record
Code - Build Meta Error Record
  -> HTTP - Insert Import Error
Code - Build Meta Error Record
  -> Code - Emit Failure Result
Code - Emit Failure Result
  -> Loop Over Items

IF - Meta Request OK? (true)
  -> Code - Normalize Metrics
Code - Normalize Metrics
  -> IF - Skip Upsert?

IF - Skip Upsert? (true)
  -> Code - Build Normalize Error Record
Code - Build Normalize Error Record
  -> HTTP - Insert Import Error
Code - Build Normalize Error Record
  -> Code - Emit Failure Result
Code - Emit Failure Result
  -> Loop Over Items

IF - Skip Upsert? (false)
  -> Code - Build Upsert Payload
Code - Build Upsert Payload
  -> HTTP - Upsert ad_metrics
Code - Build Upsert Payload
  -> Merge - Upsert Context + Response (Input 1)
HTTP - Upsert ad_metrics
  -> Merge - Upsert Context + Response (Input 2)

Merge - Upsert Context + Response
  -> IF - Upsert OK?

IF - Upsert OK? (false)
  -> Code - Build Upsert Error Record
Code - Build Upsert Error Record
  -> HTTP - Insert Import Error
Code - Build Upsert Error Record
  -> Code - Emit Failure Result
Code - Emit Failure Result
  -> Loop Over Items

IF - Upsert OK? (true)
  -> HTTP - Update ad_accounts.last_sync_at
Merge - Upsert Context + Response
  -> Merge - Update Context + Response (Input 1)
HTTP - Update ad_accounts.last_sync_at
  -> Merge - Update Context + Response (Input 2)

Merge - Update Context + Response
  -> IF - Update Account OK?

IF - Update Account OK? (false)
  -> Code - Build Update Error Record
Code - Build Update Error Record
  -> HTTP - Insert Import Error
Code - Build Update Error Record
  -> Code - Emit Failure Result
Code - Emit Failure Result
  -> Loop Over Items

IF - Update Account OK? (true)
  -> Code - Emit Success Result
Code - Emit Success Result
  -> Loop Over Items

Loop Over Items (done output)
  -> Code - Aggregate Account Results
  -> HTTP - Finalize Import Run
```

## Configuración exacta por nodo

### 1) Schedule Trigger

- Tipo: `Schedule Trigger`
- Timezone: `America/Bogota`
- Frecuencia: diaria
- Hora: `06:05`

### 2) Code - Init Snapshot Window

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

### 3) HTTP - Create Import Run

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

### 4) Code - Extract Run Row

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

### 5) HTTP - Fetch Active Meta Accounts

- Tipo: `HTTP Request`
- Method: `GET`
- URL:

```text
{{SUPABASE_URL}}/rest/v1/ad_accounts?select=id,client_id,meta_account_id,name,currency_code,timezone,platform,status&platform=eq.meta&status=eq.active&order=name.asc
```

- Response Format: `JSON`
- Options:
  - `Never Error = true`
  - `Include Response Headers and Status = true`
- Headers:
  - `apikey: {{SUPABASE_SERVICE_ROLE}}`
  - `Authorization: Bearer {{SUPABASE_SERVICE_ROLE}}`

### 6) Code - Attach Run Context To Accounts

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

### 7) IF - Has Active Accounts?

- Tipo: `IF`
- Condición:

```javascript
{{$json.has_accounts === true}}
```

- `true` -> `Loop Over Items - One Account At A Time`
- `false` -> `Code - Build Zero Summary`

### 8) Code - Build Zero Summary

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

### 9) Loop Over Items - One Account At A Time

- Tipo: `Loop Over Items`
- Batch Size: `1`
- Reset: `false`

### 10) HTTP - Meta Insights

- Tipo: `HTTP Request`
- Method: `GET`
- URL:

```text
https://graph.facebook.com/<KEEP_CURRENT_VALIDATED_GRAPH_VERSION>/{{$json.account.meta_account_id}}/insights
```

- Query Params:
  - `access_token = {{META_ACCESS_TOKEN}}`
  - `level = account`
  - `fields = spend,reach,impressions,clicks,cpm,cpc,ctr,frequency,actions,action_values`
  - `time_range = {{ JSON.stringify({ since: $json.snapshot.date_start, until: $json.snapshot.date_stop }) }}`
- Response Format: `JSON`
- Options:
  - `Never Error = true`
  - `Include Response Headers and Status = true`
  - `Retry On Fail = true`
  - `Max Tries = 3`
  - `Wait Between Tries = 1500 ms`

### 11) Merge - Account + Meta Response

- Tipo: `Merge`
- Mode: `Combine`
- Combine By: `Position`
- Input 1: item original del loop
- Input 2: respuesta de Meta

### 12) IF - Meta Request OK?

- Tipo: `IF`
- Condición:

```javascript
{{Number($json.statusCode) >= 200 && Number($json.statusCode) < 300}}
```

- `true` -> `Code - Normalize Metrics`
- `false` -> `Code - Build Meta Error Record`

### 13) Code - Normalize Metrics

- Tipo: `Code`
- Mode: `Run Once for Each Item`
- Código:

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

### 14) IF - Skip Upsert?

- Tipo: `IF`
- Condición:

```javascript
{{$json.skip_upsert === true}}
```

- `true` -> `Code - Build Normalize Error Record`
- `false` -> `Code - Build Upsert Payload`

### 15) Code - Build Normalize Error Record

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

### 16) Code - Build Upsert Payload

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

### 17) HTTP - Upsert ad_metrics

- Tipo: `HTTP Request`
- Method: `POST`
- URL:

```text
{{SUPABASE_URL}}/rest/v1/ad_metrics?on_conflict=client_id,ad_account_id,date
```

- Response Format: `JSON`
- Options:
  - `Never Error = true`
  - `Include Response Headers and Status = true`
- Headers:
  - `apikey: {{SUPABASE_SERVICE_ROLE}}`
  - `Authorization: Bearer {{SUPABASE_SERVICE_ROLE}}`
  - `Content-Type: application/json`
  - `Prefer: resolution=merge-duplicates,return=representation`
- Body JSON:

```json
{
  "client_id": "={{$json.client_id}}",
  "ad_account_id": "={{$json.ad_account_id}}",
  "date": "={{$json.date}}",
  "spend": ={{$json.spend}},
  "reach": ={{$json.reach}},
  "impressions": ={{$json.impressions}},
  "clicks": ={{$json.clicks}},
  "cpm": ={{$json.cpm}},
  "cpc": ={{$json.cpc}},
  "ctr": ={{$json.ctr}},
  "messages": ={{$json.messages}},
  "leads": ={{$json.leads}},
  "purchases": ={{$json.purchases}},
  "purchase_value": ={{$json.purchase_value}},
  "roas": ={{$json.roas}},
  "cpr": ={{$json.cpr}},
  "cpl": ={{$json.cpl}},
  "cpa": ={{$json.cpa}},
  "frequency": ={{$json.frequency}},
  "raw_actions": ={{$json.raw_actions}},
  "source": "={{$json.source}}"
}
```

### 18) Merge - Upsert Context + Response

- Tipo: `Merge`
- Mode: `Combine`
- Combine By: `Position`
- Input 1: `Code - Build Upsert Payload`
- Input 2: `HTTP - Upsert ad_metrics`

### 19) IF - Upsert OK?

- Tipo: `IF`
- Condición:

```javascript
{{Number($json.statusCode) >= 200 && Number($json.statusCode) < 300}}
```

- `true` -> `HTTP - Update ad_accounts.last_sync_at`
- `false` -> `Code - Build Upsert Error Record`

### 20) Code - Build Upsert Error Record

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

### 21) HTTP - Update ad_accounts.last_sync_at

- Tipo: `HTTP Request`
- Method: `PATCH`
- URL:

```text
{{SUPABASE_URL}}/rest/v1/ad_accounts?id=eq.{{$json.ad_account_id}}
```

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
  "last_sync_at": "={{$now.toISO()}}"
}
```

### 22) Merge - Update Context + Response

- Tipo: `Merge`
- Mode: `Combine`
- Combine By: `Position`
- Input 1: `Merge - Upsert Context + Response`
- Input 2: `HTTP - Update ad_accounts.last_sync_at`

### 23) IF - Update Account OK?

- Tipo: `IF`
- Condición:

```javascript
{{Number($json.statusCode) >= 200 && Number($json.statusCode) < 300}}
```

- `true` -> `Code - Emit Success Result`
- `false` -> `Code - Build Update Error Record`

### 24) Code - Build Update Error Record

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

### 25) Code - Build Meta Error Record

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

### 26) HTTP - Insert Import Error

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

### 27) Code - Emit Failure Result

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

### 28) Code - Emit Success Result

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

### 29) Code - Aggregate Account Results

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

### 30) HTTP - Finalize Import Run

- Tipo: `HTTP Request`
- Method: `PATCH`
- URL:

```text
{{SUPABASE_URL}}/rest/v1/ad_import_runs?id=eq.{{$json.run_id}}
```

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

## Checklist de prueba

1. Ejecuta manualmente con 1 cuenta activa.
2. Verifica que `ad_import_runs` cree una fila en `running` y luego cierre en `success`.
3. Verifica que `ad_metrics` haga `upsert` con `on_conflict=client_id,ad_account_id,date`.
4. Verifica que el payload hacia `ad_metrics` no incluya `import_run_id`.
5. Verifica que `ad_accounts.last_sync_at` solo cambie cuando el upsert fue exitoso.
6. Fuerza un token inválido de Meta y confirma:
   - no se actualiza `last_sync_at`
   - se crea fila en `ad_import_errors`
   - el run termina `failed` o `partial_success`
7. Fuerza un payload inválido hacia Supabase y confirma que el error cae en `stage='upsert_ad_metrics'`.
8. Ejecuta con varias cuentas y confirma que el workflow sigue aunque una falle.
9. Ejecuta con cero cuentas activas y confirma que el run cierra en `success` con contadores en `0`.

## Referencias usadas

- Contrato del repo: `/Users/samueldiaz/js-analytics-dashboard/docs/n8n-meta-daily-import-contract.md`
- n8n Loop Over Items: https://docs.n8n.io/flow-logic/looping/
- n8n Code node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/
- n8n Merge node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.merge/
