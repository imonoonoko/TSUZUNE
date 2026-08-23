/**
 * O2-P4A test-only Path Alias sidecar synchronization.
 * This module has no app, IPC, MCP, package-command, or live-Drive entry point.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { compilePathAliases } from '../core/path-aliases'

export interface RemotePathAliasObject {
  id: string
  vaultId: string
  role: 'pathAliases'
  parentId: string
  version: string
  bytes: Buffer
}

export interface DrivePathAliasRemote {
  list(vaultId: string): Promise<RemotePathAliasObject[]>
  create(input: {
    vaultId: string
    parentId: string
    bytes: Buffer
  }): Promise<RemotePathAliasObject>
  update(input: {
    fileId: string
    vaultId: string
    parentId: string
    expectedVersion: string
    bytes: Buffer
  }): Promise<RemotePathAliasObject>
  remove?(input: {
    fileId: string
    vaultId: string
    parentId: string
    expectedVersion: string
  }): Promise<void>
}

interface PrototypeOptions {
  vaultRoot: string
  ledgerPath: string
  sidecarPath: string
  vaultId: string
  rootFolderId: string
  remote: DrivePathAliasRemote
}

export interface DrivePathAliasSyncPreview {
  action: 'upload' | 'download' | 'none' | 'conflict'
  fingerprint: string
  localHash: string | null
  remoteHash: string | null
  remoteId: string | null
  remoteVersion: string | null
}

interface PathAliasLedger {
  kind: 'o2-p4a-path-alias-ledger'
  version: 1
  vaultId: string
  rootFolderId: string
  fileId: string
  localHash: string
  remoteHash: string
  remoteVersion: string
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function validatePaths(options: PrototypeOptions): void {
  const expectedSidecar = resolve(options.vaultRoot, '.tsuzune', 'path-aliases.json')
  if (resolve(options.sidecarPath).toLowerCase() !== expectedSidecar.toLowerCase()) {
    throw new Error('Path Alias sidecar pathが所有境界と一致しません。')
  }
  const ledgerRelative = relative(resolve(options.vaultRoot), resolve(options.ledgerPath))
  if (!ledgerRelative.startsWith('..') && !isAbsolute(ledgerRelative)) {
    throw new Error('Path Alias ledger pathはVault外でなければなりません。')
  }
}

function validateAliasBytes(bytes: Buffer): void {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  compilePathAliases(JSON.parse(text) as unknown)
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp-${randomUUID()}`
  try {
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), {
      encoding: 'utf8',
      flag: 'wx'
    })
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function readOptional(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function writeBytesAtomic(path: string, bytes: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp-${randomUUID()}`
  try {
    await writeFile(temporaryPath, bytes, { flag: 'wx' })
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

function ownedRemote(
  candidates: RemotePathAliasObject[],
  vaultId: string,
  rootFolderId: string
): RemotePathAliasObject | null {
  const owned = candidates.filter(
    (candidate) =>
      candidate.id.length > 0 &&
      candidate.version.length > 0 &&
      candidate.vaultId === vaultId &&
      candidate.role === 'pathAliases' &&
      candidate.parentId === rootFolderId
  )
  if (owned.length > 1) {
    throw new Error('Driveに所有済みPath Alias objectが複数あります。')
  }
  return owned[0] ?? null
}

async function readLedger(path: string): Promise<PathAliasLedger | null> {
  const bytes = await readOptional(path)
  if (!bytes) return null
  const value = JSON.parse(bytes.toString('utf8')) as Partial<PathAliasLedger>
  if (
    value.kind !== 'o2-p4a-path-alias-ledger' ||
    value.version !== 1 ||
    typeof value.vaultId !== 'string' ||
    typeof value.rootFolderId !== 'string' ||
    typeof value.fileId !== 'string' ||
    typeof value.localHash !== 'string' ||
    typeof value.remoteHash !== 'string' ||
    typeof value.remoteVersion !== 'string'
  ) {
    throw new Error('Path Alias sync ledgerが不正です。')
  }
  return value as PathAliasLedger
}

export async function previewDrivePathAliasSyncPrototype(
  options: PrototypeOptions
): Promise<DrivePathAliasSyncPreview> {
  validatePaths(options)
  const localBytes = await readOptional(options.sidecarPath)
  if (localBytes) validateAliasBytes(localBytes)
  const remote = ownedRemote(
    await options.remote.list(options.vaultId),
    options.vaultId,
    options.rootFolderId
  )
  if (remote) validateAliasBytes(remote.bytes)
  if (!localBytes && !remote) {
    throw new Error('同期するPath Alias sidecarがありません。')
  }
  const localHash = localBytes ? sha256(localBytes) : null
  const remoteHash = remote ? sha256(remote.bytes) : null
  const ledger = await readLedger(options.ledgerPath)
  let action: DrivePathAliasSyncPreview['action']
  if (localHash && remoteHash && localHash !== remoteHash) {
    const sameCheckpoint =
      ledger?.vaultId === options.vaultId &&
      ledger.rootFolderId === options.rootFolderId &&
      ledger.fileId === remote?.id
    if (
      sameCheckpoint &&
      ledger.remoteHash === remoteHash &&
      ledger.remoteVersion === remote?.version &&
      ledger.localHash !== localHash
    ) {
      action = 'upload'
    } else if (
      sameCheckpoint &&
      ledger.localHash === localHash &&
      ledger.remoteHash !== remoteHash
    ) {
      action = 'download'
    } else {
      action = 'conflict'
    }
  } else {
    action = localBytes && remote ? 'none' : localBytes ? 'upload' : 'download'
  }
  return {
    action,
    localHash,
    remoteHash,
    remoteId: remote?.id ?? null,
    remoteVersion: remote?.version ?? null,
    fingerprint: sha256(
      Buffer.from(
        JSON.stringify({
          vaultId: options.vaultId,
          rootFolderId: options.rootFolderId,
          localHash,
          remoteHash,
          remoteId: remote?.id ?? null,
          remoteVersion: remote?.version ?? null,
          ledgerHash: ledger ? sha256(Buffer.from(JSON.stringify(ledger))) : null
        })
      )
    )
  }
}

export async function applyDrivePathAliasSyncPrototype(
  options: PrototypeOptions & { preview: DrivePathAliasSyncPreview }
): Promise<void> {
  const fresh = await previewDrivePathAliasSyncPrototype(options)
  if (fresh.fingerprint !== options.preview.fingerprint) {
    throw new Error('Path Alias sync changed after preview.')
  }
  if (fresh.action === 'conflict') {
    throw new Error('Path Alias sidecarのローカルとremoteが競合しています。')
  }
  const localPreimage =
    fresh.action === 'download' ? await readOptional(options.sidecarPath) : null
  let downloaded = false
  let object: RemotePathAliasObject
  if (fresh.action === 'upload') {
    const bytes = await readFile(options.sidecarPath)
    object = fresh.remoteId
      ? await options.remote.update({
          fileId: fresh.remoteId,
          vaultId: options.vaultId,
          parentId: options.rootFolderId,
          expectedVersion: fresh.remoteVersion!,
          bytes
        })
      : await options.remote.create({
          vaultId: options.vaultId,
          parentId: options.rootFolderId,
          bytes
        })
    if (
      !ownedRemote([object], options.vaultId, options.rootFolderId) ||
      !object.bytes.equals(bytes)
    ) {
      throw new Error('Remote Path Alias mutation response identity or bytes mismatch.')
    }
  } else {
    object = ownedRemote(
      await options.remote.list(options.vaultId),
      options.vaultId,
      options.rootFolderId
    )!
    if (fresh.action === 'download') {
      await writeBytesAtomic(options.sidecarPath, object.bytes)
      downloaded = true
    }
  }
  try {
    await writeJsonAtomic(options.ledgerPath, {
      kind: 'o2-p4a-path-alias-ledger',
      version: 1,
      vaultId: options.vaultId,
      rootFolderId: options.rootFolderId,
      fileId: object.id,
      localHash: sha256(object.bytes),
      remoteHash: sha256(object.bytes),
      remoteVersion: object.version
    })
  } catch (error) {
    if (downloaded) {
      if (localPreimage) {
        await writeBytesAtomic(options.sidecarPath, localPreimage)
      } else {
        await rm(options.sidecarPath, { force: true })
      }
    }
    throw error
  }
}
