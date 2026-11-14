import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createServer as createTcpServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

assert.equal(process.platform, 'win32')
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Requires a disposable GitHub Windows runner')
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'Requires a GitHub-hosted runner')

const exec = promisify(execFile)
const previous = '0.6.0'
const { version } = JSON.parse(await readFile('package.json', 'utf8'))
const temp = await mkdtemp(join(tmpdir(), 'tsuzune-upgrade-'))
const vault = join(temp, 'vault')
const profile = join(process.env.APPDATA, 'TSUZUNE')
const installed = join(process.env.LOCALAPPDATA, 'Programs', 'tsuzune')
const binary = join(installed, 'TSUZUNE.exe')
const oldInstaller = join(temp, `TSUZUNE-Setup-${previous}.exe`)
const noteName = 'upgrade.md'
const note = '# Release upgrade fixture\n\nKeep this text after updating.\n'
const sha = async (file) => createHash('sha256').update(await readFile(file)).digest('hex')
const exists = (path) => access(path).then(() => true, () => false)

assert.equal(await exists(installed), false, 'TSUZUNE is already installed')
assert.equal(await exists(profile), false, 'TSUZUNE already has a profile')
await mkdir(vault)
await mkdir(profile)
await writeFile(join(vault, noteName), note)
const settingsPath = join(profile, 'settings.json')
await writeFile(settingsPath, JSON.stringify({ lastVaultPath: vault, lastNotePath: noteName }))

await exec('curl.exe', ['--fail', '--silent', '--show-error', '--location', '--output', oldInstaller,
  'https://github.com/imonoonoko/TSUZUNE/releases/download/v0.6.0/TSUZUNE-Setup-0.6.0.exe'])
assert.equal(await sha(oldInstaller), 'b04420224b7f334088fb43d8041f3bd91b7e929c79904ec2a01fea8ef33e394b')
await exec(oldInstaller, ['/S'], { timeout: 120_000, windowsHide: true })
assert.ok(await exists(binary), 'The v0.6.0 installer did not install TSUZUNE')

const installer = `TSUZUNE-Setup-${version}.exe`
const files = new Set(['latest.yml', installer, installer + '.blockmap'])
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname.slice(1)
  if (!files.has(path) || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end()
    return
  }
  const file = join('dist', path)
  const size = (await stat(file)).size
  // A clean install uses the full download when no old update is cached.
  response.writeHead(200, { 'content-length': size })
  if (request.method === 'HEAD') response.end()
  else createReadStream(file).pipe(response)
})
await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))

async function until(description, action, timeout = 45_000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const value = await action()
    if (value) return value
    await delay(250)
  }
  throw new Error(`Timed out waiting for ${description}`)
}

const cdp = new Map()
let serial = 0
let socket
try {
  const updateConfig = join(installed, 'resources', 'app-update.yml')
  const oldConfig = await readFile(updateConfig, 'utf8')
  const cache = oldConfig.match(/^updaterCacheDirName: [^\r\n]+/m)?.[0]
  assert.ok(cache, 'The published installer did not include its updater cache name')
  await writeFile(updateConfig, `provider: generic\nurl: http://127.0.0.1:${server.address().port}/\n${cache}\n`)

  const portProbe = createTcpServer()
  await new Promise((resolve, reject) => portProbe.listen(0, '127.0.0.1', resolve).once('error', reject))
  const debuggerPort = portProbe.address().port
  await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()))
  const old = spawn(binary, [
    `--remote-debugging-port=${debuggerPort}`, '--remote-debugging-address=127.0.0.1'
  ], {
    windowsHide: true, stdio: 'ignore'
  })
  const target = await until('the v0.6.0 renderer', async () => {
    const response = await fetch(`http://127.0.0.1:${debuggerPort}/json/list`).catch(() => null)
    if (!response?.ok) return null
    return (await response.json()).find(({ type, url }) => type === 'page' && url.startsWith('file:'))
  })
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    cdp.get(message.id)?.(message)
  })

  async function evaluate(expression, awaitPromise = true) {
    const id = ++serial
    try {
      const meta = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`CDP command timed out: ${expression}`)), 180_000)
        cdp.set(id, (message) => {
          clearTimeout(timer)
          resolve(message)
        })
        socket.send(JSON.stringify({ id, method: 'Runtime.evaluate',
          params: { expression, awaitPromise, returnByValue: true } }))
      })
      assert.ok(!meta.error && !meta.result.exceptionDetails, JSON.stringify(meta))
      return meta.result.result.value
    } finally {
      cdp.delete(id)
    }
  }

  async function call(api, ...args) {
    const result = await evaluate(`window.tsuzune.${api}(...${JSON.stringify(args)})`)
    assert.equal(result.ok, true, JSON.stringify(result))
    return result.value
  }

  await until('the v0.6.0 bridge', () => evaluate('Boolean(window.tsuzune?.getUpdateStatus)'))
  assert.equal((await call('getUpdateStatus')).currentVersion, previous)
  await call('openLastVault')
  assert.equal((await call('readNote', noteName)).content, note)
  const available = await call('checkForUpdates')
  assert.equal(available.phase, 'available', JSON.stringify(available))
  assert.equal(available.availableVersion, version)
  const downloaded = await call('downloadUpdate')
  assert.equal(downloaded.phase, 'downloaded', JSON.stringify(downloaded))
  assert.equal(downloaded.availableVersion, version)

  await evaluate('void setTimeout(() => window.tsuzune.installUpdate(), 100)', false)
  await until('v0.6.0 to exit', () => old.exitCode !== null)
  const expected = {}
  for (const entry of ['TSUZUNE.exe', 'resources/app.asar']) {
    expected[entry] = await sha(join('dist', 'win-unpacked', entry))
  }
  await until('the installer to replace the app', async () => {
    for (const entry of Object.keys(expected)) {
      if (await sha(join(installed, entry)).catch(() => null) !== expected[entry]) return false
    }
    return true
  }, 150_000)
  const restarted = await until('the upgraded app to restart', async () => {
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-Process -Name TSUZUNE -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -NE 0 | Select-Object -ExpandProperty Id; exit 0'])
    return stdout.trim().split(/\s+/).map(Number).find((pid) => pid && pid !== old.pid)
  })
  assert.equal(await readFile(join(vault, noteName), 'utf8'), note)
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'))
  assert.equal(settings.lastVaultPath, vault)
  assert.equal(settings.lastNotePath, noteName)

  const signatures = {}
  for (const [key, path] of Object.entries({ installer: join('dist', installer), app: binary })) {
    const { stdout } = await exec('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference = 'Stop'; (Get-AuthenticodeSignature -LiteralPath $env:TSUZUNE_VERIFY_SIGNATURE_PATH).Status.ToString()"],
      { env: { ...process.env, TSUZUNE_VERIFY_SIGNATURE_PATH: path } })
    signatures[key] = stdout.trim()
    assert.ok(['Valid', 'NotSigned'].includes(signatures[key]), signatures[key])
  }
  const receipt = { source: process.env.GITHUB_SHA, previous, version, checked: available.phase,
    downloaded: downloaded.phase, restarted: true, vaultPreserved: true, settingsPreserved: true,
    installedFileHashes: expected, signatures }
  await writeFile(join('dist', 'windows-upgrade-verification.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt, null, 2))

  await exec('taskkill.exe', ['/PID', String(restarted), '/T', '/F'])
  await until('the upgraded app processes to stop', async () => {
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-Process -Name TSUZUNE -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id; exit 0'])
    return !stdout.trim()
  })
} finally {
  socket?.close()
  server.closeAllConnections()
  server.close()
}
