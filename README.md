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
