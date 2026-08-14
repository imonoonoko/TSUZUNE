import { mkdtemp, rm } from 'node:fs/promises'
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
    { id: string; content: string; version: number }
  >()
  readonly roots = new Map<string, DriveVaultRoot>()
  rootCreated = false
  beforeUpdate: (() => void) | null = null
  failUpdatePath: string | null = null
  lastListedVaultId: string | null = null
  downloadCount = 0
  fullListCount = 0
  changeListCount = 0
  rejectChangeToken = false
  private readonly changes: DriveChange[] = []
  private nextId = 1
  private vaultId = 'vault-id'

  private metadata(
    path: string,
    file: { id: string; content: string; version: number }
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
    )
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

  async download(_accessToken: string, fileId: string): Promise<string> {
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
    const id = `file-${this.nextId++}`
    const file = { id, content: input.content, version: 1 }
    this.files.set(input.path, file)
    const metadata = this.metadata(input.path, file)
    this.changes.push({ fileId: id, removed: false, file: metadata })
    return metadata
  }

  async update(
    _accessToken: string,
    input: UpdateMarkdownInput
  ): Promise<DriveMarkdownFile> {
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
    return metadata
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

  set(path: string, content: string): void {
    const current = this.files.get(path)
    this.files.set(path, {
      id: current?.id ?? `file-${this.nextId++}`,
      content,
      version: (current?.version ?? 0) + 1
    })
    const file = this.files.get(path) as {
      id: string
      content: string
      version: number
    }
    this.changes.push({
      fileId: file.id,
      removed: false,
      file: this.metadata(path, file)
    })
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
  return new DriveSyncService({
    ledgerPath: join(directory, 'ledger.json'),
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

  it('fails closed when a local move and content edit are combined', async () => {
    const vault = new MemoryVault({ 'Inbox/A.md': 'baseline' })
    const remote = new MemoryRemote()
    const sync = await service(vault, remote)
    const first = await sync.preview()
    await sync.apply(first.planId)
    await vault.moveNote({
      path: 'Inbox/A.md',
      destinationDirectory: 'Archive',
      destinationPath: 'Archive/A.md'
    })
    vault.set('Archive/A.md', 'edited too')
    await sync.recordLocalMove('Inbox/A.md', 'Archive/A.md')

    await expect(sync.preview()).rejects.toThrow(/移動と同時/)
    expect(remote.files.has('Inbox/A.md')).toBe(true)
    expect(remote.files.has('Archive/A.md')).toBe(false)
  })
})
