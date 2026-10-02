import assert from 'node:assert/strict'
import { execFile, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { extractFile } from '@electron/asar'

const root = process.cwd()
const appPath =
  process.argv[2] ?? join(root, 'dist', 'win-unpacked', 'TSUZUNE.exe')
const smokeDirectory = await mkdtemp(join(tmpdir(), 'tsuzune-smoke-'))
const readyFile = join(smokeDirectory, 'ready.json')
const isolatedUserData = join(smokeDirectory, 'user-data')
const run = promisify(execFile)

async function checkEmbeddedMcp() {
  const archivePath = join(dirname(resolve(appPath)), 'resources', 'app.asar')
  const directory = join(smokeDirectory, 'embedded-mcp')
  await mkdir(directory)
  // The extracted server and sibling Worker retain their packaged ESM identity.
  await writeFile(join(directory, 'package.json'), '{"type":"module"}\n')
  const artifacts = []
  for (const name of ['server.js', 'base-worker.js']) {
    const archiveEntry = `out/mcp/${name}`
    const content = extractFile(archivePath, join('out', 'mcp', name))
    await writeFile(join(directory, name), content)
    artifacts.push({ archiveEntry, sha256: createHash('sha256').update(content).digest('hex') })
  }
  const pending = run(process.execPath, [join(root, 'scripts', 'check-mcp-knowledge-flow.mjs')], {
    cwd: root,
    env: { ...process.env, TSUZUNE_MCP_SERVER_PATH: join(directory, 'server.js') },
    windowsHide: true,
    maxBuffer: 1024 * 1024
  })
  const timer = setTimeout(() => {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(pending.child.pid), '/T', '/F'], {
        stdio: 'ignore', windowsHide: true
      })
    } else pending.child.kill()
  }, 60_000)
  const result = await pending.finally(() => clearTimeout(timer))
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  return { status: 'passed', archivePath, execution: 'extracted packaged server and Node Worker with isolated fixture', artifacts }
}

function windowsTsuzuneProcessIds() {
  if (process.platform !== 'win32') return []
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Get-Process -Name TSUZUNE -ErrorAction SilentlyContinue | Where-Object { -not $_.HasExited } | Select-Object -ExpandProperty Id"
    ],
    { encoding: 'utf8', windowsHide: true }
  )
  if (result.error) throw result.error
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isInteger)
}

const preexistingProcessIds = new Set(windowsTsuzuneProcessIds())
assert.equal(preexistingProcessIds.size, 0, 'packaged smoke requires TSUZUNE to be closed')

function ownedWindowsProcessIds() {
  return windowsTsuzuneProcessIds().filter(
    (processId) => !preexistingProcessIds.has(processId)
  )
}

async function waitForOwnedWindowsProcesses(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const processIds = ownedWindowsProcessIds()
    if (processIds.length === 0) return []
    await delay(100)
  }
  return ownedWindowsProcessIds()
}

const child = spawn(appPath, [`--user-data-dir=${isolatedUserData}`], {
  env: {
    ...process.env,
    TSUZUNE_HEADLESS_SMOKE: '1',
    TSUZUNE_HEADLESS_SMOKE_READY_FILE: readyFile
  },
  stdio: 'ignore',
  windowsHide: true
})

try {
  const deadline = Date.now() + 15_000
  let ready = false
  let profile
  while (Date.now() < deadline) {
    try {
      profile = JSON.parse(await readFile(readyFile, 'utf8'))
      ready = profile.ready === true
    } catch {
      // The renderer has not finished loading yet.
    }
    if (ready) break
    if (child.exitCode !== null) {
      throw new Error(`packaged TSUZUNE exited before ready (${child.exitCode})`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  assert.ok(ready, 'packaged TSUZUNE did not report renderer readiness')
  assert.equal(profile.userData.toLowerCase(), isolatedUserData.toLowerCase(), 'userData must be isolated')
  assert.equal(profile.sessionData.toLowerCase(), isolatedUserData.toLowerCase(), 'sessionData must be isolated')
  const embeddedMcp = await checkEmbeddedMcp()
  console.log(
    JSON.stringify(
      {
        packagedStartup: 'ready', isolatedUserData: true, isolatedSessionData: true,
        guiExecutable: { path: resolve(appPath), rendererReady: true },
        embeddedMcp
      },
      null,
      2
    )
  )
} finally {
  if (process.platform === 'win32') {
    const processIds = await waitForOwnedWindowsProcesses(15_000)
    for (const processId of processIds) {
      spawnSync('taskkill.exe', ['/PID', String(processId), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      })
    }
    const remainingProcessIds = await waitForOwnedWindowsProcesses(5_000)
    if (remainingProcessIds.length > 0) {
      throw new Error('packaged TSUZUNE process did not exit')
    }
  } else if (child.exitCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve))
    const exitedNaturally = await Promise.race([
      exited.then(() => true),
      delay(45_000, false)
    ])
    if (!exitedNaturally) {
      if (process.platform === 'win32') {
        spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true
        })
      } else {
        child.kill()
      }
      await Promise.race([exited, delay(5_000)])
    }
  }
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      await rm(smokeDirectory, { recursive: true, force: true })
      break
    } catch (error) {
      if (
        attempt === 299 ||
        !(error instanceof Error) ||
        !('code' in error) ||
        !['EBUSY', 'EPERM'].includes(error.code)
      ) {
        throw error
      }
      await delay(100)
    }
  }
}
