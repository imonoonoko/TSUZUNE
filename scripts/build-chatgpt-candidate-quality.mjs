import { build } from 'esbuild'

await build({
  entryPoints: ['src/cli/chatgpt-candidate-quality.ts'],
  outfile: 'work/tools/chatgpt-candidate-quality.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true
})
