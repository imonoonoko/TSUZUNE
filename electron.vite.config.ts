import { createRequire } from 'node:module'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    worker: {
      plugins: () => [{
        name: 'worker-character-references',
        enforce: 'pre',
        resolveId(id) {
          // The browser export needs document. The default export uses an entity map.
          if (id === 'decode-named-character-reference') return createRequire(import.meta.url).resolve(id)
        }
      }]
    },
    plugins: [react()]
  }
})
