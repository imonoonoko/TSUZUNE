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

  it('saves template settings only for an existing Vault folder', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    registerIpc(
      { scan: vi.fn().mockResolvedValue({ directories: ['', '雛形'] }) } as never,
      {} as never,
      { connection: {} as never, driveSync: {} as never },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('settings:setTemplates')!

    await expect(
      handler(
        { sender: webContents, senderFrame: mainFrame },
        { directory: '存在しない', includeBuiltIns: false }
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { message: 'テンプレートフォルダがVault内に見つかりません。' }
    })
    await expect(
      handler(
        { sender: webContents, senderFrame: mainFrame },
        { directory: '雛形', includeBuiltIns: false }
      )
    ).resolves.toEqual({ ok: true, value: null })
    await expect(readSettings()).resolves.toMatchObject({
      templateDirectory: '雛形',
      showBuiltInTemplates: false
    })
  })

  it('reveals a validated Vault entry only for the active renderer', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    const resolveEntryForReveal = vi.fn(async (path: string) => {
      if (path === 'attachments/missing.svg') {
        throw new Error('見つかりません。')
      }
      return `C:\\Vault\\${path.replaceAll('/', '\\')}`
    })
    registerIpc(
      { resolveEntryForReveal } as never,
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

    await handler({ sender: webContents, senderFrame: mainFrame }, 'Inbox')
    expect(electron.showItemInFolder).toHaveBeenLastCalledWith('C:\\Vault\\Inbox')

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

  it('persists excluded file filters without removing files from renderer snapshots', async () => {
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
    await writeFile(
      join(vaultRoot, '80_excluded', 'Hidden.png'),
      'image',
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
        directories: ['', '80_excluded'],
        notes: [
          { path: '80_excluded/Hidden.md' },
          { path: 'Visible.md' }
        ],
        attachments: [{ path: '80_excluded/Hidden.png' }]
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
    const preflight = vi.fn().mockResolvedValue({
      source: 'Inbox/A.md',
      destination: 'Archive/A.md',
      fingerprint: 'sha256:test'
    })
    const apply = vi.fn().mockResolvedValue({
      old_path: 'Inbox/A.md',
      new_path: 'Archive/A.md'
    })
    registerIpc(
      {
        resolveMoveDestination: vi.fn().mockResolvedValue('Archive/A.md')
      } as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined,
      undefined,
      { preflight, apply } as never
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
    expect(preflight).toHaveBeenCalledWith(
      'Inbox/A.md',
      'Archive/A.md',
      'human'
    )
    expect(apply).toHaveBeenCalledWith({
      source: 'Inbox/A.md',
      destination: 'Archive/A.md',
      expected_fingerprint: 'sha256:test',
      actor: 'human'
    })
  })

  it('moves a folder through the renderer-only entry contract', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    const moveEntry = vi.fn().mockResolvedValue({
      oldPath: '資料',
      path: '保管/資料'
    })
    registerIpc(
      { moveEntry } as never,
      {} as never,
      { connection: {} as never, driveSync: { recordLocalMove: vi.fn() } as never },
      {} as never,
      () => window as never,
      () => undefined
    )
    const handler = electron.handlers.get('entry:moveEntry')!

    await expect(
      handler(
        { sender: webContents, senderFrame: mainFrame },
        { path: '資料', destinationDirectory: '保管' }
      )
    ).resolves.toEqual({
      ok: true,
      value: { oldPath: '資料', path: '保管/資料' }
    })
    expect(moveEntry).toHaveBeenCalledWith({
      path: '資料',
      destinationDirectory: '保管'
    })
  })

  it('returns the shared move coordinator failure to the renderer', async () => {
    const mainFrame = {}
    const webContents = { mainFrame }
    const window = { webContents }
    const preflight = vi.fn().mockResolvedValue({
      source: 'Inbox/A.md',
      destination: 'Archive/A.md',
      fingerprint: 'sha256:test'
    })
    const apply = vi.fn().mockRejectedValue(new Error('LEDGER_WRITE_FAILED'))
    registerIpc(
      {
        resolveMoveDestination: vi.fn().mockResolvedValue('Archive/A.md')
      } as never,
      {} as never,
      {
        connection: {} as never,
        driveSync: {} as never
      },
      {} as never,
      () => window as never,
      () => undefined,
      undefined,
      { preflight, apply } as never
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
    expect(apply).toHaveBeenCalledOnce()
  })
})
