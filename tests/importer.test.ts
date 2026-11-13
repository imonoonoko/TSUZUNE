import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, mkdir, open, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VaultService } from '../src/main/vault'
import { canonicalWorkspaceVaultKey } from '../src/main/workspaces'
import { ImporterService } from '../src/main/importer'
import { IMPORT_MAX_FILE_BYTES, IMPORT_MAX_FILES } from '../src/shared/importer'

describe('human import transaction', () => {
  let home: string, root: string, source: string, vault: VaultService, service: ImporterService
  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'tsuzune-import-')); root = join(home, 'vault'); source = join(home, 'source')
    await mkdir(root); await mkdir(source); await writeFile(join(source, 'A.md'), '# original')
    vault = new VaultService(); await vault.setRootPath(root); service = new ImporterService(vault)
  })
  afterEach(async () => { vi.restoreAllMocks(); await rm(home, { recursive: true, force: true }) })
  const scope = async (vault: VaultService) => ({ rootPath: await canonicalWorkspaceVaultKey(vault.getRootPath()!), rootRevision: vault.getRootRevision() })
  async function preview() {
    const s = await scope(vault)
    const selected = await service.read({ scope: s, format: 'markdown', kind: 'folder' }, [{ path: join(source, 'A.md'), relativePath: 'source/A.md' }])
    const plan = await service.preview({ scope: s, sourceToken: selected.token, destinationName: 'Imported', files: selected.files, warnings: [] })
    return { s, selected, plan }
  }
  it('previews without writing and publishes copied bytes only on apply', async () => {
    const { s, plan } = await preview(); expect(await readdir(root)).toEqual([])
    const result = await service.apply({ scope: s, planId: plan.planId })
    expect(result.folder).toBe('Imported'); expect(await readFile(join(root, 'Imported/A.md'), 'utf8')).toBe('# original')
    expect(await readFile(join(source, 'A.md'), 'utf8')).toBe('# original')
    expect(result.snapshot.notes.some(file => file.path === 'Imported/A.md')).toBe(true)
    expect(await readdir(root)).toEqual(['Imported'])
  })
  it('does not overwrite even an empty destination created after preview', async () => {
    const { s, plan } = await preview(); await mkdir(join(root, 'Imported'))
    await expect(service.apply({ scope: s, planId: plan.planId })).rejects.toThrow('既に')
    expect(await readdir(join(root, 'Imported'))).toEqual([])
    expect(await readdir(root)).toEqual(['Imported'])
  })
  it('detects changed original bytes and stale Vault generations without writes', async () => {
    let current = await preview(); await writeFile(join(source, 'A.md'), '# changed')
    await expect(service.apply({ scope: current.s, planId: current.plan.planId })).rejects.toThrow('変更')
    current = await preview(); await vault.setRootPath(root)
    await expect(service.apply({ scope: current.s, planId: current.plan.planId })).rejects.toThrow('変更')
    expect(await readdir(root)).toEqual([])
  })
  it('seals outputs and detects repeated import regardless of destination name', async () => {
    const { s, selected, plan } = await preview(); selected.files[0].bytes.fill(0)
    await service.apply({ scope: s, planId: plan.planId })
    const read = await service.read({ scope: s, format: 'markdown', kind: 'folder' }, [{ path: join(source, 'A.md'), relativePath: 'source/A.md' }])
    const repeat = await service.preview({ scope: s, sourceToken: read.token, destinationName: 'Other', files: read.files, warnings: [] })
    expect(repeat.duplicateFolder).toBe('Imported')
    await expect(service.apply({ scope: s, planId: repeat.planId })).rejects.toThrow('同じ原本')
    expect(await readFile(join(root, 'Imported/A.md'), 'utf8')).toBe('# original')
  })
  it('rejects unsafe output names, collisions, source overlap and expired source tokens', async () => {
    const { s, selected } = await preview()
    for (const path of ['../a.md', '/a.md', 'CON.md', 'COM¹.md', 'A.md.', '.hidden/A.md', 'A.md ', ' leading.md', 'a\\b.md']) {
      await expect(service.preview({ scope: s, sourceToken: selected.token, destinationName: 'Import', files: [{ path, bytes: new Uint8Array() }], warnings: [] })).rejects.toThrow()
    }
    await expect(service.preview({ scope: s, sourceToken: selected.token, destinationName: 'Import', files: ['A.md', 'a.MD'].map(path => ({ path, bytes: new Uint8Array() })), warnings: [] })).rejects.toThrow('衝突')
    await expect(service.preview({ scope: s, sourceToken: selected.token, destinationName: 'Import', files: ['Dir/A.md', 'dir/B.md'].map(path => ({ path, bytes: new Uint8Array() })), warnings: [] })).rejects.toThrow('衝突')
    await service.discard(selected.token)
    await expect(service.preview({ scope: s, sourceToken: selected.token, destinationName: 'Import', files: selected.files, warnings: [] })).rejects.toThrow('変更')
    await writeFile(join(root, 'Inside.md'), 'existing')
    await expect(service.read({ scope: s, format: 'markdown', kind: 'file' }, [{ path: join(root, 'Inside.md'), relativePath: 'Inside.md' }])).rejects.toThrow('重なって')
  })
  it('excludes hidden settings and symlink sources with warnings', async () => {
    await writeFile(join(source, '.settings'), 'private'); await mkdir(join(home, 'other')); await writeFile(join(home, 'other/A.md'), 'linked'); await symlink(join(home, 'other'), join(source, 'Link'), 'junction')
    const result = await service.read({ scope: await scope(vault), format: 'markdown', kind: 'folder' }, [...['A.md', '.settings', 'Link/A.md'].map(name => ({ path: join(source, name), relativePath: `source/${name}` }))])
    expect(result.files.map(file => file.path)).toEqual(['A.md']); expect(result.warnings.length).toBe(2)
  })
  it('rejects oversized selections and source files before copying', async () => {
    const s = await scope(vault), item = { path: join(source, 'A.md'), relativePath: 'source/A.md' }
    await expect(service.read({ scope: s, format: 'markdown', kind: 'folder' }, Array(IMPORT_MAX_FILES + 1).fill(item))).rejects.toThrow('5000')
    const handle = await open(item.path, 'w'); await handle.truncate(IMPORT_MAX_FILE_BYTES + 1); await handle.close()
    await expect(service.read({ scope: s, format: 'markdown', kind: 'folder' }, [item])).rejects.toThrow('128MiB')
    expect(await readdir(root)).toEqual([])
  })
  it('cleans only its hidden stage when the source changes during staging', async () => {
    const { s, plan } = await preview(), generation = vault.getRootRevision()
    vi.spyOn(vault, 'getRootRevision').mockImplementation(() => {
      if (readdirSync(root).some(name => name.startsWith('.tsuzune-import-'))) writeFileSync(join(source, 'A.md'), '# edited during stage')
      return generation
    })
    await expect(service.apply({ scope: s, planId: plan.planId })).rejects.toThrow('変更')
    expect(await readdir(root)).toEqual([])
    expect(await readFile(join(source, 'A.md'), 'utf8')).toBe('# edited during stage')
  })
  it('never exposes hidden staging files in a snapshot', async () => {
    await mkdir(join(root, '.tsuzune-import-test')); await writeFile(join(root, '.tsuzune-import-test/A.md'), 'not published')
    const snapshot = await vault.scan([], { persistCreationTimes: false })
    expect(snapshot.notes).toEqual([]); expect(snapshot.directories).toEqual([''])
  })
})
