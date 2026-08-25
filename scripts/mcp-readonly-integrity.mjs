import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, readlink } from 'node:fs/promises'
import { join, relative } from 'node:path'

async function snapshotTree(root) {
  const entries = []

  async function visit(path) {
    let info
    try {
      info = await lstat(path)
    } catch (error) {
      if (path === root && error?.code === 'ENOENT') {
        entries.push({ path: '.', type: 'missing' })
        return
      }
      throw error
    }

    const entryPath = path === root
      ? '.'
      : relative(root, path).replaceAll('\\', '/')
    if (info.isDirectory()) {
      entries.push({ path: entryPath, type: 'directory', mtimeMs: info.mtimeMs })
      const children = await readdir(path)
      for (const child of children.sort()) await visit(join(path, child))
      return
    }
    if (info.isSymbolicLink()) {
      entries.push({
        path: entryPath,
        type: 'symlink',
        target: await readlink(path),
        mtimeMs: info.mtimeMs
      })
      return
    }
    if (info.isFile()) {
      entries.push({
        path: entryPath,
        type: 'file',
        size: info.size,
        mtimeMs: info.mtimeMs,
        sha256: createHash('sha256').update(await readFile(path)).digest('hex')
      })
    }
  }

  await visit(root)
  return entries
}

async function snapshotScopes(scopes) {
  const snapshot = new Map()
  for (const scope of scopes) {
    snapshot.set(
      scope.name,
      JSON.stringify(await snapshotTree(scope.path))
    )
  }
  return snapshot
}

export async function assertNoTreeMutation(scopes, operation, label) {
  const before = await snapshotScopes(scopes)
  let result
  let operationError
  try {
    result = await operation()
  } catch (error) {
    operationError = error
  }
  const after = await snapshotScopes(scopes)
  const changed = scopes
    .filter((scope) => before.get(scope.name) !== after.get(scope.name))
    .map((scope) => scope.name)

  if (changed.length > 0) {
    const noun = changed.length === 1 ? 'scope' : 'scopes'
    throw new Error(`${label} mutated ${noun}: ${changed.join(', ')}`, {
      cause: operationError
    })
  }
  if (operationError) throw operationError
  return result
}

export function assertExactReadOnlyCoverage(expectedNames, exercisedNames) {
  const expected = [...new Set(expectedNames)].sort()
  const exercised = new Set(exercisedNames)
  const missing = expected.filter((name) => !exercised.has(name))
  if (missing.length > 0) {
    throw new Error(`read-only MCP coverage is incomplete: ${missing.join(', ')}`)
  }
  const unexpected = [...exercised].filter((name) => !expected.includes(name)).sort()
  if (unexpected.length > 0) {
    throw new Error(`undeclared read-only MCP tools were exercised: ${unexpected.join(', ')}`)
  }
}
