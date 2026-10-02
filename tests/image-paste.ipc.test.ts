import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  decode: vi.fn(), image: { isEmpty: vi.fn(() => false), toPNG: vi.fn(() => Buffer.from('PNG')) } }))
vi.mock('electron', () => ({ BrowserWindow: class {}, clipboard: {}, dialog: {}, shell: {},
  nativeImage: { createFromBuffer: mock.decode }, app: { getPath: () => '' },
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => mock.handlers.set(channel, handler), on: vi.fn() } }))
import { registerIpc } from '../src/main/ipc'
import { MAX_PASTED_IMAGE_BYTES } from '../src/shared/image-paste'
describe('image paste IPC boundary', () => {
  const window = { webContents: { mainFrame: {} } }, vault = { importPastedImage: vi.fn(async () => ({ path: 'image.png' })) }
  const trusted = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
  const input = () => ({ scope: { rootPath: 'C:\\Vault', rootRevision: 1 }, notePath: 'Note.md', bytes: new Uint8Array([1, 2, 3]) })
  beforeEach(() => {
    vi.clearAllMocks()
    mock.image.isEmpty.mockReturnValue(false)
    mock.image.toPNG.mockReturnValue(Buffer.from('PNG'))
    mock.decode.mockReturnValue(mock.image)
    registerIpc(vault as never, {} as never, { connection: {}, driveSync: {} } as never,
      {} as never, () => window as never, () => undefined)
  })
  it('decodes image data in main and forwards its PNG and original scope', async () => {
    const args = input()
    await expect(mock.handlers.get('attachment:pasteImage')!(trusted, args)).resolves.toEqual({ ok: true, value: { path: 'image.png' } })
    expect(vault.importPastedImage).toHaveBeenCalledWith({ scope: args.scope, notePath: args.notePath, content: Buffer.from('PNG') })
  })
  it('rejects untrusted senders and malformed/oversized data before decoding or storage', async () => {
    const invoke = mock.handlers.get('attachment:pasteImage')!
    await expect(invoke({ sender: {}, senderFrame: {} }, input())).resolves.toMatchObject({ ok: false, error: { code: 'ACCESS_DENIED' } })
    for (const bytes of [null, new Uint8Array(), new Uint8Array(MAX_PASTED_IMAGE_BYTES + 1)]) {
      await expect(invoke(trusted, { ...input(), bytes })).resolves.toMatchObject({ ok: false })
    }
    expect(mock.decode).not.toHaveBeenCalled()
    expect(vault.importPastedImage).not.toHaveBeenCalled()
  })
  it('rejects undecodable images and oversized converted PNG without storage', async () => {
    const invoke = mock.handlers.get('attachment:pasteImage')!
    mock.image.isEmpty.mockReturnValueOnce(true)
    await expect(invoke(trusted, input())).resolves.toMatchObject({ ok: false })
    mock.image.toPNG.mockReturnValueOnce(Buffer.alloc(MAX_PASTED_IMAGE_BYTES + 1))
    await expect(invoke(trusted, input())).resolves.toMatchObject({ ok: false })
    expect(vault.importPastedImage).not.toHaveBeenCalled()
  })
})
