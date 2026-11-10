import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Id de build para detectar versiones viejas en el navegador (ver
// src/components/UpdateBanner.tsx). Usa el commit de Vercel cuando existe
// (despliegues reales) y cae a Date.now() en builds locales.
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now())

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  if (command === 'build') {
    writeFileSync(resolve(__dirname, 'public/version.json'), JSON.stringify({ version: APP_VERSION }))
  }

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
  }
})
