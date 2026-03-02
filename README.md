# J&S Analytics - Performance & ROAS Dashboard (Febrero 2026)

Dashboard ejecutivo en React + TypeScript + Vite, diseñado con estilo Dark Premium para seguimiento de inversión, ventas, ROAS y estado de rentabilidad por cliente.

## Ejecutar en local

```bash
npm install
npm run dev
```

## Build de producción

```bash
npm run build
npm run preview
```

## Data remota con fallback local

El dashboard intenta leer datos desde `VITE_DATA_URL`. Si la carga falla (timeout, error HTTP o JSON inválido), usa automáticamente el dataset local de `src/data/months.ts`.

1. Definir variable en entorno local:

```bash
VITE_DATA_URL=https://tu-dominio.com/data/monthly.json
```

2. En Vercel:
- Ir a `Project Settings` -> `Environment Variables`.
- Crear `VITE_DATA_URL` con la URL pública del JSON.
- Hacer redeploy.

Formato esperado del JSON:

```json
[
  {
    "clientName": "Tienda de la Platería",
    "months": {
      "2026-02": {
        "investment": 931713,
        "sales": 30158300,
        "messages": 148,
        "reach": 44000,
        "impressions": 120000
      },
      "2026-03": {
        "investment": 1000000,
        "sales": 32000000,
        "messages": 160,
        "reach": 47000,
        "impressions": 130000
      }
    }
  }
]
```

Notas:
- `investment` faltante se normaliza a `0`.
- `sales`, `messages`, `reach`, `impressions` faltantes se normalizan a `null`.
- Si `VITE_DATA_URL` no está definida, se usa local automáticamente.

## Deploy en Vercel (GitHub)

1. Crear un repositorio en GitHub.
2. Inicializar y subir el proyecto:

```bash
git init
git add .
git commit -m "feat: dashboard dark premium listo para deploy"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

3. Entrar a Vercel y seleccionar `Add New Project`.
4. Importar el repositorio de GitHub.
5. Verificar que Vercel detecte automáticamente `Framework Preset: Vite`.
6. Confirmar configuración por defecto:
   - Build Command: `npm run build`
   - Output Directory: `dist`
7. Hacer clic en `Deploy`.

## Opcional: Deploy con Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```
