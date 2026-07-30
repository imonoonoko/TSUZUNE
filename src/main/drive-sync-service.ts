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
  SaveNoteInput,
  SaveNoteOutput,
  VaultSnapshot
} from '../shared/types'
import {
  createMarkdown,
  downloadMarkdown,
  ensureVaultRoot,
  listVaultFiles,
  listVaultRoots,
  updateMarkdown,
  type CreateMarkdownInput,
  type DriveMarkdownFile,
  type DriveVaultRoot,
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
}

export interface DriveSyncRemote {
  list(accessToken: string, vaultId: string): Promise<DriveMarkdownFile[]>
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
}

interface LedgerFile {
  fileId: string
  localHash: string
  remoteHash: string
}

interface VaultLedger {
  rootPath: string
  vaultId: string
  rootFolderId: string | null
  lastSyncAt: string | null
  files: Record<string, LedgerFile>
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
  content: string
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
    listRoots: (accessToken) => listVaultRoots(accessToken, fetchImpl),
    download: (accessToken, fileId) =>
      downloadMarkdown(accessToken, fileId, fetchImpl),
    ensureRoot: (accessToken, vaultId, rootName) =>
      ensureVaultRoot(accessToken, vaultId, rootName, fetchImpl),
    create: (accessToken, input) =>
      createMarkdown(accessToken, input, fetchImpl),
    update: (accessToken, input) =>
      updateMarkdown(accessToken, input, fetchImpl)
  }
}

function countActions(items: DriveSyncDecision[]): DriveSyncPreview['counts'] {
  return {
    upload: items.filter((item) => item.action === 'upload').length,
    download: items.filter((item) => item.action === 'download').length,
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
    const createdAt = this.now().toISOString()
    const preview: DriveSyncPreview = {
      planId: randomUUID(),
      createdAt,
      items: inspection.decisions.map(({ path, action, reason }) => ({
        path,
        action,
        reason
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

    const fresh = await this.inspect(vault)
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
      conflicts: 0,
      preserved: 0,
      conflictPaths: [],
      completedAt: ''
    }
    let rootFolderId = vault.rootFolderId
    const nextFiles = { ...vault.files }
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
          remoteHash: local.hash
        }
        await checkpoint()
        result.uploaded += 1
        continue
      }

      if (decision.action === 'download' && remote) {
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
          remoteHash: remote.hash
        }
        await checkpoint()
        result.downloaded += 1
        continue
      }

      if (decision.action === 'conflict' && local && remote) {
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
          remoteHash: local.hash
        }
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
          remoteHash: remote.hash
        }
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
          remoteHash: remote.hash
        }
        continue
      }
      if (!nextFiles[path]) {
        nextFiles[path] = {
          fileId: remote.fileId,
          localHash: local.hash,
          remoteHash: remote.hash
        }
      }
    }

    result.completedAt = this.now().toISOString()
    vault.rootFolderId = rootFolderId
    vault.lastSyncAt = result.completedAt
    vault.files = nextFiles
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

  private async inspect(vault: VaultLedger): Promise<Inspection> {
    const [snapshot, accessToken] = await Promise.all([
      this.dependencies.vault.scan(),
      this.dependencies.connection.getAccessToken()
    ])
    const remoteMetadata = await this.remote.list(accessToken, vault.vaultId)
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
    const remoteContents = await Promise.all(
      remoteMetadata.map(async (file) => ({
        path: file.path,
        fileId: file.id,
        version: file.version as string,
        content: await this.remote.download(accessToken, file.id)
      }))
    )

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
    for (const file of remoteContents) {
      if (remote.has(file.path)) {
        throw new Error(
          `Google Driveに同じTSUZUNEパスが複数あります: ${file.path}`
        )
      }
      remote.set(file.path, {
        ...file,
        hash: sha256(file.content)
      })
    }
    const previous = Object.entries(vault.files).map(([path, state]) => ({
      path,
      localHash: state.localHash,
      remoteHash: state.remoteHash
    }))
    const decisions = planDriveSync({
      local: [...local.values()].map(({ path, hash }) => ({ path, hash })),
      remote: [...remote.values()].map(({ path, hash }) => ({ path, hash })),
      previous
    })
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
      fingerprint
    }
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
