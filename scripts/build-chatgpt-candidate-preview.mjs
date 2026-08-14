import { build } from 'esbuild'

await build({
  entryPoints: ['src/cli/chatgpt-candidate-preview.ts'],
  outfile: 'work/tools/chatgpt-candidate-preview.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true
})
