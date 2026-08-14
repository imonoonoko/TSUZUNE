import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const scriptsDirectory = dirname(fileURLToPath(import.meta.url))
const temporaryDirectory = await mkdtemp(
  join(tmpdir(), 'tsuzune-large-vault-core-')
)
const bundlePath = join(temporaryDirectory, 'measure-large-vault-core.mjs')

try {
  await build({
    entryPoints: [resolve(scriptsDirectory, 'measure-large-vault-core.ts')],
    outfile: bundlePath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    logLevel: 'silent'
  })
  await import(pathToFileURL(bundlePath).href)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
