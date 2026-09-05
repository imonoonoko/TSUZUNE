import { extractFile, uncache } from '@electron/asar'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile
} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import {
  SOURCE_RECEIPT_RELATIVE_PATH,
  fingerprintFiles,
  sha256File,
  snapshotSourceTree
} from './source-fingerprint.mjs'

const root = process.cwd()
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const receiptRelativePath = SOURCE_RECEIPT_RELATIVE_PATH

const plan = {
  steps: [
    { id: 'typecheck' },
    { id: 'tests' },
    { id: 'mcp' },
    { id: 'package' },
    { id: 'installer-contract' },
    { id: 'packaged-smoke' },
    { id: 'silent-install' },
    { id: 'installed-smoke' },
    { id: 'installed-hash' },
    { id: 'mcp-register' }
  ],
  installArguments: ['/S'],
  productionProfilePolicy: 'must-remain-byte-identical',
  installedVerification: [
    'package-version',
    'app.asar-sha256',
    'executable-sha256',
    'renderer-ready'
  ],
  sameVersionPolicy: 'allowed-when-app-asar-matches',
  sourceTreePolicy: 'dirty-allowed-but-byte-stable-during-promotion',
  googleOAuthBuildPolicy: 'environment-or-installed-production-bundle'
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    ...options
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${basename(command)} ${args.join(' ')} failed (${result.status})`)
  }
}

function captureChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    ...options
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${basename(command)} ${args.join(' ')} failed (${result.status}): ${result.stderr?.trim() ?? ''}`
    )
  }
  return result.stdout
}

function runNpm(args, options = {}) {
  const npmEntry = process.env.npm_execpath
  if (npmEntry && existsSync(npmEntry)) {
    runChecked(process.execPath, [npmEntry, ...args], options)
    return
  }
  runChecked(npmCommand, args, {
    shell: process.platform === 'win32',
    ...options
  })
}

async function listFiles(directory, current = directory) {
  if (!existsSync(directory)) return []
  const entries = await readdir(current, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(current, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(directory, path)))
    else if (entry.isFile() || entry.isSymbolicLink()) files.push(path)
  }
  return files
}

async function snapshotDirectory(directory) {
  if (!existsSync(directory)) {
    return {
      exists: false,
      fileCount: 0,
      digest: createHash('sha256').digest('hex')
    }
  }
  return {
    exists: true,
    ...(await fingerprintFiles(directory, await listFiles(directory)))
  }
}

function assertSameSnapshot(label, before, after) {
  if (
    before.exists !== after.exists ||
    before.fileCount !== after.fileCount ||
    before.digest !== after.digest
  ) {
    throw new Error(`${label} changed during production update`)
  }
}

function findSingleBundledValue(source, pattern, label) {
  const values = [...new Set(source.match(pattern) ?? [])]
  if (values.length !== 1) {
    throw new Error(`Could not safely recover the existing ${label} (${values.length} candidates)`)
  }
  return values[0]
}

function resolveGoogleOAuthBuildEnvironment(installedAsarPath) {
  const clientId = process.env.MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error('Both Google OAuth build environment variables must be set together')
  }
  if (clientId && clientSecret) {
    return {
      source: 'environment',
      env: {
        ...process.env,
        MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID: clientId,
        MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET: clientSecret
      }
    }
  }

  if (!existsSync(installedAsarPath)) {
    throw new Error(
      'Google OAuth build values are absent and no installed production bundle can supply them'
    )
  }
  const mainSource = extractFile(installedAsarPath, 'out\\main\\index.js').toString(
    'utf8'
  )
  const bundledClientId = findSingleBundledValue(
    mainSource,
    /[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com/g,
    'Google OAuth client ID'
  )
  const bundledClientSecret = findSingleBundledValue(
    mainSource,
    /GOCSPX-[A-Za-z0-9_-]+/g,
    'Google OAuth client secret'
  )
  return {
    source: 'installed-bundle',
    env: {
      ...process.env,
      MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID: bundledClientId,
      MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET: bundledClientSecret
    }
  }
}

function assertProductionNotRunning(installedExecutable) {
  const script = [
    "$target = [IO.Path]::GetFullPath($env:TSUZUNE_PROCESS_TARGET)",
    "$count = @(Get-Process -Name 'TSUZUNE' -ErrorAction SilentlyContinue | Where-Object {",
    "  try { [IO.Path]::GetFullPath($_.Path) -eq $target } catch { $false }",
    '}).Count',
    'Write-Output $count'
  ].join('\n')
  const count = Number(
    captureChecked('powershell.exe', ['-NoProfile', '-Command', script], {
      env: {
        ...process.env,
        TSUZUNE_PROCESS_TARGET: installedExecutable
      }
    }).trim()
  )
  if (!Number.isFinite(count)) {
    throw new Error('Could not verify whether production TSUZUNE is running')
  }
  if (count > 0) {
    throw new Error(
      'Production TSUZUNE is running. Save and close it, then run production:update again.'
    )
  }
}

async function readAsarVersion(asarPath) {
  const manifest = JSON.parse(extractFile(asarPath, 'package.json').toString('utf8'))
  return manifest.version
}

async function writeReceipt(path, receipt) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
}

async function main() {
  if (process.argv.includes('--plan')) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
  const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
  const installedRoot = join(localAppData, 'Programs', 'tsuzune')
  const installedExecutable = join(installedRoot, 'TSUZUNE.exe')
  const installedAsar = join(installedRoot, 'resources', 'app.asar')
  const builtRoot = join(root, 'dist', 'win-unpacked')
  const builtExecutable = join(builtRoot, 'TSUZUNE.exe')
  const builtAsar = join(builtRoot, 'resources', 'app.asar')
  const installer = join(root, 'dist', `TSUZUNE-Setup-${manifest.version}.exe`)
  const productionProfile = join(appData, 'TSUZUNE')
  const receiptPath = join(root, ...receiptRelativePath.split('/'))

  if (process.argv.includes('--dry-run')) {
    console.log(
      JSON.stringify(
        {
          ...plan,
          packageVersion: manifest.version,
          installer,
          installedExecutable,
          productionProfile,
          receiptPath
        },
        null,
        2
      )
    )
    return
  }

  if (process.platform !== 'win32') {
    throw new Error('production:update supports the personal Windows production PC only')
  }

  assertProductionNotRunning(installedExecutable)
  const unmerged = captureChecked('git', [
    'diff',
    '--name-only',
    '--diff-filter=U'
  ]).trim()
  if (unmerged) throw new Error('Resolve unmerged files before updating production')
  runChecked('git', ['diff', '--check', 'HEAD'])

  await mkdir(join(root, 'work'), { recursive: true })
  const sourceArchive = await mkdtemp(join(root, 'work', 'production-source-'))
  const sourceBefore = await snapshotSourceTree(root, sourceArchive)
  const profileBefore = await snapshotDirectory(productionProfile)
  const oauth = resolveGoogleOAuthBuildEnvironment(installedAsar)

  runNpm(['run', 'typecheck'])
  runNpm(['run', 'test:production'])
  runNpm(['run', 'check:mcp'])
  runNpm(['run', 'pack:win'], { env: oauth.env })
  runNpm(['run', 'check:installer'])
  runNpm(['run', 'check:packaged'])

  assertSameSnapshot('Source tree', sourceBefore, await snapshotSourceTree(root))
  assertProductionNotRunning(installedExecutable)
  if (!existsSync(installer)) throw new Error(`Installer was not created: ${installer}`)

  runChecked(installer, ['/S'])
  uncache(installedAsar)
  assertProductionNotRunning(installedExecutable)
  runNpm(['run', 'check:packaged', '--', installedExecutable])

  const installedVersion = await readAsarVersion(installedAsar)
  if (installedVersion !== manifest.version) {
    throw new Error(
      `Installed version ${installedVersion} does not match package version ${manifest.version}`
    )
  }

  const builtAsarSha256 = await sha256File(builtAsar)
  const installedAsarSha256 = await sha256File(installedAsar)
  if (builtAsarSha256 !== installedAsarSha256) {
    throw new Error('Installed app.asar does not match the verified package')
  }
  const builtExecutableSha256 = await sha256File(builtExecutable)
  const installedExecutableSha256 = await sha256File(installedExecutable)
  if (builtExecutableSha256 !== installedExecutableSha256) {
    throw new Error('Installed executable does not match the verified package')
  }

  const profileAfter = await snapshotDirectory(productionProfile)
  assertSameSnapshot('Production TSUZUNE profile', profileBefore, profileAfter)
  const sourceAfter = await snapshotSourceTree(root)
  assertSameSnapshot('Source tree', sourceBefore, sourceAfter)
  runNpm(['run', 'mcp:register'])

  const commit = captureChecked('git', ['rev-parse', 'HEAD']).trim()
  const dirty = Boolean(captureChecked('git', ['status', '--porcelain']).trim())
  const receipt = {
    status: 'installed-and-verified',
    verifiedAt: new Date().toISOString(),
    packageVersion: manifest.version,
    git: { commit, dirty },
    sourceFingerprint: sourceAfter,
    sourceArchive: { path: relative(root, sourceArchive).replaceAll('\\', '/') },
    oauthBuildSource: oauth.source,
    installer: {
      path: relative(root, installer).replaceAll('\\', '/'),
      sha256: await sha256File(installer)
    },
    built: {
      executableSha256: builtExecutableSha256,
      appAsarSha256: builtAsarSha256
    },
    installed: {
      executable: installedExecutable,
      version: installedVersion,
      executableSha256: installedExecutableSha256,
      appAsarSha256: installedAsarSha256,
      rendererReady: true
    },
    productionProfile: {
      path: productionProfile,
      before: profileBefore,
      after: profileAfter,
      unchanged: true
    },
    checks: plan.steps.map(({ id }) => ({ id, status: 'passed' }))
  }
  await writeReceipt(receiptPath, receipt)
  console.log(JSON.stringify({ productionUpdate: 'verified', receiptPath }, null, 2))
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
