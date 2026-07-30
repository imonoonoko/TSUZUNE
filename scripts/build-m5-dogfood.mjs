import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

await mkdir('work', { recursive: true })
await build({
  entryPoints: ['scripts/m5-dogfood.ts'],
  outfile: 'work/m5-dogfood.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true
})

const moduleUrl = `${pathToFileURL(
  `${process.cwd()}/work/m5-dogfood.mjs`
).href}?run=${Date.now()}`
const { runM5Dogfood } = await import(moduleUrl)
await runM5Dogfood(process.argv.slice(2))
