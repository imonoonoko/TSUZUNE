import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const root = process.cwd()
const appPath =
  process.argv[2] ?? join(root, 'dist', 'win-unpacked', 'TSUZUNE.exe')
const smokeDirectory = await mkdtemp(join(tmpdir(), 'tsuzune-smoke-'))
const readyFile = join(smokeDirectory, 'ready.txt')
const isolatedUserData = join(smokeDirectory, 'user-data')
const child = spawn(appPath, [`--user-data-dir=${isolatedUserData}`], {
  env: {
    ...process.env,
    TSUZUNE_HEADLESS_SMOKE: '1',
    TSUZUNE_HEADLESS_SMOKE_READY_FILE: readyFile
  },
  stdio: 'ignore'
})

try {
  const deadline = Date.now() + 15_000
  let ready = false
  while (Date.now() < deadline) {
    try {
      ready = (await readFile(readyFile, 'utf8')) === 'ready'
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
  console.log(
    JSON.stringify(
      { packagedStartup: 'ready', isolatedUserData: true },
      null,
      2
    )
  )
} finally {
  if (child.exitCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve))
    child.kill()
    await Promise.race([exited, delay(5_000)])
  }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await rm(smokeDirectory, { recursive: true, force: true })
      break
    } catch (error) {
      if (
        attempt === 49 ||
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
