import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const electron = vi.hoisted(() => ({
  appData: '',
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>()
}))

vi.mock('electron', () => ({
  app: { getPath: () => electron.appData },
  BrowserWindow: class {},
  clipboard: { writeText: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) =>
      electron.handlers.set(channel, handler),
    on: vi.fn()
  },
  shell: { openExternal: vi.fn(), showItemInFolder: vi.fn() }
}))

import { registerIpc } from '../src/main/ipc'
import { VaultService } from '../src/main/vault'

describe('workspace IPC', () => {
  let root = ''
  let vault: VaultService
  let window: { webContents: { mainFrame: object } }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tsuzune-ipc-workspaces-'))
    electron.appData = join(root, 'profile')
    const vaultRoot = join(root, 'Vault')
    await Promise.all([mkdir(electron.appData), mkdir(vaultRoot)])
    electron.handlers.clear()
    vault = new VaultService()
    await vault.setRootPath(vaultRoot)
    window = { webContents: { mainFrame: {} } }
    registerIpc(
      vault,
      {} as never,
      { connection: {} as never, driveSync: {} as never },
      {} as never,
      () => window as never,
      () => undefined
    )
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('registers exactly the four narrow workspace channels behind sender trust', async () => {
    const channels = [...electron.handlers.keys()].filter((channel) => channel.startsWith('workspaces:'))
    expect(channels).toEqual([
      'workspaces:get',
      'workspaces:save',
      'workspaces:delete',
      'workspaces:saveLastSession'
    ])
    const get = electron.handlers.get('workspaces:get')!
    await expect(get({ sender: {}, senderFrame: {} }, vault.getRootPath())).resolves.toMatchObject({
      ok: false,
      error: { code: 'ACCESS_DENIED' }
    })
    await expect(
      get(
        { sender: window.webContents, senderFrame: window.webContents.mainFrame },
        vault.getRootPath()
      )
    ).resolves.toMatchObject({ ok: true, value: { state: { version: 1, named: [] } } })
  })

  it('lists Bases through a trusted channel using settings-owned exclusions', async () => {
    const vaultRoot = vault.getRootPath()!
    await mkdir(join(vaultRoot, 'views'), { recursive: true })
    await Promise.all([
      writeFile(join(vaultRoot, 'visible.base'), 'visible', 'utf8'),
      writeFile(join(vaultRoot, 'views', 'hidden.base'), 'hidden', 'utf8'),
      writeFile(
        join(electron.appData, 'settings.json'),
        JSON.stringify({ userIgnoreFilters: ['views/'] }),
        'utf8'
      )
    ])
    const listBases = electron.handlers.get('vault:listBases')!

    await expect(
      listBases({ sender: {}, senderFrame: {} }, vaultRoot)
    ).resolves.toMatchObject({ ok: false, error: { code: 'ACCESS_DENIED' } })
    await expect(
      listBases(
        { sender: window.webContents, senderFrame: window.webContents.mainFrame },
        vaultRoot
      )
    ).resolves.toEqual({ ok: true, value: ['visible.base'] })
    await expect(
      listBases(
        { sender: window.webContents, senderFrame: window.webContents.mainFrame },
        join(vaultRoot, 'other')
      )
    ).resolves.toMatchObject({ ok: false, error: { code: 'FILE_CHANGED' } })
  })
})
