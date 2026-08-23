import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'
import { build } from 'esbuild'

const repoRoot = resolve(import.meta.dirname, '..')
const outputDirectory = resolve(repoRoot, 'work', 'tools')
const outputPath = resolve(
  outputDirectory,
  'production-classification-relocation.mjs'
)

await mkdir(outputDirectory, { recursive: true })
await build({
  entryPoints: [
    resolve(repoRoot, 'src', 'cli', 'production-classification-runner.ts')
  ],
  outfile: outputPath,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  external: ['electron'],
  sourcemap: true
})

const environment = { ...process.env }
delete environment.ELECTRON_RUN_AS_NODE
const temporaryUserData = await mkdtemp(
  join(tmpdir(), 'tsuzune-classification-runner-')
)
try {
  const productionUserData = resolve(
    process.env.APPDATA ?? resolve(homedir(), 'AppData', 'Roaming'),
    'tsuzune'
  )
  await copyFile(
    join(productionUserData, 'Local State'),
    join(temporaryUserData, 'Local State')
  )
  const result = spawnSync(
    electron,
    [
      `--user-data-dir=${temporaryUserData}`,
      outputPath,
      ...process.argv.slice(2)
    ],
    {
      cwd: repoRoot,
      env: environment,
      stdio: 'inherit',
      windowsHide: true
    }
  )
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  const allowedPrefix = resolve(
    tmpdir(),
    'tsuzune-classification-runner-'
  ).toLocaleLowerCase()
  if (resolve(temporaryUserData).toLocaleLowerCase().startsWith(allowedPrefix)) {
    await rm(temporaryUserData, { recursive: true, force: true }).catch(
      () => undefined
    )
  }
}
