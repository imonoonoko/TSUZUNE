import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { planDriveSync, type DriveSyncDecision } from '../core/drive-sync'
import {
  basenameRelative,
  dirnameRelative,
  withoutMarkdownExtension
} from '../core/paths'
import type {
  CreateDirectoryInput,
  CreateNoteInput,
  DriveSyncApplyResult,
  DriveSyncPreview,
  EntryOperationOutput,
  MoveNoteInput,
  SaveNoteInput,
  SaveNoteOutput,
  VaultSnapshot
} from '../shared/types'
import {
  createMarkdown,
  downloadMarkdown,
  DriveChangeTokenInvalidError,
  ensureVaultRoot,
  getDriveStartPageToken,
  listDriveChanges,
  listVaultFiles,
  listVaultRoots,
  moveMarkdown,
  updateMarkdown,
  type CreateMarkdownInput,
  type DriveChangePage,
  type DriveMarkdownFile,
  type DriveVaultRoot,
  type MoveMarkdownInput,
  type UpdateMarkdownInput
} from './google-drive'

interface SyncConnection {
  getAccessToken(): Promise<string>
}

interface SyncVault {
  getRootPath(): string | null
  scan(): Promise<VaultSnapshot>
  saveNote(input: SaveNoteInput): Promise<SaveNoteOutput>
  createNote(input: CreateNoteInput): Promise<EntryOperationOutput>
  createDirectory(input: CreateDirectoryInput): Promise<EntryOperationOutput>
  moveNote(input: MoveNoteInput): Promise<EntryOperationOutput>
}

export interface DriveSyncRemote {
  list(accessToken: string, vaultId: string): Promise<DriveMarkdownFile[]>
  getStartPageToken(accessToken: string): Promise<string>
  listChanges(
    accessToken: string,
    pageToken: string,
    vaultId: string
  ): Promise<DriveChangePage>
  listRoots(accessToken: string): Promise<DriveVaultRoot[]>
  download(accessToken: string, fileId: string): Promise<string>
  ensureRoot(
    accessToken: string,
    vaultId: string,
    rootName: string
  ): Promise<DriveVaultRoot>
  create(
    accessToken: string,
    input: CreateMarkdownInput
  ): Promise<DriveMarkdownFile>
  update(
    accessToken: string,
    input: UpdateMarkdownInput
  ): Promise<DriveMarkdownFile>
  move(
    accessToken: string,
    input: MoveMarkdownInput
  ): Promise<DriveMarkdownFile>
}

interface LedgerFile {
  fileId: string
  localHash: string
  remoteHash: string
  remoteVersion?: string
}

interface RemoteLedgerFile {
  fileId: string
  remoteHash: string
  remoteVersion: string
}

interface VaultLedger {
  rootPath: string
  vaultId: string
  rootFolderId: string | null
  lastSyncAt: string | null
  files: Record<string, LedgerFile>
  remoteFiles?: Record<string, RemoteLedgerFile>
  changeToken?: string
  pendingMoves?: Record<string, string>
}

interface SyncLedger {
  version: 1
  vaults: VaultLedger[]
}

interface LocalFile {
  path: string
  content: string
  hash: string
  modifiedAt: number
}

interface RemoteFile {
  path: string
  content: string | null
  hash: string
  fileId: string
  version: string
}

interface Inspection {
  rootPath: string
  rootName: string
  directories: string[]
  vault: VaultLedger
  local: Map<string, LocalFile>
  remote: Map<string, RemoteFile>
  decisions: DriveSyncDecision[]
  fingerprint: string
  nextChangeToken: string
}

interface PendingPlan {
  preview: DriveSyncPreview
  inspection: Inspection
}

export interface DriveSyncServiceDependencies {
  ledgerPath: string
  vault: SyncVault
  connection: SyncConnection
  remote?: DriveSyncRemote
  now?: () => Date
}

export interface RemoteVaultSummary {
  rootFolderId: string
  vaultId: string
  name: string
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function emptyLedger(): SyncLedger {
  return { version: 1, vaults: [] }
}

function defaultRemote(fetchImpl: typeof fetch = globalThis.fetch): DriveSyncRemote {
  return {
    list: (accessToken, vaultId) =>
      listVaultFiles(accessToken, vaultId, fetchImpl),
    getStartPageToken: (accessToken) =>
      getDriveStartPageToken(accessToken, fetchImpl),
    listChanges: (accessToken, pageToken, vaultId) =>
      listDriveChanges(accessToken, pageToken, vaultId, fetchImpl),
    listRoots: (accessToken) => listVaultRoots(accessToken, fetchImpl),
    download: (accessToken, fileId) =>
      downloadMarkdown(accessToken, fileId, fetchImpl),
    ensureRoot: (accessToken, vaultId, rootName) =>
      ensureVaultRoot(accessToken, vaultId, rootName, fetchImpl),
    create: (accessToken, input) =>
      createMarkdown(accessToken, input, fetchImpl),
    update: (accessToken, input) =>
      updateMarkdown(accessToken, input, fetchImpl),
    move: (accessToken, input) =>
      moveMarkdown(accessToken, input, fetchImpl)
  }
}

function countActions(items: DriveSyncDecision[]): DriveSyncPreview['counts'] {
  return {
    upload: items.filter((item) => item.action === 'upload').length,
    download: items.filter((item) => item.action === 'download').length,
    move: items.filter((item) => item.action === 'move').length,
    conflict: items.filter((item) => item.action === 'conflict').length,
    preserve: items.filter((item) => item.action === 'preserve').length
  }
}

function timestampLabel(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('')
}

export class DriveSyncService {
  private readonly remote: DriveSyncRemote
  private readonly now: () => Date
  private pendingPlan: PendingPlan | null = null

  constructor(private readonly dependencies: DriveSyncServiceDependencies) {
    this.remote = dependencies.remote ?? defaultRemote()
    this.now = dependencies.now ?? (() => new Date())
  }

  async listRemoteVaults(): Promise<RemoteVaultSummary[]> {
    const accessToken = await this.dependencies.connection.getAccessToken()
    const roots = await this.remote.listRoots(accessToken)
    return roots.map((root) => ({
      rootFolderId: root.id,
      vaultId: root.appProperties.tsuzuneVaultId,
      name: root.name
    }))
  }

  async pairRemoteVault(
    rootFolderId: string,
    vaultId: string
  ): Promise<void> {
    const rootPath = this.requireRootPath()
    const accessToken = await this.dependencies.connection.getAccessToken()
    const roots = await this.remote.listRoots(accessToken)
    const liveRoot = roots.find(
      (root) =>
        root.id === rootFolderId &&
        root.appProperties.tsuzuneVaultId === vaultId
    )
    if (!liveRoot) {
      throw new Error(
        '指定されたTSUZUNE VaultがGoogle Driveに見つかりません。'
      )
    }

    const ledger = await this.readLedger()
    const current = ledger.vaults.find((entry) => entry.rootPath === rootPath)
    const sameBinding =
      current?.rootFolderId === rootFolderId && current.vaultId === vaultId
    if (
      current &&
      !sameBinding &&
      (current.lastSyncAt !== null || Object.keys(current.files).length > 0)
    ) {
      throw new Error(
        '同期済みのVaultを別のGoogle Drive Vaultへ紐付け直すことはできません。'
      )
    }

    if (current) {
      current.vaultId = vaultId
      current.rootFolderId = rootFolderId
      if (!sameBinding) {
        current.changeToken = undefined
        current.remoteFiles = undefined
      }
    } else {
      ledger.vaults.push({
        rootPath,
        vaultId,
        rootFolderId,
        lastSyncAt: null,
        files: {}
      })
    }
    await this.writeLedger(ledger)
    this.pendingPlan = null
  }

  async getStatusMetadata(
    rootPath: string | null
  ): Promise<{ lastSyncAt: string | null; rootFolderId: string | null }> {
    if (!rootPath) {
      return { lastSyncAt: null, rootFolderId: null }
    }
    const ledger = await this.readLedger()
    const vault = ledger.vaults.find((entry) => entry.rootPath === rootPath)
    return {
      lastSyncAt: vault?.lastSyncAt ?? null,
      rootFolderId: vault?.rootFolderId ?? null
    }
  }

  async recordLocalMove(oldPath: string, path: string): Promise<void> {
    if (oldPath === path) return
    const rootPath = this.requireRootPath()
    const ledger = await this.readLedger()
    const vault = ledger.vaults.find((entry) => entry.rootPath === rootPath)
    if (!vault) return

    const pendingMoves = { ...(vault.pendingMoves ?? {}) }
    const originalPath =
      Object.entries(pendingMoves).find(([, target]) => target === oldPath)?.[0] ??
      oldPath
    if (!vault.files[originalPath]) return

    delete pendingMoves[originalPath]
    if (originalPath !== path) pendingMoves[originalPath] = path
    vault.pendingMoves = pendingMoves
    await this.writeLedger(ledger)
    this.pendingPlan = null
  }

  async preview(): Promise<DriveSyncPreview> {
    const rootPath = this.requireRootPath()
    const ledger = await this.readLedger()
    let vault = ledger.vaults.find((entry) => entry.rootPath === rootPath)
    if (!vault) {
      vault = {
        rootPath,
        vaultId: randomUUID(),
        rootFolderId: null,
        lastSyncAt: null,
        files: {}
      }
      ledger.vaults.push(vault)
      await this.writeLedger(ledger)
    }

    const inspection = await this.inspect(vault)
    if (inspection.decisions.length === 0) {
      vault.remoteFiles = this.remoteLedger(inspection.remote)
      vault.changeToken = inspection.nextChangeToken
      await this.writeLedger(ledger)
    }
    const createdAt = this.now().toISOString()
    const preview: DriveSyncPreview = {
      planId: randomUUID(),
      createdAt,
      items: inspection.decisions.map((decision) => ({
        path: decision.path,
        action: decision.action,
        reason: decision.reason,
        ...(decision.action === 'move' ? { oldPath: decision.oldPath } : {})
      })),
      counts: countActions(inspection.decisions)
    }
    this.pendingPlan = { preview, inspection }
    return preview
  }

  async apply(planId: string): Promise<DriveSyncApplyResult> {
    const pending = this.pendingPlan
    if (!pending || pending.preview.planId !== planId) {
      throw new Error('同期プランが見つかりません。もう一度内容を確認してください。')
    }
    if (this.requireRootPath() !== pending.inspection.rootPath) {
      throw new Error('Vaultが切り替わりました。同期内容を確認し直してください。')
    }

    const ledger = await this.readLedger()
    const vault = ledger.vaults.find(
      (entry) => entry.rootPath === pending.inspection.rootPath
    )
    if (!vault || vault.vaultId !== pending.inspection.vault.vaultId) {
      throw new Error('同期状態が変わりました。同期内容を確認し直してください。')
    }

    const fresh = await this.inspect(vault, pending.inspection.remote)
    if (fresh.fingerprint !== pending.inspection.fingerprint) {
      this.pendingPlan = null
      throw new Error(
        'プレビュー後にローカルまたはDriveの内容が変わりました。同期内容を確認し直してください。'
      )
    }

    const accessToken = await this.dependencies.connection.getAccessToken()
    const result: DriveSyncApplyResult = {
      uploaded: 0,
      downloaded: 0,
      moved: 0,
      conflicts: 0,
      preserved: 0,
      conflictPaths: [],
      completedAt: ''
    }
    let rootFolderId = vault.rootFolderId
    const nextFiles = { ...vault.files }
    const nextRemote = new Map(fresh.remote)
    const createdPaths = new Set<string>()
    const existingLocalPaths = new Set(
      [
        ...fresh.local.keys(),
        ...fresh.directories
          .filter(Boolean)
          .map((path) => `${path}/`)
      ].map((path) => path.toLocaleLowerCase())
    )

    const ensureRoot = async (): Promise<string> => {
      if (!rootFolderId) {
        rootFolderId = (
          await this.remote.ensureRoot(
            accessToken,
            vault.vaultId,
            `TSUZUNE - ${fresh.rootName}`
          )
        ).id
      }
      return rootFolderId
    }

    const checkpoint = async (): Promise<void> => {
      vault.rootFolderId = rootFolderId
      vault.files = { ...nextFiles }
      await this.writeLedger(ledger)
    }

    for (const decision of fresh.decisions) {
      const local = fresh.local.get(decision.path)
      const remote = fresh.remote.get(decision.path)

      if (decision.action === 'move') {
        const previous = vault.files[decision.oldPath]
        if (!previous) {
          throw new Error('同期済みノートの移動履歴が変わりました。確認し直してください。')
        }
        if (decision.reason === 'local_moved') {
          const oldRemote = fresh.remote.get(decision.oldPath)
          if (!local || !oldRemote) {
            throw new Error('移動対象が変わりました。同期内容を確認し直してください。')
          }
          const moved = await this.remote.move(accessToken, {
            fileId: previous.fileId,
            vaultId: vault.vaultId,
            oldPath: decision.oldPath,
            path: decision.path,
            expectedVersion: oldRemote.version
          })
          fresh.remote.delete(decision.oldPath)
          fresh.remote.set(decision.path, {
            path: decision.path,
            fileId: moved.id,
            version: this.requireRemoteVersion(moved),
            content: oldRemote.content,
            hash: oldRemote.hash
          })
          nextRemote.delete(decision.oldPath)
          nextRemote.set(decision.path, fresh.remote.get(decision.path) as RemoteFile)
          delete vault.pendingMoves?.[decision.oldPath]
        } else {
          const oldLocal = fresh.local.get(decision.oldPath)
          if (!oldLocal || !remote) {
            throw new Error('移動対象が変わりました。同期内容を確認し直してください。')
          }
          await this.ensureLocalDirectory(dirnameRelative(decision.path), existingLocalPaths)
          await this.dependencies.vault.moveNote({
            path: decision.oldPath,
            destinationDirectory: dirnameRelative(decision.path),
            destinationPath: decision.path
          })
          fresh.local.delete(decision.oldPath)
          fresh.local.set(decision.path, { ...oldLocal, path: decision.path })
          existingLocalPaths.delete(decision.oldPath.toLocaleLowerCase())
          existingLocalPaths.add(decision.path.toLocaleLowerCase())
        }
        delete nextFiles[decision.oldPath]
        nextFiles[decision.path] = {
          ...previous,
          remoteVersion:
            fresh.remote.get(decision.path)?.version ?? previous.remoteVersion
        }
        await checkpoint()
        result.moved += 1
        continue
      }

      if (decision.action === 'upload' && local) {
        let uploaded: DriveMarkdownFile
        if (remote) {
          uploaded = await this.remote.update(accessToken, {
            fileId: remote.fileId,
            vaultId: vault.vaultId,
            path: decision.path,
            expectedVersion: remote.version,
            content: local.content
          })
        } else {
          uploaded = await this.remote.create(accessToken, {
            vaultId: vault.vaultId,
            path: decision.path,
            parentId: await ensureRoot(),
            content: local.content
          })
        }
        nextFiles[decision.path] = {
          fileId: uploaded.id,
          localHash: local.hash,
          remoteHash: local.hash,
          remoteVersion: this.requireRemoteVersion(uploaded)
        }
        nextRemote.set(decision.path, {
          path: decision.path,
          fileId: uploaded.id,
          version: this.requireRemoteVersion(uploaded),
          content: local.content,
          hash: local.hash
        })
        await checkpoint()
        result.uploaded += 1
        continue
      }

      if (decision.action === 'download' && remote) {
        if (remote.content === null) {
          throw new Error(`Google Driveのノート本文を取得できません: ${remote.path}`)
        }
        if (local) {
          await this.dependencies.vault.saveNote({
            path: local.path,
            content: remote.content,
            expectedModifiedAt: local.modifiedAt
          })
        } else {
          await this.ensureLocalDirectory(
            dirnameRelative(remote.path),
            existingLocalPaths
          )
          await this.dependencies.vault.createNote({
            directory: dirnameRelative(remote.path),
            name: basenameRelative(remote.path),
            content: remote.content
          })
          existingLocalPaths.add(remote.path.toLocaleLowerCase())
        }
        nextFiles[decision.path] = {
          fileId: remote.fileId,
          localHash: remote.hash,
          remoteHash: remote.hash,
          remoteVersion: remote.version
        }
        await checkpoint()
        result.downloaded += 1
        continue
      }

      if (decision.action === 'conflict' && local && remote) {
        if (remote.content === null) {
          throw new Error(`Google Driveのノート本文を取得できません: ${remote.path}`)
        }
        const conflictPath = await this.createConflictCopy(
          remote.path,
          remote.content,
          existingLocalPaths
        )
        const uploaded = await this.remote.update(accessToken, {
          fileId: remote.fileId,
          vaultId: vault.vaultId,
          path: decision.path,
          expectedVersion: remote.version,
          content: local.content
        })
        nextFiles[decision.path] = {
          fileId: uploaded.id,
          localHash: local.hash,
          remoteHash: local.hash,
          remoteVersion: this.requireRemoteVersion(uploaded)
        }
        nextRemote.set(decision.path, {
          path: decision.path,
          fileId: uploaded.id,
          version: this.requireRemoteVersion(uploaded),
          content: local.content,
          hash: local.hash
        })
        await checkpoint()

        const preserved = await this.remote.create(accessToken, {
          vaultId: vault.vaultId,
          path: conflictPath,
          parentId: await ensureRoot(),
          content: remote.content
        })
        nextFiles[conflictPath] = {
          fileId: preserved.id,
          localHash: remote.hash,
          remoteHash: remote.hash,
          remoteVersion: this.requireRemoteVersion(preserved)
        }
        nextRemote.set(conflictPath, {
          path: conflictPath,
          fileId: preserved.id,
          version: this.requireRemoteVersion(preserved),
          content: remote.content,
          hash: remote.hash
        })
        createdPaths.add(conflictPath)
        await checkpoint()
        result.uploaded += 2
        result.conflicts += 1
        result.conflictPaths.push(conflictPath)
        continue
      }

      if (decision.action === 'preserve') {
        result.preserved += 1
      }
    }

    const allPaths = new Set([
      ...fresh.local.keys(),
      ...fresh.remote.keys(),
      ...createdPaths
    ])
    for (const path of Object.keys(nextFiles)) {
      if (!allPaths.has(path)) {
        delete nextFiles[path]
      }
    }
    for (const path of allPaths) {
      const local = fresh.local.get(path)
      const remote = fresh.remote.get(path)
      const decision = fresh.decisions.find((item) => item.path === path)
      if (decision?.action === 'preserve' || !local || !remote) {
        continue
      }
      if (local.hash === remote.hash) {
        nextFiles[path] = {
          fileId: remote.fileId,
          localHash: local.hash,
          remoteHash: remote.hash,
          remoteVersion: remote.version
        }
        continue
      }
      if (!nextFiles[path]) {
        nextFiles[path] = {
          fileId: remote.fileId,
          localHash: local.hash,
          remoteHash: remote.hash,
          remoteVersion: remote.version
        }
      }
    }

    result.completedAt = this.now().toISOString()
    vault.rootFolderId = rootFolderId
    vault.lastSyncAt = result.completedAt
    vault.files = nextFiles
    vault.remoteFiles = this.remoteLedger(nextRemote)
    vault.changeToken = fresh.nextChangeToken
    await this.writeLedger(ledger)
    this.pendingPlan = null
    return result
  }

  private requireRootPath(): string {
    const rootPath = this.dependencies.vault.getRootPath()
    if (!rootPath) {
      throw new Error('先にVaultを開いてください。')
    }
    return rootPath
  }

  private async inspect(
    vault: VaultLedger,
    cachedRemote: Map<string, RemoteFile> | null = null
  ): Promise<Inspection> {
    const [snapshot, accessToken] = await Promise.all([
      this.dependencies.vault.scan(),
      this.dependencies.connection.getAccessToken()
    ])
    const { files: remoteMetadata, nextChangeToken } =
      await this.listRemoteMetadata(accessToken, vault)
    const localPathsByKey = new Map<string, string>()
    for (const note of snapshot.notes) {
      const key = note.path.toLowerCase()
      const existingLocalPath = localPathsByKey.get(key)
      if (existingLocalPath && existingLocalPath !== note.path) {
        throw new Error(
          `Vaultに同じTSUZUNEパスが複数あります: ${existingLocalPath}, ${note.path}`
        )
      }
      localPathsByKey.set(key, note.path)
    }
    const remotePathsByKey = new Map<string, string>()
    for (const file of remoteMetadata) {
      const key = file.path.toLowerCase()
      const existingRemotePath = remotePathsByKey.get(key)
      if (existingRemotePath && existingRemotePath !== file.path) {
        throw new Error(
          `Google Driveに同じTSUZUNEパスが複数あります: ${existingRemotePath}, ${file.path}`
        )
      }
      const localPath = localPathsByKey.get(key)
      if (localPath && localPath !== file.path) {
        throw new Error(
          `VaultとGoogle Driveに大文字小文字だけが異なる同じTSUZUNEパスがあります: ${localPath}, ${file.path}`
        )
      }
      if (!file.version) {
        throw new Error(
          `Google Driveのノート版を確認できません: ${file.path}`
        )
      }
      remotePathsByKey.set(key, file.path)
    }
    const local = new Map(
      snapshot.notes.map((note) => [
        note.path,
        {
          path: note.path,
          content: note.content,
          hash: sha256(note.content),
          modifiedAt: note.modifiedAt
        }
      ])
    )
    const remote = new Map<string, RemoteFile>()
    await Promise.all(remoteMetadata.map(async (file) => {
      if (remote.has(file.path)) {
        throw new Error(
          `Google Driveに同じTSUZUNEパスが複数あります: ${file.path}`
        )
      }
      const version = file.version as string
      const cached = cachedRemote?.get(file.path)
      const previous = vault.files[file.path]
      if (
        cached?.fileId === file.id &&
        cached.version === version
      ) {
        remote.set(file.path, cached)
        return
      }
      if (
        previous?.fileId === file.id &&
        previous.remoteVersion === version
      ) {
        remote.set(file.path, {
          path: file.path,
          fileId: file.id,
          version,
          content: null,
          hash: previous.remoteHash
        })
        return
      }
      const content = await this.remote.download(accessToken, file.id)
      remote.set(file.path, {
        path: file.path,
        fileId: file.id,
        version,
        content,
        hash: sha256(content)
      })
    }))
    const previous = Object.entries(vault.files).map(([path, state]) => ({
      path,
      localHash: state.localHash,
      remoteHash: state.remoteHash
    }))
    const moveDecisions = this.planMoves(vault, local, remote)
    const movedPaths = new Set(
      moveDecisions.flatMap((decision) => [decision.oldPath, decision.path])
    )
    const decisions = [
      ...moveDecisions,
      ...planDriveSync({
        local: [...local.values()]
          .filter(({ path }) => !movedPaths.has(path))
          .map(({ path, hash }) => ({ path, hash })),
        remote: [...remote.values()]
          .filter(({ path }) => !movedPaths.has(path))
          .map(({ path, hash }) => ({ path, hash })),
        previous: previous.filter(({ path }) => !movedPaths.has(path))
      })
    ]
    const fingerprint = sha256(
      JSON.stringify({
        rootPath: snapshot.rootPath,
        local: [...local.values()]
          .map(({ path, hash }) => ({ path, hash }))
          .sort((left, right) => left.path.localeCompare(right.path)),
        remote: [...remote.values()]
          .map(({ path, hash, fileId, version }) => ({
            path,
            hash,
            fileId,
            version
          }))
          .sort((left, right) => left.path.localeCompare(right.path)),
        previous: previous.sort((left, right) => left.path.localeCompare(right.path)),
        pendingMoves: vault.pendingMoves ?? {},
        decisions
      })
    )
    return {
      rootPath: snapshot.rootPath,
      rootName: snapshot.rootName,
      directories: snapshot.directories,
      vault,
      local,
      remote,
      decisions,
      fingerprint,
      nextChangeToken
    }
  }

  private planMoves(
    vault: VaultLedger,
    local: Map<string, LocalFile>,
    remote: Map<string, RemoteFile>
  ): Extract<DriveSyncDecision, { action: 'move' }>[] {
    const decisions: Extract<DriveSyncDecision, { action: 'move' }>[] = []
    const claimed = new Set<string>()

    for (const [oldPath, path] of Object.entries(vault.pendingMoves ?? {})) {
      const previous = vault.files[oldPath]
      const localFile = local.get(path)
      const remoteFile = remote.get(oldPath)
      if (
        !previous ||
        !localFile ||
        local.has(oldPath) ||
        !remoteFile ||
        remote.has(path) ||
        remoteFile.fileId !== previous.fileId ||
        localFile.hash !== previous.localHash ||
        remoteFile.hash !== previous.remoteHash
      ) {
        throw new Error(
          `移動と同時に内容または配置が変わりました: ${oldPath} → ${path}`
        )
      }
      decisions.push({ path, oldPath, action: 'move', reason: 'local_moved' })
      claimed.add(oldPath)
      claimed.add(path)
    }

    const remoteById = new Map([...remote.values()].map((file) => [file.fileId, file]))
    for (const [oldPath, previous] of Object.entries(vault.files)) {
      if (claimed.has(oldPath) || remote.has(oldPath)) continue
      const moved = remoteById.get(previous.fileId)
      const localFile = local.get(oldPath)
      if (!moved || moved.path === oldPath || !localFile) continue
      if (
        claimed.has(moved.path) ||
        local.has(moved.path) ||
        localFile.hash !== previous.localHash ||
        moved.hash !== previous.remoteHash
      ) {
        throw new Error(
          `Driveの移動と同時に内容または配置が変わりました: ${oldPath} → ${moved.path}`
        )
      }
      decisions.push({
        path: moved.path,
        oldPath,
        action: 'move',
        reason: 'remote_moved'
      })
      claimed.add(oldPath)
      claimed.add(moved.path)
    }
    return decisions
  }

  private async listRemoteMetadata(
    accessToken: string,
    vault: VaultLedger
  ): Promise<{ files: DriveMarkdownFile[]; nextChangeToken: string }> {
    if (vault.changeToken && vault.remoteFiles) {
      try {
        const page = await this.remote.listChanges(
          accessToken,
          vault.changeToken,
          vault.vaultId
        )
        const files = new Map(
          Object.entries(vault.remoteFiles).map(([path, file]) => [
            path,
            this.ledgerMetadata(path, vault.vaultId, file)
          ])
        )
        for (const change of page.changes) {
          for (const [path, file] of files) {
            if (file.id === change.fileId) files.delete(path)
          }
          if (
            !change.removed &&
            change.file?.appProperties.tsuzuneVaultId === vault.vaultId
          ) {
            files.set(change.file.path, change.file)
          }
        }
        return {
          files: [...files.values()],
          nextChangeToken: page.newStartPageToken
        }
      } catch (error) {
        if (!(error instanceof DriveChangeTokenInvalidError)) throw error
      }
    }

    const nextChangeToken = await this.remote.getStartPageToken(accessToken)
    return {
      files: await this.remote.list(accessToken, vault.vaultId),
      nextChangeToken
    }
  }

  private ledgerMetadata(
    path: string,
    vaultId: string,
    file: RemoteLedgerFile
  ): DriveMarkdownFile {
    return {
      id: file.fileId,
      name: path.split('/').at(-1) ?? path,
      path,
      parentIds: [],
      version: file.remoteVersion,
      md5Checksum: null,
      appProperties: { tsuzuneVaultId: vaultId, tsuzunePath: path }
    }
  }

  private remoteLedger(
    remote: Map<string, RemoteFile>
  ): Record<string, RemoteLedgerFile> {
    return Object.fromEntries(
      [...remote].map(([path, file]) => [
        path,
        {
          fileId: file.fileId,
          remoteHash: file.hash,
          remoteVersion: file.version
        }
      ])
    )
  }

  private requireRemoteVersion(file: DriveMarkdownFile): string {
    if (!file.version) {
      throw new Error(`Google Driveのノート版を確認できません: ${file.path}`)
    }
    return file.version
  }

  private async ensureLocalDirectory(
    directory: string,
    existingPaths: Set<string>
  ): Promise<void> {
    if (!directory) {
      return
    }
    let parent = ''
    for (const name of directory.split('/')) {
      const path = parent ? `${parent}/${name}` : name
      const key = `${path}/`.toLocaleLowerCase()
      if (!existingPaths.has(key)) {
        await this.dependencies.vault.createDirectory({ parent, name })
        existingPaths.add(key)
      }
      parent = path
    }
  }

  private async createConflictCopy(
    originalPath: string,
    content: string,
    existingPaths: Set<string>
  ): Promise<string> {
    const directory = dirnameRelative(originalPath)
    await this.ensureLocalDirectory(directory, existingPaths)
    const stem = withoutMarkdownExtension(basenameRelative(originalPath))
    const suffix = timestampLabel(this.now())
    let counter = 1
    while (true) {
      const numbered = counter === 1 ? '' : ` ${counter}`
      const name = `${stem} (Drive conflict ${suffix})${numbered}.md`
      const path = directory ? `${directory}/${name}` : name
      if (!existingPaths.has(path.toLocaleLowerCase())) {
        const created = await this.dependencies.vault.createNote({
          directory,
          name,
          content
        })
        existingPaths.add(created.path.toLocaleLowerCase())
        return created.path
      }
      counter += 1
    }
  }

  private async readLedger(): Promise<SyncLedger> {
    let raw: string
    try {
      raw = await readFile(this.dependencies.ledgerPath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyLedger()
      }
      throw error
    }
    const parsed = JSON.parse(raw) as Partial<SyncLedger>
    if (parsed.version !== 1 || !Array.isArray(parsed.vaults)) {
      throw new Error('Google Drive同期履歴の形式が不正です。')
    }
    return parsed as SyncLedger
  }

  private async writeLedger(ledger: SyncLedger): Promise<void> {
    await mkdir(dirname(this.dependencies.ledgerPath), { recursive: true })
    const temporaryPath = `${this.dependencies.ledgerPath}.tmp-${randomUUID()}`
    try {
      await writeFile(temporaryPath, JSON.stringify(ledger, null, 2), {
        encoding: 'utf8',
        flag: 'wx'
      })
      await rename(temporaryPath, this.dependencies.ledgerPath)
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
  }
}
