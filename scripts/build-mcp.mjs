import { build } from 'esbuild'

await build({
  entryPoints: ['src/mcp/server.ts'],
  outfile: 'out/mcp/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true
})
