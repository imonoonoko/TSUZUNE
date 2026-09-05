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

describe('Obsidian plugin IPC', () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tsuzune-ipc-plugins-'))
    electron.appData = await mkdtemp(join(tmpdir(), 'tsuzune-ipc-plugins-data-'))
    electron.handlers.clear()
    await mkdir(join(root, '.obsidian', 'plugins', 'demo-plugin'), { recursive: true })
    await writeFile(
      join(root, '.obsidian', 'plugins', 'demo-plugin', 'manifest.json'),
      JSON.stringify({
        id: 'demo-plugin',
        name: 'Demo',
        version: '1.0.0',
        description: 'Demo',
        author: 'TSUZUNE',
        minAppVersion: '1.0.0',
        isDesktopOnly: false
      })
    )
    await writeFile(
      join(root, '.obsidian', 'plugins', 'demo-plugin', 'main.js'),
      'throw new Error("must not execute")'
    )
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
    await rm(electron.appData, { recursive: true, force: true })
  })

  it('lists candidates for the active Vault and rejects an untrusted sender', async () => {
    const vault = new VaultService()
    await vault.setRootPath(root)
    const mainFrame = {}
    const webContents = { mainFrame }
    registerIpc(
      vault,
      {} as never,
      { connection: {} as never, driveSync: {} as never },
      {} as never,
      () => ({ webContents }) as never,
      () => undefined
    )
    const handler = electron.handlers.get('obsidianPlugins:list')!
    await expect(handler({ sender: {}, senderFrame: {} })).resolves.toMatchObject({
      ok: false,
      error: { code: 'ACCESS_DENIED' }
    })
    await expect(
      handler({ sender: webContents, senderFrame: mainFrame })
    ).resolves.toEqual({
      ok: true,
      value: [
        expect.objectContaining({
          id: 'demo-plugin',
          status: 'detected',
          hasMain: true
        })
      ]
    })
  })
})
