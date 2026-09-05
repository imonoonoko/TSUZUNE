import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const root = process.cwd()
const appPath =
  process.argv[2] ?? join(root, 'dist', 'win-unpacked', 'TSUZUNE.exe')
const smokeDirectory = await mkdtemp(join(tmpdir(), 'tsuzune-smoke-'))
const readyFile = join(smokeDirectory, 'ready.json')
const isolatedUserData = join(smokeDirectory, 'user-data')

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
  console.log(
    JSON.stringify(
      { packagedStartup: 'ready', isolatedUserData: true, isolatedSessionData: true },
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
