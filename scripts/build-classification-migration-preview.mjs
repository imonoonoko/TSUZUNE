import { build } from 'esbuild'

await build({
  entryPoints: ['src/cli/classification-migration-preview.ts'],
  outfile: 'work/tools/classification-migration-preview.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true
})
