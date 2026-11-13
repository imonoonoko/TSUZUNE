import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { gunzipSync } from 'node:zlib'

const electron = vi.hoisted(() => ({
  appData: '',
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>()
}))

vi.mock('electron', () => ({
  app: { getPath: () => electron.appData },
  BrowserWindow: class {},
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) =>
      electron.handlers.set(channel, handler),
    on: vi.fn()
  }
}))

import { registerIpc } from '../src/main/ipc'
import { VaultService } from '../src/main/vault'

let root: string
let vaultRoot: string
const webContents = { mainFrame: {} }
const trusted = { sender: webContents, senderFrame: webContents.mainFrame }

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tsuzune-startup-ipc-'))
  electron.appData = join(root, 'profile')
  vaultRoot = join(root, 'Vault')
  await Promise.all([mkdir(electron.appData), mkdir(vaultRoot)])
  electron.handlers.clear()
  registerIpc(
    new VaultService(),
    { start: vi.fn(), stop: vi.fn() } as never,
    { connection: {} as never, driveSync: {} as never },
    {} as never,
    () => ({ webContents }) as never,
    () => undefined
  )
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('returns the same complete initial Vault as the ordinary open, with compression for a large note', async () => {
  const body = '# 起動時のノート\n'.repeat(30_000)
  await Promise.all([
    writeFile(join(vaultRoot, '起動.md'), body),
    writeFile(join(electron.appData, 'settings.json'), JSON.stringify({ lastVaultPath: vaultRoot }))
  ])

  const open = electron.handlers.get('vault:openLast')!
  const startup = electron.handlers.get('vault:openLastStartup')
  expect(startup).toBeDefined()
  await expect(startup!({ sender: {}, senderFrame: {} })).resolves.toMatchObject({
    ok: false, error: { code: 'ACCESS_DENIED' }
  })
  const normal = await open(trusted)
  const result = await startup!(trusted)
  expect(normal).toMatchObject({ ok: true, value: { notes: [{ content: body }] } })
  expect(result).toMatchObject({ ok: true, value: { encoding: 'gzip-base64', data: expect.any(String) } })
  const { data } = (result as { value: { data: string } }).value
  expect(JSON.parse(gunzipSync(Buffer.from(data, 'base64')).toString('utf8'))).toEqual(
    (normal as { value: unknown }).value
  )
})

it('returns the ordinary null response when there is no last Vault', async () => {
  const startup = electron.handlers.get('vault:openLastStartup')!
  await expect(startup(trusted)).resolves.toEqual({ ok: true, value: null })
})

it('uses the ordinary snapshot format for a small Vault', async () => {
  await Promise.all([
    writeFile(join(vaultRoot, 'small.md'), '# Small'),
    writeFile(join(electron.appData, 'settings.json'), JSON.stringify({ lastVaultPath: vaultRoot }))
  ])
  const open = electron.handlers.get('vault:openLast')!
  const startup = electron.handlers.get('vault:openLastStartup')!

  const normal = await open(trusted)
  expect(normal).toMatchObject({ ok: true, value: { notes: [{ content: '# Small' }] } })
  await expect(startup(trusted)).resolves.toEqual(normal)
})
