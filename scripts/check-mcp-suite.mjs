import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const registeredPath = resolve(process.env.TSUZUNE_REGISTERED_MCP_SERVER_PATH ?? join(root,'out','mcp','server.js'))
let registeredBefore
async function registeredArtifacts() {
  const directory = dirname(registeredPath)
  const result = []
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name), info = await stat(path)
    if (!info.isFile()) continue
    result.push({name,hash:createHash('sha256').update(await readFile(path)).digest('hex'),mtime:info.mtimeMs})
  }
  return result
}
try {
  await stat(registeredPath)
  registeredBefore = await registeredArtifacts()
} catch (error) {
  throw new Error(`registered MCP bundle is unavailable; run npm run build:mcp first (${registeredPath})`, { cause: error })
}
await mkdir(join(root, 'out'), { recursive: true })
const temporaryRoot = await mkdtemp(join(root, 'out', 'mcp-check-'))
const serverPath = join(temporaryRoot, 'server.js')
const environment = { ...process.env, TSUZUNE_MCP_SERVER_PATH: serverPath }

try {
  await run(process.execPath, [join(root, 'scripts', 'build-mcp.mjs'), '--outfile', serverPath], { cwd: root, env: environment })
  for (const script of ['check-mcp-contract.mjs', 'check-mcp.mjs', 'check-mcp-fetch-pages.mjs', 'check-mcp-knowledge-flow.mjs', 'check-mcp-freebuff.mjs', 'evaluate-delivery-info.mjs', 'evaluate-stale-runtime-write-guard.mjs']) {
    const result = await run(process.execPath, [join(root, 'scripts', script)], { cwd: root, env: environment })
    process.stdout.write(result.stdout)
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
  const registeredAfter = await registeredArtifacts()
  if (JSON.stringify(registeredAfter) !== JSON.stringify(registeredBefore)) {
    throw new Error('registered MCP artifacts (server/Worker/maps) changed during check:mcp')
  }
}
