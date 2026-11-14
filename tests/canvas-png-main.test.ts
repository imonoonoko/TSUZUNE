import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as fs from 'node:fs/promises'
const electron = vi.hoisted(() => ({ showSaveDialog: vi.fn(), createFromBuffer: vi.fn(() => ({ isEmpty: (): boolean => false, getSize: () => ({ width: 1, height: 1 }) })) }))
vi.mock('electron', () => ({ dialog: electron, nativeImage: electron }))
vi.mock('node:fs/promises', async importOriginal => ({ ...await importOriginal<typeof import('node:fs/promises')>() }))
import { CanvasPngExportService } from '../src/main/canvas-png'
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII='
const options = { suggestedName: '日本語.canvas.png', png }
const roots: string[] = []
afterEach(async () => { vi.restoreAllMocks(); vi.clearAllMocks(); await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
function fixture() {
  const window = { isDestroyed: () => false, webContents: { isDestroyed: () => false, mainFrame: {}, on: vi.fn(), removeListener: vi.fn() } }
  return { window, service: new CanvasPngExportService(() => window as never) }
}
it('saves the PNG bytes to the new path selected by the native dialog', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-png-')); roots.push(root)
  const path = join(root, 'Board.png')
  electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
  const { service } = fixture()
  expect(await service.export(options)).toEqual({ canceled: false, path })
  expect(await readFile(path)).toEqual(Buffer.from(png.split(',')[1], 'base64'))
  expect(await readdir(root)).toEqual(['Board.png'])
})
it('validates input, dimensions and native decoding before opening a save dialog', async () => {
  const { service } = fixture()
  const huge = Buffer.from(png.split(',')[1], 'base64'); huge.writeUInt32BE(9000, 16)
  const tooManyPixels = Buffer.from(png.split(',')[1], 'base64'); tooManyPixels.writeUInt32BE(4001, 16); tooManyPixels.writeUInt32BE(4001, 20)
  for (const input of [null, {}, { ...options, suggestedName: '../escape' }, { ...options, path: 'injected.png' }, { ...options, png: 'data:text/html;base64,AAAA' }, { ...options, png: 'data:image/png;base64,AAAA' }, { ...options, png: `data:image/png;base64,${png.split(',')[1].replace(/=$/, '')}` }, { ...options, png: 'data:image/png;base64,' + huge.toString('base64') }, { ...options, png: 'data:image/png;base64,' + tooManyPixels.toString('base64') }]) {
    await expect(service.export(input as never)).rejects.toThrow()
  }
  electron.createFromBuffer.mockReturnValueOnce({ isEmpty: () => true, getSize: () => ({ width: 1, height: 1 }) })
  await expect(service.export(options)).rejects.toThrow('PNGを読み込めません')
  expect(electron.showSaveDialog).not.toHaveBeenCalled()
})
it('handles cancel, invalid destinations, overlap and stale windows without creating output', async () => {
  const { service, window } = fixture()
  electron.showSaveDialog.mockResolvedValue({ canceled: true })
  expect(await service.export(options)).toEqual({ canceled: true })
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-png-')); roots.push(root)
  await fs.mkdir(join(root, 'directory.png'))
  for (const path of ['relative.png', join(root, 'wrong.md'), join(root, 'directory.png')]) {
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
    await expect(service.export(options)).rejects.toThrow()
  }
  let finish!: (result: { canceled: boolean; filePath: string }) => void
  electron.showSaveDialog.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = service.export(options)
  await expect(service.export(options)).rejects.toThrow('保存中')
  window.isDestroyed = () => true
  finish({ canceled: false, filePath: join(root, 'out.png') })
  await expect(pending).rejects.toThrow('画面が変更')
  expect(await readdir(root)).toEqual(['directory.png'])
})
it('preserves an existing or concurrently created destination and asks for another name', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-png-')); roots.push(root)
  const path = join(root, 'Board.png'); await writeFile(path, 'original')
  electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path })
  await expect(fixture().service.export(options)).rejects.toThrow('別の名前')
  expect(await readFile(path, 'utf8')).toBe('original')
  await fs.unlink(path)
  const originalLink = fs.link
  vi.spyOn(fs, 'link').mockImplementationOnce(async (...args) => { await writeFile(path, 'concurrent'); return originalLink(...args) })
  await expect(fixture().service.export(options)).rejects.toThrow('別の名前')
  expect(await readFile(path, 'utf8')).toBe('concurrent')
  expect(await readdir(root)).toEqual(['Board.png'])
})
it.each(['write', 'publish'])('leaves no partial output and cleans up on %s failure', async stage => {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-png-')); roots.push(root)
  electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: join(root, 'Board.png') })
  if (stage === 'publish') vi.spyOn(fs, 'link').mockRejectedValueOnce(new Error('publish failed'))
  else {
    const originalOpen = fs.open
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const handle = await originalOpen(...args)
      vi.spyOn(handle, 'writeFile').mockRejectedValueOnce(new Error('write failed'))
      return handle
    })
  }
  await expect(fixture().service.export(options)).rejects.toThrow('failed')
  expect(await readdir(root)).toEqual([])
})
