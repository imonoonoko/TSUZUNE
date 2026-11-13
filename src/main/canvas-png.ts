import { dialog, nativeImage, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { link, open, unlink } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join } from 'node:path'
import type { CanvasPngExportOptions, CanvasPngExportResult } from '../shared/canvas-png'

export class CanvasPngExportService {
  private exporting = false
  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  async export(input: CanvasPngExportOptions): Promise<CanvasPngExportResult> {
    if (!input || typeof input !== 'object' || Object.keys(input).some(key => !['suggestedName', 'png'].includes(key)) ||
      typeof input.suggestedName !== 'string' || !input.suggestedName.trim() || input.suggestedName.length > 255 || /[/\\\u0000-\u001f]/.test(input.suggestedName) ||
      typeof input.png !== 'string' || input.png.length > 32 * 1024 * 1024 * 4 / 3 + 32 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.png)) throw new Error('PNGの設定または容量が不正です。PNGの上限は32MiBです。')
    const encoded = input.png.slice('data:image/png;base64,'.length)
    const bytes = Buffer.from(encoded, 'base64')
    if (bytes.toString('base64') !== encoded) throw new Error('PNGの形式または容量が不正です。')
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.length > 32 * 1024 * 1024) throw new Error('PNGの形式または容量が不正です。')
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20)
    if (!width || !height || width > 8192 || height > 8192 || width * height > 16_000_000) throw new Error('PNGの上限を超えています。')
    const image = nativeImage.createFromBuffer(bytes)
    const size = image.getSize()
    if (image.isEmpty() || size.width !== width || size.height !== height) throw new Error('PNGを読み込めませんでした。')
    if (this.exporting) throw new Error('PNGを保存中です。')
    const window = this.getWindow()
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) throw new Error('Canvasが閉じられています。')
    const frame = window.webContents.mainFrame
    let navigated = false
    const onNavigate = (_event: unknown, _url: string, _inPlace: boolean, isMainFrame: boolean): void => { if (isMainFrame) navigated = true }
    const ensureWindow = (): void => {
      if (navigated || this.getWindow() !== window || window.isDestroyed() || window.webContents.isDestroyed() || window.webContents.mainFrame !== frame) throw new Error('書き出し元の画面が変更されました。')
    }
    this.exporting = true
    window.webContents.on('did-start-navigation', onNavigate)
    try {
      let name = input.suggestedName.replace(/\.png$/i, '').replace(/[<>:"|?*]/g, '_').slice(0, 220).replace(/[. ]+$/g, '').trim() || 'Canvas'
      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`
      const selection = await dialog.showSaveDialog(window, { title: 'CanvasをPNGで保存', defaultPath: `${name}.png`, filters: [{ name: 'PNG', extensions: ['png'] }], properties: ['showOverwriteConfirmation'] })
      ensureWindow()
      if (selection.canceled) return { canceled: true }
      const path = selection.filePath
      if (!path || !isAbsolute(path) || extname(path).toLowerCase() !== '.png') throw new Error('PNGファイルの保存先を指定してください。')
      const temporary = join(dirname(path), `.tsuzune-png-${randomUUID()}.tmp`)
      const handle = await open(temporary, 'wx')
      try {
        try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
        ensureWindow()
        await link(temporary, path).catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'EEXIST') throw new Error('同じ名前のファイルがあります。別の名前で保存してください。')
          throw error
        })
      } finally { await unlink(temporary).catch(() => undefined) }
      return { canceled: false, path }
    } finally {
      window.webContents.removeListener('did-start-navigation', onNavigate)
      this.exporting = false
    }
  }
}
