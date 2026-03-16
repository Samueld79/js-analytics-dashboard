# Agency OS / js-analytics-dashboard

Dashboard operativo interno + workspace por cliente para Agency OS.

Hoy el proyecto corre sobre Supabase, usa autenticacion real con Supabase Auth y consume datos operativos reales, incluyendo Meta Ads multi-cuenta.

## Estado actual

- frontend: Vite + React + TypeScript
- backend/data: Supabase
- auth: Supabase Auth
- deploy web: Vercel
- datos operativos: Supabase
- Meta Ads: flujo real multi-cuenta activo en n8n

Este repo ya no esta basado en un dashboard estatico de JSON. La fuente operativa actual es Supabase.

## Que hace hoy

- dashboard interno para equipo Agency OS
- workspace restringido por cliente
- KPIs operativos diarios y mensuales
- estado de sync Meta por cliente
- health score, issues, alerts y tareas
- estrategias, ventas y memoria operativa

## Roles

- `internos`
  Acceden al dashboard general, clientes, ventas, estrategias, alertas, AI y configuracion.
- `clientes`
  Acceden solo a su espacio asignado y a la ruta `/mi-espacio`.

## Rutas importantes

- `/`
  Home segun rol. Internos ven dashboard general. Clientes son redirigidos a su espacio.
- `/clients/:id`
  Workspace del cliente. Internos ven cualquier cliente permitido. Clientes solo su empresa asignada.
- `/mi-espacio`
  Entrada corta para usuarios cliente. Redirige al cliente asignado.

## Flujo de datos operativo

- `public.ad_accounts`
  Catalogo de cuentas Meta por cliente.
- `public.ad_metrics`
  Base diaria/snapshot de Ads. El flujo real de Meta escribe aqui.
- `public.daily_sales`
  Ventas diarias por cliente.
- `public.v_client_daily_operating_kpis`
- `public.v_client_monthly_operating_kpis`

La app consulta Supabase y las vistas SQL operativas. Los acumulados y KPIs MTD no se calculan desde un JSON local; se resuelven por vistas SQL.

Meta Ads hoy funciona asi:
- n8n lista cuentas activas desde `ad_accounts`
- consulta Meta Insights por cuenta
- normaliza metricas
- hace `upsert` en `ad_metrics`
- actualiza `ad_accounts.last_sync_at`

## Variables de entorno

Para correr el frontend local solo hacen falta:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Puedes copiar `.env.example` a `.env.local` y completar esos valores.

No expongas en frontend:
- `SUPABASE_SERVICE_ROLE`
- tokens de Meta
- secretos de terceros

## Correr local

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## SQL relevante

- [supabase/schema.sql](/Users/samueldiaz/js-analytics-dashboard/supabase/schema.sql)
- [supabase/phase-1-operating-views.sql](/Users/samueldiaz/js-analytics-dashboard/supabase/phase-1-operating-views.sql)

## Documentacion operativa

- [docs/meta-ads-operating-runbook.md](/Users/samueldiaz/js-analytics-dashboard/docs/meta-ads-operating-runbook.md)
- [docs/n8n-meta-daily-import-contract.md](/Users/samueldiaz/js-analytics-dashboard/docs/n8n-meta-daily-import-contract.md)
- [docs/n8n-meta-ads-sync-all-active-accounts-spec.md](/Users/samueldiaz/js-analytics-dashboard/docs/n8n-meta-ads-sync-all-active-accounts-spec.md)
- [docs/n8n-meta-ads-sync-incremental-hardening-plan.md](/Users/samueldiaz/js-analytics-dashboard/docs/n8n-meta-ads-sync-incremental-hardening-plan.md)
- [docs/n8n-meta-ads-sync-incremental-hardening-plan-delta.md](/Users/samueldiaz/js-analytics-dashboard/docs/n8n-meta-ads-sync-incremental-hardening-plan-delta.md)

Nota:
- los docs de `hardening` describen endurecimiento pendiente de n8n
- no deben leerse como si `ad_import_runs` y `ad_import_errors` ya fueran obligatorios en el flujo activo actual

## Vercel

Vercel despliega el contenido que este pusheado al repo y a la branch conectada al proyecto.

Cosas importantes:
- cambios locales en tu maquina no aparecen en Vercel
- para que Vercel muestre cambios, necesitas `commit + push`
- si el proyecto en Vercel apunta a otra branch, debes pushear a esa branch o cambiar la branch conectada
- si cambias variables de entorno en Vercel, necesitas redeploy

Flujo normal:

```bash
git add .
git commit -m "docs: update project state"
git push origin <branch-conectada-a-vercel>
```

Despues del push:
- GitHub recibe el commit
- Vercel detecta el cambio en la branch conectada
- Vercel ejecuta build y publica ese commit

Si Vercel no muestra cambios:
- revisa que hiciste push
- revisa la branch conectada en Vercel
- revisa el log del deploy
- revisa variables de entorno del proyecto en Vercel
