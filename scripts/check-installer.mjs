import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { extractFile } = require('@electron/asar')
const root = process.cwd()
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const installerName = `TSUZUNE-Setup-${manifest.version}.exe`
const installerPath = join(root, 'dist', installerName)
const blockMapPath = `${installerPath}.blockmap`
const latestPath = join(root, 'dist', 'latest.yml')
const appAsarPath = join(root, 'dist', 'win-unpacked', 'resources', 'app.asar')
const appUpdatePath = join(
  root,
  'dist',
  'win-unpacked',
  'resources',
  'app-update.yml'
)

async function extractAssociatedIconDigest(executablePath, outputPath) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Drawing',
    '$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($env:ICON_SOURCE)',
    "if ($null -eq $icon) { throw 'Associated icon was not found' }",
    '$stream = [IO.File]::Create($env:ICON_OUTPUT)',
    'try { $icon.Save($stream) } finally { $stream.Dispose(); $icon.Dispose() }'
  ].join('; ')
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Command', script],
    {
      env: {
        ...process.env,
        ICON_SOURCE: executablePath,
        ICON_OUTPUT: outputPath
      },
      encoding: 'utf8'
    }
  )
  assert.equal(
    result.status,
    0,
    `could not extract associated icon: ${result.stderr?.trim() ?? ''}`
  )
  return createHash('sha256').update(await readFile(outputPath)).digest('hex')
}

const [installer, installerInfo, blockMapInfo, latest, appUpdate] =
  await Promise.all([
    readFile(installerPath),
    stat(installerPath),
    stat(blockMapPath),
    readFile(latestPath, 'utf8'),
    readFile(appUpdatePath, 'utf8')
  ])
const bundledMain = extractFile(appAsarPath, 'out\\main\\index.js').toString('utf8')

const digest = createHash('sha512').update(installer).digest('base64')
assert.ok(installerInfo.size > 0, 'installer is empty')
assert.ok(blockMapInfo.size > 0, 'installer block map is empty')
assert.match(latest, new RegExp(`version:\\s*${manifest.version.replaceAll('.', '\\.')}\\b`))
assert.ok(latest.includes(`url: ${installerName}`), 'latest.yml installer name differs')
assert.ok(latest.includes(`sha512: ${digest}`), 'latest.yml checksum differs')
assert.doesNotMatch(
  bundledMain,
  /import\s*\{\s*autoUpdater\s*\}\s*from\s*["']electron-updater["']/,
  'packaged main process uses an incompatible electron-updater named import'
)
assert.match(
  bundledMain,
  /import\s+\w+\s+from\s*["']electron-updater["']/,
  'packaged main process must use the CommonJS-compatible default import'
)
assert.match(appUpdate, /provider:\s*github\b/)
assert.match(appUpdate, /owner:\s*imonoonoko\b/)
assert.match(appUpdate, /repo:\s*TSUZUNE\b/)
assert.match(appUpdate, /private:\s*true\b/)

let customApplicationIcon = null
if (process.platform === 'win32') {
  const iconDirectory = await mkdtemp(join(tmpdir(), 'tsuzune-icon-check-'))
  try {
    const packagedIconDigest = await extractAssociatedIconDigest(
      join(root, 'dist', 'win-unpacked', 'TSUZUNE.exe'),
      join(iconDirectory, 'tsuzune.ico')
    )
    const electronIconDigest = await extractAssociatedIconDigest(
      join(root, 'node_modules', 'electron', 'dist', 'electron.exe'),
      join(iconDirectory, 'electron.ico')
    )
    assert.notEqual(
      packagedIconDigest,
      electronIconDigest,
      'packaged application still uses the default Electron icon'
    )
    customApplicationIcon = true
  } finally {
    await rm(iconDirectory, { recursive: true, force: true })
  }
}

console.log(
  JSON.stringify(
    {
      version: manifest.version,
      installer: installerName,
      installerBytes: installerInfo.size,
      blockMapBytes: blockMapInfo.size,
      updateFeed: 'private GitHub release',
      customApplicationIcon
    },
    null,
    2
  )
)
