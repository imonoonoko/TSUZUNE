import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  CreateDirectoryInput,
  CreateNoteInput,
  EntryOperationOutput,
  MoveNoteInput,
  NoteDocument,
  SaveNoteInput,
  SaveNoteOutput,
  VaultSnapshot
} from '../src/shared/types'
import {
  DriveSyncService,
  type DriveSyncRemote
} from '../src/main/drive-sync-service'
import type {
  CreateMarkdownInput,
  DriveChange,
  DriveChangePage,
  DriveMarkdownFile,
  DriveVaultRoot,
  UpdateMarkdownInput
} from '../src/main/google-drive'
import { DriveChangeTokenInvalidError } from '../src/main/google-drive'
import { VaultService } from '../src/main/vault'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

class MemoryVault {
  readonly rootPath = 'C:\\Vault'
  readonly notes = new Map<string, NoteDocument>()
  readonly directories = new Set<string>([''])
  private clock = 100
  trashCount = 0

  constructor(initial: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initial)) {
      this.set(path, content)
    }
  }

  getRootPath(): string {
    return this.rootPath
  }

  async scan(): Promise<VaultSnapshot> {
    return {
      rootPath: this.rootPath,
      rootName: 'Vault',
      directories: [...this.directories].sort(),
      notes: [...this.notes.values()]
        .map((note) => ({ ...note }))
        .sort((left, right) => left.path.localeCompare(right.path))
    }
  }

  async saveNote(input: SaveNoteInput): Promise<SaveNoteOutput> {
    const note = this.notes.get(input.path)
    if (!note || note.modifiedAt !== input.expectedModifiedAt) {
      throw new Error('FILE_CHANGED')
    }
    this.set(input.path, input.content)
    const saved = this.notes.get(input.path) as NoteDocument
    return {
      path: saved.path,
      modifiedAt: saved.modifiedAt,
      size: saved.size
    }
  }

  async createNote(input: CreateNoteInput): Promise<EntryOperationOutput> {
    const name = input.name.toLowerCase().endsWith('.md')
      ? input.name
      : `${input.name}.md`
    const path = input.directory ? `${input.directory}/${name}` : name
    if (this.notes.has(path)) {
      throw new Error('ALREADY_EXISTS')
    }
    this.set(path, input.content ?? '')
    return { path }
  }

  async createDirectory(
    input: CreateDirectoryInput
  ): Promise<EntryOperationOutput> {
    const path = input.parent ? `${input.parent}/${input.name}` : input.name
    if (this.directories.has(path)) {
      throw new Error('ALREADY_EXISTS')
    }
    this.directories.add(path)
    return { path }
  }

  async moveNote(input: MoveNoteInput): Promise<EntryOperationOutput> {
    const note = this.notes.get(input.path)
    if (!note || !input.destinationPath || this.notes.has(input.destinationPath)) {
      throw new Error('MOVE_FAILED')
    }
    this.notes.delete(input.path)
    this.set(input.destinationPath, note.content)
    return { oldPath: input.path, path: input.destinationPath }
  }

  async trashEntry(path: string): Promise<EntryOperationOutput> {
    if (!this.notes.delete(path)) throw new Error('NOT_FOUND')
    this.trashCount += 1
    return { path }
  }

  set(path: string, content: string): void {
    const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    if (directory) {
      let current = ''
      for (const part of directory.split('/')) {
        current = current ? `${current}/${part}` : part
        this.directories.add(current)
      }
    }
    this.clock += 1
    this.notes.set(path, {
      path,
      name: path.split('/').at(-1)?.replace(/\.md$/i, '') ?? path,
      content,
      modifiedAt: this.clock,
      size: Buffer.byteLength(content)
    })
  }
}

class MemoryRemote implements DriveSyncRemote {
  readonly files = new Map<
    string,
    { id: string; content: string | Buffer; version: number }
  >()
  readonly roots = new Map<string, DriveVaultRoot>()
  rootCreated = false
  beforeUpdate: (() => void) | null = null
  failUpdatePath: string | null = null
  throwAfterUpdatePath: string | null = null
  lastListedVaultId: string | null = null
  downloadCount = 0
  fullListCount = 0
  changeListCount = 0
  updateCount = 0
  trashCount = 0
  failTrash = false
  duplicateListedFiles: DriveMarkdownFile[] = []
  activeUpdates = 0
  maxConcurrentUpdates = 0
  updateDelayMs = 0
  failCreatePath: string | null = null
  activeCreates = 0
  maxConcurrentCreates = 0
  createDelayMs = 0
  rejectChangeToken = false
  private readonly changes: DriveChange[] = []
  private nextId = 1
  private vaultId = 'vault-id'

  private metadata(
    path: string,
    file: { id: string; content: string | Buffer; version: number }
  ): DriveMarkdownFile {
    return {
      id: file.id,
      name: path.split('/').at(-1) ?? path,
      path,
      parentIds: ['root-1'],
      version: String(file.version),
      md5Checksum: null,
      appProperties: {
        tsuzuneVaultId: this.vaultId,
        tsuzunePath: path
      }
    }
  }

  async list(
    _accessToken: string,
    vaultId: string
  ): Promise<DriveMarkdownFile[]> {
    this.lastListedVaultId = vaultId
    this.vaultId = vaultId
    this.fullListCount += 1
    return [...this.files.entries()].map(([path, file]) =>
      this.metadata(path, file)
    ).concat(this.duplicateListedFiles)
  }

  async getStartPageToken(): Promise<string> {
    return String(this.changes.length)
  }

  async listChanges(
    _accessToken: string,
    pageToken: string,
    vaultId: string
  ): Promise<DriveChangePage> {
    this.changeListCount += 1
    this.vaultId = vaultId
    if (this.rejectChangeToken) {
      this.rejectChangeToken = false
      throw new DriveChangeTokenInvalidError('invalid')
    }
    return {
      changes: this.changes.slice(Number(pageToken)),
      newStartPageToken: String(this.changes.length)
    }
  }

  async listRoots(): Promise<DriveVaultRoot[]> {
    return [...this.roots.values()]
  }

  async download(_accessToken: string, fileId: string): Promise<string | Buffer> {
    this.downloadCount += 1
    const entry = [...this.files.values()].find((file) => file.id === fileId)
    if (!entry) throw new Error('NOT_FOUND')
    return entry.content
  }

  async ensureRoot(): Promise<DriveVaultRoot> {
    this.rootCreated = true
    return {
      id: 'root-1',
      name: 'TSUZUNE - Vault',
      parentIds: [],
      version: '1',
      appProperties: {
        tsuzuneVaultId: 'vault-id',
        tsuzuneRole: 'vaultRoot'
      }
    }
  }

  async create(
    _accessToken: string,
    input: CreateMarkdownInput
  ): Promise<DriveMarkdownFile> {
    this.activeCreates += 1
    this.maxConcurrentCreates = Math.max(
      this.maxConcurrentCreates,
      this.activeCreates
    )
    try {
      if (this.createDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.createDelayMs))
      }
      if (input.path === this.failCreatePath) {
        throw new Error('SIMULATED_CREATE_FAILURE')
      }
      const id = `file-${this.nextId++}`
      const file = { id, content: input.content, version: 1 }
      this.files.set(input.path, file)
      const metadata = this.metadata(input.path, file)
      this.changes.push({ fileId: id, removed: false, file: metadata })
      return metadata
    } finally {
      this.activeCreates -= 1
    }
  }

  async update(
    _accessToken: string,
    input: UpdateMarkdownInput
  ): Promise<DriveMarkdownFile> {
    this.updateCount += 1
    this.activeUpdates += 1
    this.maxConcurrentUpdates = Math.max(
      this.maxConcurrentUpdates,
      this.activeUpdates
    )
    try {
      if (this.updateDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.updateDelayMs))
      }
      this.beforeUpdate?.()
      if (input.path === this.failUpdatePath) {
        throw new Error('SIMULATED_UPDATE_FAILURE')
      }
      const current = this.files.get(input.path)
      if (!current || String(current.version) !== input.expectedVersion) {
        throw new Error('Drive版が変わりました。同期内容を確認し直してください。')
      }
      const file = {
        id: input.fileId,
        content: input.content,
        version: current.version + 1
      }
      this.files.set(input.path, file)
      const metadata = this.metadata(input.path, file)
      this.changes.push({ fileId: file.id, removed: false, file: metadata })
      if (input.path === this.throwAfterUpdatePath) {
        throw new Error('SIMULATED_CHECKPOINT_CRASH')
      }
      return metadata
    } finally {
      this.activeUpdates -= 1
    }
  }

  async move(
    _accessToken: string,
    input: import('../src/main/google-drive').MoveMarkdownInput
  ): Promise<DriveMarkdownFile> {
    const current = this.files.get(input.oldPath)
    if (
      !current ||
      current.id !== input.fileId ||
      String(current.version) !== input.expectedVersion ||
      this.files.has(input.path)
    ) {
      throw new Error('Drive版または場所が変わりました。同期内容を確認し直してください。')
    }
    this.files.delete(input.oldPath)
    const moved = { ...current, version: current.version + 1 }
    this.files.set(input.path, moved)
    const metadata = this.metadata(input.path, moved)
    this.changes.push({ fileId: moved.id, removed: false, file: metadata })
    return metadata
  }

  async trash(
    _accessToken: string,
    input: { fileId: string; path: string; expectedVersion: string }
  ): Promise<void> {
    if (this.failTrash) throw new Error('SIMULATED_TRASH_FAILURE')
    const current = this.files.get(input.path)
    if (!current || current.id !== input.fileId || String(current.version) !== input.expectedVersion) {
      throw new Error('Drive版が変わりました。同期内容を確認し直してください。')
    }
    this.files.delete(input.path)
    this.trashCount += 1
  }

  set(path: string, content: string | Buffer): void {
    const current = this.files.get(path)
    this.files.set(path, {
      id: current?.id ?? `file-${this.nextId++}`,
      content,
      version: (current?.version ?? 0) + 1
    })
    const file = this.files.get(path) as {
      id: string
      content: string | Buffer
      version: number
    }
    this.changes.push({
      fileId: file.id,
      removed: false,
      file: this.metadata(path, file)
    })
  }

  bumpInvisibleVersion(path: string): void {
    const current = this.files.get(path)
    if (!current) throw new Error('NOT_FOUND')
    current.version += 1
  }

  remove(path: string): void {
    const file = this.files.get(path)
    if (!file) return
    this.files.delete(path)
    this.changes.push({ fileId: file.id, removed: true, file: null })
  }

  setRoot(id: string, vaultId: string, name: string): void {
    this.roots.set(id, {
      id,
      name,
      parentIds: [],
      version: '1',
      appProperties: {
        tsuzuneVaultId: vaultId,
        tsuzuneRole: 'vaultRoot'
      }
    })
  }
}

async function service(
  vault: MemoryVault,
  remote: MemoryRemote
): Promise<DriveSyncService> {
  const directory = await mkdtemp(join(tmpdir(), 'tsuzune-drive-sync-'))
  temporaryDirectories.push(directory)
  return serviceAt(vault, remote, join(directory, 'ledger.json'))
}

function serviceAt(
  vault: MemoryVault,
  remote: MemoryRemote,
  ledgerPath: string
): DriveSyncService {
  return new DriveSyncService({
    ledgerPath,
    vault,
    connection: {
      async getAccessToken() {
        return 'access-token'
      }
    },
    remote,
    now: () => new Date('2026-07-31T04:00:00+09:00')
  })
}

describe('DriveSyncService', () => {
  it('syncs supported attachment bytes in both directions', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'tsuzune-drive-attachment-vault-'))
    const ledgerDirectory = await mkdtemp(join(tmpdir(), 'tsuzune-drive-attachment-ledger-'))
    temporaryDirectories.push(rootPath, ledgerDirectory)
    await mkdir(join(rootPath, 'attachments'))
    const initialBytes = Buffer.from([0, 255, 17])
    await writeFile(join(rootPath, 'attachments', 'image.png'), initialBytes)
    const vault = new VaultService()
    await vault.setRootPath(rootPath)
    const remote = new MemoryRemote()
    const sync = new DriveSyncService({
      ledgerPath: join(ledgerDirectory, 'ledger.json'),
      vault,
      connection: { async getAccessToken() { return 'access-token' } },
      remote,
      now: () => new Date('2026-07-31T04:00:00+09:00')
    })

    const uploadPreview = await sync.preview()
    expect(uploadPreview.items).toEqual([
      { path: 'attachments/image.png', action: 'upload', reason: 'new_local' }
    ])
    await expect(sync.apply(uploadPreview.planId)).resolves.toMatchObject({ uploaded: 1 })
    expect(remote.files.get('attachments/image.png')?.content).toEqual(initialBytes)

    const changedBytes = Buffer.from([9, 8, 7, 0, 255])
    remote.set('attachments/image.png', changedBytes)
    const downloadPreview = await sync.preview()
    expect(downloadPreview.items).toEqual([
      { path: 'attachments/image.png', action: 'download', reason: 'remote_changed' }
    ])
    await expect(sync.apply(downloadPreview.planId)).resolves.toMatchObject({ downloaded: 1 })
    await expect(readFile(join(rootPath, 'attachments', 'image.png'))).resolves.toEqual(changedBytes)

    const localConflictBytes = Buffer.from([1, 1, 1, 0, 255])
    const remoteConflictBytes = Buffer.from([2, 2, 2, 128])
    await writeFile(join(rootPath, 'attachments', 'image.png'), localConflictBytes)
    remote.set('attachments/image.png', remoteConflictBytes)
    const conflictPreview = await sync.preview()
    expect(conflictPreview.items).toEqual([
      { path: 'attachments/image.png', action: 'conflict', reason: 'both_changed' }
    ])
    const conflictResult = await sync.apply(conflictPreview.planId)
    expect(conflictResult).toMatchObject({ conflicts: 1, uploaded: 2 })
    expect(conflictResult.conflictPaths).toHaveLength(1)
    const conflictPath = conflictResult.conflictPaths[0]
    expect(conflictPath).toMatch(/^attachments\/image \(Drive conflict .+\)\.png$/)
    await expect(readFile(join(rootPath, ...conflictPath.split('/')))).resolves.toEqual(
      remoteConflictBytes
    )
    expect(remote.files.get('attachments/image.png')?.content).toEqual(localConflictBytes)
    expect(remote.files.get(conflictPath)?.content).toEqual(remoteConflictBytes)
  })

  it('rejects exact duplicate normalized Drive paths before downloading content', async () => {
    const vault = new MemoryVault()
    const remote = new MemoryRemote()
    remote.set('Duplicate.md', 'one')
    remote.duplicateListedFiles = [{
      id: 'duplicate-file',
      name: 'Duplicate.md',
      path: 'Duplicate.md',
      parentIds: ['root-1'],
      version: '1',
      md5Checksum: null,
      appProperties: { tsuzuneVaultId: 'vault-id', tsuzunePath: 'Duplicate.md' }
    }]
    const sync = await service(vault, remote)
    await expect(sync.preview({ forceFull: true })).rejects.toThrow(/同じTSUZUNEパスが複数/)
    expect(remote.downloadCount).toBe(0)
  })

  it('treats byte-identical exact-path Drive duplicates as one recovery file', async () => {
    const vault = new MemoryVault()
    const remote = new MemoryRemote()
    remote.set('Duplicate.md', 'one')
    const listed = await remote.list('access-token', 'vault-id')
    const checksum = createHash('md5').update('one').digest('hex')
    remote.duplicateListedFiles = [{
      ...listed[0],
      id: 'z-duplicate-file',
      md5Checksum: checksum
    }]
    remote.list = async () => [
      { ...listed[0], md5Checksum: checksum },
      ...remote.duplicateListedFiles
    ]

    const sync = await service(vault, remote)
    await expect(sync.preview({ forceFull: true })).resolves.toMatchObject({
      counts: { download: 1 }
    })
    expect(remote.downloadCount).toBe(1)
  })

  it('lists existing Drive vault roots as pairing choices', async () => {
    const vault = new MemoryVault()
    const remote = new MemoryRemote()
    remote.setRoot('root-alpha', 'vault-alpha', 'TSUZUNE - Alpha')
    remote.setRoot('root-beta', 'vault-beta', 'TSUZUNE - Beta')
    const sync = await service(vault, remote)

    await expect(sync.listRemoteVaults()).resolves.toEqual([
      {
        rootFolderId: 'root-alpha',
        vaultId: 'vault-alpha',
        name: 'TSUZUNE - Alpha'
      },
      {
        rootFolderId: 'root-beta',
        vaultId: 'vault-beta',
        name: 'TSUZUNE - Beta'
      }
    ])
  })

  it('pairs the current local Vault only with a live matching Drive root', async () => {
    const vault = new MemoryVault()
    const remote = new MemoryRemote()
    remote.setRoot('root-alpha', 'vault-alpha', 'TSUZUNE - Alpha')
    const sync = await service(vault, remote)

    await sync.pairRemoteVault('root-alpha', 'vault-alpha')

    await expect(sync.getStatusMetadata(vault.rootPath)).resolves.toEqual({
      lastSyncAt: null,
      rootFolderId: 'root-alpha'
    })
    await sync.preview()
    expect(remote.lastListedVaultId).toBe('vault-alpha')
  })

  it('refuses a root and vault id pair not present in the live Drive list', async () => {
    const vault = new MemoryVault()
    const remote = new MemoryRemote()
    remote.setRoot('root-alpha', 'vault-alpha', 'TSUZUNE - Alpha')
    const sync = await service(vault, remote)

    await expect(
      sync.pairRemoteVault('root-alpha', 'vault-other')
    ).rejects.toThrow(/見つかりません/)
    await expect(sync.getStatusMetadata(vault.rootPath)).resolves.toEqual({
      lastSyncAt: null,
      rootFolderId: null
    })
  })

  it('can replace an unsynced empty pairing and clears its pending plan', async () => {
    const vault = new MemoryVault()
    const remote = new MemoryRemote()
    remote.setRoot('root-alpha', 'vault-alpha', 'TSUZUNE - Alpha')
    remote.setRoot('root-beta', 'vault-beta', 'TSUZUNE - Beta')
    const sync = await service(vault, remote)
    const oldPlan = await sync.preview()

    await sync.pairRemoteVault('root-alpha', 'vault-alpha')
    await sync.pairRemoteVault('root-beta', 'vault-beta')

    await expect(sync.getStatusMetadata(vault.rootPath)).resolves.toEqual({
      lastSyncAt: null,
      rootFolderId: 'root-beta'
    })
    await expect(sync.apply(oldPlan.planId)).rejects.toThrow(/プラン/)
    await sync.preview()
    expect(remote.lastListedVaultId).toBe('vault-beta')
  })

  it('refuses to replace a binding after it has synchronized files', async () => {
    const vault = new MemoryVault({ 'A.md': 'local' })
    const remote = new MemoryRemote()
    remote.setRoot('root-alpha', 'vault-alpha', 'TSUZUNE - Alpha')
    remote.setRoot('root-beta', 'vault-beta', 'TSUZUNE - Beta')
    const sync = await service(vault, remote)
    await sync.pairRemoteVault('root-alpha', 'vault-alpha')
    const preview = await sync.preview()
    await sync.apply(preview.planId)

    await expect(
      sync.pairRemoteVault('root-beta', 'vault-beta')
    ).rejects.toThrow(/同期済み/)
    await expect(sync.getStatusMetadata(vault.rootPath)).resolves.toMatchObject({
      rootFolderId: 'root-alpha'
    })
  })

  it('previews and uploads a local-only Markdown note', async () => {
    const vault = new MemoryVault({ 'A.md': 'local' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)

    const preview = await sync.preview()
    expect(preview.items).toEqual([
      { path: 'A.md', action: 'upload', reason: 'new_local' }
    ])

    const result = await sync.apply(preview.planId)
    expect(result.uploaded).toBe(1)
    expect(remote.files.get('A.md')?.content).toBe('local')
    expect(remote.rootCreated).toBe(true)
    expect(await sync.getStatusMetadata(vault.rootPath)).toMatchObject({
      lastSyncAt: '2026-07-30T19:00:00.000Z',
      rootFolderId: 'root-1'
    })
  })

  it('downloads a remote-only nested note without touching other notes', async () => {
    const vault = new MemoryVault({ 'Keep.md': 'keep' })
    const remote = new MemoryRemote()
    remote.set('Folder/Remote.md', 'remote')
    const sync = await service(vault, remote)

    const preview = await sync.preview()
    expect(remote.downloadCount).toBe(1)
    await sync.apply(preview.planId)
    expect(remote.downloadCount).toBe(1)

    expect(vault.notes.get('Folder/Remote.md')?.content).toBe('remote')
    expect(vault.notes.get('Keep.md')?.content).toBe('keep')
    expect(vault.directories.has('Folder')).toBe(true)
  })

  it('does not download unchanged Drive bodies after the ledger records their versions', async () => {
    const vault = new MemoryVault({ 'A.md': 'one', 'B.md': 'two' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)

    remote.downloadCount = 0
    const settled = await sync.preview()

    expect(settled.items).toEqual([])
    expect(remote.downloadCount).toBe(0)
  })

  it('uses Drive changes after the first full remote snapshot', async () => {
    const vault = new MemoryVault({ 'A.md': 'one' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)
    const fullListCount = remote.fullListCount

    await expect(sync.preview()).resolves.toMatchObject({ items: [] })
    await expect(sync.preview()).resolves.toMatchObject({ items: [] })

    expect(remote.fullListCount).toBe(fullListCount)
    expect(remote.changeListCount).toBeGreaterThanOrEqual(2)
  })

  it('falls back to a full remote snapshot when Drive rejects the change token', async () => {
    const vault = new MemoryVault({ 'A.md': 'one' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)
    await sync.preview()
    const fullListCount = remote.fullListCount
    remote.rejectChangeToken = true

    await expect(sync.preview()).resolves.toMatchObject({ items: [] })

    expect(remote.fullListCount).toBe(fullListCount + 1)
  })

  it('does not resurrect a removed Drive note from the sync baseline', async () => {
    const vault = new MemoryVault({ 'A.md': 'one' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)
    await sync.preview()
    remote.remove('A.md')

    const removed = await sync.preview()
    expect(removed.items).toEqual([
      { path: 'A.md', action: 'preserve', reason: 'remote_deleted' }
    ])
    await sync.apply(removed.planId)

    const repeated = await sync.preview()
    expect(repeated.items).toEqual([
      { path: 'A.md', action: 'preserve', reason: 'remote_deleted' }
    ])
    expect(remote.fullListCount).toBe(2)
  })

  it('downloads only the Drive body whose version changed', async () => {
    const vault = new MemoryVault({ 'A.md': 'one', 'B.md': 'two' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)
    remote.set('B.md', 'remote two')

    remote.downloadCount = 0
    const changed = await sync.preview()

    expect(changed.items).toEqual([
      { path: 'B.md', action: 'download', reason: 'remote_changed' }
    ])
    expect(remote.downloadCount).toBe(1)

    await sync.apply(changed.planId)
    expect(remote.downloadCount).toBe(1)
    expect(vault.notes.get('B.md')?.content).toBe('remote two')
  })

  it('preserves the Drive version as a conflict note and converges on the local original', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)

    vault.set('A.md', 'local changed')
    remote.set('A.md', 'remote changed')
    const conflict = await sync.preview()
    expect(conflict.counts.conflict).toBe(1)

    const result = await sync.apply(conflict.planId)
    expect(vault.notes.get('A.md')?.content).toBe('local changed')
    expect(remote.files.get('A.md')?.content).toBe('local changed')
    expect(result.conflictPaths).toHaveLength(1)
    expect(vault.notes.get(result.conflictPaths[0])?.content).toBe('remote changed')

    const settled = await sync.preview()
    expect(settled.items).toEqual([])

    vault.set(result.conflictPaths[0], 'reviewed conflict')
    const editedConflict = await sync.preview()
    expect(editedConflict.items).toEqual([
      {
        path: result.conflictPaths[0],
        action: 'upload',
        reason: 'local_changed'
      }
    ])
  })

  it('rejects a stale plan before changing Drive', async () => {
    const vault = new MemoryVault({ 'A.md': 'before' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const preview = await sync.preview()
    vault.set('A.md', 'after preview')

    await expect(sync.apply(preview.planId)).rejects.toThrow(/確認し直/)
    expect(remote.files.size).toBe(0)
  })

  it('rejects a Drive change detected immediately before an update', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)

    vault.set('A.md', 'local changed')
    const preview = await sync.preview()
    remote.beforeUpdate = () => {
      remote.beforeUpdate = null
      remote.set('A.md', 'late remote change')
    }

    await expect(sync.apply(preview.planId)).rejects.toThrow(/確認し直/)
    expect(remote.files.get('A.md')?.content).toBe('late remote change')
  })

  it('accepts a version-only Drive change when the remote content is unchanged', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)

    vault.set('A.md', 'local changed')
    const preview = await sync.preview()
    remote.bumpInvisibleVersion('A.md')

    const result = await sync.apply(preview.planId)

    expect(result.uploaded).toBe(1)
    expect(remote.files.get('A.md')?.content).toBe('local changed')
  })

  it('checkpoints each successful action before a later action fails', async () => {
    const vault = new MemoryVault({
      'A.md': 'baseline A',
      'B.md': 'baseline B'
    })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)

    vault.set('A.md', 'local A1')
    vault.set('B.md', 'local B1')
    remote.failUpdatePath = 'B.md'
    const partial = await sync.preview()
    await expect(sync.apply(partial.planId)).rejects.toThrow(
      /SIMULATED_UPDATE_FAILURE/
    )
    expect(remote.files.get('A.md')?.content).toBe('local A1')
    expect(remote.files.get('B.md')?.content).toBe('baseline B')

    remote.failUpdatePath = null
    vault.set('A.md', 'local A2')
    const retry = await sync.preview()
    expect(retry.items).toContainEqual({
      path: 'A.md',
      action: 'upload',
      reason: 'local_changed'
    })
    expect(retry.items).not.toContainEqual(
      expect.objectContaining({
        path: 'A.md',
        action: 'conflict'
      })
    )
  })

  it('rejects case-colliding Drive paths before changing the Vault', async () => {
    const vault = new MemoryVault()
    const remote = new MemoryRemote()
    remote.set('Folder/A.md', 'upper')
    remote.set('folder/a.md', 'lower')
    const sync = await service(vault, remote)

    await expect(sync.preview()).rejects.toThrow(/同じTSUZUNEパス/)
    expect(vault.notes.size).toBe(0)
  })

  it('rejects case-colliding local paths before changing Drive', async () => {
    const vault = new MemoryVault({
      'Folder/A.md': 'upper',
      'folder/a.md': 'lower'
    })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)

    await expect(sync.preview()).rejects.toThrow(/同じTSUZUNEパス/)
    expect(remote.files.size).toBe(0)
  })

  it('reports a known one-sided deletion but never propagates it', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)
    vault.notes.delete('A.md')

    const preview = await sync.preview()
    expect(preview.items).toEqual([
      { path: 'A.md', action: 'preserve', reason: 'local_deleted' }
    ])
    const result = await sync.apply(preview.planId)

    expect(result.preserved).toBe(1)
    expect(remote.files.get('A.md')?.content).toBe('baseline')
    expect(vault.notes.has('A.md')).toBe(false)
  })

  it('relocates an explicitly moved local note with the same Drive file id', async () => {
    const vault = new MemoryVault({ 'Inbox/A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)
    const fileId = remote.files.get('Inbox/A.md')?.id

    await vault.moveNote({
      path: 'Inbox/A.md',
      destinationDirectory: 'Archive',
      destinationPath: 'Archive/A.md'
    })
    await sync.recordLocalMove('Inbox/A.md', 'Archive/A.md')

    const preview = await sync.preview()
    expect(preview.items).toEqual([
      {
        path: 'Archive/A.md',
        oldPath: 'Inbox/A.md',
        action: 'move',
        reason: 'local_moved'
      }
    ])
    expect(preview.counts.move).toBe(1)
    const result = await sync.apply(preview.planId)

    expect(result.moved).toBe(1)
    expect(remote.files.has('Inbox/A.md')).toBe(false)
    expect(remote.files.get('Archive/A.md')?.id).toBe(fileId)
    expect(remote.files.get('Archive/A.md')?.content).toBe('baseline')
    expect((await sync.preview()).items).toEqual([])
  })

  it('relocates and uploads an explicitly moved local note edited in the same sync', async () => {
    const vault = new MemoryVault({ 'Inbox/A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)
    const fileId = remote.files.get('Inbox/A.md')?.id

    await vault.moveNote({
      path: 'Inbox/A.md',
      destinationDirectory: 'Archive',
      destinationPath: 'Archive/A.md'
    })
    vault.set('Archive/A.md', 'local edit')
    await sync.recordLocalMove('Inbox/A.md', 'Archive/A.md')

    const preview = await sync.preview()
    expect(preview.items).toEqual([
      {
        path: 'Archive/A.md',
        oldPath: 'Inbox/A.md',
        action: 'move',
        reason: 'local_moved'
      },
      {
        path: 'Archive/A.md',
        action: 'upload',
        reason: 'local_changed'
      }
    ])
    const result = await sync.apply(preview.planId)

    expect(result.moved).toBe(1)
    expect(result.uploaded).toBe(1)
    expect(remote.files.get('Archive/A.md')).toMatchObject({
      id: fileId,
      content: 'local edit'
    })
    expect((await sync.preview()).items).toEqual([])
  })

  it('relocates and downloads a Drive note edited in the same sync', async () => {
    const vault = new MemoryVault({ 'Inbox/A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)
    const current = remote.files.get('Inbox/A.md')
    if (!current) throw new Error('missing remote fixture')

    await remote.move('token', {
      fileId: current.id,
      vaultId: 'vault-id',
      oldPath: 'Inbox/A.md',
      path: 'Archive/A.md',
      expectedVersion: String(current.version),
      expectedMd5Checksum: null,
      expectedContentHash: 'unused by fixture'
    })
    remote.set('Archive/A.md', 'remote edit')

    const preview = await sync.preview()
    expect(preview.items).toEqual([
      {
        path: 'Archive/A.md',
        oldPath: 'Inbox/A.md',
        action: 'move',
        reason: 'remote_moved'
      },
      {
        path: 'Archive/A.md',
        action: 'download',
        reason: 'remote_changed'
      }
    ])
    const result = await sync.apply(preview.planId)

    expect(result.moved).toBe(1)
    expect(result.downloaded).toBe(1)
    expect(vault.notes.get('Archive/A.md')?.content).toBe('remote edit')
    expect(vault.notes.has('Inbox/A.md')).toBe(false)
    expect((await sync.preview()).items).toEqual([])
  })

  it('persists a deletion tombstone before Drive trash and requires recovery after failure', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const directory = await mkdtemp(join(tmpdir(), 'tsuzune-drive-delete-'))
    temporaryDirectories.push(directory)
    const ledgerPath = join(directory, 'ledger.json')
    const sync = serviceAt(vault, remote, ledgerPath)
    await sync.apply((await sync.preview()).planId)
    vault.notes.delete('A.md')
    remote.failTrash = true
    const preview = await sync.preview({ propagateLocalDeletion: true })
    await expect(sync.apply(preview.planId)).rejects.toThrow(/SIMULATED_TRASH_FAILURE/)
    expect(remote.trashCount).toBe(0)

    const restarted = serviceAt(vault, remote, ledgerPath)
    await expect(restarted.preview()).rejects.toThrow(/RECOVERY_REQUIRED/)
  })

  it('forces a full remote refresh before propagating a local deletion', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)

    remote.remove('A.md')
    const fullListCountBeforePreview = remote.fullListCount
    const preview = await sync.preview({ propagateRemoteDeletion: true })

    expect(preview.items).toContainEqual({
      path: 'A.md',
      action: 'trash_local',
      reason: 'remote_deleted'
    })
    expect(remote.fullListCount).toBe(fullListCountBeforePreview + 1)

    const fullListCountBeforeApply = remote.fullListCount
    await sync.apply(preview.planId)
    expect(remote.fullListCount).toBe(fullListCountBeforeApply + 1)
  })

  it('rejects a stale deletion plan before the first destructive call', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)
    vault.notes.delete('A.md')
    const preview = await sync.preview({ propagateLocalDeletion: true })
    remote.set('A.md', 'changed externally')
    await expect(sync.apply(preview.planId)).rejects.toThrow(/確認し直/)
    expect(remote.trashCount).toBe(0)
  })

  it('re-baselines an equal local and remote pair after an update checkpoint crash', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)

    vault.set('A.md', 'local update')
    remote.throwAfterUpdatePath = 'A.md'
    await expect(sync.apply((await sync.preview()).planId)).rejects.toThrow(
      /SIMULATED_CHECKPOINT_CRASH/
    )

    remote.throwAfterUpdatePath = null
    const recovered = await sync.preview()
    expect(recovered.items).toEqual([])

    vault.set('A.md', 'local edit after recovery')
    const next = await sync.preview()
    expect(next.items).toEqual([
      { path: 'A.md', action: 'upload', reason: 'local_changed' }
    ])
  })

  it('re-baselines an equal pair even when an unrelated preserve remains', async () => {
    const vault = new MemoryVault({ 'A.md': 'A', 'B.md': 'B' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)

    vault.notes.delete('B.md')
    vault.set('A.md', 'A changed')
    vault.set('C.md', 'new local')
    remote.throwAfterUpdatePath = 'A.md'
    await expect(sync.apply((await sync.preview()).planId)).rejects.toThrow(
      /SIMULATED_CHECKPOINT_CRASH/
    )

    remote.throwAfterUpdatePath = null
    const recovered = await sync.preview()
    expect(recovered.items).toContainEqual({
      path: 'B.md',
      action: 'preserve',
      reason: 'local_deleted'
    })
    expect(recovered.items).toContainEqual({
      path: 'C.md',
      action: 'upload',
      reason: 'new_local'
    })
    const recoveredResult = await sync.apply(recovered.planId)
    expect(recoveredResult.preserved).toBe(1)
    expect(recoveredResult.uploaded).toBe(1)
    expect(remote.files.get('C.md')?.content).toBe('new local')
    vault.set('A.md', 'A edited after recovery')
    expect((await sync.preview()).items).toContainEqual({
      path: 'A.md',
      action: 'upload',
      reason: 'local_changed'
    })
  })

  it('forces a full remote refresh before acting on an existing remote file', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline', 'B.md': 'keep' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)

    vault.set('A.md', 'local change')
    const remoteFile = remote.files.get('A.md') as { id: string; content: string; version: number }
    remoteFile.content = 'unreported remote change'
    remoteFile.version += 1

    const fullListCountBeforePreview = remote.fullListCount
    const preview = await sync.preview()
    expect(preview.items).toContainEqual({
      path: 'A.md',
      action: 'conflict',
      reason: 'both_changed'
    })
    expect(remote.fullListCount).toBe(fullListCountBeforePreview + 1)
  })

  it('refreshes full metadata again immediately before existing Drive updates', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)

    vault.set('A.md', 'local change')
    const preview = await sync.preview()
    const fullListCountBeforeApply = remote.fullListCount

    await sync.apply(preview.planId)

    expect(remote.fullListCount).toBe(fullListCountBeforeApply + 1)
  })

  it('updates existing Drive notes four at a time', async () => {
    const vault = new MemoryVault({
      'A.md': 'baseline A',
      'B.md': 'baseline B',
      'C.md': 'baseline C',
      'D.md': 'baseline D'
    })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)

    for (const path of vault.notes.keys()) {
      vault.set(path, `changed ${path}`)
    }
    remote.updateDelayMs = 10

    const result = await sync.apply((await sync.preview()).planId)

    expect(result.uploaded).toBe(4)
    expect(remote.updateCount).toBe(4)
    expect(remote.maxConcurrentUpdates).toBe(4)
  })

  it('creates new Drive files four at a time', async () => {
    const vault = new MemoryVault({
      'A.md': 'new A',
      'B.md': 'new B',
      'C.md': 'new C',
      'D.md': 'new D',
      'E.md': 'new E'
    })
    const remote = new MemoryRemote()
    remote.createDelayMs = 10
    const sync = await service(vault, remote)

    const result = await sync.apply((await sync.preview()).planId)

    expect(result.uploaded).toBe(5)
    expect(remote.maxConcurrentCreates).toBe(4)
  })

  it('checkpoints successful creates in a failed batch before retrying', async () => {
    const vault = new MemoryVault({
      'A.md': 'new A',
      'B.md': 'new B',
      'C.md': 'new C',
      'D.md': 'new D'
    })
    const remote = new MemoryRemote()
    remote.createDelayMs = 10
    remote.failCreatePath = 'B.md'
    const directory = await mkdtemp(join(tmpdir(), 'tsuzune-drive-create-batch-'))
    temporaryDirectories.push(directory)
    const ledgerPath = join(directory, 'ledger.json')
    const sync = serviceAt(vault, remote, ledgerPath)

    await expect(sync.apply((await sync.preview()).planId)).rejects.toThrow(
      /SIMULATED_CREATE_FAILURE/
    )
    expect([...remote.files.keys()].sort()).toEqual(['A.md', 'C.md', 'D.md'])

    remote.failCreatePath = null
    const restarted = serviceAt(vault, remote, ledgerPath)
    const retry = await restarted.preview()

    expect(retry.items).toEqual([
      { path: 'B.md', action: 'upload', reason: 'new_local' }
    ])
  })

  it('does not batch existing updates across a different action', async () => {
    const vault = new MemoryVault({
      'A.md': 'baseline A',
      'C.md': 'baseline C'
    })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)

    vault.set('A.md', 'changed A')
    vault.set('B.md', 'new B')
    vault.set('C.md', 'changed C')

    const result = await sync.apply((await sync.preview()).planId)

    expect(result.uploaded).toBe(3)
    expect(remote.updateCount).toBe(2)
    expect(remote.files.get('A.md')?.content).toBe('changed A')
    expect(remote.files.get('B.md')?.content).toBe('new B')
    expect(remote.files.get('C.md')?.content).toBe('changed C')
    expect((await sync.preview()).items).toEqual([])
  })

  it('normalizes chained local moves to the original Drive path', async () => {
    const vault = new MemoryVault({ 'A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    await sync.apply((await sync.preview()).planId)

    await vault.moveNote({
      path: 'A.md',
      destinationDirectory: 'Middle',
      destinationPath: 'Middle/A.md'
    })
    await sync.recordLocalMove('A.md', 'Middle/A.md')
    await vault.moveNote({
      path: 'Middle/A.md',
      destinationDirectory: 'Archive',
      destinationPath: 'Archive/A.md'
    })
    await sync.recordLocalMove('Middle/A.md', 'Archive/A.md')

    expect((await sync.preview()).items).toEqual([
      {
        path: 'Archive/A.md',
        oldPath: 'A.md',
        action: 'move',
        reason: 'local_moved'
      }
    ])
  })

  it('applies a Drive move locally by stable file id', async () => {
    const vault = new MemoryVault({ 'Inbox/A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)
    const current = remote.files.get('Inbox/A.md')!
    await remote.move('access-token', {
      fileId: current.id,
      vaultId: 'vault-id',
      oldPath: 'Inbox/A.md',
      path: 'Archive/A.md',
      expectedVersion: String(current.version)
    })

    const preview = await sync.preview()
    expect(preview.items).toEqual([
      {
        path: 'Archive/A.md',
        oldPath: 'Inbox/A.md',
        action: 'move',
        reason: 'remote_moved'
      }
    ])
    await sync.apply(preview.planId)

    expect(vault.notes.has('Inbox/A.md')).toBe(false)
    expect(vault.notes.get('Archive/A.md')?.content).toBe('baseline')
    expect((await sync.preview()).items).toEqual([])
  })

})

if (process.env.TSUZUNE_DRIVE_BENCHMARK === '1') {
  describe('DriveSyncService benchmark', () => {
    it(
      'measures incremental change merging at production-like Vault scale',
      async () => {
        const fileCount = 1_140
        const changeCount = 1_000
        const warmups = 3
        const runs = 15
        const initial = Object.fromEntries(
          Array.from({ length: fileCount }, (_, index) => [
            `Notes/${String(index).padStart(4, '0')}.md`,
            `note ${index}`
          ])
        )
        const vault = new MemoryVault(initial)
        const remote = new MemoryRemote()
        for (const [path, content] of Object.entries(initial)) {
          remote.set(path, content)
        }
        const sync = await service(vault, remote)
        expect((await sync.preview()).items).toEqual([])
        for (let index = 0; index < changeCount; index += 1) {
          remote.remove(`Notes/${String(index).padStart(4, '0')}.md`)
        }

        const samples: number[] = []
        for (let run = 0; run < warmups + runs; run += 1) {
          const startedAt = performance.now()
          const preview = await sync.preview()
          const elapsedMs = performance.now() - startedAt
          expect(preview.counts.preserve).toBe(changeCount)
          if (run >= warmups) samples.push(elapsedMs)
        }

        const sorted = [...samples].sort((left, right) => left - right)
        const percentile = (value: number): number =>
          sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))]
        const round = (value: number): number => Math.round(value * 1000) / 1000
        console.log(
          `TSUZUNE_DRIVE_BENCHMARK ${JSON.stringify({
            scenario: 'incremental-change-merge',
            fileCount,
            changeCount,
            runs,
            p50Ms: round(percentile(0.5)),
            p95Ms: round(percentile(0.95)),
            maxMs: round(sorted.at(-1) ?? 0),
            minMs: round(sorted[0] ?? 0)
          })}`
        )
      },
      120_000
    )
  })
}
