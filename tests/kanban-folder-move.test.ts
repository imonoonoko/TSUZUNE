import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VaultService } from '../src/main/vault'
import { EntryMoveCoordinator } from '../src/main/entry-move'
import { KanbanFolderMoveService } from '../src/main/kanban-folder-move'
import { canonicalWorkspaceVaultKey } from '../src/main/workspaces'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
describe('human Kanban folder move', () => {
  let root: string, vault: VaultService, service: KanbanFolderMoveService
  let filters: string[]
  let coordinator: EntryMoveCoordinator
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tsuzune-kanban-folder-'))
    await mkdir(join(root, 'Inbox')); await mkdir(join(root, 'Done'))
    await writeFile(join(root, 'Inbox/A.md'), '# A\n')
    await writeFile(join(root, 'Done/B.md'), '# B\n')
    await writeFile(join(root, 'Root.md'), '[[Inbox/A]]\n')
    await writeFile(join(root, 'Board.base'), 'views:\n  - type: kanban\n    name: Folder\n    order: [file.name]\n    groupBy:\n      property: file.folder\n')
    vault = new VaultService(); await vault.setRootPath(root); filters = []
    coordinator = new EntryMoveCoordinator({ vault, drive: {
      inspectLocalMoves: async () => ({ tracked: 0, untracked: 1, pendingMoves: {} }),
      recordLocalMoves: async () => {}, replacePendingMoves: async () => {}
    } })
    service = new KanbanFolderMoveService(vault, coordinator, async () => filters, async () => ({}))
  })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })
  async function input(destinationDirectory = 'Done') {
    return { scope: { rootPath: await canonicalWorkspaceVaultKey(root), rootRevision: vault.getRootRevision() },
      basePath: 'Board.base', expectedBaseRevision: (await vault.readBase('Board.base')).revision!, viewIndex: 0,
      sourcePath: 'Inbox/A.md', expectedSourceRevision: hash((await vault.readNote('Inbox/A.md')).content), destinationDirectory }
  }
  it('previews then moves using link rewrite and leaves the Base unchanged', async () => {
    const request = await input(); const base = await readFile(join(root, 'Board.base'), 'utf8')
    const preview = await service.preview(request)
    expect(preview).toMatchObject({ source: 'Inbox/A.md', destination: 'Done/A.md', linkImpact: { affectedCount: 1 } })
    expect(await service.apply({ ...request, expectedFingerprint: preview.fingerprint })).toEqual({ oldPath: 'Inbox/A.md', path: 'Done/A.md' })
    expect(await readFile(join(root, 'Root.md'), 'utf8')).toContain('[[Done/A]]')
    expect(await readFile(join(root, 'Board.base'), 'utf8')).toBe(base)
  })
  it('accepts the existing root folder represented by an empty group cell', async () => {
    const request = await input(''); const preview = await service.preview(request)
    expect(preview.destination).toBe('A.md')
    await service.apply({ ...request, expectedFingerprint: preview.fingerprint })
    expect(await readFile(join(root, 'A.md'), 'utf8')).toBe('# A\n')
  })
  it('preview alone leaves source and references unchanged', async () => {
    await service.preview(await input())
    expect(await readFile(join(root, 'Inbox/A.md'), 'utf8')).toBe('# A\n')
    expect(await readFile(join(root, 'Root.md'), 'utf8')).toBe('[[Inbox/A]]\n')
  })
  it.each(['source', 'base', 'link', 'vault'])('rejects a stale preview after %s changes without moving', async kind => {
    const request = await input(); const preview = await service.preview(request)
    if (kind === 'source') await writeFile(join(root, 'Inbox/A.md'), '# changed\n')
    if (kind === 'base') await writeFile(join(root, 'Board.base'), (await readFile(join(root, 'Board.base'), 'utf8')) + '# changed\n')
    if (kind === 'link') await writeFile(join(root, 'Root.md'), 'new [[Inbox/A]]\n')
    if (kind === 'vault') await writeFile(join(root, 'New.md'), '# New\n')
    await expect(service.apply({ ...request, expectedFingerprint: preview.fingerprint })).rejects.toThrow()
    expect(await readFile(join(root, 'Inbox/A.md'), 'utf8')).toBe(kind === 'source' ? '# changed\n' : '# A\n')
    await expect(readFile(join(root, 'Done/A.md'))).rejects.toThrow()
  })
  it('rejects an existing same-name file without autoname', async () => {
    await writeFile(join(root, 'Done/A.md'), 'existing')
    await expect(service.preview(await input())).rejects.toThrow()
    expect(await readFile(join(root, 'Done/A.md'), 'utf8')).toBe('existing')
    expect(await readFile(join(root, 'Inbox/A.md'), 'utf8')).toBe('# A\n')
  })
  it('rejects arbitrary existing folders that are not evaluated columns', async () => {
    await mkdir(join(root, 'Unused'))
    await expect(service.preview(await input('Unused'))).rejects.toThrow()
  })
  it.each(['../Done', '/Done', 'Done\\sub', 'Done/', '.', 'Inbox'])('rejects malformed or identical destination %s', async destination => {
    await expect(service.preview(await input(destination))).rejects.toThrow()
  })
  it('rejects switched Vault scope and noncanonical scope', async () => {
    const request = await input()
    await expect(service.preview({ ...request, scope: { ...request.scope, rootPath: root + '/.' } })).rejects.toThrow()
    await vault.setRootPath(root)
    await expect(service.preview(request)).rejects.toThrow()
  })
  it('rejects source revisions, invalid views, and non-Markdown source', async () => {
    const request = await input()
    await expect(service.preview({ ...request, expectedSourceRevision: '0'.repeat(64) })).rejects.toThrow()
    await expect(service.preview({ ...request, viewIndex: 1 })).rejects.toThrow()
    await expect(service.preview({ ...request, sourcePath: 'Board.base' })).rejects.toThrow()
  })
  it('rejects excluded source, destination and Base', async () => {
    const request = await input()
    for (const pattern of ['Inbox', 'Done', 'Board.base']) {
      filters = [pattern]
      await expect(service.preview(request)).rejects.toThrow()
    }
  })
  it.each(['40_情報源', '50_履歴', '.hidden'])('rejects protected or hidden target %s', async directory => {
    await mkdir(join(root, directory)); await writeFile(join(root, directory, 'B.md'), '# B\n')
    await expect(service.preview(await input(directory))).rejects.toThrow()
    const request = await input()
    await expect(service.preview({ ...request, sourcePath: directory + '/B.md', expectedSourceRevision: hash('# B\n') })).rejects.toThrow()
  })
  it('rejects hidden columns and a source removed by view filter', async () => {
    const original = await readFile(join(root, 'Board.base'), 'utf8')
    await writeFile(join(root, 'Board.base'), original + '      hidden: [Done]\n')
    await expect(service.preview(await input())).rejects.toThrow()
    await writeFile(join(root, 'Board.base'), original + '    filters:\n      and:\n        - file.folder == "Done"\n')
    await expect(service.preview(await input())).rejects.toThrow()
  })
  it('rejects a preview after exclusion settings change', async () => {
    const request = await input(); const preview = await service.preview(request)
    filters = ['Done']
    await expect(service.apply({ ...request, expectedFingerprint: preview.fingerprint })).rejects.toThrow()
  })
  it('evaluates filters with the saved Base as this.file just like the renderer', async () => {
    const base = await readFile(join(root, 'Board.base'), 'utf8')
    await writeFile(join(root, 'Board.base'), 'filters:\n  and:\n    - this.file.name == "Board.base"\n' + base)
    expect((await service.preview(await input())).destination).toBe('Done/A.md')
  })
  it('preserves excluded referring-note bytes while updating eligible references', async () => {
    await mkdir(join(root, 'Private'))
    const excludedBytes = Buffer.from('\uFEFF[[Inbox/A]]\r\n')
    await writeFile(join(root, 'Private/Ref.md'), excludedBytes)
    filters = ['Private']
    const request = await input(); const preview = await service.preview(request)
    await service.apply({ ...request, expectedFingerprint: preview.fingerprint })
    expect(await readFile(join(root, 'Private/Ref.md'))).toEqual(excludedBytes)
    expect(await readFile(join(root, 'Root.md'), 'utf8')).toBe('[[Done/A]]\n')
    expect(await readFile(join(root, 'Done/A.md'), 'utf8')).toBe('# A\n')
  })
  it('keeps generic coordinator movement unchanged when no caller policy is supplied', async () => {
    await mkdir(join(root, 'Private'))
    await writeFile(join(root, 'Private/Ref.md'), '[[Inbox/A]]\n')
    filters = ['Private']
    const preview = await coordinator.preflight('Inbox/A.md', 'Done/A.md', 'human')
    await coordinator.apply({ source: preview.source, destination: preview.destination, expected_fingerprint: preview.fingerprint, actor: 'human' })
    expect(await readFile(join(root, 'Private/Ref.md'), 'utf8')).toBe('[[Done/A]]\n')
  })
  it('binds the optional link-source policy into coordinator preflight and apply', async () => {
    const policy = { excludedLinkSources: ['Private'] }
    const preview = await coordinator.preflight('Inbox/A.md', 'Done/A.md', 'human', policy)
    const request = { source: preview.source, destination: preview.destination, expected_fingerprint: preview.fingerprint, actor: 'human' as const }
    await expect(coordinator.apply(request)).rejects.toThrow('preflight')
    await expect(coordinator.apply(request, { excludedLinkSources: ['Other'] })).rejects.toThrow('preflight')
    expect(await readFile(join(root, 'Inbox/A.md'), 'utf8')).toBe('# A\n')
    await coordinator.apply(request, policy)
    expect(await readFile(join(root, 'Done/A.md'), 'utf8')).toBe('# A\n')
  })
})
