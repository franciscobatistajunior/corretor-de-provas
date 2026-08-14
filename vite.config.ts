import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // cvWorker.ts is created with `{ type: 'module' }` (it uses ES `import`),
  // so the production build must bundle it as an ES module too — Vite's
  // default worker output format is a classic IIFE otherwise.
  worker: {
    format: 'es',
  },
})
