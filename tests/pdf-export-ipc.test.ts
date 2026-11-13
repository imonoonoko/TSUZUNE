import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.hoisted(() => Object.defineProperty(process, 'isMainFrame', { configurable: true, writable: true, value: true }))
const electron = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => Promise<any>>(), showSaveDialog: vi.fn(), exposed: undefined as any, invoke: vi.fn() }))
vi.mock('electron', () => ({ app: { getPath: () => '' }, BrowserWindow: class {}, clipboard: {}, nativeImage: {}, dialog: { showSaveDialog: electron.showSaveDialog }, ipcMain: { handle: (name: string, handler: any) => electron.handlers.set(name, handler), on: vi.fn() }, shell: {}, contextBridge: { exposeInMainWorld: (_name: string, value: any) => { electron.exposed = value } }, ipcRenderer: { invoke: electron.invoke } }))
import { registerIpc } from '../src/main/ipc'
import '../src/preload/index'
describe('PDF export bridge', () => {
  const contents = { mainFrame: {}, isDestroyed: () => false, printToPDF: vi.fn(), on: vi.fn(), removeListener: vi.fn() }
  const window = { isDestroyed: () => false, webContents: contents }
  beforeEach(() => {
    electron.handlers.clear(); electron.showSaveDialog.mockReset()
    registerIpc({} as never, {} as never, { driveSync: {} } as never, {} as never, () => window as never, () => undefined)
  })
  it('only accepts the trusted main frame and returns the normal Result envelope', async () => {
    const handler = electron.handlers.get('note:exportPdf')!
    expect(handler).toBeTypeOf('function')
    for (const event of [{ sender: {}, senderFrame: contents.mainFrame }, { sender: contents, senderFrame: {} }]) expect(await handler(event, {})).toMatchObject({ ok: false, error: { code: 'ACCESS_DENIED' } })
    expect(electron.showSaveDialog).not.toHaveBeenCalled()
    expect(await handler({ sender: contents, senderFrame: contents.mainFrame }, { pageSize: 'A3' })).toMatchObject({ ok: false })
    electron.showSaveDialog.mockResolvedValue({ canceled: true })
    expect(await handler({ sender: contents, senderFrame: contents.mainFrame }, { suggestedName: 'note', pageSize: 'A4', landscape: false })).toEqual({ ok: true, value: { canceled: true } })
  })
  it('exposes the fixed options API without a renderer-selected destination', async () => {
    const input = { suggestedName: 'note', pageSize: 'Letter', landscape: true }
    electron.invoke.mockResolvedValue({ ok: true, value: { canceled: true } })
    expect(await electron.exposed.exportNotePdf(input)).toEqual({ ok: true, value: { canceled: true } })
    expect(electron.invoke).toHaveBeenCalledWith('note:exportPdf', input)
  })
})
