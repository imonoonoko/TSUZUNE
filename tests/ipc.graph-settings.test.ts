import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const electron = vi.hoisted(() => ({
  appData: '',
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  writeText: vi.fn(),
  showItemInFolder: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => electron.appData
  },
  BrowserWindow: class {},
  clipboard: {
    writeText: electron.writeText
  },
  dialog: {
    showOpenDialog: vi.fn()
  },
  ipcMain: {
    handle: (
      channel: string,
      handler: (...args: unknown[]) => Promise<unknown>
    ) => electron.handlers.set(channel, handler),
    on: vi.fn()
  },
  shell: {
    openExternal: vi.fn(),
    showItemInFolder: electron.showItemInFolder
  }
}))

import { registerIpc } from '../src/main/ipc'
import { readSettings } from '../src/main/settings'
import { VaultService } from '../src/main/vault'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'

describe('graph settings IPC', () => {
  beforeEach(async () => {
    electron.appData = await mkdtemp(join(tmpdir(), 'tsuzune-ipc-settings-'))
    electron.handlers.clear()
    electron.writeText.mockClear()
    electron.showItemInFolder.mockClear()
  })

  afterEach(async () => {
    await rm(electron.appData, { recursive: true, force: true })
  })

  it('rejects an untrusted sender and accepts the active renderer', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    registerIpc(
      {} as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('settings:setGraphForces')!
    const graphForces = {
      centerForce: 0.25,
      repelForce: 7,
      linkForce: 0.45,
      linkDistance: 288
    }

    await expect(
      handler(
        { sender: {}, senderFrame: {} },
        graphForces
      )
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'この操作元は信頼できません。'
      }
    })

    await expect(
      handler(
        { sender: webContents, senderFrame: mainFrame },
        graphForces
      )
    ).resolves.toEqual({ ok: true, value: null })
    await expect(readSettings()).resolves.toMatchObject({ graphForces })
  })

  it('copies exact text only for the active renderer', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    registerIpc(
      {} as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('system:copyText')!

    await expect(
      handler(
        { sender: {}, senderFrame: {} },
        'attachments/diagram.svg'
      )
    ).resolves.toMatchObject({ ok: false })
    expect(electron.writeText).not.toHaveBeenCalled()

    await expect(
      handler(
        { sender: webContents, senderFrame: mainFrame },
        'attachments/diagram.svg'
      )
    ).resolves.toEqual({ ok: true, value: null })
    expect(electron.writeText).toHaveBeenCalledWith('attachments/diagram.svg')
  })

  it('reveals a validated Vault file only for the active renderer', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    const resolveFileForOpen = vi.fn(async (path: string) => {
      if (path === 'attachments/missing.svg') {
        throw new Error('見つかりません。')
      }
      return 'C:\\Vault\\attachments\\diagram.svg'
    })
    registerIpc(
      { resolveFileForOpen } as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('system:revealVaultFile')!

    await expect(
      handler({ sender: {}, senderFrame: {} }, 'attachments/diagram.svg')
    ).resolves.toMatchObject({ ok: false })
    expect(electron.showItemInFolder).not.toHaveBeenCalled()

    await expect(
      handler(
        { sender: webContents, senderFrame: mainFrame },
        'attachments/diagram.svg'
      )
    ).resolves.toEqual({ ok: true, value: null })
    expect(electron.showItemInFolder).toHaveBeenCalledOnce()
    expect(electron.showItemInFolder).toHaveBeenCalledWith(
      'C:\\Vault\\attachments\\diagram.svg'
    )

    electron.showItemInFolder.mockClear()
    await expect(
      handler(
        { sender: webContents, senderFrame: mainFrame },
        'attachments/missing.svg'
      )
    ).resolves.toMatchObject({ ok: false })
    expect(electron.showItemInFolder).not.toHaveBeenCalled()
  })

  it('persists Obsidian graph display settings from the active renderer', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    registerIpc(
      {} as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('settings:setGraphDisplay')
    expect(handler).toBeTypeOf('function')
    const graphDisplay = {
      arrows: true,
      textFade: -1.2,
      nodeSize: 2,
      lineSize: 0.5
    }

    await expect(
      handler!({ sender: {}, senderFrame: {} }, graphDisplay)
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'この操作元は信頼できません。'
      }
    })

    await expect(
      handler!(
        { sender: webContents, senderFrame: mainFrame },
        graphDisplay
      )
    ).resolves.toEqual({ ok: true, value: null })
    await expect(readSettings()).resolves.toMatchObject({ graphDisplay })
  })

  it('persists Obsidian graph filter settings from the active renderer', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    registerIpc(
      {} as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('settings:setGraphFilters')
    expect(handler).toBeTypeOf('function')
    const graphFilters = {
      showTags: false,
      showAttachments: false,
      existingFilesOnly: true,
      showOrphans: false,
      outgoingLinks: true,
      incomingLinks: false,
      neighborLinks: true
    }

    await expect(
      handler!({ sender: {}, senderFrame: {} }, graphFilters)
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'この操作元は信頼できません。'
      }
    })

    await expect(
      handler!({ sender: webContents, senderFrame: mainFrame }, graphFilters)
    ).resolves.toEqual({ ok: true, value: null })
    await expect(readSettings()).resolves.toMatchObject({ graphFilters })
  })

  it('persists ordered Obsidian graph groups from the active renderer', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    registerIpc(
      {} as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('settings:setGraphGroups')
    expect(handler).toBeTypeOf('function')
    const graphGroups = [
      { id: 'projects', query: 'path:Projects', color: '#e57373' },
      { id: 'ideas', query: 'tag:#idea', color: '#64b5f6' }
    ]

    await expect(
      handler!({ sender: {}, senderFrame: {} }, graphGroups)
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'この操作元は信頼できません。'
      }
    })

    await expect(
      handler!({ sender: webContents, senderFrame: mainFrame }, graphGroups)
    ).resolves.toEqual({ ok: true, value: null })
    await expect(readSettings()).resolves.toMatchObject({ graphGroups })
  })

  it('persists one graph view scope without replacing the other scope', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    registerIpc(
      {} as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('settings:setGraphViewState')
    expect(handler).toBeTypeOf('function')
    const localState = {
      scale: 99,
      query: 'path:Projects',
      settingsOpen: true,
      settingsSections: {
        filters: true,
        groups: false,
        display: true,
        forces: false
      }
    }

    await expect(
      handler!({ sender: {}, senderFrame: {} }, 'local', localState)
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'この操作元は信頼できません。'
      }
    })
    await expect(
      handler!(
        { sender: webContents, senderFrame: mainFrame },
        'local',
        localState
      )
    ).resolves.toEqual({ ok: true, value: null })
    await expect(readSettings()).resolves.toMatchObject({
      graphViewStates: {
        local: { ...localState, scale: 8 },
        vault: DEFAULT_GRAPH_VIEW_STATES.vault
      }
    })
  })

  it('persists excluded file filters and applies them to the next Vault snapshot', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    const vaultRoot = join(electron.appData, 'Vault')
    await mkdir(join(vaultRoot, '80_excluded'), { recursive: true })
    await writeFile(join(vaultRoot, 'Visible.md'), '# visible', 'utf8')
    await writeFile(
      join(vaultRoot, '80_excluded', 'Hidden.md'),
      '# hidden',
      'utf8'
    )
    const vault = new VaultService()
    await vault.setRootPath(vaultRoot)
    registerIpc(
      vault,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const setFilters = electron.handlers.get('settings:setUserIgnoreFilters')
    const getSnapshot = electron.handlers.get('vault:snapshot')
    expect(setFilters).toBeTypeOf('function')
    expect(getSnapshot).toBeTypeOf('function')

    await expect(
      setFilters!({ sender: {}, senderFrame: {} }, ['80_excluded'])
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'この操作元は信頼できません。'
      }
    })
    await expect(
      setFilters!(
        { sender: webContents, senderFrame: mainFrame },
        [' 80_excluded ', '']
      )
    ).resolves.toEqual({ ok: true, value: null })
    await expect(readSettings()).resolves.toMatchObject({
      userIgnoreFilters: ['80_excluded']
    })

    await expect(
      getSnapshot!({ sender: webContents, senderFrame: mainFrame })
    ).resolves.toMatchObject({
      ok: true,
      value: {
        notes: [{ path: 'Visible.md' }]
      }
    })
  })

  it('guards and persists Vault bookmark writes', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    const vaultRoot = join(electron.appData, 'Vault')
    await mkdir(join(vaultRoot, 'attachments'), { recursive: true })
    await writeFile(join(vaultRoot, 'attachments', 'diagram.svg'), '<svg/>', 'utf8')
    const vault = new VaultService()
    await vault.setRootPath(vaultRoot)
    registerIpc(
      vault,
      {} as never,
      { connection: {} as never, driveSync: {} as never },
      {} as never,
      () => window as never,
      () => undefined
    )
    const save = electron.handlers.get('bookmark:save')!
    const remove = electron.handlers.get('bookmark:remove')!

    await expect(
      save(
        { sender: {}, senderFrame: {} },
        { path: 'attachments/diagram.svg' }
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'ACCESS_DENIED' }
    })
    await expect(
      save(
        { sender: webContents, senderFrame: mainFrame },
        { path: 'attachments/diagram.svg', title: '構成図' }
      )
    ).resolves.toMatchObject({
      ok: true,
      value: { path: 'attachments/diagram.svg', title: '構成図' }
    })
    expect((await vault.scan()).bookmarks).toHaveLength(1)

    await expect(
      remove(
        { sender: webContents, senderFrame: mainFrame },
        'attachments/diagram.svg'
      )
    ).resolves.toEqual({ ok: true, value: null })
    expect((await vault.scan()).bookmarks).toEqual([])
  })

  it('records a successful Markdown move for the next Drive sync', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    const recordLocalMove = vi.fn().mockResolvedValue(undefined)
    const moveNote = vi.fn().mockResolvedValue({
      oldPath: 'Inbox/A.md',
      path: 'Archive/A.md'
    })
    registerIpc(
      { moveNote } as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: { recordLocalMove } as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('entry:moveNote')!

    await expect(
      handler(
        { sender: webContents, senderFrame: mainFrame },
        { path: 'Inbox/A.md', destinationDirectory: 'Archive' }
      )
    ).resolves.toEqual({
      ok: true,
      value: { oldPath: 'Inbox/A.md', path: 'Archive/A.md' }
    })
    expect(recordLocalMove).toHaveBeenCalledWith(
      'Inbox/A.md',
      'Archive/A.md'
    )
  })

  it('rolls a Markdown move back when the Drive ledger cannot be recorded', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    const recordLocalMove = vi.fn().mockRejectedValue(new Error('LEDGER_WRITE_FAILED'))
    const moveNote = vi
      .fn()
      .mockResolvedValueOnce({ oldPath: 'Inbox/A.md', path: 'Archive/A.md' })
      .mockResolvedValueOnce({ oldPath: 'Archive/A.md', path: 'Inbox/A.md' })
    registerIpc(
      { moveNote } as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: { recordLocalMove } as never
      },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('entry:moveNote')!

    await expect(
      handler(
        { sender: webContents, senderFrame: mainFrame },
        { path: 'Inbox/A.md', destinationDirectory: 'Archive' }
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { message: 'LEDGER_WRITE_FAILED' }
    })
    expect(moveNote).toHaveBeenLastCalledWith({
      path: 'Archive/A.md',
      destinationDirectory: 'Inbox',
      destinationPath: 'Inbox/A.md'
    })
  })
})
