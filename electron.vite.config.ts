import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
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
    plugins: [react(), {
      name: 'local-pdf-resources',
      async generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'assets/pdfjs/LICENSE', source: await readFile('node_modules/pdfjs-dist/LICENSE') })
        for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
          const source = join('node_modules/pdfjs-dist', directory)
          for (const entry of await readdir(source, { withFileTypes: true })) {
            if (entry.isFile()) this.emitFile({ type: 'asset', fileName: `assets/pdfjs/${directory}/${entry.name}`, source: await readFile(join(source, entry.name)) })
          }
        }
      }
    }]
  }
})
