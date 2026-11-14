import { dialog, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { link, lstat, open, rename, unlink } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join } from 'node:path'
import type { PdfExportOptions, PdfExportResult } from '../shared/pdf-export'

export class PdfExportService {
  private exporting = false
  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  async export(input: PdfExportOptions): Promise<PdfExportResult> {
    if (
      !input || typeof input !== 'object' ||
      Object.keys(input).some((key) => !['suggestedName', 'pageSize', 'landscape'].includes(key)) ||
      typeof input.suggestedName !== 'string' || !input.suggestedName.trim() ||
      input.suggestedName.length > 255 || /[/\\\u0000-\u001f]/.test(input.suggestedName) ||
      !['A4', 'Letter'].includes(input.pageSize) || typeof input.landscape !== 'boolean'
    ) throw new Error('PDF書き出しの設定が不正です。')
    if (this.exporting) throw new Error('PDFを書き出し中です。')
    const window = this.getWindow()
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) throw new Error('書き出し元の画面が閉じられています。')
    const frame = window.webContents.mainFrame
    let navigated = false
    const onNavigate = (details: Electron.WebContentsDidStartNavigationEventParams): void => {
      if (details.isMainFrame) navigated = true
    }
    const ensureWindow = (): void => {
      if (navigated || this.getWindow() !== window || window.isDestroyed() || window.webContents.isDestroyed() || window.webContents.mainFrame !== frame) throw new Error('書き出し元の画面が変更されました。')
    }
    this.exporting = true
    try {
      window.webContents.on('did-start-navigation', onNavigate)
      let name = input.suggestedName.replace(/\.pdf$/i, '').replace(/[<>:"|?*]/g, '_').slice(0, 220).replace(/[. ]+$/g, '').trim() || 'note'
      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`
      const selection = await dialog.showSaveDialog(window, {
        title: 'ノートをPDFに書き出し',
        defaultPath: `${name}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
        properties: ['showOverwriteConfirmation']
      })
      ensureWindow()
      if (selection.canceled) return { canceled: true }
      const path = selection.filePath
      if (!path || !isAbsolute(path) || extname(path).toLowerCase() !== '.pdf') throw new Error('PDFファイルの保存先を指定してください。')
      const validateDestination = async (): Promise<string | null> => {
        const stat = await lstat(path, { bigint: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error })
        if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error('通常のPDFファイルを保存先に指定してください。')
        return stat ? [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':') : null
      }
      const originalDestination = await validateDestination()
      ensureWindow()
      const bytes = await window.webContents.printToPDF({
        pageSize: input.pageSize,
        landscape: input.landscape,
        printBackground: true,
        scale: 1,
        displayHeaderFooter: false,
        preferCSSPageSize: false,
        margins: { top: 15 / 25.4, bottom: 15 / 25.4, left: 15 / 25.4, right: 15 / 25.4 }
      })
      ensureWindow()
      const temporary = join(dirname(path), `.tsuzune-pdf-${randomUUID()}.tmp`)
      const handle = await open(temporary, 'wx')
      try {
        try {
          await handle.writeFile(bytes)
          await handle.sync()
        } finally {
          await handle.close()
        }
        if (await validateDestination() !== originalDestination) throw new Error('保存先のファイルが変更されました。もう一度保存先を選んでください。')
        ensureWindow()
        if (originalDestination === null) {
          await link(temporary, path).catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'EEXIST') throw new Error('保存先のファイルが変更されました。もう一度保存先を選んでください。')
            throw error
          })
        } else {
          await rename(temporary, path)
        }
      } finally {
        await unlink(temporary).catch(() => undefined)
      }
      return { canceled: false, path }
    } finally {
      window.webContents.removeListener('did-start-navigation', onNavigate)
      this.exporting = false
    }
  }
}
