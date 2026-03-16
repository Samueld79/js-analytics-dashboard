# Google Sheets Sales Integration

## Estado actual

- No existe integración real con Google Sheets en el repo.
- No hay servicio activo, credenciales, documento maestro ni sincronización automática.
- `daily_sales` sigue siendo la fuente real usada por la app para ventas reportadas.

## Decisión de arquitectura

- Un documento de Google Sheets por cliente.
- Cada documento pertenece solo a la empresa correspondiente.
- El sistema no debe leer ni escribir Google Sheets desde el frontend.
- La integración real debe hacerse después con una capa server-side segura:
  - Supabase Edge Function
  - n8n privado
  - o servicio backend con cuenta de servicio de Google

## Contrato mínimo del documento

- Nombre sugerido:
  - `Growth Strategy JS - Ventas - {Cliente}`
- Hoja principal sugerida:
  - `ventas`
- Columnas esperadas:
  - `fecha`
  - `empresa`
  - `ventas_totales`
  - `nuevo_cliente`
  - `recompra`
  - `punto_fisico`
  - `online`
  - `observaciones`
  - `mes`
  - `responsable`

## Mapeo esperado hacia `daily_sales`

- `fecha` -> `daily_sales.date`
- `ventas_totales` -> `daily_sales.total_sales`
- `nuevo_cliente` -> `daily_sales.new_client_sales`
- `recompra` -> `daily_sales.repeat_sales`
- `punto_fisico` -> `daily_sales.physical_store_sales`
- `online` -> `daily_sales.online_sales`
- `observaciones` -> `daily_sales.observations`

## Reglas operativas

- Una fila por fecha y cliente.
- La suma `nuevo_cliente + recompra` debería coincidir con `ventas_totales`.
- La suma `punto_fisico + online` debería coincidir con `ventas_totales`.
- El dato validado que usa la app sigue quedando en Supabase, no en la hoja.

## Lo que falta para conexión real

- Crear el documento de Google Sheets por cada cliente.
- Compartir cada hoja con la cuenta de servicio o credencial técnica que vaya a sincronizar.
- Definir dónde se guardará el `spreadsheet_id` por cliente.
- Implementar el sincronizador server-side hacia `daily_sales`.

## Qué no se hizo en esta pasada

- No se agregaron credenciales de Google al repo.
- No se implementó acceso directo desde el navegador.
- No se creó sincronización falsa ni mocks disfrazados de integración final.
