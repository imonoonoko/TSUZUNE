import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
)

const outputIndex = process.argv.indexOf('--outfile')
const outfile = outputIndex >= 0 ? process.argv[outputIndex + 1] : 'out/mcp/server.js'
if (!outfile) throw new Error('--outfile requires a path')

await build({
  entryPoints: ['src/mcp/server.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  banner: { js: 'import { createRequire as __tsuzuneCreateRequire } from "node:module"; const require = __tsuzuneCreateRequire(import.meta.url);' },
  define: {
    __TSUZUNE_VERSION__: JSON.stringify(packageJson.version)
  }
})

await build({
  entryPoints: ['src/mcp/base-worker.ts'],
  outfile: join(dirname(outfile), 'base-worker.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  banner: { js: 'import { createRequire as __tsuzuneCreateRequire } from "node:module"; const require = __tsuzuneCreateRequire(import.meta.url);' }
})
