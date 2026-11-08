// RĂSCRUCE AI — build-ul extensiei (MV3): panoul lateral, dashboard-ul și service worker-ul.
// Scriptul de conținut se construiește separat (vite.content.config.js), ca IIFE fără importuri.
// Rezultatul: dist/extension → „Load unpacked” în chrome://extensions.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const projectRoot = import.meta.dirname
const extRoot = path.join(projectRoot, 'extension')
export const OUT_DIR = path.join(projectRoot, 'dist', 'extension')

/** host_permissions: cele din manifest (cursul BNR) + domeniul backend-ului (VITE_API_BASE_URL). */
export function buildManifest(apiBaseUrl) {
  const manifest = JSON.parse(readFileSync(path.join(extRoot, 'manifest.json'), 'utf8'))
  manifest.host_permissions = [...(manifest.host_permissions ?? []), ...(apiBaseUrl ? [`${new URL(apiBaseUrl).origin}/*`] : [])]
  return manifest
}

export const ICON_SIZES = [16, 32, 48, 128]

function manifestPlugin(apiBaseUrl) {
  return {
    name: 'rascruce-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(buildManifest(apiBaseUrl), null, 2) })
      // Iconițele (generate cu scripts/render-icons.mjs din extension/icons/icon.svg).
      for (const size of ICON_SIZES) {
        this.emitFile({ type: 'asset', fileName: `icons/icon-${size}.png`, source: readFileSync(path.join(extRoot, 'icons', `icon-${size}.png`)) })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'VITE_')
  return {
    root: extRoot,
    envDir: projectRoot,
    publicDir: false,
    base: './',
    plugins: [react(), tailwindcss(), manifestPlugin(env.VITE_API_BASE_URL)],
    build: {
      outDir: OUT_DIR,
      emptyOutDir: true,
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: {
          sidepanel: path.join(extRoot, 'sidepanel.html'),
          dashboard: path.join(extRoot, 'dashboard.html'),
          background: path.join(extRoot, 'src/background/index.js'),
        },
        output: {
          entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
  }
})
