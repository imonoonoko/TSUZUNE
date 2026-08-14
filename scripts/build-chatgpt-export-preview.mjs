import { build } from 'esbuild'

await build({
  entryPoints: ['src/cli/chatgpt-export-preview.ts'],
  outfile: 'work/tools/chatgpt-export-preview.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true
})
