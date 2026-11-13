import { mkdtemp, writeFile, mkdir, rm, symlink, open } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VaultService } from '../src/main/vault'

let root: string, vault: VaultService
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'tsuzune-pdf-test-')); vault = new VaultService(); await vault.setRootPath(root) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
describe('Vault PDF reads', () => {
  it('returns exact local PDF bytes without modifying the file', async () => {
    const bytes = Buffer.from('%PDF-1.7\nfixture\x00')
    await writeFile(join(root, 'Paper.PDF'), bytes)
    expect(await vault.readPdfBytes('Paper.PDF')).toEqual(new Uint8Array(bytes))
  })
  it('rejects a stale Vault even when the active Vault has the same attachment path', async () => {
    await mkdir(join(root, 'other'))
    const bytes = Buffer.from('%PDF-1.7\ncurrent Vault')
    await writeFile(join(root, 'other', 'paper.pdf'), bytes)
    const previousRoot = vault.getRootPath()!
    await vault.setRootPath(join(root, 'other'))
    await expect(vault.readPdfBytes('paper.pdf', previousRoot)).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    await expect(vault.readPdfBytes('paper.pdf', vault.getRootPath()!)).resolves.toEqual(new Uint8Array(bytes))
  })
  it('rejects traversal, non-PDF and spoofed PDF content', async () => {
    await writeFile(join(root, 'bad.pdf'), '<html>not PDF</html>')
    await expect(vault.readPdfBytes('../outside.pdf')).rejects.toMatchObject({ appError: { code: 'INVALID_PATH' } })
    await expect(vault.readPdfBytes('note.md')).rejects.toMatchObject({ appError: { code: 'INVALID_PATH' } })
    await expect(vault.readPdfBytes('bad.pdf')).rejects.toMatchObject({ appError: { code: 'INVALID_PATH' } })
  })
  it('rejects oversize PDFs before reading their contents', async () => {
    const file = await open(join(root, 'large.pdf'), 'w')
    await file.write('%PDF-1.7\n'); await file.truncate(100 * 1024 * 1024 + 1); await file.close()
    await expect(vault.readPdfBytes('large.pdf')).rejects.toMatchObject({ appError: { code: 'INVALID_PATH' } })
  })
  it('rejects symlink traversal', async () => {
    await mkdir(join(root, 'outside')); await writeFile(join(root, 'outside', 'p.pdf'), '%PDF-1.7\n')
    await symlink(join(root, 'outside'), join(root, 'alias'), 'junction')
    await expect(vault.readPdfBytes('alias/p.pdf')).rejects.toMatchObject({ appError: { code: 'INVALID_PATH' } })
  })
  it('discards a result when the active Vault changed during resolution', async () => {
    await writeFile(join(root, 'p.pdf'), '%PDF-1.7\n')
    await mkdir(join(root, 'other'))
    const resolveFile = vault.resolveFileForOpen.bind(vault)
    vi.spyOn(vault, 'resolveFileForOpen').mockImplementation(async path => { const absolute = await resolveFile(path); await vault.setRootPath(join(root, 'other')); return absolute })
    await expect(vault.readPdfBytes('p.pdf')).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
  })
})
