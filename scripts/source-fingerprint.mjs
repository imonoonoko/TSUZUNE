import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { constants, existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

export const SOURCE_RECEIPT_RELATIVE_PATH =
  'docs/reports/production-update-latest.json'

export async function sha256File(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

export async function fingerprintFiles(base, paths) {
  const hash = createHash('sha256')
  const normalizedPaths = [...paths].sort((left, right) =>
    left.localeCompare(right, 'en')
  )
  for (const path of normalizedPaths) {
    const normalized = relative(base, path).replaceAll('\\', '/')
    hash.update(normalized)
    hash.update('\0')
    hash.update(await sha256File(path))
    hash.update('\0')
  }
  return { fileCount: normalizedPaths.length, digest: hash.digest('hex') }
}

function gitTopLevel(repositoryRoot) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  })
  if (result.status !== 0 || result.error) throw new Error('git root unavailable')
  return resolve(result.stdout.trim())
}

export async function snapshotSourceTree(repositoryRoot, archiveDirectory) {
  const root = resolve(repositoryRoot)
  if (gitTopLevel(root) !== root) throw new Error('repository root mismatch')
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' }
  )
  if (result.status !== 0 || result.error) throw new Error('source listing unavailable')
  const paths = result.stdout
    .split('\0')
    .filter(Boolean)
    .filter((path) => path.replaceAll('\\', '/') !== SOURCE_RECEIPT_RELATIVE_PATH)
    .map((path) => resolve(root, path))
    .filter((path) => existsSync(path))
  const fingerprint = await fingerprintFiles(root, paths)
  if (archiveDirectory) {
    const archivedPaths = []
    for (const path of paths) {
      const archived = resolve(archiveDirectory, relative(root, path))
      await mkdir(dirname(archived), { recursive: true })
      await copyFile(path, archived, constants.COPYFILE_EXCL)
      archivedPaths.push(archived)
    }
    const archiveFingerprint = await fingerprintFiles(archiveDirectory, archivedPaths)
    if (archiveFingerprint.digest !== fingerprint.digest) {
      throw new Error('Source archive does not match the source fingerprint')
    }
  }
  return {
    ...fingerprint,
    excludedPaths: [SOURCE_RECEIPT_RELATIVE_PATH]
  }
}

function validFingerprint(value) {
  return Boolean(
    value &&
      Number.isInteger(value.fileCount) &&
      value.fileCount >= 0 &&
      typeof value.digest === 'string' &&
      /^[a-f0-9]{64}$/.test(value.digest) &&
      Array.isArray(value.excludedPaths) &&
      value.excludedPaths.length === 1 &&
      value.excludedPaths[0] === SOURCE_RECEIPT_RELATIVE_PATH
  )
}

export async function deliveryStatus(repositoryRoot) {
  try {
    const root = resolve(repositoryRoot)
    const receipt = JSON.parse(
      await readFile(resolve(root, SOURCE_RECEIPT_RELATIVE_PATH), 'utf8')
    )
    if (!validFingerprint(receipt.sourceFingerprint)) return 'unknown'
    const current = await snapshotSourceTree(root)
    return current.fileCount === receipt.sourceFingerprint.fileCount &&
      current.digest === receipt.sourceFingerprint.digest
      ? 'match'
      : 'mismatch'
  } catch {
    return 'unknown'
  }
}
