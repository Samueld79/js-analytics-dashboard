# Agency OS Blueprint

Blueprint operativo sobre el repo actual para pasar de dashboard demo a sistema interno modular.

## 1. Schema SQL Final

Fuente de verdad: [supabase/schema.sql](/Users/samueldiaz/js-analytics-dashboard/supabase/schema.sql)

Decisiones aplicadas:
- Se conservaron nombres ya usados por el frontend actual: `clients`, `ad_metrics`, `daily_sales`, `strategies`, `tasks`, `alerts`, `client_memory`.
- Se agregaron tablas nuevas para cerrar el sistema operativo: `client_memberships`, `ad_accounts`, `ad_import_runs`, `strategy_history`, `client_files`, `client_notes`, `memory_entries`, `activity_log`.
- `JSONB` solo queda en estructuras flexibles: campañas, segmentación, creativos, links Drive, checklist IA, metadata de alertas/imports y snapshots/versiones.
- Se añadieron vistas para dashboard y workspace: `v_client_daily_operating_kpis` y `v_client_monthly_operating_kpis`.
- RLS queda básico pero funcional: equipo interno con acceso total, clientes solo a sus clientes asignados, y clientes pueden registrar ventas de su propio cliente.

## 2. Mapa de Pantallas

### Navegación global

- `/`
  Qué es: dashboard principal de operación.
  Qué muestra: KPIs 30d, clientes en riesgo, alertas, tareas, ranking y resumen general.

- `/clients`
  Qué es: directorio de clientes.
  Qué muestra: estado, nicho, ciudad, cuenta principal, accesos rápidos al workspace.

- `/clients/:id`
  Qué es: workspace por cliente.
  Qué muestra: todo el contexto operativo del cliente en una sola vista.
  Tabs objetivo:
  - `Resumen`
  - `Ads`
  - `Ventas`
  - `Estrategias`
  - `Tareas y Alertas`
  - `Archivos`
  - `IA`
  - `Notas`

- `/metrics`
  Qué es: vista global de ads.
  Qué muestra: consolidado por cliente, detalle diario, comparativos.

- `/sales`
  Qué es: vista global de ventas.
  Qué muestra: resumen por cliente y seguimiento de cumplimiento de registro diario.

- `/strategies`
  Qué es: tablero global de estrategias.
  Qué muestra: pipeline `pendiente > montada > revisada > aprobada`, presupuesto, responsable y acceso a detalle.

- `/alerts`
  Qué es: centro de alertas.
  Qué muestra: alertas operativas, técnicas y comerciales, con acciones y resolución.

- `/ai`
  Qué es: interfaz global del copiloto.
  Qué muestra: estructuración estratégica y consultas de memoria por cliente.

- `/settings`
  Qué es: configuración técnica.
  Qué muestra: conexión Supabase, cuentas Meta, estado de integraciones y roles.

### Qué ve cada rol

| Rol | Dashboard | Clientes | Workspace cliente | Ads | Ventas | Estrategias | Tareas/Alertas | Archivos | IA |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `admin` | Completo | Completo | Completo | Completo | Completo | Completo | Completo | Completo | Completo |
| `team` | Completo | Completo | Completo | Completo | Completo | Completo | Completo | Completo | Completo |
| `strategist` | Completo | Asignados | Asignados | Lectura | Lectura | Crear/editar | Lectura + seguimiento | Lectura/escritura | Completo |
| `operator` | Completo | Asignados | Asignados | Completo | Lectura + carga | Lectura + cambio de estado | Completo | Lectura/escritura | Estructurar/consultar |
| `partner` | Completo | Completo | Completo | Completo | Lectura | Completo | Completo | Completo | Completo |
| `client` | Solo sus clientes | No aplica | Solo su cliente | Resumen | Cargar ventas + ver histórico propio | Solo estrategias compartidas | Solo alertas compartidas | Solo archivos compartidos | No en MVP |

### Mapa sobre archivos actuales

- Reutilizar como shell:
  - [src/App.tsx](/Users/samueldiaz/js-analytics-dashboard/src/App.tsx)
  - [src/components/Sidebar.tsx](/Users/samueldiaz/js-analytics-dashboard/src/components/Sidebar.tsx)
  - [src/pages/DashboardPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/DashboardPage.tsx)
  - [src/pages/ClientsPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/ClientsPage.tsx)
  - [src/pages/ClientDetailPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/ClientDetailPage.tsx)
  - [src/pages/MetricsPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/MetricsPage.tsx)
  - [src/pages/AlertsPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/AlertsPage.tsx)
  - [src/components/SalesModal.tsx](/Users/samueldiaz/js-analytics-dashboard/src/components/SalesModal.tsx)

- Reemplazar funcionalmente:
  - [src/hooks/useData.ts](/Users/samueldiaz/js-analytics-dashboard/src/hooks/useData.ts)
  - [src/lib/mockData.ts](/Users/samueldiaz/js-analytics-dashboard/src/lib/mockData.ts)
  - [src/pages/StrategiesPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/StrategiesPage.tsx)
  - [src/pages/AIAgentPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/AIAgentPage.tsx)
  - [src/lib/supabase.ts](/Users/samueldiaz/js-analytics-dashboard/src/lib/supabase.ts)

## 3. Backlog Técnico por Fases

### Fase 0 — Base operativa

Prioridad real:
1. Aplicar el schema final en Supabase.
2. Configurar `auth`, `user_profiles`, `client_memberships` y 2-3 usuarios internos.
3. Crear clientes reales y `ad_accounts`.
4. Reemplazar el modo `mock` por una capa de servicios sobre Supabase.
5. Conectar dashboard y workspace de cliente a datos reales.

Entregables:
- DB lista.
- Auth lista.
- Datos reales visibles en UI sin mocks.
- Query layer estable.

### Fase 1 — Datos core del negocio

Prioridad real:
1. Registro de ventas diario con `upsert`.
2. Import diario de Meta Ads con n8n.
3. Vistas SQL para cruzar inversión, ventas y ROAS real.
4. Dashboard principal con KPIs reales.
5. Workspace cliente con tabs `Resumen`, `Ads`, `Ventas`.

Entregables:
- Inversión diaria automática.
- Ventas manuales simples.
- Cruce inversión vs ventas.
- Alertas mínimas de operación.

### Fase 2 — Sistema operativo interno

Prioridad real:
1. CRUD real de estrategias.
2. Historial de versiones en `strategy_history`.
3. Tareas automáticas desde checklist.
4. Centro de alertas con resolución.
5. Módulo de archivos/Drive.
6. Bitácora con `client_notes`.

Entregables:
- Estrategias ya no viven en WhatsApp.
- Hay trazabilidad y estado.
- Hay recordatorios reales de operación.

### Fase 3 — Copiloto IA y memoria

Prioridad real:
1. Edge Function `ai-structure-strategy`.
2. Edge Function `ai-query-client`.
3. Snapshot `client_memory`.
4. `memory_entries` por estrategia, nota y aprendizaje.
5. Consulta contextual por cliente.

Entregables:
- Texto libre -> estrategia estructurada.
- Resumen y checklist.
- Memoria útil por cliente.
- Comparación contra estrategia previa.

## 4. MVP Exacto a Construir Primero sobre este Repo

### Qué construir primero

Primer MVP real:
1. `Supabase schema + auth + clientes + ad_accounts`
2. `ventas manuales reales`
3. `dashboard y workspace cliente leyendo Supabase`
4. `import diario Meta Ads vía n8n`
5. `alertas mínimas`

No meter IA ni archivos antes de cerrar esto.

### Qué archivos reutilizar

- [src/pages/DashboardPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/DashboardPage.tsx)
  Reutilizar layout y jerarquía visual. Cambiar queries a vistas SQL y servicios.

- [src/pages/ClientDetailPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/ClientDetailPage.tsx)
  Reutilizar como shell del workspace cliente. Extender tabs y mover la obtención de datos a servicios.

- [src/components/SalesModal.tsx](/Users/samueldiaz/js-analytics-dashboard/src/components/SalesModal.tsx)
  Reutilizar como base del registro diario. Agregar validación suave y estado de envío.

- [src/pages/MetricsPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/MetricsPage.tsx)
  Reutilizar como consolidado de ads.

- [src/pages/AlertsPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/AlertsPage.tsx)
  Reutilizar como inbox operativo.

- [src/components/Sidebar.tsx](/Users/samueldiaz/js-analytics-dashboard/src/components/Sidebar.tsx)
  Reutilizar navegación general.

### Qué archivos reemplazar

- [src/hooks/useData.ts](/Users/samueldiaz/js-analytics-dashboard/src/hooks/useData.ts)
  Reemplazar por hooks delgados que llamen una capa `src/services/*`.

- [src/lib/mockData.ts](/Users/samueldiaz/js-analytics-dashboard/src/lib/mockData.ts)
  Mantener solo para fallback temporal local; dejar de ser fuente principal.

- [src/lib/supabase.ts](/Users/samueldiaz/js-analytics-dashboard/src/lib/supabase.ts)
  Expandir tipos para nuevas tablas y vistas.

- [src/pages/StrategiesPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/StrategiesPage.tsx)
  Mantener UI general pero pasar a CRUD real.

- [src/pages/AIAgentPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/AIAgentPage.tsx)
  Dejar solo como shell visual en MVP; sin lógica real hasta fase 3.

### Qué módulos dejar en espera

- Portal cliente externo.
- WhatsApp y Telegram.
- Embeddings y búsqueda semántica.
- Breakdown por campaña/anuncio.
- Automatización de publicación en Meta.
- Biblioteca avanzada de creativos.

### Servicios y endpoints a crear primero

Servicios frontend:
- `src/services/clients.ts`
- `src/services/dashboard.ts`
- `src/services/adMetrics.ts`
- `src/services/dailySales.ts`
- `src/services/alerts.ts`
- `src/services/tasks.ts`

Hooks frontend:
- `src/hooks/useClients.ts`
- `src/hooks/useClientWorkspace.ts`
- `src/hooks/useDashboard.ts`
- `src/hooks/useDailySales.ts`
- `src/hooks/useAlerts.ts`

Edge functions a crear primero:
- `supabase/functions/ai-structure-strategy`
- `supabase/functions/ai-query-client`

Nota:
- El import de Meta Ads no necesita endpoint custom en el MVP; n8n puede escribir directo a Supabase con service role.

## 5. Diseño Inicial del Flujo n8n

### Workflow 1 — Import diario Meta Ads 6:00 am

Nombre sugerido: `meta_daily_import`

Secuencia:
1. `Cron`
   Hora: `06:05`
   Zona: `America/Bogota`

2. `Supabase -> Select ad_accounts`
   Filtro: `status = active` y `platform = meta`

3. `Create import run`
   Inserta en `ad_import_runs`:
   - `run_date = hoy`
   - `date_from = ayer`
   - `date_to = ayer`
   - `status = running`

4. `Split in Batches`
   Iterar una cuenta por vez.

5. `HTTP Request -> Meta Ads Insights API`
   Pedir:
   - `date_preset` o `since/until` = día anterior
   - métricas mínimas del MVP:
     `spend`, `reach`, `impressions`, `clicks`, `cpm`, `cpc`, `ctr`
   - acciones para derivar:
     `messages`, `leads`, `purchases`, `purchase_value`

6. `Code node -> Normalize`
   Salida por cuenta:
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
   - `raw_actions`
   - `import_run_id`

7. `Validation node`
   Reglas:
   - si falta `client_id`, crear alerta crítica y saltar la fila
   - si falta `ad_account_id`, crear alerta crítica y saltar la fila
   - si la fecha no es la esperada, marcar error
   - si vienen números negativos, descartar y alertar

8. `Supabase -> Upsert ad_metrics`
   Clave única:
   - `client_id`
   - `ad_account_id`
   - `date`

9. `Supabase -> Update ad_accounts`
   Actualizar `last_sync_at`

10. `Finalize import run`
   Si todo bien: `status = completed`
   Si algunas cuentas fallan: `status = partial`
   Si todo falla: `status = failed`

### Workflow 2 — Alertas automáticas post-import

Nombre sugerido: `agency_alert_rules`

Hora:
- `06:20` o al terminar el workflow 1

Reglas MVP:
- `optimize_every_5_days`
  Condición: `clients.last_optimization_at <= now() - interval '5 days'`
  Acción: crear `alert` warning y `task` de optimización.

- `missing_sales_yesterday`
  Condición: cliente activo sin fila en `daily_sales` para ayer
  Acción: crear `alert` warning.

- `import_failed`
  Condición: `ad_import_runs.status = failed`
  Acción: `alert` critical.

- `roas_drop`
  Condición: `real_roas` o `ad_roas` de ayer cae fuerte vs promedio 7d
  Acción: `alert` critical.

- `high_roas_scale_review`
  Condición: ROAS superior al umbral del cliente
  Acción: `alert` info.

### Manejo de errores

- Reintentos por cuenta: `2`
- Si Meta responde `rate limit`, esperar y reintentar
- Si una cuenta falla, no cortar todo el job
- Si el job completo falla, dejar `ad_import_runs.status = failed`
- Si el job queda `partial`, registrar `error_message` y `metadata`
- Crear siempre alerta técnica si el job no termina correctamente antes de `06:45`

## 6. Diseño Inicial del Agente IA

### Objetivo del primer agente real

No chat genérico.

Dos capacidades:
1. `structure_strategy`
2. `query_client_memory`

### Inputs

#### `ai-structure-strategy`

Entrada:
- `client_id`
- `raw_input`
- `user_id`
- `month`
- `strategy_id` opcional si es edición

Contexto cargado por la función:
- cliente
- `client_memory`
- última estrategia aprobada
- últimas notas relevantes

#### `ai-query-client`

Entrada:
- `client_id`
- `question`
- `user_id`

Contexto cargado:
- `client_memory`
- últimas 3 estrategias
- `memory_entries` más relevantes
- últimas notas operativas

### Outputs

#### Salida de `ai-structure-strategy`

```json
{
  "title": "Estrategia Abril 2026 - Cliente",
  "ai_summary": "Resumen ejecutivo",
  "campaigns_new": [],
  "campaigns_off": [],
  "campaigns_optimize": [],
  "segmentation": {},
  "creatives": [],
  "drive_links": [],
  "ai_checklist": [],
  "ai_diff": "Cambios frente a la anterior",
  "notes": "Observaciones operativas",
  "memory_updates": []
}
```

#### Salida de `ai-query-client`

```json
{
  "answer": "Respuesta corta y accionable",
  "used_context": [
    "strategy:uuid",
    "memory_entry:uuid"
  ],
  "suggested_actions": []
}
```

### Memoria por cliente

Dos capas:

- `client_memory`
  Snapshot resumido del cliente.
  Qué guarda:
  - nicho
  - ciudades
  - objetivos frecuentes
  - públicos históricos
  - campañas históricas
  - patrones creativos
  - notas recurrentes
  - aprendizajes

- `memory_entries`
  Hechos atómicos e históricos.
  Qué guarda:
  - audiencia usada
  - aprendizaje confirmado
  - patrón creativo
  - warning recurrente
  - resumen de estrategia aprobada

Regla operativa:
- Solo actualizar el snapshot `client_memory` desde estrategias aprobadas, notas importantes y aprendizajes confirmados.
- No meter cualquier conversación suelta en memoria canónica.

### Cómo se conecta con estrategias

Flujo:
1. Usuario entra a [src/pages/AIAgentPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/AIAgentPage.tsx) o al tab `IA` del cliente.
2. Selecciona cliente.
3. Pega texto libre.
4. Frontend llama `ai-structure-strategy`.
5. La función devuelve estructura editable.
6. El usuario revisa y guarda en `strategies`.
7. Al guardar o aprobar:
   - crear snapshot en `strategy_history`
   - crear `tasks` desde `ai_checklist`
   - actualizar `client_memory`
   - insertar `memory_entries`

### Conexión exacta con el repo actual

- Mantener [src/pages/AIAgentPage.tsx](/Users/samueldiaz/js-analytics-dashboard/src/pages/AIAgentPage.tsx) como interfaz.
- Quitar mocks locales y reemplazar por llamadas a Edge Functions.
- En `StrategiesPage`, agregar acción `Crear con IA`.
- En `ClientDetailPage`, agregar tab `IA` y tab `Archivos`.

## Secuencia de Ejecución Recomendada

1. Aplicar [supabase/schema.sql](/Users/samueldiaz/js-analytics-dashboard/supabase/schema.sql)
2. Reemplazar `useData.ts` por capa `services + hooks`
3. Conectar ventas reales
4. Conectar dashboard y workspace
5. Montar n8n Meta import
6. Activar alertas automáticas
7. Entrar a estrategias CRUD
8. Entrar a IA
