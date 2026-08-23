import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const registeredPath = join(root, 'out', 'mcp', 'server.js')
let registeredBefore
try {
  registeredBefore = {
    hash: createHash('sha256').update(await readFile(registeredPath)).digest('hex'),
    mtime: (await stat(registeredPath)).mtimeMs
  }
} catch (error) {
  throw new Error(`registered MCP bundle is unavailable; run npm run build:mcp first (${registeredPath})`, { cause: error })
}
await mkdir(join(root, 'out'), { recursive: true })
const temporaryRoot = await mkdtemp(join(root, 'out', 'mcp-check-'))
const serverPath = join(temporaryRoot, 'server.js')
const environment = { ...process.env, TSUZUNE_MCP_SERVER_PATH: serverPath }

try {
  await run(process.execPath, [join(root, 'scripts', 'build-mcp.mjs'), '--outfile', serverPath], { cwd: root, env: environment })
  for (const script of ['check-mcp-contract.mjs', 'check-mcp.mjs', 'check-mcp-freebuff.mjs', 'evaluate-delivery-info.mjs', 'evaluate-stale-runtime-write-guard.mjs']) {
    await run(process.execPath, [join(root, 'scripts', script)], { cwd: root, env: environment })
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
  const registeredAfter = {
    hash: createHash('sha256').update(await readFile(registeredPath)).digest('hex'),
    mtime: (await stat(registeredPath)).mtimeMs
  }
  if (registeredAfter.hash !== registeredBefore.hash || registeredAfter.mtime !== registeredBefore.mtime) {
    throw new Error('registered MCP bundle changed during check:mcp')
  }
}
