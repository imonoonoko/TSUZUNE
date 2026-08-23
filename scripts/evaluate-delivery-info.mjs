import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const runCommand = promisify(execFile)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(repoRoot, 'src', 'mcp', 'server.ts')
const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'))
const receiptRelativePath = 'docs/reports/production-update-latest.json'

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function filesUnder(root, current = root) {
  const result = []
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = join(current, entry.name)
    if (entry.isDirectory()) result.push(...await filesUnder(root, absolute))
    else if (entry.isFile()) result.push(absolute)
  }
  return result
}

async function fingerprint(root) {
  const output = (await runCommand('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root })).stdout
  const paths = output.split('\0').filter(Boolean)
    .filter((path) => path.replaceAll('\\', '/') !== receiptRelativePath)
    .map((path) => join(root, path))
  const hash = createHash('sha256')
  for (const path of paths.sort((a, b) => relative(root, a).localeCompare(relative(root, b), 'en'))) {
    hash.update(relative(root, path).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(await sha256(path))
    hash.update('\0')
  }
  return { fileCount: paths.length, digest: hash.digest('hex'), excludedPaths: [receiptRelativePath] }
}

async function snapshot(root) {
  const entries = []
  for (const path of (await filesUnder(root)).sort()) {
    const info = await stat(path)
    entries.push({ path: relative(root, path).replaceAll('\\', '/'), size: info.size, mtimeMs: info.mtimeMs, sha256: await sha256(path) })
  }
  return JSON.stringify(entries)
}

async function writeReceipt(root, sourceFingerprint) {
  await writeFile(join(root, receiptRelativePath), `${JSON.stringify({ status: 'installed-and-verified', sourceFingerprint }, null, 2)}\n`)
}

async function git(root, args) {
  await runCommand('git', args, { cwd: root })
}

async function buildFixture(root) {
  await mkdir(join(root, 'out', 'mcp'), { recursive: true })
  await mkdir(join(root, 'docs', 'reports'), { recursive: true })
  await mkdir(join(root, 'vault'), { recursive: true })
  await writeFile(join(root, '.gitignore'), 'out/\n')
  await writeFile(join(root, 'package.json'), JSON.stringify(packageJson))
  await writeFile(join(root, 'vault', 'Home.md'), '# Delivery fixture\n')
  await git(root, ['init', '--quiet'])
  await git(root, ['config', 'user.email', 'fixture@example.invalid'])
  await git(root, ['config', 'user.name', 'fixture'])
  await git(root, ['add', '.gitignore', 'package.json', 'vault/Home.md'])
  await writeReceipt(root, await fingerprint(root))
  await build({
    stdin: { contents: (await readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n'), resolveDir: dirname(sourcePath), sourcefile: sourcePath, loader: 'ts' },
    outfile: join(root, 'out', 'mcp', 'server.js'), bundle: true, platform: 'node', format: 'esm', target: 'node22',
    define: { __TSUZUNE_VERSION__: JSON.stringify(packageJson.version) }, logLevel: 'silent'
  })
}

async function startClient(root, callerCwd = root) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'out', 'mcp', 'server.js'), '--vault', join(root, 'vault')], cwd: callerCwd, stderr: 'pipe' })
  const client = new Client({ name: 'delivery-info-evaluation', version: '1.0.0' })
  await client.connect(transport)
  return client
}

async function callDelivery(client) {
  const result = await client.callTool({ name: 'delivery_info', arguments: {} })
  assert.equal(result.isError, undefined, result.content?.[0]?.text)
  const value = result.structuredContent
  assert.deepEqual(Object.keys(value).sort(), ['status'])
  assert.match(value.status, /^(match|mismatch|unknown)$/)
  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8')
  assert.ok(bytes < 2048, `delivery_info response too large: ${bytes}`)
  assert.doesNotMatch(JSON.stringify(value), /(?:[A-Za-z]:[\\/]|\/Users\/|Bearer\s|token|secret|password)/i)
  return { value, bytes }
}

async function callStable(client, root, expected) {
  const before = await snapshot(root)
  const result = await callDelivery(client)
  assert.equal(result.value.status, expected)
  assert.equal(await snapshot(root), before)
  return result
}

async function run() {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-delivery-info-'))
  let client
  let callerCwd
  let unresolvable
  try {
    const prefix = `${resolve(tmpdir())}${sep}`
    assert.ok(resolve(root).toLowerCase().startsWith(prefix.toLowerCase()))
    await buildFixture(root)
    callerCwd = await mkdtemp(join(tmpdir(), 'tsuzune-delivery-caller-'))
    client = await startClient(root, callerCwd)
    const listed = await client.listTools()
    const definition = listed.tools.find((tool) => tool.name === 'delivery_info')
    if (!definition) throw new Error('delivery_info tool was not registered.')
    const schemaBytes = Buffer.byteLength(JSON.stringify(definition), 'utf8')
    assert.ok(schemaBytes < 1024, `delivery_info schema too large: ${schemaBytes}`)

    const first = await callStable(client, root, 'match')
    const second = await callStable(client, root, 'match')
    assert.deepEqual(first.value, second.value)
    assert.equal(first.bytes, second.bytes)
    assert.equal(first.bytes, 18)

    await writeFile(join(root, 'vault', 'Home.md'), '# Delivery drift fixture\n')
    const drift = await callStable(client, root, 'mismatch')
    assert.equal(drift.bytes, 21)
    await rm(join(root, receiptRelativePath))
    const missing = await callStable(client, root, 'unknown')
    assert.equal(missing.bytes, 20)
    await writeFile(join(root, receiptRelativePath), '{"sourceFingerprint":{"fileCount":-1,"digest":"bad"}}\n')
    const invalid = await callStable(client, root, 'unknown')
    assert.equal(invalid.bytes, 20)
    await client.close()
    client = undefined

    unresolvable = await mkdtemp(join(tmpdir(), 'tsuzune-delivery-unresolvable-'))
    await mkdir(join(unresolvable, 'out', 'mcp'), { recursive: true })
    await mkdir(join(unresolvable, 'docs', 'reports'), { recursive: true })
    await mkdir(join(unresolvable, 'vault'), { recursive: true })
    await copyFile(join(root, 'out', 'mcp', 'server.js'), join(unresolvable, 'out', 'mcp', 'server.js'))
    await writeFile(join(unresolvable, 'package.json'), JSON.stringify(packageJson))
    await writeFile(join(unresolvable, 'vault', 'Home.md'), '# Unresolvable fixture\n')
    await writeFile(join(unresolvable, receiptRelativePath), JSON.stringify({ sourceFingerprint: { fileCount: 1, digest: 'a'.repeat(64), excludedPaths: [receiptRelativePath] } }))
    client = await startClient(unresolvable, callerCwd)
    const unknownRepo = await callStable(client, unresolvable, 'unknown')
    assert.equal(unknownRepo.bytes, 20)
    console.log(JSON.stringify({ status: 'pass', schema_bytes: schemaBytes, response_bytes: { match: first.bytes, mismatch: drift.bytes, unknown: missing.bytes } }, null, 2))
  } finally {
    if (client) await client.close().catch(() => {})
    await rm(root, { recursive: true, force: true })
    if (callerCwd) await rm(callerCwd, { recursive: true, force: true })
    if (unresolvable) await rm(unresolvable, { recursive: true, force: true })
  }
}

await run()
