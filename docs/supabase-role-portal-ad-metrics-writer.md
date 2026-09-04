# Rol restringido: `portal_ad_metrics_writer`

**Creado:** 2026-09-04
**Por qué existe:** una rutina externa (Claude Cowork) necesita insertar
filas *placeholder* (`spend=0`, `messages=0`) en `portal_ad_daily_metrics`
para los 9 anuncios fijos del portal de **Óptica Punto Lentes**
(`client_id = 5c3978a0-9338-5c29-8cdd-9833a4d0639b`). En vez de darle la
`anon key` (sin permiso de escritura) o la `service_role key` (acceso total
a toda la base de datos), se creó un rol de Postgres que solo puede hacer
esa única cosa.

Si estás leyendo esto en 6 meses y no sabes por qué existe este rol: es
por esto. Si la rutina de Claude Cowork ya no corre, este rol y su policy
se pueden borrar sin afectar nada más del sistema — no lo usa ningún otro
flujo.

El SQL que lo crea vive en
[`supabase/migrations/20260904_add_portal_ad_metrics_writer_role.sql`](../supabase/migrations/20260904_add_portal_ad_metrics_writer_role.sql).

## Qué puede hacer este rol, exactamente

Solo `INSERT` en `public.portal_ad_daily_metrics`, y solo si la fila
cumple **todas** estas condiciones a la vez (impuestas por RLS, no por
convención de la app — Postgres las rechaza aunque el llamador se
equivoque o esté comprometido):

| Columna | Restricción |
|---|---|
| `client_id` | exactamente `5c3978a0-9338-5c29-8cdd-9833a4d0639b` (Óptica) |
| `ad_id` | uno de los 9 fijos: `IMG_4705`, `IMG_4710`, `IMG_4712`, `AQOQ4zem`, `AQOXs0Ib`, `AQNSEJ8W`, `VD-1`, `VD-2`, `VD-3` |
| `date` | hoy, en zona horaria `America/Bogota` |
| `spend` | exactamente `0` |
| `messages` | exactamente `0` |

Además, el `GRANT INSERT` está a nivel de columna: solo puede escribir
`client_id, date, ad_id, ad_name, adset_name, campaign_name, messages,
spend, effective_status` — nunca `id`, `created_at` ni `updated_at`.

**No puede**, bajo ninguna circunstancia con este rol:
- Leer (`SELECT`), modificar (`UPDATE`) ni borrar (`DELETE`) nada en
  `portal_ad_daily_metrics`.
- Tocar ninguna otra tabla del proyecto (no tiene ningún `GRANT` sobre
  ninguna otra).
- Insertar spend o mensajes distintos de `0`, ni filas de otro cliente,
  otro anuncio, o de una fecha distinta a hoy.

Si el token de este rol se filtra, el peor caso es que alguien inserte
filas de $0 para estos 9 anuncios de Óptica en el día de hoy — nada más.

## Cómo obtener la API key / JWT de este rol

**Importante: yo no generé ni tengo esta key.** Los roles de Postgres en
Supabase no tienen una "API key" propia por defecto — la forma en que
PostgREST (la capa REST de Supabase) decide qué rol usar es leyendo el
claim `role` de un JWT firmado con el **JWT Secret** del proyecto.
`anon` y `service_role` son, técnicamente, solo JWTs pre-firmados con
`role: "anon"` y `role: "service_role"` respectivamente. Este rol nuevo
necesita su propio JWT firmado de la misma forma, con
`role: "portal_ad_metrics_writer"`.

Pasos:

1. **Entra a Supabase Dashboard → tu proyecto (`wwlnclellqcztrfizcpk`) →
   Settings → API.**
2. Busca la sección de **JWT Settings** (puede aparecer como "JWT Secret"
   o, en proyectos más nuevos, dentro de un panel separado **API Keys** —
   el nombre exacto varía según cuándo se creó el proyecto; si no la ves
   en "API", revisa si hay una pestaña "JWT Keys" o "Legacy JWT Secret").
3. Copia el **JWT Secret** del proyecto (una cadena larga, distinta de
   `anon` y de `service_role`).
   ⚠️ **No pegues ese secreto en un chat con Claude ni con ninguna otra
   herramienta** — con él se puede firmar un JWT con
   `role: "service_role"` y obtener acceso total a la base de datos. Es
   tan sensible como el `service_role key` mismo.
4. Con ese secreto, firma tú mismo (o quien administre las credenciales)
   un JWT HS256 con un payload como:
   ```json
   {
     "role": "portal_ad_metrics_writer",
     "iss": "supabase",
     "iat": 1767484800,
     "exp": 1799020800
   }
   ```
   Puedes hacerlo con [jwt.io](https://jwt.io) (pega el secreto solo en
   el campo de firma, en tu navegador — no lo envíes a ningún servidor
   de terceros) o con un script local de una línea usando la librería
   `jsonwebtoken` de Node:
   ```js
   require('jsonwebtoken').sign(
     { role: 'portal_ad_metrics_writer', iss: 'supabase' },
     'TU_JWT_SECRET',
     { expiresIn: '1y' },
   );
   ```
   Recomendado: expiración de ~1 año, con recordatorio para rotarla —
   no la dejes sin expiración.
5. Ese JWT es la "key" que le das a Claude Cowork. Se usa exactamente
   igual que la `anon key` en las llamadas REST:
   ```
   POST https://wwlnclellqcztrfizcpk.supabase.co/rest/v1/portal_ad_daily_metrics
   apikey: <ese JWT>
   Authorization: Bearer <ese JWT>
   Content-Type: application/json
   Prefer: return=minimal

   {
     "client_id": "5c3978a0-9338-5c29-8cdd-9833a4d0639b",
     "date": "2026-09-04",
     "ad_id": "IMG_4705",
     "ad_name": "IMG_4705",
     "adset_name": "Información",
     "campaign_name": null,
     "messages": 0,
     "spend": 0,
     "effective_status": null
   }
   ```

## Verificar que quedó bien restringido

Antes de dárselo a la rutina externa, prueba dos casos con esa key:

- **Debe funcionar:** el `INSERT` de arriba, con los valores exactos de
  la tabla de restricciones.
- **Debe fallar** (RLS lo debe rechazar): el mismo `INSERT` pero con
  `spend: 1`, o con un `client_id` distinto, o con `date` de ayer. Si
  cualquiera de estos pasa, algo quedó mal configurado — revisa la
  policy antes de usar la key en producción.

## Idempotencia (evitar filas duplicadas)

Si la rutina corre más de una vez el mismo día, usa
`Prefer: resolution=ignore-duplicates` en el header (o
`?on_conflict=client_id,date,ad_id` con `ON CONFLICT DO NOTHING`) para
que una segunda corrida no falle por duplicado — este rol no tiene
permiso de `UPDATE`, así que un `ON CONFLICT ... DO UPDATE` fallaría por
diseño; usa `DO NOTHING`.
