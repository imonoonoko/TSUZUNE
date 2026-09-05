import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, extname } from 'node:path'
import {
  planDriveSync,
  type DriveSyncDecision,
  type DriveSyncDeletionPolicy
} from '../core/drive-sync'
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
  DriveSyncPreviewOptions,
  EntryOperationOutput,
  MoveNoteInput,
  SaveNoteInput,
  SaveNoteOutput,
  VaultSnapshot
} from '../shared/types'
import {
  createMarkdown,
  downloadVaultFile,
  DriveChangeTokenInvalidError,
  ensureVaultRoot,
  getDriveStartPageToken,
  listDriveChanges,
  listVaultFiles,
  listVaultRoots,
  moveMarkdown,
  trashMarkdown,
  updateMarkdown,
  type CreateMarkdownInput,
  type DriveChangePage,
  type DriveMarkdownFile,
  type DriveVaultRoot,
  type MoveMarkdownInput,
  type UpdateMarkdownInput
} from './google-drive'

const MAX_CONCURRENT_DRIVE_WRITES = 4

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
  trashEntry?(path: string): Promise<EntryOperationOutput>
  readAttachmentBytes?(path: string): Promise<Buffer>
  saveAttachment?(input: {
    path: string
    content: Buffer
    expectedModifiedAt?: number
    expectedContent?: Buffer
  }): Promise<SaveNoteOutput>
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
  download(accessToken: string, fileId: string): Promise<string | Buffer>
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
  trash?(accessToken: string, input: { fileId: string; vaultId: string; path: string; expectedVersion: string; expectedMd5Checksum?: string | null; expectedContentHash?: string }): Promise<void>
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
  remoteMd5Checksum?: string | null
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
  pendingDeletion?: PendingDeletion
}

interface PendingDeletion {
  path: string
  action: 'trash_local' | 'trash_remote'
  fileId?: string
  preimageHash: string
  expectedVersion?: string
  stage: 'prepared' | 'local_succeeded' | 'remote_succeeded'
  createdAt: string
}

interface SyncLedger {
  version: 1
  vaults: VaultLedger[]
}

interface LocalFile {
  path: string
  content: string | Buffer
  kind: 'markdown' | 'attachment'
  hash: string
  modifiedAt: number
}

interface RemoteFile {
  path: string
  content: string | Buffer | null
  kind: 'markdown' | 'attachment'
  hash: string
  fileId: string
  version: string
  md5Checksum: string | null
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
  deletionPolicy: DriveSyncDeletionPolicy
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

function sha256(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
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
      downloadVaultFile(accessToken, fileId, fetchImpl),
    ensureRoot: (accessToken, vaultId, rootName) =>
      ensureVaultRoot(accessToken, vaultId, rootName, fetchImpl),
    create: (accessToken, input) =>
      createMarkdown(accessToken, input, fetchImpl),
    update: (accessToken, input) =>
      updateMarkdown(accessToken, input, fetchImpl),
    move: (accessToken, input) =>
      moveMarkdown(accessToken, input, fetchImpl),
    trash: (accessToken, input) =>
      trashMarkdown(accessToken, input, fetchImpl)
  }
}

function countActions(items: DriveSyncDecision[]): DriveSyncPreview['counts'] {
  return {
    upload: items.filter((item) => item.action === 'upload').length,
    download: items.filter((item) => item.action === 'download').length,
    move: items.filter((item) => item.action === 'move').length,
    conflict: items.filter((item) => item.action === 'conflict').length,
    preserve: items.filter((item) => item.action === 'preserve').length,
    trashLocal: items.filter((item) => item.action === 'trash_local').length,
    trashRemote: items.filter((item) => item.action === 'trash_remote').length
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

function collapseIdenticalRemoteDuplicates(
  files: DriveMarkdownFile[],
  trackedFiles: Record<string, LedgerFile>
): DriveMarkdownFile[] {
  const filesByPath = new Map<string, DriveMarkdownFile>()
  for (const file of files) {
    const existing = filesByPath.get(file.path)
    if (!existing) {
      filesByPath.set(file.path, file)
      continue
    }
    if (
      !file.md5Checksum ||
      file.md5Checksum !== existing.md5Checksum ||
      file.kind !== existing.kind
    ) {
      throw new Error(
        `Google Driveに同じTSUZUNEパスが複数あります: ${existing.path}, ${file.path}`
      )
    }
    const trackedFileId = trackedFiles[file.path]?.fileId
    if (
      file.id === trackedFileId ||
      (existing.id !== trackedFileId && file.id.localeCompare(existing.id) < 0)
    ) {
      filesByPath.set(file.path, file)
    }
  }
  return [...filesByPath.values()]
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
    await this.recordLocalMoves([{ oldPath, path }])
  }

  async inspectLocalMoves(
    mappings: Array<{ oldPath: string; path: string }>
  ): Promise<{
    tracked: number
    untracked: number
    pendingMoves: Record<string, string>
  }> {
    const rootPath = this.requireRootPath()
    const ledger = await this.readLedger()
    const vault = ledger.vaults.find((entry) => entry.rootPath === rootPath)
    if (!vault) return { tracked: 0, untracked: 0, pendingMoves: {} }

    let tracked = 0
    let untracked = 0
    for (const mapping of mappings) {
      const originalPath =
        Object.entries(vault.pendingMoves ?? {}).find(
          ([, target]) => target === mapping.oldPath
        )?.[0] ?? mapping.oldPath
      if (vault.files[originalPath]) tracked += 1
      else untracked += 1
    }
    return {
      tracked,
      untracked,
      pendingMoves: { ...(vault.pendingMoves ?? {}) }
    }
  }

  async replacePendingMoves(pendingMoves: Record<string, string>): Promise<void> {
    const rootPath = this.requireRootPath()
    const ledger = await this.readLedger()
    const vault = ledger.vaults.find((entry) => entry.rootPath === rootPath)
    if (!vault) {
      if (Object.keys(pendingMoves).length > 0) {
        throw new Error('Drive同期台帳が見つかりません。')
      }
      return
    }
    vault.pendingMoves = { ...pendingMoves }
    await this.writeLedger(ledger)
    this.pendingPlan = null
  }

  async recordLocalMoves(
    mappings: Array<{ oldPath: string; path: string }>
  ): Promise<void> {
    const effective = mappings.filter((mapping) => mapping.oldPath !== mapping.path)
    if (effective.length === 0) return
    const rootPath = this.requireRootPath()
    const ledger = await this.readLedger()
    const vault = ledger.vaults.find((entry) => entry.rootPath === rootPath)
    if (!vault) return

    const pendingMoves = { ...(vault.pendingMoves ?? {}) }
    for (const { oldPath, path } of effective) {
      const originalPath =
        Object.entries(pendingMoves).find(([, target]) => target === oldPath)?.[0] ??
        oldPath
      if (!vault.files[originalPath]) continue
      delete pendingMoves[originalPath]
      if (originalPath !== path) pendingMoves[originalPath] = path
    }

    const targets = new Set<string>()
    for (const target of Object.values(pendingMoves)) {
      const key = target.toLocaleLowerCase()
      if (targets.has(key)) {
        throw new Error(`Drive移動先が重複しています: ${target}`)
      }
      targets.add(key)
    }
    vault.pendingMoves = pendingMoves
    await this.writeLedger(ledger)
    this.pendingPlan = null
  }

  async preview(options: DriveSyncPreviewOptions = {}): Promise<DriveSyncPreview> {
    const { forceFull = false, ...deletionPolicy } = options
    const rootPath = this.requireRootPath()
    const ledger = await this.readLedger()
    let vault = ledger.vaults.find((entry) => entry.rootPath === rootPath)
    if (vault?.pendingDeletion) {
      throw new Error(`RECOVERY_REQUIRED: 削除伝播の未完了tombstoneがあります: ${vault.pendingDeletion.path}`)
    }
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

    let inspection = await this.inspect(vault, null, forceFull, false, deletionPolicy)
    const needsRemoteRefresh = inspection.decisions.some((decision) => {
      if (
        decision.action === 'conflict' ||
        decision.action === 'move' ||
        decision.action === 'trash_remote' ||
        decision.action === 'trash_local'
      ) return true
      return decision.action === 'upload' && inspection.remote.has(decision.path)
    })
    if (needsRemoteRefresh) {
      inspection = await this.inspect(vault, null, true, false, deletionPolicy)
    }
    let baselineChanged = false
    for (const [path, local] of inspection.local) {
      const remote = inspection.remote.get(path)
      if (!remote || local.hash !== remote.hash) continue
      const next = {
        fileId: remote.fileId,
        localHash: local.hash,
        remoteHash: remote.hash,
        remoteVersion: remote.version
      }
      const previous = vault.files[path]
      if (
        !previous ||
        previous.fileId !== next.fileId ||
        previous.localHash !== next.localHash ||
        previous.remoteHash !== next.remoteHash ||
        previous.remoteVersion !== next.remoteVersion
      ) {
        vault.files[path] = next
        baselineChanged = true
      }
    }
    if (baselineChanged) {
      // Recompute decisions and fingerprint after recovery baselines change.
      // This keeps the preview applicable when unrelated actions remain.
      const refreshedChangeToken = inspection.nextChangeToken
      inspection = await this.inspect(vault, inspection.remote, false, true, deletionPolicy)
      inspection.nextChangeToken = refreshedChangeToken
    }
    if (needsRemoteRefresh || baselineChanged || inspection.decisions.length === 0) {
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

    const needsRemoteRefresh = pending.inspection.decisions.some((decision) => {
      if (
        decision.action === 'conflict' ||
        decision.action === 'move' ||
        decision.action === 'trash_remote' ||
        decision.action === 'trash_local'
      ) return true
      return (
        decision.action === 'upload' &&
        pending.inspection.remote.has(decision.path)
      )
    })
    const fresh = await this.inspect(
      vault,
      pending.inspection.remote,
      needsRemoteRefresh,
      false,
      pending.inspection.deletionPolicy
    )
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
      trashedLocal: 0,
      trashedRemote: 0,
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
    if (vault.pendingDeletion) {
      throw new Error(`RECOVERY_REQUIRED: 削除伝播の未完了tombstoneがあります: ${vault.pendingDeletion.path}`)
    }

    const recordUpload = (
      decision: DriveSyncDecision,
      local: LocalFile,
      uploaded: DriveMarkdownFile
    ): void => {
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
        md5Checksum: uploaded.md5Checksum,
        content: local.content,
        kind: local.kind,
        hash: local.hash
      })
      result.uploaded += 1
    }

    for (
      let decisionIndex = 0;
      decisionIndex < fresh.decisions.length;
      decisionIndex += 1
    ) {
      const decision = fresh.decisions[decisionIndex]
      const local = fresh.local.get(decision.path)
      const remote = fresh.remote.get(decision.path)

      if (decision.action === 'upload' && local && remote) {
        const batch: Array<{
          decision: DriveSyncDecision
          local: LocalFile
          remote: RemoteFile
        }> = []
        for (
          let batchDecisionIndex = decisionIndex;
          batchDecisionIndex < fresh.decisions.length &&
          batch.length < MAX_CONCURRENT_DRIVE_WRITES;
          batchDecisionIndex += 1
        ) {
          const batchDecision = fresh.decisions[batchDecisionIndex]
          const batchLocal = fresh.local.get(batchDecision.path)
          const batchRemote = fresh.remote.get(batchDecision.path)
          if (batchDecision.action !== 'upload' || !batchLocal || !batchRemote) {
            break
          }
          batch.push({ decision: batchDecision, local: batchLocal, remote: batchRemote })
        }

        const updates = await Promise.allSettled(
          batch.map((item) =>
            this.remote.update(accessToken, {
              fileId: item.remote.fileId,
              vaultId: vault.vaultId,
              path: item.decision.path,
              expectedVersion: item.remote.version,
              expectedMd5Checksum: item.remote.md5Checksum,
              expectedContentHash: item.remote.hash,
              content: item.local.content
            })
          )
        )
        for (const [batchIndex, update] of updates.entries()) {
          if (update.status === 'fulfilled') {
            recordUpload(
              batch[batchIndex].decision,
              batch[batchIndex].local,
              update.value
            )
            await checkpoint()
          }
        }
        decisionIndex += batch.length - 1
        const failure = updates.find((update) => update.status === 'rejected')
        if (failure?.status === 'rejected') {
          throw failure.reason
        }
        continue
      }

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
            expectedVersion: oldRemote.version,
            expectedMd5Checksum: oldRemote.md5Checksum,
            expectedContentHash: oldRemote.hash
          })
          fresh.remote.delete(decision.oldPath)
          fresh.remote.set(decision.path, {
            path: decision.path,
            fileId: moved.id,
            version: this.requireRemoteVersion(moved),
            md5Checksum: moved.md5Checksum,
            content: oldRemote.content,
            kind: oldRemote.kind,
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
          const movedSnapshot = await this.dependencies.vault.scan()
          const movedNote = movedSnapshot.notes.find((note) => note.path === decision.path)
          const movedAttachment = movedSnapshot.attachments?.find(
            (attachment) => attachment.path === decision.path
          )
          if (!movedNote && !movedAttachment) {
            throw new Error('移動後のローカルファイルを確認できません。同期内容を確認し直してください。')
          }
          const movedContent = movedNote
            ? movedNote.content
            : await this.requireAttachmentReader()(decision.path)
          fresh.local.delete(decision.oldPath)
          fresh.local.set(decision.path, {
            path: decision.path,
            content: movedContent,
            kind: movedNote ? 'markdown' : 'attachment',
            hash: sha256(movedContent),
            modifiedAt: (movedNote ?? movedAttachment)?.modifiedAt ?? 0
          })
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
        const batch: Array<{
          decision: DriveSyncDecision
          local: LocalFile
        }> = []
        for (
          let batchDecisionIndex = decisionIndex;
          batchDecisionIndex < fresh.decisions.length &&
          batch.length < MAX_CONCURRENT_DRIVE_WRITES;
          batchDecisionIndex += 1
        ) {
          const batchDecision = fresh.decisions[batchDecisionIndex]
          const batchLocal = fresh.local.get(batchDecision.path)
          const batchRemote = fresh.remote.get(batchDecision.path)
          if (batchDecision.action !== 'upload' || !batchLocal || batchRemote) {
            break
          }
          batch.push({ decision: batchDecision, local: batchLocal })
        }

        const parentId = await ensureRoot()
        const creates = await Promise.allSettled(
          batch.map((item) =>
            this.remote.create(accessToken, {
              vaultId: vault.vaultId,
              path: item.decision.path,
              parentId,
              content: item.local.content
            })
          )
        )
        let succeeded = false
        for (const [batchIndex, create] of creates.entries()) {
          if (create.status === 'fulfilled') {
            recordUpload(
              batch[batchIndex].decision,
              batch[batchIndex].local,
              create.value
            )
            succeeded = true
          }
        }
        if (succeeded) {
          await checkpoint()
        }
        decisionIndex += batch.length - 1
        const failure = creates.find((create) => create.status === 'rejected')
        if (failure?.status === 'rejected') {
          throw failure.reason
        }
        continue
      }

      if (decision.action === 'download' && remote) {
        if (remote.content === null) {
          throw new Error(`Google Driveのファイル内容を取得できません: ${remote.path}`)
        }
        if (remote.kind === 'attachment') {
          if (!Buffer.isBuffer(remote.content)) {
            throw new Error(`Google Driveの添付ファイルを読み込めません: ${remote.path}`)
          }
          if (!this.dependencies.vault.saveAttachment) {
            throw new Error('このVaultは添付ファイルの同期に対応していません。')
          }
          await this.ensureLocalDirectory(dirnameRelative(remote.path), existingLocalPaths)
          await this.dependencies.vault.saveAttachment({
            path: remote.path,
            content: remote.content,
            ...(local
              ? {
                  expectedModifiedAt: local.modifiedAt,
                  expectedContent: Buffer.isBuffer(local.content) ? local.content : undefined
                }
              : {})
          })
          existingLocalPaths.add(remote.path.toLocaleLowerCase())
        } else if (local) {
          await this.dependencies.vault.saveNote({
            path: local.path,
            content: remote.content as string,
            expectedModifiedAt: local.modifiedAt,
            expectedContent: local.content as string
          })
        } else {
          await this.ensureLocalDirectory(
            dirnameRelative(remote.path),
            existingLocalPaths
          )
          await this.dependencies.vault.createNote({
            directory: dirnameRelative(remote.path),
            name: basenameRelative(remote.path),
            content: remote.content as string
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
          throw new Error(`Google Driveのファイル内容を取得できません: ${remote.path}`)
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
          expectedMd5Checksum: remote.md5Checksum,
          expectedContentHash: remote.hash,
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
          md5Checksum: uploaded.md5Checksum,
          content: local.content,
          kind: local.kind,
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
          md5Checksum: preserved.md5Checksum,
          content: remote.content,
          kind: remote.kind,
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
        continue
      }

      if (decision.action === 'trash_remote') {
        const previous = vault.files[decision.path]
        const remoteFile = fresh.remote.get(decision.path)
        if (!previous || !remoteFile || previous.fileId !== remoteFile.fileId) {
          throw new Error('削除伝播対象が変わりました。同期内容を確認し直してください。')
        }
        if (!this.remote.trash) {
          throw new Error('Google Driveのゴミ箱移動に対応していません。')
        }
        vault.pendingDeletion = {
          path: decision.path,
          action: decision.action,
          fileId: remoteFile.fileId,
          preimageHash: remoteFile.hash,
          expectedVersion: remoteFile.version,
          stage: 'prepared',
          createdAt: this.now().toISOString()
        }
        await this.writeLedger(ledger)
        await this.remote.trash(accessToken, {
          fileId: remoteFile.fileId,
          vaultId: vault.vaultId,
          path: decision.path,
          expectedVersion: remoteFile.version,
          expectedMd5Checksum: remoteFile.md5Checksum,
          expectedContentHash: remoteFile.hash
        })
        delete nextFiles[decision.path]
        nextRemote.delete(decision.path)
        vault.pendingDeletion.stage = 'remote_succeeded'
        await this.writeLedger(ledger)
        delete vault.pendingDeletion
        await checkpoint()
        result.trashedRemote = (result.trashedRemote ?? 0) + 1
        continue
      }

      if (decision.action === 'trash_local') {
        if (!this.dependencies.vault.trashEntry) {
          throw new Error('Vaultのゴミ箱移動に対応していません。')
        }
        const localFile = fresh.local.get(decision.path)
        if (!localFile) throw new Error('ローカル削除対象が変わりました。同期内容を確認し直してください。')
        vault.pendingDeletion = {
          path: decision.path,
          action: decision.action,
          preimageHash: localFile.hash,
          stage: 'prepared',
          createdAt: this.now().toISOString()
        }
        await this.writeLedger(ledger)
        await this.dependencies.vault.trashEntry(decision.path)
        delete nextFiles[decision.path]
        nextRemote.delete(decision.path)
        vault.pendingDeletion.stage = 'local_succeeded'
        await this.writeLedger(ledger)
        delete vault.pendingDeletion
        await checkpoint()
        result.trashedLocal = (result.trashedLocal ?? 0) + 1
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
    cachedRemote: Map<string, RemoteFile> | null = null,
    forceFull = false,
    reuseCachedRemote = false,
    deletionPolicy: DriveSyncDeletionPolicy = {}
  ): Promise<Inspection> {
    const [snapshot, accessToken] = await Promise.all([
      this.dependencies.vault.scan(),
      this.dependencies.connection.getAccessToken()
    ])
    const reusedRemote = cachedRemote ?? new Map<string, RemoteFile>()
    const remoteListing: { files: DriveMarkdownFile[]; nextChangeToken: string } = reuseCachedRemote
      ? {
          files: [...reusedRemote.values()].map((file) => ({
            id: file.fileId,
            name: file.path.split('/').at(-1) ?? file.path,
            path: file.path,
            parentIds: [],
            version: file.version,
            md5Checksum: file.md5Checksum,
            kind: file.kind,
            appProperties: {
              tsuzuneVaultId: vault.vaultId,
              tsuzunePath: file.path
            }
          })),
          nextChangeToken: vault.changeToken ?? ''
        }
      : await this.listRemoteMetadata(accessToken, vault, forceFull)
    const { files: listedRemoteMetadata, nextChangeToken } = remoteListing
    const remoteMetadata = collapseIdenticalRemoteDuplicates(
      listedRemoteMetadata,
      vault.files
    )
    const attachmentFiles = await Promise.all(
      (snapshot.attachments ?? []).map(async (attachment): Promise<LocalFile> => {
        if (!this.dependencies.vault.readAttachmentBytes) {
          throw new Error('このVaultは添付ファイルの同期に対応していません。')
        }
        const content = await this.dependencies.vault.readAttachmentBytes(attachment.path)
        return {
          path: attachment.path,
          content,
          kind: 'attachment',
          hash: sha256(content),
          modifiedAt: attachment.modifiedAt
        }
      })
    )
    const localFiles: LocalFile[] = [
      ...snapshot.notes.map((note) => ({
        path: note.path,
        content: note.content,
        kind: 'markdown' as const,
        hash: sha256(note.content),
        modifiedAt: note.modifiedAt
      })),
      ...attachmentFiles
    ]
    const localPathsByKey = new Map<string, string>()
    for (const file of localFiles) {
      const key = file.path.toLowerCase()
      const existingLocalPath = localPathsByKey.get(key)
      if (existingLocalPath && existingLocalPath !== file.path) {
        throw new Error(
          `Vaultに同じTSUZUNEパスが複数あります: ${existingLocalPath}, ${file.path}`
        )
      }
      localPathsByKey.set(key, file.path)
    }
    const remotePathsByKey = new Map<string, string>()
    for (const file of remoteMetadata) {
      const key = file.path.toLowerCase()
      const existingRemotePath = remotePathsByKey.get(key)
      if (existingRemotePath !== undefined) {
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
    const local = new Map(localFiles.map((file) => [file.path, file]))
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
          md5Checksum: file.md5Checksum,
          content: null,
          kind: file.kind ?? (file.path.toLocaleLowerCase().endsWith('.md') ? 'markdown' : 'attachment'),
          hash: previous.remoteHash
        })
        return
      }
      const downloaded = await this.remote.download(accessToken, file.id)
      const kind = file.kind ?? (file.path.toLocaleLowerCase().endsWith('.md') ? 'markdown' : 'attachment')
      const content = kind === 'markdown'
        ? (typeof downloaded === 'string' ? downloaded : downloaded.toString('utf8'))
        : (typeof downloaded === 'string' ? Buffer.from(downloaded, 'utf8') : Buffer.from(downloaded))
      remote.set(file.path, {
        path: file.path,
        fileId: file.id,
        version,
        md5Checksum: file.md5Checksum,
        content,
        kind,
        hash: sha256(content)
      })
    }))
    const localSyncIds = this.localSyncIds(vault, local, remote)
    const previous = Object.entries(vault.files).map(([path, state]) => ({
      id: state.fileId,
      path,
      localHash: state.localHash,
      remoteHash: state.remoteHash
    }))
    const decisions = planDriveSync({
      local: [...local.values()].map(({ path, hash }) => ({
        id: localSyncIds.get(path),
        path,
        hash
      })),
      remote: [...remote.values()].map(({ path, hash, fileId }) => ({
        id: fileId,
        path,
        hash
      })),
      previous,
      deletionPolicy
    })
    const fingerprint = sha256(
      JSON.stringify({
        rootPath: snapshot.rootPath,
        local: [...local.values()]
          .map(({ path, hash }) => ({ path, hash }))
          .sort((left, right) => left.path.localeCompare(right.path)),
        remote: [...remote.values()]
          .map(({ path, hash, fileId }) => ({
            path,
            hash,
            fileId
          }))
          .sort((left, right) => left.path.localeCompare(right.path)),
        previous: previous.sort((left, right) => left.path.localeCompare(right.path)),
        pendingMoves: vault.pendingMoves ?? {},
        decisions,
        deletionPolicy
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
      nextChangeToken,
      deletionPolicy
    }
  }

  private localSyncIds(
    vault: VaultLedger,
    local: Map<string, LocalFile>,
    remote: Map<string, RemoteFile>
  ): Map<string, string> {
    const ids = new Map(
      Object.entries(vault.files)
        .filter(([path]) => local.has(path))
        .map(([path, state]) => [path, state.fileId])
    )
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
        remoteFile.fileId !== previous.fileId
      ) {
        throw new Error(
          `移動対象または配置が変わりました: ${oldPath} → ${path}`
        )
      }
      ids.set(path, previous.fileId)
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
        local.has(moved.path)
      ) {
        throw new Error(
          `Driveの移動先とローカル配置が競合しました: ${oldPath} → ${moved.path}`
        )
      }
      claimed.add(oldPath)
      claimed.add(moved.path)
    }
    return ids
  }

  private async listRemoteMetadata(
    accessToken: string,
    vault: VaultLedger,
    forceFull = false
  ): Promise<{ files: DriveMarkdownFile[]; nextChangeToken: string }> {
    if (!forceFull && vault.changeToken && vault.remoteFiles) {
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
        const pathsByFileId = new Map(
          [...files].map(([path, file]) => [file.id, path])
        )
        for (const change of page.changes) {
          const previousPath = pathsByFileId.get(change.fileId)
          if (previousPath) files.delete(previousPath)
          pathsByFileId.delete(change.fileId)
          if (
            !change.removed &&
            change.file?.appProperties.tsuzuneVaultId === vault.vaultId
          ) {
            const replacedFile = files.get(change.file.path)
            if (replacedFile) pathsByFileId.delete(replacedFile.id)
            files.set(change.file.path, change.file)
            pathsByFileId.set(change.file.id, change.file.path)
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
      md5Checksum: file.remoteMd5Checksum ?? null,
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
          remoteVersion: file.version,
          remoteMd5Checksum: file.md5Checksum
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
    content: string | Buffer,
    existingPaths: Set<string>
  ): Promise<string> {
    const directory = dirnameRelative(originalPath)
    await this.ensureLocalDirectory(directory, existingPaths)
    const originalName = basenameRelative(originalPath)
    const extension = extname(originalName)
    const stem = extension
      ? originalName.slice(0, -extension.length)
      : withoutMarkdownExtension(originalName)
    const suffix = timestampLabel(this.now())
    let counter = 1
    while (true) {
      const numbered = counter === 1 ? '' : ` ${counter}`
      const name = `${stem} (Drive conflict ${suffix})${numbered}${extension}`
      const path = directory ? `${directory}/${name}` : name
      if (!existingPaths.has(path.toLocaleLowerCase())) {
        const created = Buffer.isBuffer(content)
          ? await this.requireAttachmentWriter()({ path, content })
          : await this.dependencies.vault.createNote({ directory, name, content })
        existingPaths.add(created.path.toLocaleLowerCase())
        return created.path
      }
      counter += 1
    }
  }

  private requireAttachmentReader(): (path: string) => Promise<Buffer> {
    const reader = this.dependencies.vault.readAttachmentBytes
    if (!reader) {
      throw new Error('このVaultは添付ファイルの同期に対応していません。')
    }
    return reader.bind(this.dependencies.vault)
  }

  private requireAttachmentWriter(): NonNullable<SyncVault['saveAttachment']> {
    const writer = this.dependencies.vault.saveAttachment
    if (!writer) {
      throw new Error('このVaultは添付ファイルの同期に対応していません。')
    }
    return writer.bind(this.dependencies.vault)
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
