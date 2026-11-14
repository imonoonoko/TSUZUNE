import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as fs from 'node:fs/promises'

const electron = vi.hoisted(() => ({ showSaveDialog: vi.fn() }))
vi.mock('electron', () => ({ dialog: electron }))
vi.mock('node:fs/promises', async (importOriginal) => ({ ...await importOriginal<typeof import('node:fs/promises')>() }))
import { PdfExportService } from '../src/main/pdf-export'

const options = { suggestedName: '日本語のノート', pageSize: 'A4' as const, landscape: false }
const roots: string[] = []
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))) })
function fixture() {
  const printToPDF = vi.fn(async () => Buffer.from('%PDF-test'))
  const window = { isDestroyed: () => false, webContents: { isDestroyed: () => false, mainFrame: {}, printToPDF, on: vi.fn<(...args: any[]) => void>(), removeListener: vi.fn() } }
  return { window, printToPDF, service: new PdfExportService(() => window as never) }
}
describe('PDF export', () => {
  it('cancels before generating or touching a destination', async () => {
    electron.showSaveDialog.mockResolvedValue({ canceled: true })
    const { service, printToPDF } = fixture()
    expect(await service.export(options)).toEqual({ canceled: true })
    expect(printToPDF).not.toHaveBeenCalled()
  })
  it('publishes a new PDF at the selected destination', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-pdf-')); roots.push(root)
    const path = join(root, 'note.pdf')
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
    const { service } = fixture()
    expect(await service.export(options)).toEqual({ canceled: false, path })
    expect(await readFile(path, 'utf8')).toBe('%PDF-test')
    expect(await readdir(root)).toEqual(['note.pdf'])
  })
  it('replaces an existing PDF only after generation and writes selected paper options', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-pdf-')); roots.push(root)
    const path = join(root, 'note.pdf'); await writeFile(path, 'old')
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
    const { service, printToPDF } = fixture()
    expect(await service.export({ ...options, pageSize: 'Letter', landscape: true })).toEqual({ canceled: false, path })
    expect(await readFile(path, 'utf8')).toBe('%PDF-test')
    expect(await readdir(root)).toEqual(['note.pdf'])
    expect(printToPDF).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 'Letter', landscape: true, printBackground: true, scale: 1, displayHeaderFooter: false, preferCSSPageSize: false, margins: { top: 15 / 25.4, bottom: 15 / 25.4, left: 15 / 25.4, right: 15 / 25.4 } }))
  })
  it('rejects invalid options before opening a dialog', async () => {
    const { service } = fixture(); electron.showSaveDialog.mockClear()
    for (const input of [null, {}, { ...options, pageSize: 'A3' }, { ...options, landscape: 1 }, { ...options, suggestedName: '../escape' }, { ...options, path: 'injected.pdf' }]) {
      await expect(service.export(input as never)).rejects.toThrow()
    }
    expect(electron.showSaveDialog).not.toHaveBeenCalled()
  })
  it('rejects invalid destinations without printing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-pdf-')); roots.push(root)
    await fs.mkdir(join(root, 'directory.pdf'))
    await fs.symlink(root, join(root, 'link.pdf'), 'junction')
    const { service, printToPDF } = fixture()
    for (const path of [join(root, 'note.txt'), join(root, 'directory.pdf'), join(root, 'link.pdf'), 'relative.pdf']) {
      electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
      await expect(service.export(options)).rejects.toThrow()
    }
    expect(printToPDF).not.toHaveBeenCalled()
  })
  it.each(['print', 'write', 'replace'])('preserves existing bytes and cleans temporary files on %s failure', async (stage) => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-pdf-')); roots.push(root)
    const path = join(root, 'note.pdf'); await writeFile(path, 'original')
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
    const { service, printToPDF } = fixture()
    if (stage === 'print') printToPDF.mockRejectedValue(new Error('print failed'))
    if (stage === 'write') {
      const originalOpen = fs.open
      vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
        const handle = await originalOpen(...args)
        vi.spyOn(handle, 'writeFile').mockRejectedValue(new Error('write failed'))
        return handle
      })
    }
    if (stage === 'replace') vi.spyOn(fs, 'rename').mockRejectedValue(new Error('replace failed'))
    await expect(service.export(options)).rejects.toThrow('failed')
    expect(await readFile(path, 'utf8')).toBe('original')
    expect(await readdir(root)).toEqual(['note.pdf'])
  })
  it('rejects overlap and a window that becomes stale while the dialog is open', async () => {
    let finish!: (result: { canceled: boolean; filePath: string }) => void
    electron.showSaveDialog.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { service, window, printToPDF } = fixture()
    const pending = service.export(options)
    await expect(service.export(options)).rejects.toThrow()
    window.isDestroyed = () => true
    finish({ canceled: false, filePath: join(tmpdir(), 'should-not-write.pdf') })
    await expect(pending).rejects.toThrow()
    expect(printToPDF).not.toHaveBeenCalled()
  })
  it('aborts when the main frame navigates during generation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-pdf-')); roots.push(root)
    const path = join(root, 'note.pdf'); await writeFile(path, 'original')
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
    const { service, window, printToPDF } = fixture()
    printToPDF.mockImplementation(async () => {
      const listener = window.webContents.on.mock.calls.find(([event]) => event === 'did-start-navigation')?.[1] as ((...args: unknown[]) => void) | undefined
      listener?.({ isMainFrame: true })
      return Buffer.from('%PDF-other')
    })
    await expect(service.export(options)).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe('original')
  })
  it.each([true, false])('preserves external changes made during printing (existing: %s)', async (existing) => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-pdf-')); roots.push(root)
    const path = join(root, 'note.pdf')
    if (existing) await writeFile(path, 'old')
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
    const { service, printToPDF } = fixture()
    printToPDF.mockImplementation(async () => {
      await writeFile(path, 'external newer content')
      return Buffer.from('%PDF-test')
    })
    await expect(service.export(options)).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe('external newer content')
    expect(await readdir(root)).toEqual(['note.pdf'])
  })
  it('preserves a destination created after the final existence check', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-pdf-')); roots.push(root)
    const path = join(root, 'note.pdf')
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
    const originalLstat = fs.lstat
    let destinationChecks = 0
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args: Parameters<typeof fs.lstat>) => {
      if (args[0] === path && ++destinationChecks === 2) {
        try {
          return await originalLstat(...args)
        } finally {
          await writeFile(path, 'new destination')
        }
      }
      return originalLstat(...args)
    })
    const { service } = fixture()
    await expect(service.export(options)).rejects.toThrow('保存先のファイルが変更されました')
    expect(await readFile(path, 'utf8')).toBe('new destination')
    expect(await readdir(root)).toEqual(['note.pdf'])
  })
})
