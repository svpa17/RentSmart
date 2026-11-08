// RĂSCRUCE AI — scriptul de conținut, injectat la cerere prin chrome.scripting.executeScript.
// IIFE autonom (fără importuri la rulare), adăugat în dist/extension/content/.
import path from 'node:path'
import { defineConfig } from 'vite'
import { OUT_DIR } from './vite.config.js'

export default defineConfig({
  publicDir: false,
  build: {
    outDir: path.join(OUT_DIR, 'content'),
    emptyOutDir: false,
    lib: {
      entry: path.join(import.meta.dirname, 'extension/src/content/entry.js'),
      formats: ['iife'],
      name: 'RascruceContent',
      fileName: () => 'readPage.js',
    },
  },
})
