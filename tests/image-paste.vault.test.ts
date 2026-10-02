import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VaultService } from '../src/main/vault'
import { canonicalWorkspaceVaultKey } from '../src/main/workspaces'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
describe('pasted image storage', () => {
  let root: string, canonicalRoot: string, vault: VaultService
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tsuzune-image-paste-'))
    await mkdir(join(root, '日本語 空白'))
    await writeFile(join(root, '日本語 空白/Note.md'), '\uFEFF本文\r\n<!--keep-->')
    vault = new VaultService()
    await vault.setRootPath(root)
    canonicalRoot = await canonicalWorkspaceVaultKey(root)
  })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })
  const input = () => ({ scope: { rootPath: canonicalRoot, rootRevision: vault.getRootRevision() }, notePath: '日本語 空白/Note.md', content: png })

  it('stores collision-free images next to the note and preserves note bytes', async () => {
    const [first, second] = await Promise.all([vault.importPastedImage(input()), vault.importPastedImage(input())])
    expect(first.path).not.toBe(second.path)
    expect(first.path).toMatch(/^日本語 空白\/Pasted image .*\.png$/)
    expect(await readFile(join(root, first.path))).toEqual(png)
    expect(await readFile(join(root, '日本語 空白/Note.md'), 'utf8')).toBe('\uFEFF本文\r\n<!--keep-->')
    expect((await readdir(join(root, '日本語 空白'))).filter(path => path.endsWith('.tmp'))).toEqual([])
    expect((await vault.scan()).attachments?.some(image => image.path === first.path)).toBe(true)
  })

  it('rejects stale scope, missing/outside notes, invalid data and history without new files', async () => {
    for (const changes of [{ scope: { rootPath: root, rootRevision: -1 } }, { notePath: '../outside.md' },
      { notePath: 'missing.md' }, { notePath: '50_履歴/log.md' }, { content: Buffer.from('not image') }]) {
      await expect(vault.importPastedImage({ ...input(), ...changes })).rejects.toBeDefined()
    }
    expect(await readdir(join(root, '日本語 空白'))).toEqual(['Note.md'])
  })

  it('checks Vault generation again after reading the note', async () => {
    const other = join(root, 'other')
    await mkdir(other)
    const read = vault.readNote.bind(vault)
    vi.spyOn(vault, 'readNote').mockImplementationOnce(async path => {
      const note = await read(path)
      await vault.setRootPath(other)
      return note
    })
    await expect(vault.importPastedImage(input())).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    expect(await readdir(other)).toEqual([])
    expect(await readdir(join(root, '日本語 空白'))).toEqual(['Note.md'])
  })
})
