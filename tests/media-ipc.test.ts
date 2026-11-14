import { afterEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>() }))
vi.mock('electron', () => ({
  BrowserWindow: class {},
  clipboard: {},
  dialog: {},
  shell: {},
  nativeImage: {},
  app: { getPath: () => '' },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => mock.handlers.set(channel, handler),
    on: vi.fn()
  }
}))

import { registerIpc } from '../src/main/ipc'
import { VaultMedia } from '../src/main/media-protocol'

afterEach(() => vi.restoreAllMocks())

it('issues a capability only to the trusted main frame and forwards the requesting Vault', async () => {
  const window = { webContents: { mainFrame: {} } }
  const getUrl = vi.spyOn(VaultMedia.prototype, 'getUrl').mockResolvedValue('tsuzune-media://vault/token')
  registerIpc({} as never, {} as never, { connection: {}, driveSync: {} } as never, {} as never,
    () => window as never, () => {})
  const invoke = mock.handlers.get('vault:mediaUrl')!
  const scope = 'C:/Vault'
  for (const event of [{ sender: {}, senderFrame: window.webContents.mainFrame }, { sender: window.webContents, senderFrame: {} }]) {
    await expect(invoke(event, 'a.wav', scope)).resolves.toMatchObject({ ok: false, error: { code: 'ACCESS_DENIED' } })
  }
  expect(getUrl).not.toHaveBeenCalled()
  await expect(invoke({ sender: window.webContents, senderFrame: window.webContents.mainFrame }, 'a.wav', scope))
    .resolves.toEqual({ ok: true, value: 'tsuzune-media://vault/token' })
  expect(getUrl).toHaveBeenCalledExactlyOnceWith('a.wav', scope)
})
