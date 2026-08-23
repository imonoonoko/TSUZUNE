// @vitest-environment jsdom

import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AppUpdateStatus,
  NoteDocument,
  Result,
  TsuzuneApi,
  VaultChangeEvent,
  VaultSnapshot
} from '../src/shared/types'

vi.mock('../src/renderer/components/MarkdownEditor', async () => {
  const React = await import('react')
  return {
    default: ({
      value,
      onChange,
      readOnly
    }: {
      value: string
      onChange: (value: string) => void
      readOnly?: boolean
    }) =>
      React.createElement('textarea', {
        'aria-label': 'Markdown編集欄',
        value,
        readOnly,
        onChange: readOnly
          ? undefined
          : (event: React.ChangeEvent<HTMLTextAreaElement>) =>
              onChange(event.target.value)
      })
  }
})

import App from '../src/renderer/App'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'

const noteA: NoteDocument = {
  path: 'A.md',
  name: 'A',
  content: 'Aの本文',
  modifiedAt: 100,
  size: 10
}
const noteB: NoteDocument = {
  path: 'B.md',
  name: 'B',
  content: 'Bの本文',
  modifiedAt: 200,
  size: 10
}
const noteC: NoteDocument = {
  path: 'C.md',
  name: 'C',
  content: 'Cの本文',
  modifiedAt: 300,
  size: 10
}
const snapshot: VaultSnapshot = {
  rootPath: 'C:\\Vault',
  rootName: 'Vault',
  directories: [''],
  notes: [noteA, noteB, noteC]
}

let vaultChanged: ((event: VaultChangeEvent) => void) | null
let updateStatusChanged: ((status: AppUpdateStatus) => void) | null
let requestClose: (() => void) | null
let api: TsuzuneApi

function ok<T>(value: T): Promise<Result<T>> {
  return Promise.resolve({ ok: true, value })
}

beforeEach(() => {
  vaultChanged = null
  updateStatusChanged = null
  requestClose = null
  api = {
    chooseVault: vi.fn(() => ok(null)),
    openLastVault: vi.fn(() => ok(snapshot)),
    getSettings: vi.fn(() =>
      ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: noteA.path,
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 50,
          repelForce: 50,
          linkForce: 50,
          linkDistance: 50
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    ),
    getSnapshot: vi.fn(() => ok(snapshot)),
    readNote: vi.fn((path) => {
      const note = snapshot.notes.find((candidate) => candidate.path === path)
      return note
        ? ok(note)
        : Promise.resolve({
            ok: false,
            error: { code: 'NOT_FOUND', message: '見つかりません。' }
          })
    }),
    readVaultImage: vi.fn(() =>
      ok('data:image/png;base64,iVBORw0KGgo=')
    ),
    openVaultFile: vi.fn(() => ok(null)),
    revealVaultFile: vi.fn(() => ok(null)),
    openVaultFileWindow: vi.fn(() => ok(null)),
    copyText: vi.fn(() => ok(null)),
    saveNote: vi.fn((input) =>
      ok({
        path: input.path,
        modifiedAt: input.expectedModifiedAt + 1,
        size: new TextEncoder().encode(input.content).byteLength
      })
    ),
    createNote: vi.fn(),
    createDirectory: vi.fn(),
    renameEntry: vi.fn(),
    moveNote: vi.fn(),
    moveEntry: vi.fn(),
    getMoveRecovery: vi.fn(() => ok({ status: 'clean' as const })),
    trashEntry: vi.fn(),
    saveBookmark: vi.fn((input) =>
      ok({ type: 'file', ...input, ctime: 1 })
    ),
    removeBookmark: vi.fn(() => ok(null)),
    setLastNote: vi.fn(() => ok(null)),
    setUserIgnoreFilters: vi.fn(() => ok(null)),
    setAiReviewPaths: vi.fn(() => ok(null)),
    setTemplateSettings: vi.fn(() => ok(null)),
    listAiReviewProposals: vi.fn(() => ok([])),
    approveAiReviewProposal: vi.fn((id: string) => ok({ path: id })),
    cancelAiReviewProposal: vi.fn(() => ok(null)),
    setGraphForces: vi.fn(() => ok(null)),
    setGraphDisplay: vi.fn(() => ok(null)),
    setGraphFilters: vi.fn(() => ok(null)),
    setGraphGroups: vi.fn(() => ok(null)),
    setGraphViewState: vi.fn(() => ok(null)),
    chooseGoogleOAuthConfig: vi.fn(() => ok(null)),
    getGoogleDriveStatus: vi.fn(() =>
      ok({
        configured: true,
        connected: true,
        account: {
          sub: 'google-user',
          name: 'TSUZUNE User',
          email: 'user@example.com',
          picture: null
        },
        authorizedFeatures: ['drive_sync'],
        lastSyncAt: null,
        vaultFolderUrl: null
      })
    ),
    connectGoogle: vi.fn(),
    authorizeGoogleCalendar: vi.fn(),
    disconnectGoogle: vi.fn(),
    listDriveVaults: vi.fn(() =>
      ok([
        {
          rootFolderId: 'remote-root',
          vaultId: 'remote-vault',
          name: 'TSUZUNE - Main Vault'
        }
      ])
    ),
    pairDriveVault: vi.fn(() =>
      ok({
        configured: true,
        connected: true,
        account: {
          sub: 'google-user',
          name: 'TSUZUNE User',
          email: 'user@example.com',
          picture: null
        },
        authorizedFeatures: ['drive_sync'],
        lastSyncAt: null,
        vaultFolderUrl: 'https://drive.google.com/drive/folders/remote-root'
      })
    ),
    previewDriveSync: vi.fn(() =>
      ok({
        planId: 'plan-1',
        createdAt: '2026-07-31T00:00:00.000Z',
        items: [
          {
            path: 'A.md',
            action: 'upload',
            reason: 'local_changed'
          }
        ],
        counts: {
          upload: 1,
          download: 0,
          move: 0,
          conflict: 0,
          preserve: 0
        }
      })
    ),
    applyDriveSync: vi.fn(),
    getUpdateStatus: vi.fn(() =>
      ok({
        phase: 'idle',
        currentVersion: '0.4.0',
        availableVersion: null,
        downloadPercent: null,
        message: null
      })
    ),
    checkForUpdates: vi.fn(() =>
      ok({
        phase: 'up-to-date',
        currentVersion: '0.4.0',
        availableVersion: null,
        downloadPercent: null,
        message: 'TSUZUNEは最新です。'
      })
    ),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(() => ok(null)),
    openExternal: vi.fn(() => ok(null)),
    confirmClose: vi.fn(),
    onVaultChanged: vi.fn((callback) => {
      vaultChanged = callback
      return () => undefined
    }),
    onRequestClose: vi.fn((callback) => {
      requestClose = callback
      return () => {
        requestClose = null
      }
    }),
    onUpdateStatus: vi.fn((callback) => {
      updateStatusChanged = callback
      return () => {
        updateStatusChanged = null
      }
    })
  } as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', {
    configurable: true,
    value: api
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        beginPath: vi.fn(),
        clearRect: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        lineTo: vi.fn(),
        moveTo: vi.fn(),
        setTransform: vi.fn(),
        stroke: vi.fn()
      }) as unknown as CanvasRenderingContext2D
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App data-loss guards', () => {
  it('creates a folder from the tree inline without opening a prompt', async () => {
    const prompt = vi.spyOn(window, 'prompt')
    vi.mocked(api.createDirectory).mockResolvedValue(await ok({ path: '資料' }))
    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({ ...snapshot, directories: ['', '資料'] })
    )
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'フォルダ' }))
    const input = screen.getByRole('textbox', {
      name: 'Vaultに作るフォルダー名'
    })
    fireEvent.change(input, { target: { value: '資料' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(api.createDirectory).toHaveBeenCalledWith({ parent: '', name: '資料' })
    )
    expect(prompt).not.toHaveBeenCalled()
  })

  it('shows a fixed recovery warning with both paths', async () => {
    vi.mocked(api.getMoveRecovery).mockResolvedValue(
      await ok({
        status: 'recovery-required',
        source: 'Inbox/A.md',
        destination: 'Archive/A.md'
      })
    )
    render(<App />)

    expect(
      await screen.findByText(
        '未完了の移動を安全に判定できません。新しい移動を停止しています。'
      )
    ).toBeTruthy()
    expect(screen.getByText('Inbox/A.md → Archive/A.md')).toBeTruthy()
  })

  it('restores an aliased last note without rewriting the saved setting', async () => {
    const canonical: NoteDocument = {
      ...noteB,
      path: '30_知識/現在名.md',
      name: '現在名',
      content: 'aliasから復元した本文'
    }
    vi.mocked(api.openLastVault).mockResolvedValue(
      await ok({
        ...snapshot,
        directories: ['', '30_知識'],
        notes: [canonical],
        pathAliases: { '旧分類/旧名.md': canonical.path }
      })
    )
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: '旧分類/旧名.md',
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 50,
          repelForce: 50,
          linkForce: 50,
          linkDistance: 50
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))

    expect(await screen.findByDisplayValue('aliasから復元した本文')).toBeTruthy()
    expect(api.setLastNote).not.toHaveBeenCalled()
  })

  it('prefers a live note at the old path over its stale alias', async () => {
    const liveOld: NoteDocument = {
      ...noteA,
      path: '旧分類/旧名.md',
      name: '旧名',
      content: '現在も存在する旧パスの本文'
    }
    const canonical: NoteDocument = {
      ...noteB,
      path: '30_知識/現在名.md',
      name: '現在名',
      content: 'alias終端の本文'
    }
    vi.mocked(api.openLastVault).mockResolvedValue(
      await ok({
        ...snapshot,
        directories: ['', '旧分類', '30_知識'],
        notes: [liveOld, canonical],
        pathAliases: { [liveOld.path]: canonical.path }
      })
    )
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: liveOld.path,
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 50,
          repelForce: 50,
          linkForce: 50,
          linkDistance: 50
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))

    expect(
      await screen.findByDisplayValue('現在も存在する旧パスの本文')
    ).toBeTruthy()
    expect(screen.queryByDisplayValue('alias終端の本文')).toBeNull()
    expect(api.setLastNote).not.toHaveBeenCalled()
  })

  it('does not restore an aliased last note when its terminal note is missing', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue(
      await ok({
        ...snapshot,
        notes: [noteA],
        pathAliases: { '旧分類/旧名.md': '30_知識/削除済み.md' }
      })
    )
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: '旧分類/旧名.md',
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 50,
          repelForce: 50,
          linkForce: 50,
          linkDistance: 50
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )

    render(<App />)

    expect(
      await screen.findByText(
        '左の一覧からノートを選ぶか、新しいノートを作成してください。'
      )
    ).toBeTruthy()
    expect(screen.queryByLabelText('Markdown編集欄')).toBeNull()
    expect(api.setLastNote).not.toHaveBeenCalled()
  })

  it('uses path aliases for related notes, Wiki navigation, backlinks, and graph nodes', async () => {
    const source: NoteDocument = {
      ...noteA,
      content: '[[旧分類/旧名]]'
    }
    const canonical: NoteDocument = {
      ...noteB,
      path: '30_知識/現在名.md',
      name: '現在名',
      content: 'canonical本文'
    }
    const aliasSnapshot: VaultSnapshot = {
      ...snapshot,
      directories: ['', '30_知識'],
      notes: [source, canonical],
      pathAliases: { '旧分類/旧名.md': canonical.path }
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(aliasSnapshot))
    vi.mocked(api.readNote).mockImplementation((path) => {
      const note = aliasSnapshot.notes.find((candidate) => candidate.path === path)
      return note
        ? ok(note)
        : Promise.resolve({
            ok: false,
            error: { code: 'NOT_FOUND', message: '見つかりません。' }
          })
    })
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: source.path,
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 50,
          repelForce: 50,
          linkForce: 50,
          linkDistance: 50
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )

    render(<App />)

    expect(
      await screen.findByRole('button', { name: '旧分類/旧名' })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ローカルグラフ' }))
    expect(
      await screen.findByRole('button', { name: '現在名（リンク先）を開く' })
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'プレビュー' }))
    fireEvent.click(await screen.findByRole('link', { name: '旧分類/旧名' }))

    await waitFor(() => {
      expect(api.setLastNote).toHaveBeenCalledWith(canonical.path)
    })
    expect(await screen.findByText('canonical本文')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /バックリンク/ }))
    expect(
      screen.getByRole('button', { name: /A\s*A\.md/ })
    ).toBeTruthy()
  })

  it('warns before moving a canonical note that is reached through an old path alias', async () => {
    const source: NoteDocument = {
      ...noteA,
      content: '[[旧分類/旧名]]'
    }
    const canonical: NoteDocument = {
      ...noteB,
      path: '30_知識/現在名.md',
      name: '現在名'
    }
    const aliasSnapshot: VaultSnapshot = {
      ...snapshot,
      directories: ['', '30_知識', '40_情報源'],
      notes: [source, canonical],
      pathAliases: { '旧分類/旧名.md': canonical.path }
    }
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(aliasSnapshot))
    vi.mocked(api.moveNote).mockResolvedValue(
      await ok({ oldPath: canonical.path, path: '40_情報源/現在名.md' })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'ローカルグラフ' }))
    fireEvent.contextMenu(
      await screen.findByRole('button', { name: '現在名（リンク先）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'ファイルを移動…' }))
    fireEvent.change(screen.getByRole('combobox', { name: '移動先' }), {
      target: { value: '40_情報源' }
    })
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'ファイルを移動' })).getByRole(
        'button',
        { name: '移動' }
      )
    )

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('1件の参照元')
      )
    })
    expect(api.moveNote).not.toHaveBeenCalled()
  })

  it('moves a folder from its context menu with its nested note', async () => {
    const nestedNote: NoteDocument = {
      ...noteA,
      path: '資料/子/記録.md',
      name: '記録',
      content: '# 記録'
    }
    const initialSnapshot: VaultSnapshot = {
      ...snapshot,
      directories: ['', '資料', '資料/子', '保管'],
      notes: [nestedNote]
    }
    const movedSnapshot: VaultSnapshot = {
      ...initialSnapshot,
      directories: ['', '保管', '保管/資料', '保管/資料/子'],
      notes: [{ ...nestedNote, path: '保管/資料/子/記録.md' }]
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(initialSnapshot))
    vi.mocked(api.getSnapshot).mockResolvedValue(await ok(movedSnapshot))
    vi.mocked(api.moveEntry).mockResolvedValue(
      await ok({ oldPath: '資料', path: '保管/資料' })
    )

    render(<App />)
    fireEvent.contextMenu(await screen.findByRole('treeitem', { name: '資料' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '移動' }))
    fireEvent.change(screen.getByRole('combobox', { name: '移動先' }), {
      target: { value: '保管' }
    })
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'フォルダーを移動' })).getByRole(
        'button',
        { name: '移動' }
      )
    )

    await waitFor(() => {
      expect(api.moveEntry).toHaveBeenCalledWith({
        path: '資料',
        destinationDirectory: '保管'
      })
    })
    expect(await screen.findByText('記録')).toBeTruthy()
  })

  it('shows each note modification time and the selected note freshness', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByLabelText('Markdown編集欄')

    expect(screen.getByLabelText(/Aの最終更新:/).textContent).toBeTruthy()
    expect(screen.getByText(/更新:.*古い可能性/)).toBeTruthy()
  })

  it('creates a collision-free blank note and opens the ordinary editor without a form', async () => {
    const existingBlank: NoteDocument = {
      path: '無題のノート.md',
      name: '無題のノート',
      content: '# 既存の無題ノート\n',
      modifiedAt: 350,
      size: 12
    }
    const createdNote: NoteDocument = {
      path: '無題のノート 1.md',
      name: '無題のノート 1',
      content: '',
      modifiedAt: 400,
      size: 0
    }
    vi.mocked(api.openLastVault).mockResolvedValue(
      await ok({ ...snapshot, notes: [...snapshot.notes, existingBlank] })
    )
    vi.mocked(api.createNote).mockResolvedValue(await ok({ path: createdNote.path }))
    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({ ...snapshot, notes: [...snapshot.notes, existingBlank, createdNote] })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'ノート' }))

    await waitFor(() => expect(api.createNote).toHaveBeenCalledTimes(1))
    expect(api.createNote).toHaveBeenCalledWith({
      directory: '',
      name: '無題のノート 1',
      content: undefined
    })
    expect(screen.queryByRole('dialog', { name: '新しいノート' })).toBeNull()
    expect((screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).value).toBe('')
  })

  it('removes the template create and add buttons in favour of note creation and template insertion', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByLabelText('Markdown編集欄')
    expect(screen.queryByRole('button', { name: 'テンプレートから作成' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'テンプレートを追加' })).toBeNull()
    expect(screen.queryByLabelText('テンプレート')).toBeNull()
    expect(screen.getByRole('button', { name: '今日のノート' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'アイデアを追加' })).toBeTruthy()
  })

  it('creates an idea note through the idea capture form', async () => {
    const ideaNote: NoteDocument = {
      path: '01_受信箱/アイデア/新しいアイデア.md',
      name: '新しいアイデア',
      content: '# 新しいアイデア\n\n## アイデア\n\nいい感じの案\n',
      modifiedAt: 400,
      size: 40
    }
    vi.mocked(api.createDirectory).mockResolvedValue(
      await ok({ path: '01_受信箱/アイデア' })
    )
    vi.mocked(api.createNote).mockResolvedValue(await ok({ path: ideaNote.path }))
    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({
        ...snapshot,
        directories: ['', '01_受信箱', '01_受信箱/アイデア'],
        notes: [...snapshot.notes, ideaNote]
      })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByLabelText('Markdown編集欄')
    fireEvent.click(screen.getByRole('button', { name: 'アイデアを追加' }))

    const dialog = await screen.findByRole('dialog', { name: 'アイデアを追加' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'タイトル' }), {
      target: { value: '新しいアイデア' }
    })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '内容' }), {
      target: { value: 'いい感じの案' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存して開く' }))

    await waitFor(() => expect(api.createNote).toHaveBeenCalledTimes(1))
    expect(api.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: '01_受信箱/アイデア',
        name: '新しいアイデア'
      })
    )
  })

  it('renames the selected note through an in-app dialog', async () => {
    const renamedNote: NoteDocument = {
      ...noteA,
      path: 'Renamed.md',
      name: 'Renamed'
    }
    vi.mocked(api.renameEntry).mockResolvedValue(await ok({ path: renamedNote.path }))
    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({ ...snapshot, notes: [renamedNote, noteB, noteC] })
    )
    const promptSpy = vi.spyOn(window, 'prompt')

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByDisplayValue('Aの本文')
    fireEvent.click(screen.getByRole('button', { name: '名前変更', exact: true }))

    const dialog = await screen.findByRole('dialog', { name: 'ノートの名前を変更' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '新しい名前' }), {
      target: { value: 'Renamed' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '名前変更', exact: true }))

    await waitFor(() => {
      expect(api.renameEntry).toHaveBeenCalledWith({
        path: 'A.md',
        newName: 'Renamed'
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'ノートの名前を変更' })).toBeNull()
    })
    expect(promptSpy).not.toHaveBeenCalled()
  })

  it('moves a note by dropping it on a folder through the existing move contract', async () => {
    const nestedSnapshot = {
      ...snapshot,
      directories: ['', 'Archive']
    }
    const movedNote = { ...noteA, path: 'Archive/A.md' }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(nestedSnapshot))
    vi.mocked(api.getSnapshot)
      .mockResolvedValueOnce(await ok(nestedSnapshot))
      .mockResolvedValue(await ok({
        ...nestedSnapshot,
        notes: [movedNote, noteB, noteC]
      }))
    vi.mocked(api.moveNote).mockResolvedValue(await ok({ path: movedNote.path }))

    const { container } = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByDisplayValue('Aの本文')
    const note = container.querySelector<HTMLButtonElement>('button.tree-note')!
    const archive = screen.getByRole('treeitem', { name: 'Archive' })
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn()
    }

    fireEvent.dragStart(note, { dataTransfer })
    fireEvent.dragOver(archive, { dataTransfer })
    fireEvent.drop(archive, { dataTransfer })

    await waitFor(() => {
      expect(api.moveNote).toHaveBeenCalledWith({
        path: 'A.md',
        destinationDirectory: 'Archive'
      })
    })
    expect(screen.queryByRole('dialog', { name: 'ファイルを移動' })).toBeNull()
  })

  it('renames a note inline through the existing rename contract', async () => {
    const renamedNote = { ...noteA, path: 'Renamed.md', name: 'Renamed' }
    vi.mocked(api.renameEntry).mockResolvedValue(await ok({ path: renamedNote.path }))
    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({ ...snapshot, notes: [renamedNote, noteB, noteC] })
    )

    const { container } = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByDisplayValue('Aの本文')
    fireEvent.doubleClick(container.querySelector<HTMLButtonElement>('button.tree-note')!)
    const input = screen.getByRole('textbox', { name: 'Aの名前' })
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(api.renameEntry).toHaveBeenCalledWith({
        path: 'A.md',
        newName: 'Renamed'
      })
    })
    expect(api.renameEntry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'ノートの名前を変更' })).toBeNull()
  })

  it('keeps the rename dialog open for blank or unchanged names', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByDisplayValue('Aの本文')
    fireEvent.click(screen.getByRole('button', { name: '名前変更', exact: true }))

    const dialog = await screen.findByRole('dialog', { name: 'ノートの名前を変更' })
    const input = within(dialog).getByRole('textbox', { name: '新しい名前' })
    const submit = within(dialog).getByRole('button', { name: '名前変更', exact: true })

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(submit)
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      '新しい名前を入力してください。'
    )
    expect(api.renameEntry).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'A' } })
    fireEvent.click(submit)
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      '現在と異なる名前を入力してください。'
    )
    expect(api.renameEntry).not.toHaveBeenCalled()
  })

  it('creates todays note from the daily button and opens the ordinary editor', async () => {
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const content = `# ${date}\n\n## 今日やったこと\n\n## 気づき\n\n## メモ\n\n## 次にすること\n\n`
    const createdNote: NoteDocument = {
      path: `02_デイリー/${date}.md`,
      name: date,
      content,
      modifiedAt: Date.now(),
      size: content.length
    }
    vi.mocked(api.createDirectory).mockResolvedValue(
      await ok({ path: '02_デイリー' })
    )
    vi.mocked(api.createNote).mockResolvedValue(await ok({ path: createdNote.path }))
    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({
        ...snapshot,
        directories: ['', '02_デイリー'],
        notes: [...snapshot.notes, createdNote]
      })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '今日のノート' }))

    await waitFor(() => expect(api.createNote).toHaveBeenCalledTimes(1))
    const input = vi.mocked(api.createNote).mock.calls[0][0]
    expect(input.directory).toBe('02_デイリー')
    expect(input.name).toBe(date)
    expect(input.content).toBe(content)
    expect(screen.queryByRole('dialog', { name: '今日のノート' })).toBeNull()
    expect((screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).value).toBe(content)
  })

  it('opens an existing daily note from the daily button instead of creating a duplicate', async () => {
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const dailyNote: NoteDocument = {
      path: `02_デイリー/${date}.md`,
      name: date,
      content: '# 今日のノート',
      modifiedAt: Date.now(),
      size: 12
    }
    vi.mocked(api.openLastVault).mockResolvedValue(
      await ok({
        ...snapshot,
        directories: ['', '02_デイリー'],
        notes: [...snapshot.notes, dailyNote]
      })
    )
    vi.mocked(api.readNote).mockImplementation((path) =>
      path === dailyNote.path ? ok(dailyNote) : ok(noteA)
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '今日のノート' }))

    await waitFor(() => expect(api.setLastNote).toHaveBeenCalledWith(dailyNote.path))
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    expect(api.createNote).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '今日のノート' })).toBeNull()
    expect((screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).value).toBe(
      dailyNote.content
    )
  })

  it('round-trips a generated daily note through the plain form', async () => {
    const dailyNote: NoteDocument = {
      path: '02_デイリー/2026-08-08.md',
      name: '2026-08-08',
      content:
        '# 2026-08-08\n\n## 今日やったこと\n\n入力画面を作った\n\n## 気づき\n\n最初の気づき\n\n## 次にすること\n\n- [ ] 本番で試す\n',
      modifiedAt: 800,
      size: 120
    }
    const dailySnapshot = {
      ...snapshot,
      directories: ['', '02_デイリー'],
      notes: [dailyNote]
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(dailySnapshot))
    vi.mocked(api.getSnapshot).mockResolvedValue(await ok(dailySnapshot))
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: dailyNote.path,
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 50,
          repelForce: 50,
          linkForce: 50,
          linkDistance: 50
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )
    vi.mocked(api.readNote).mockResolvedValue(await ok(dailyNote))

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '内容を編集' }))
    expect((screen.getByLabelText('今日やったこと') as HTMLTextAreaElement).value).toBe(
      '入力画面を作った'
    )
    expect((screen.getByLabelText('気づき') as HTMLTextAreaElement).value).toBe(
      '最初の気づき'
    )
    expect(screen.getByRole('button', { name: 'Markdownソース' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('気づき'), {
      target: { value: 'フォームで安全に再編集できた' }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存して開く' }))

    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(1))
    expect(vi.mocked(api.saveNote).mock.calls[0][0]).toMatchObject({
      path: dailyNote.path,
      expectedModifiedAt: dailyNote.modifiedAt
    })
    expect(vi.mocked(api.saveNote).mock.calls[0][0].content).toContain(
      'フォームで安全に再編集できた'
    )
    expect(vi.mocked(api.saveNote).mock.calls[0][0].content).toContain('# 2026-08-08')
  })

  it('keeps a manually extended daily note in Markdown source mode', async () => {
    const dailyNote: NoteDocument = {
      path: '02_デイリー/2026-08-08.md',
      name: '2026-08-08',
      content:
        '# 2026-08-08\n\n## 気づき\n\n定型部分\n\n## 自由形式\n\n自由形式の追記\n',
      modifiedAt: 800,
      size: 70
    }
    const dailySnapshot = {
      ...snapshot,
      directories: ['', '02_デイリー'],
      notes: [dailyNote]
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(dailySnapshot))
    vi.mocked(api.getSnapshot).mockResolvedValue(await ok(dailySnapshot))
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: dailyNote.path,
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 50,
          repelForce: 50,
          linkForce: 50,
          linkDistance: 50
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )
    vi.mocked(api.readNote).mockResolvedValue(await ok(dailyNote))

    render(<App />)

    expect(await screen.findByRole('button', { name: '編集' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '内容を編集' })).toBeNull()
  })

  it('creates an idea note through the idea button and opens the ordinary editor', async () => {
    const content = '# アイデアメモ\n\n## アイデア\n\nいい感じの案\n'
    const idea: NoteDocument = {
      path: '01_受信箱/アイデア/アイデアメモ.md',
      name: 'アイデアメモ',
      content,
      modifiedAt: Date.now(),
      size: content.length
    }
    const ideaSnapshot: VaultSnapshot = {
      ...snapshot,
      directories: ['', '01_受信箱', '01_受信箱/アイデア']
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(ideaSnapshot))
    vi.mocked(api.createNote).mockResolvedValue(await ok({ path: idea.path }))
    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({ ...ideaSnapshot, notes: [...ideaSnapshot.notes, idea] })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByLabelText('Markdown編集欄')
    fireEvent.click(screen.getByRole('button', { name: 'アイデアを追加' }))

    const dialog = await screen.findByRole('dialog', { name: 'アイデアを追加' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'タイトル' }), {
      target: { value: 'アイデアメモ' }
    })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '内容' }), {
      target: { value: 'いい感じの案' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存して開く' }))

    await waitFor(() => expect(api.createNote).toHaveBeenCalledTimes(1))
    const input = vi.mocked(api.createNote).mock.calls[0][0]
    expect(input.directory).toBe('01_受信箱/アイデア')
    expect(input.name).toBe('アイデアメモ')
    expect(input.content).toBe(content)
    expect(screen.queryByRole('dialog', { name: 'アイデアを追加' })).toBeNull()
    expect(await screen.findByRole('heading', { name: 'アイデアメモ', level: 1 })).toBeTruthy()
    expect(screen.getByText('いい感じの案')).toBeTruthy()
  })

  it('keeps the selected note visible when direct note creation fails', async () => {
    vi.mocked(api.createNote).mockResolvedValue({
      ok: false,
      error: { code: 'SAVE_FAILED', message: 'ノートを作成できませんでした。' }
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    fireEvent.click(await screen.findByRole('button', { name: 'ノート' }))
    expect(await screen.findByText('ノートを作成できませんでした。')).toBeTruthy()
    expect((screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).value).toBe(
      noteA.content
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('batches a burst of external file events into one Vault refresh', async () => {
    vi.mocked(api.readNote).mockResolvedValue(
      await ok({ ...noteA, content: '外部で更新された本文', modifiedAt: 400 })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByLabelText('Markdown編集欄')
    vi.mocked(api.getSnapshot).mockClear()

    act(() => {
      for (let index = 0; index < 20; index += 1) {
        vaultChanged?.({
          type: 'change',
          path: index === 0 ? noteA.path : `Imported/${index}.md`
        })
      }
    })

    await waitFor(() => {
      expect(api.getSnapshot).toHaveBeenCalledTimes(1)
      expect(api.readNote).toHaveBeenCalledTimes(1)
      expect(
        (screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).value
      ).toBe('外部で更新された本文')
    })
  })

  it('reloads a selected note when an external editor replaces it with unlink and add', async () => {
    vi.mocked(api.readNote).mockResolvedValue(
      await ok({ ...noteA, content: '置換後の本文', modifiedAt: 450 })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByLabelText('Markdown編集欄')
    vi.mocked(api.getSnapshot).mockClear()
    vi.mocked(api.readNote).mockClear()

    act(() => {
      vaultChanged?.({ type: 'unlink', path: noteA.path })
      vaultChanged?.({ type: 'add', path: noteA.path })
    })

    await waitFor(() => {
      expect(api.getSnapshot).toHaveBeenCalledTimes(1)
      expect(api.readNote).toHaveBeenCalledWith(noteA.path)
      expect(
        (screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).value
      ).toBe('置換後の本文')
    })
  })

  it('keeps local text until an external change is explicitly overwritten', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.readNote).mockResolvedValue(
      await ok({ ...noteA, content: '外部版の本文', modifiedAt: 450, size: 18 })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const editor = await screen.findByLabelText('Markdown編集欄')
    fireEvent.change(editor, { target: { value: '保持する編集中の本文' } })

    act(() => {
      vaultChanged?.({ type: 'change', path: noteA.path })
    })

    expect(
      await screen.findByRole('button', { name: '外部版を読み込む' })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '編集中の内容を保持' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'こちらの内容で上書き保存' })
    )

    await waitFor(() => {
      expect(api.saveNote).toHaveBeenCalledWith(
        expect.objectContaining({
          path: noteA.path,
          content: '保持する編集中の本文',
          force: true
        })
      )
    })
  })

  it('focuses Vault search with Ctrl+K', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const editor = await screen.findByLabelText('Markdown編集欄')
    editor.focus()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(document.activeElement).toBe(
      screen.getByPlaceholderText('内容を検索')
    )
  })

  it('reveals and focuses Vault search with Ctrl+Shift+F', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const editor = await screen.findByLabelText('Markdown編集欄')
    fireEvent.click(screen.getByRole('button', { name: '左サイドバーを閉じる' }))
    editor.focus()

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '左サイドバーを閉じる' })).toBeTruthy()
    })
    expect(document.activeElement).toBe(screen.getByPlaceholderText('内容を検索'))
  })

  it('labels content search distinctly and explains its operators', async () => {
    render(<App />)
    await screen.findByText('Aの本文')

    const search = screen.getByRole('textbox', { name: '内容を検索' })
    expect(search.getAttribute('aria-keyshortcuts')).toBe(
      'Control+Shift+F Meta+Shift+F Control+K Meta+K'
    )
    expect(screen.getByText(/条件: tag:/).textContent?.replace(/\s+/gu, ' ')).toBe(
      '条件: tag: / path: / file: 除外: -語 語句: "複数語"'
    )
  })

  it('opens the Quick Switcher with Ctrl+O and restores focus after Escape', async () => {
    const { container } = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    expect(screen.getByRole('button', { name: '開く' }).getAttribute('aria-keyshortcuts')).toBe(
      'Control+O Meta+O'
    )
    const editor = await screen.findByLabelText('Markdown編集欄')
    editor.focus()

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true })

    const dialog = await screen.findByRole('dialog', { name: 'ノートを開く' })
    const input = screen.getByRole('combobox', { name: 'ノートを検索' })
    expect(document.activeElement).toBe(input)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(container.querySelector('.workspace')?.hasAttribute('inert')).toBe(true)

    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'ノートを開く' })).toBeNull()
    })
    expect(document.activeElement).toBe(editor)
    expect(container.querySelector('.workspace')?.hasAttribute('inert')).toBe(false)
  })

  it('opens the Command Palette with Ctrl+P and restores focus after Escape', async () => {
    const { container } = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    expect(
      screen.getByRole('button', { name: '操作' }).getAttribute('aria-keyshortcuts')
    ).toBe('Control+P Meta+P')
    const editor = await screen.findByLabelText('Markdown編集欄')
    editor.focus()

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })

    const dialog = await screen.findByRole('dialog', { name: '操作を実行' })
    const input = screen.getByRole('combobox', { name: 'コマンドを検索' })
    expect(document.activeElement).toBe(input)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(container.querySelector('.workspace')?.hasAttribute('inert')).toBe(true)

    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '操作を実行' })).toBeNull()
    })
    expect(document.activeElement).toBe(editor)
    expect(container.querySelector('.workspace')?.hasAttribute('inert')).toBe(false)
  })

  it('exposes the stable R2 command set and filters by English keywords', async () => {
    render(<App />)
    await screen.findByText('Aの本文')

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    const dialog = await screen.findByRole('dialog', { name: '操作を実行' })
    const input = within(dialog).getByRole('combobox', { name: 'コマンドを検索' })
    const labels = [
      '新規ノートを作成',
      '今日のノート',
      'ノートを開く',
      '内容を検索',
      '左サイドバー',
      '右サイドバー',
      '編集',
      'プレビュー',
      'ローカルグラフ',
      'Vaultグラフ',
      'ブックマーク',
      '設定'
    ]
    for (const label of labels) {
      expect(within(dialog).getByRole('option', { name: new RegExp(`^${label}`) })).toBeTruthy()
    }
    expect(within(dialog).getByText(/Ctrl\+O|Meta\+O/)).toBeTruthy()
    fireEvent.change(input, { target: { value: 'sidebar' } })
    expect(within(dialog).getByRole('option', { name: /左サイドバー/ })).toBeTruthy()
    expect(within(dialog).queryByRole('option', { name: /今日のノート/ })).toBeNull()
  })

  it('keeps note-view commands disabled with a reason when no note is selected', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue(
      await ok({ ...snapshot, notes: snapshot.notes, directories: [''] })
    )
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: null,
        userIgnoreFilters: [],
        graphForces: DEFAULT_GRAPH_FORCE_SETTINGS,
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )
    render(<App />)
    await screen.findByText('左の一覧からノートを選ぶか、新しいノートを作成してください。')
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    const dialog = await screen.findByRole('dialog', { name: '操作を実行' })
    for (const label of ['編集', 'プレビュー', 'ローカルグラフ']) {
      const option = within(dialog).getByRole('option', { name: new RegExp(label) })
      expect(option.getAttribute('aria-disabled')).toBe('true')
      expect(option.getAttribute('title')).toMatch(/ノート|選択/)
    }
    const disabled = within(dialog).getByRole('option', { name: /編集/ })
    fireEvent.keyDown(disabled, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: '操作を実行' })).toBeTruthy()
  })

  it('toggles the left sidebar and focuses Vault search from the palette', async () => {
    render(<App />)
    await screen.findByText('Aの本文')
    fireEvent.click(screen.getByRole('button', { name: '左サイドバーを閉じる' }))
    expect(screen.getByRole('button', { name: '左サイドバーを開く' })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    let dialog = await screen.findByRole('dialog', { name: '操作を実行' })
    fireEvent.click(within(dialog).getByRole('option', { name: /左サイドバー/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: '左サイドバーを閉じる' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '左サイドバーを閉じる' }))
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    dialog = await screen.findByRole('dialog', { name: '操作を実行' })
    fireEvent.change(
      within(dialog).getByRole('combobox', { name: 'コマンドを検索' }),
      { target: { value: 'vault search' } }
    )
    fireEvent.keyDown(
      within(dialog).getByRole('combobox', { name: 'コマンドを検索' }),
      { key: 'Enter' }
    )
    await waitFor(() => expect(document.activeElement).toBe(screen.getByPlaceholderText('内容を検索')))
  })

  it('transitions from the palette to Quick Switcher without stacking dialogs', async () => {
    const { container } = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const editor = await screen.findByLabelText('Markdown編集欄')
    editor.focus()
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    const palette = await screen.findByRole('dialog', { name: '操作を実行' })
    fireEvent.click(within(palette).getByRole('option', { name: /^ノートを開く/ }))
    expect(screen.queryByRole('dialog', { name: '操作を実行' })).toBeNull()
    const switcher = await screen.findByRole('dialog', { name: 'ノートを開く' })
    expect(screen.queryAllByRole('dialog')).toHaveLength(1)
    fireEvent.keyDown(within(switcher).getByRole('combobox', { name: 'ノートを検索' }), {
      key: 'Escape'
    })
    await waitFor(() => expect(document.activeElement).toBe(editor))
    expect(container.querySelector('.workspace')?.hasAttribute('inert')).toBe(false)
  })

  it('routes representative palette commands through settings, bookmarks, and graph actions', async () => {
    render(<App />)
    await screen.findByText('Aの本文')
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    let dialog = await screen.findByRole('dialog', { name: '操作を実行' })
    fireEvent.click(within(dialog).getByRole('option', { name: /^設定/ }))
    const settingsDialog = await screen.findByRole('dialog', { name: '設定' })
    fireEvent.keyDown(settingsDialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '設定' })).toBeNull())

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    dialog = await screen.findByRole('dialog', { name: '操作を実行' })
    fireEvent.click(within(dialog).getByRole('option', { name: /^ブックマーク/ }))
    expect(screen.getByRole('region', { name: 'ブックマーク一覧' })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    dialog = await screen.findByRole('dialog', { name: '操作を実行' })
    fireEvent.click(within(dialog).getByRole('option', { name: /^ローカルグラフ/ }))
    expect(screen.getByRole('button', { name: 'ローカルグラフ' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    dialog = await screen.findByRole('dialog', { name: '操作を実行' })
    fireEvent.click(within(dialog).getByRole('option', { name: /^Vaultグラフ/ }))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'グラフビュー' })).toBeTruthy())
  })

  it('opens a Quick Switcher result in the current workspace and records it as most recent', async () => {
    render(<App />)
    await screen.findByText('Aの本文')

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true })
    const input = await screen.findByRole('combobox', { name: 'ノートを検索' })
    fireEvent.change(input, { target: { value: 'B' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByText('Bの本文')
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true })

    const listbox = await screen.findByRole('listbox', { name: 'ノート候補' })
    expect(within(listbox).getAllByRole('option')[0].textContent).toContain('B')
  })

  it('opens a Quick Switcher result in a new active workspace tab with Ctrl+Enter', async () => {
    render(<App />)
    await screen.findByText('Aの本文')

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true })
    const input = await screen.findByRole('combobox', { name: 'ノートを検索' })
    fireEvent.change(input, { target: { value: 'B' } })
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })

    expect(
      (await screen.findByRole('tab', { name: 'A' })).getAttribute('aria-selected')
    ).toBe('false')
    expect(screen.getByRole('tab', { name: 'B' }).getAttribute('aria-selected')).toBe(
      'true'
    )
    await screen.findByText('Bの本文')
  })

  it('confirms the destination before creating a no-match Quick Switcher note', async () => {
    const createdNote: NoteDocument = {
      path: '新規改善メモ.md',
      name: '新規改善メモ',
      content: '',
      modifiedAt: 400,
      size: 0
    }
    vi.mocked(api.createNote).mockResolvedValue(await ok({ path: createdNote.path }))
    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({ ...snapshot, notes: [...snapshot.notes, createdNote] })
    )
    render(<App />)
    await screen.findByText('Aの本文')

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true })
    const input = await screen.findByRole('combobox', { name: 'ノートを検索' })
    fireEvent.change(input, { target: { value: '新規改善メモ' } })
    fireEvent.click(screen.getByRole('button', { name: '新規ノートを作成' }))

    const createDialog = await screen.findByRole('dialog', { name: '新規ノートを作成' })
    expect(within(createDialog).getByText('作成先: 新規改善メモ.md')).toBeTruthy()
    expect(api.createNote).not.toHaveBeenCalled()
    fireEvent.click(within(createDialog).getByRole('button', { name: '作成' }))

    await waitFor(() => {
      expect(api.createNote).toHaveBeenCalledWith({
        directory: '',
        name: '新規改善メモ',
        content: undefined
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '新規ノートを作成' })).toBeNull()
    })
    const editor = screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement
    expect(editor.value).toBe('')
    await waitFor(() => expect(document.activeElement).toBe(editor))
  })

  it('renders an embedded Vault image through the trusted image reader', async () => {
    const imageNote = {
      ...noteA,
      content: '![[attachments/diagram.svg]]'
    }
    const imageSnapshot: VaultSnapshot = {
      ...snapshot,
      notes: [imageNote, noteB, noteC],
      attachments: [
        {
          path: 'attachments/diagram.svg',
          name: 'diagram.svg',
          size: 64,
          modifiedAt: 400,
          createdAt: 350
        }
      ]
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(imageSnapshot))
    vi.mocked(api.readNote).mockResolvedValue(await ok(imageNote))
    const readVaultImage = vi.fn(() =>
      ok('data:image/svg+xml;base64,PHN2Zy8+')
    )
    ;(
      api as TsuzuneApi & {
        readVaultImage(path: string): Promise<Result<string>>
      }
    ).readVaultImage = readVaultImage

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'プレビュー' }))

    const image = await screen.findByRole('img', { name: 'diagram.svg' })
    await waitFor(() => {
      expect(readVaultImage).toHaveBeenCalledWith('attachments/diagram.svg')
      expect(image.getAttribute('src')).toBe(
        'data:image/svg+xml;base64,PHN2Zy8+'
      )
    })
  })

  it('preserves a regular remote Markdown image without using the Vault reader', async () => {
    const remoteImageNote = {
      ...noteA,
      content: '![外部画像](https://example.com/diagram.png)'
    }
    vi.mocked(api.openLastVault).mockResolvedValue(
      await ok({ ...snapshot, notes: [remoteImageNote, noteB, noteC] })
    )
    vi.mocked(api.readNote).mockResolvedValue(await ok(remoteImageNote))
    vi.mocked(api.readVaultImage).mockClear()

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'プレビュー' }))

    const image = await screen.findByRole('img', { name: '外部画像' })
    expect(image.getAttribute('src')).toBe('https://example.com/diagram.png')
    expect(api.readVaultImage).not.toHaveBeenCalled()
  })

  it('checks for updates and saves the current note before installing', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))

    fireEvent.click(
      await screen.findByRole('button', { name: '更新を確認' })
    )
    await waitFor(() => {
      expect(api.checkForUpdates).toHaveBeenCalledTimes(1)
    })

    act(() => {
      updateStatusChanged?.({
        phase: 'downloaded',
        currentVersion: '0.4.0',
        availableVersion: '0.5.0',
        downloadPercent: 100,
        message: 'TSUZUNE 0.5.0を再起動して適用できます。'
      })
    })
    fireEvent.change(screen.getByLabelText('Markdown編集欄'), {
      target: { value: '更新前に保存する本文' }
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'TSUZUNE 0.5.0を適用' })
    )

    await waitFor(() => {
      expect(api.saveNote).toHaveBeenCalled()
      expect(api.installUpdate).toHaveBeenCalledTimes(1)
    })
  })

  it('does not install an update when the current note cannot be saved', async () => {
    vi.mocked(api.getUpdateStatus).mockResolvedValue(
      await ok({
        phase: 'downloaded',
        currentVersion: '0.4.0',
        availableVersion: '0.5.0',
        downloadPercent: 100,
        message: 'TSUZUNE 0.5.0を再起動して適用できます。'
      })
    )
    vi.mocked(api.saveNote).mockResolvedValue({
      ok: false,
      error: { code: 'SAVE_FAILED', message: '保存できません。' }
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    fireEvent.change(await screen.findByLabelText('Markdown編集欄'), {
      target: { value: 'まだ保存できていない本文' }
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'TSUZUNE 0.5.0を適用' })
    )

    await waitFor(() => {
      expect(api.saveNote).toHaveBeenCalled()
      expect(api.installUpdate).not.toHaveBeenCalled()
      expect(
        screen.getByText('編集中のノートを保存できなかったため、更新を中止しました。')
      ).toBeTruthy()
    })
  })

  it('shows the selected note local graph and opens a connected note', async () => {
    const graphSnapshot: VaultSnapshot = {
      ...snapshot,
      notes: [{ ...noteA, content: '[[B]]' }, noteB, noteC]
    }
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: graphSnapshot
    })

    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'ローカルグラフ' })
    )
    const linkedNote = await screen.findByRole('button', {
      name: 'B（リンク先）を開く'
    })
    fireEvent.click(linkedNote)

    expect(await screen.findByText('Bの本文')).toBeTruthy()
    expect(api.setLastNote).toHaveBeenCalledWith('B.md')
  })

  it('keeps audit history in the file tree but excludes it from normal discovery', async () => {
    const historyNote: NoteDocument = {
      path: '50_履歴/AI更新/A-history.md',
      name: 'A-history',
      content: 'audit-only-token [[A]]',
      modifiedAt: 400,
      size: 22
    }
    const historySnapshot: VaultSnapshot = {
      ...snapshot,
      directories: ['', '50_履歴', '50_履歴/AI更新'],
      notes: [noteA, noteB, noteC, historyNote]
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(historySnapshot))
    vi.mocked(api.readNote).mockImplementation((path) => {
      const note = historySnapshot.notes.find((candidate) => candidate.path === path)
      return note
        ? ok(note)
        : Promise.resolve({
            ok: false,
            error: { code: 'NOT_FOUND', message: '見つかりません。' }
          })
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    await screen.findByLabelText('Markdown編集欄')

    const tree = within(screen.getByRole('tree', { name: 'Vaultファイル' }))
    const historyFile = tree.getByRole('treeitem', { name: /A-history/ })
    fireEvent.click(historyFile)
    await waitFor(() =>
      expect(api.setLastNote).toHaveBeenCalledWith(historyNote.path)
    )
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    expect(
      (await screen.findByLabelText('Markdown編集欄') as HTMLTextAreaElement).value
    ).toBe(historyNote.content)
    fireEvent.click(tree.getByRole('treeitem', { name: 'A.md' }))
    fireEvent.click(screen.getByRole('tab', { name: /バックリンク/ }))
    const backlinks = screen
      .getByRole('heading', { name: 'バックリンク' })
      .closest('section')
    expect(backlinks).not.toBeNull()
    expect(within(backlinks!).queryByRole('button', { name: /A-history/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'ローカルグラフ' }))
    const graph = await screen.findByRole('region', { name: 'ローカルグラフ' })
    expect(within(graph).queryByRole('button', { name: /A-history/ })).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('内容を検索'), {
      target: { value: 'audit-only-token' }
    })
    expect(
      within(screen.getByLabelText('検索結果')).getByText(
        '「audit-only-token」は見つかりませんでした。'
      )
    ).toBeTruthy()
  })

  it('restores graph forces and persists them when slider editing is committed', async () => {
    const graphForces = {
      centerForce: 0.25,
      repelForce: 7,
      linkForce: 0.45,
      linkDistance: 288
    }
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: noteA.path,
        userIgnoreFilters: [],
        graphForces,
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )

    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'ローカルグラフ' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    fireEvent.click(screen.getByRole('button', { name: '力の強さを開く' }))
    const centerForce = screen.getByRole('slider', {
      name: '中心力'
    }) as HTMLInputElement
    expect(centerForce.value).toBe('0.25')

    fireEvent.change(centerForce, { target: { value: '0.8' } })
    await waitFor(() => expect(centerForce.value).toBe('0.8'))
    expect(api.setGraphForces).not.toHaveBeenCalled()

    fireEvent.blur(centerForce)
    await waitFor(() => {
      expect(api.setGraphForces).toHaveBeenCalledWith({
        ...graphForces,
        centerForce: 0.8
      })
    })
  })

  it('restores and persists Local and Vault graph view state independently', async () => {
    const graphViewStates = {
      local: {
        scale: 2,
        query: 'file:A',
        settingsOpen: true,
        settingsSections: {
          filters: true,
          groups: false,
          display: false,
          forces: false
        }
      },
      vault: {
        scale: 0.5,
        query: 'file:B',
        settingsOpen: false,
        settingsSections: {
          filters: false,
          groups: false,
          display: false,
          forces: false
        }
      }
    }
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: noteA.path,
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 0.5,
          repelForce: 10,
          linkForce: 1,
          linkDistance: 250
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates
      })
    )

    const { container } = render(<App />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'ローカルグラフ' })
    )

    expect(container.querySelector<HTMLElement>('.wiki-graph-stage')?.style.transform)
      .toContain('scale(2)')
    expect(
      (screen.getByRole('searchbox', {
        name: 'ファイルを検索…'
      }) as HTMLInputElement).value
    ).toBe('file:A')
    fireEvent.click(screen.getByRole('button', { name: 'グラフ設定を閉じる' }))

    await waitFor(() => {
      expect(api.setGraphViewState).toHaveBeenCalledWith('local', {
        ...graphViewStates.local,
        settingsOpen: false
      })
    })

    const graphViewButtons = screen.getAllByRole('button', {
      name: 'グラフビュー'
    })
    fireEvent.click(graphViewButtons[graphViewButtons.length - 1])
    expect(container.querySelector<HTMLElement>('.wiki-graph-stage')?.style.transform)
      .toContain('scale(0.5)')
    expect(screen.queryByRole('complementary', { name: 'グラフ設定' })).toBeNull()
  })

  it('edits the app-wide excluded files setting and rescans the Vault', async () => {
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: noteA.path,
        userIgnoreFilters: ['80_excluded', '/\\.private\\.md$/'],
        graphForces: {
          centerForce: 0.5,
          repelForce: 10,
          linkForce: 1,
          linkDistance: 250
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '設定' }))
    const excluded = screen.getByRole('textbox', {
      name: '除外するファイル'
    }) as HTMLTextAreaElement
    expect(excluded.value).toBe('80_excluded\n/\\.private\\.md$/')

    fireEvent.change(excluded, {
      target: { value: ' 90_archive \n\n /\\.secret$/' }
    })
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))

    await waitFor(() => {
      expect(api.setUserIgnoreFilters).toHaveBeenCalledWith([
        '90_archive',
        '/\\.secret$/'
      ])
      expect(api.getSnapshot).toHaveBeenCalled()
    })
    expect(screen.queryByRole('dialog', { name: '設定' })).toBeNull()
  })

  it('chooses a template folder and hides built-in templates from settings', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue(
      await ok({
        ...snapshot,
        directories: ['', '90_テンプレート', '雛形']
      })
    )
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: noteA.path,
        userIgnoreFilters: [],
        graphForces: DEFAULT_GRAPH_FORCE_SETTINGS,
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES,
        templateDirectory: '90_テンプレート',
        showBuiltInTemplates: true
      })
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '設定' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'テンプレートフォルダ' }), {
      target: { value: '雛形' }
    })
    fireEvent.click(screen.getByRole('checkbox', { name: '内蔵テンプレートを表示' }))
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))

    await waitFor(() => {
      expect(api.setTemplateSettings).toHaveBeenCalledWith({
        directory: '雛形',
        includeBuiltIns: false
      })
    })
  })

  it('does not expose retired additional AI immutable paths in settings', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '設定' }))

    expect(
      screen.queryByRole('textbox', { name: 'AIから変更させないパス' })
    ).toBeNull()
    expect(screen.getByRole('textbox', { name: 'AI変更を承認制にするパス' })).not.toBeNull()
  })

  it('saves review paths and lets the user approve a pending AI change', async () => {
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: noteA.path,
        userIgnoreFilters: [],
        aiReviewPaths: ['Projects'],
        graphForces: DEFAULT_GRAPH_FORCE_SETTINGS,
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )
    vi.mocked(api.listAiReviewProposals)
      .mockResolvedValueOnce(
        await ok([
          {
            id: 'proposal-1',
            path: noteA.path,
            operation: 'update',
            content: '# A\n\nAI change',
            expectedRevision: 'sha256:old',
            reason: '知識を更新',
            sourceRefs: ['30_知識/設計.md', 'docs/reports/evidence.md'],
            createdAt: '2026-08-12T00:00:00.000Z'
          }
        ])
      )
      .mockResolvedValue(await ok([]))

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '設定' }))

    expect(
      (await screen.findByRole('textbox', {
        name: 'AI変更を承認制にするパス'
      }) as HTMLTextAreaElement).value
    ).toBe('Projects')
    expect(await screen.findByText('知識を更新')).not.toBeNull()
    expect(screen.getByText('操作: 更新')).not.toBeNull()
    expect(
      screen.getByText(
        `作成時刻: ${new Date('2026-08-12T00:00:00.000Z').toLocaleString('ja-JP')}`
      )
    ).not.toBeNull()
    expect(
      screen.getByText('出典: 30_知識/設計.md、docs/reports/evidence.md')
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '承認して反映' }))

    await waitFor(() => {
      expect(api.approveAiReviewProposal).toHaveBeenCalledWith('proposal-1')
      expect(api.getSnapshot).toHaveBeenCalled()
    })

    fireEvent.change(
      screen.getByRole('textbox', { name: 'AI変更を承認制にするパス' }),
      { target: { value: ' 30_知識\n\nDrafts ' } }
    )
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await waitFor(() => {
      expect(api.setAiReviewPaths).toHaveBeenCalledWith(['30_知識', 'Drafts'])
    })
  })

  it('restores graph groups, colors matching nodes, and persists query edits', async () => {
    const graphGroups = [
      { id: 'linked', query: 'file:B', color: '#123abc' }
    ]
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: noteA.path,
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 0.5,
          repelForce: 10,
          linkForce: 1,
          linkDistance: 250
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )
    vi.mocked(api.openLastVault).mockResolvedValue(
      await ok({
        ...snapshot,
        notes: [{ ...noteA, content: '[[B]]' }, noteB, noteC]
      })
    )

    render(<App />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'ローカルグラフ' })
    )
    const linked = await screen.findByRole('button', {
      name: 'B（リンク先）を開く'
    })
    expect(
      linked.querySelector<HTMLElement>('.wiki-graph-node-dot')?.style.background
    ).toBe('rgb(18, 58, 188)')

    fireEvent.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    fireEvent.click(screen.getByRole('button', { name: 'グループを開く' }))
    const query = screen.getByPlaceholderText(
      'クエリを入力…'
    ) as HTMLInputElement
    expect(query.value).toBe('file:B')
    fireEvent.change(query, { target: { value: 'path:Projects' } })
    fireEvent.blur(query)

    await waitFor(() => {
      expect(api.setGraphGroups).toHaveBeenCalledWith([
        { id: 'linked', query: 'path:Projects', color: '#123abc' }
      ])
    })
  })

  it('keeps the force preview visible and reports a persistence failure', async () => {
    vi.mocked(api.setGraphForces).mockResolvedValue({
      ok: false,
      error: {
        code: 'SAVE_FAILED',
        message: 'グラフ設定を保存できません。'
      }
    })

    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'ローカルグラフ' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    fireEvent.click(screen.getByRole('button', { name: '力の強さを開く' }))
    const centerForce = screen.getByRole('slider', {
      name: '中心力'
    }) as HTMLInputElement
    fireEvent.change(centerForce, { target: { value: '0.8' } })
    fireEvent.blur(centerForce)

    expect(centerForce.value).toBe('0.8')
    expect(
      await screen.findByText('グラフ設定を保存できません。')
    ).toBeTruthy()
  })

  it('keeps the local graph to direct connections without depth controls', async () => {
    const noteD: NoteDocument = {
      path: 'D.md',
      name: 'D',
      content: 'Dの本文',
      modifiedAt: 400,
      size: 10
    }
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [
          { ...noteA, content: '[[B]]' },
          { ...noteB, content: '[[C]]' },
          { ...noteC, content: '[[D]]' },
          noteD
        ]
      }
    })

    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'ローカルグラフ' })
    )
    expect(
      screen.getByRole('button', { name: 'B（リンク先）を開く' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'C（関連ノート）を開く' })
    ).toBeNull()

    expect(
      screen.queryByRole('button', { name: 'C（関連ノート）を開く' })
    ).toBeNull()
    expect(
      screen.queryByRole('group', { name: 'ローカルグラフの深度' })
    ).toBeNull()
    expect(screen.queryByRole('button', { name: '深度1' })).toBeNull()
    expect(screen.queryByRole('button', { name: '深度2' })).toBeNull()
  })

  it('shows every Markdown note by default in the Vault graph', async () => {
    const noteD: NoteDocument = {
      path: 'D.md',
      name: 'D',
      content: 'Dの本文',
      modifiedAt: 400,
      size: 10
    }
    const orphan: NoteDocument = {
      path: '孤立.md',
      name: '孤立',
      content: '接続なし',
      modifiedAt: 500,
      size: 10
    }
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [
          { ...noteA, content: '[[B]]' },
          noteB,
          { ...noteC, content: '[[D]]' },
          noteD,
          orphan
        ]
      }
    })

    render(<App />)

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'グラフビュー' }))[0]
    )

    expect(
      await screen.findByRole('button', { name: 'C（関連ノート）を開く' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'D（関連ノート）を開く' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: '孤立（関連ノート）を開く' })
    ).toBeTruthy()

    expect(
      screen.getByRole('complementary', { name: 'グラフ設定' })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    const orphanToggle = screen.getByRole('checkbox', {
      name: 'オーファン'
    }) as HTMLInputElement
    expect(orphanToggle.checked).toBe(true)
    fireEvent.click(orphanToggle)

    expect(screen.queryByRole('button', { name: '孤立（関連ノート）を開く' })).toBeNull()
  })

  it('opens the Vault graph from the left panel without a selected note', async () => {
    vi.mocked(api.getSettings).mockResolvedValue(
      await ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: null,
        userIgnoreFilters: [],
        graphForces: {
          centerForce: 50,
          repelForce: 50,
          linkForce: 50,
          linkDistance: 50
        },
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    )

    render(<App />)

    const graphView = await screen.findByRole('button', {
      name: 'グラフビュー'
    })
    expect(graphView.closest('.left-panel')).not.toBeNull()

    fireEvent.click(graphView)

    expect(
      await screen.findByRole('region', { name: 'Vault全体グラフ' })
    ).toBeTruthy()
    expect(
      screen.getByRole('complementary', { name: 'グラフ設定' })
    ).toBeTruthy()
  })

  it('keeps note display modes primary and the Vault graph in the left navigation', async () => {
    render(<App />)

    const noteActions = (await screen.findByRole('group', { name: 'ノート表示' }))
      .closest('.note-actions') as HTMLElement
    expect(within(noteActions).getByRole('button', { name: '編集' })).toBeTruthy()
    expect(within(noteActions).getByRole('button', { name: 'プレビュー' })).toBeTruthy()
    expect(within(noteActions).getByRole('button', { name: 'ローカルグラフ' })).toBeTruthy()
    expect(within(noteActions).queryByRole('button', { name: 'グラフビュー' })).toBeNull()
    expect(screen.getByRole('button', { name: 'グラフビュー' }).closest('.left-panel')).not.toBeNull()
  })

  it('collapses and restores each sidebar independently while preserving the note pane', async () => {
    render(<App />)

    const leftToggle = await screen.findByRole('button', { name: '左サイドバーを閉じる' })
    const rightToggle = screen.getByRole('button', { name: '右サイドバーを閉じる' })
    const noteBody = await screen.findByText('Aの本文')
    expect(noteBody).toBeTruthy()
    expect(leftToggle.getAttribute('aria-expanded')).toBe('true')
    expect(rightToggle.getAttribute('aria-expanded')).toBe('true')
    expect(leftToggle.getAttribute('title')).toBe('左サイドバーを閉じる')
    expect(rightToggle.getAttribute('title')).toBe('右サイドバーを閉じる')

    fireEvent.click(leftToggle)
    const leftReopen = screen.getByRole('button', { name: '左サイドバーを開く' })
    expect(leftReopen.getAttribute('aria-controls')).toBe('left-sidebar-content')
    expect(leftReopen.getAttribute('title')).toBe('左サイドバーを開く')
    expect(document.getElementById('left-sidebar-content')?.hasAttribute('hidden')).toBe(true)
    expect(screen.getByText('Aの本文')).toBe(noteBody)
    expect(screen.getByRole('button', { name: '右サイドバーを閉じる' }).getAttribute('aria-expanded')).toBe(
      'true'
    )

    fireEvent.click(screen.getByRole('button', { name: '右サイドバーを閉じる' }))
    expect(screen.getByRole('button', { name: '右サイドバーを開く' }).getAttribute('title')).toBe(
      '右サイドバーを開く'
    )
    expect(document.getElementById('right-sidebar-content')?.hasAttribute('hidden')).toBe(true)
    expect(screen.getByText('Aの本文')).toBe(noteBody)

    fireEvent.click(screen.getByRole('button', { name: '左サイドバーを開く' }))
    fireEvent.click(screen.getByRole('button', { name: '右サイドバーを開く' }))
    expect(document.getElementById('left-sidebar-content')?.hasAttribute('hidden')).toBe(false)
    expect(document.getElementById('right-sidebar-content')?.hasAttribute('hidden')).toBe(false)
  })

  it('shows unresolved Wiki links until the existing-files-only filter is enabled and persisted', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '[[未作成]]' }, noteB, noteC]
      }
    })

    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'ローカルグラフ' })
    )
    expect(
      await screen.findByRole('button', {
        name: '未作成（リンク先）を開く'
      })
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    fireEvent.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    const existingFilesOnly = screen.getByRole('checkbox', {
      name: '存在するファイルのみ表示'
    }) as HTMLInputElement
    expect(existingFilesOnly.checked).toBe(false)

    fireEvent.click(existingFilesOnly)

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: '未作成（リンク先）を開く'
        })
      ).toBeNull()
      expect(api.setGraphFilters).toHaveBeenCalledWith({
        ...DEFAULT_GRAPH_FILTER_SETTINGS,
        existingFilesOnly: true
      })
    })
  })

  it('adds tag nodes to the graph only when the Tags filter is enabled', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '#project/tsuzune' }, noteB, noteC]
      }
    })

    render(<App />)

    const graphViewButtons = await screen.findAllByRole('button', {
      name: 'グラフビュー'
    })
    fireEvent.click(graphViewButtons[0])
    expect(
      screen.getByRole('complementary', { name: 'グラフ設定' })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    const tags = screen.getByRole('checkbox', { name: 'タグ' }) as HTMLInputElement
    expect(tags.checked).toBe(false)
    expect(
      screen.queryByRole('button', {
        name: '#project/tsuzune（タグ）を検索'
      })
    ).toBeNull()

    fireEvent.click(tags)

    const tagNode = await screen.findByRole('button', {
      name: '#project/tsuzune（タグ）を検索'
    })
    fireEvent.click(tagNode)

    expect(
      (screen.getByRole('textbox', { name: '内容を検索' }) as HTMLInputElement)
        .value
    ).toBe('tag:#project/tsuzune')
    expect(api.setGraphFilters).toHaveBeenCalledWith({
      ...DEFAULT_GRAPH_FILTER_SETTINGS,
      showTags: true
    })
  })

  it('adds attachment nodes without treating them as missing Markdown notes', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '![[assets/diagram.svg]]' }, noteB, noteC],
        attachments: [
          {
            path: 'assets/diagram.svg',
            name: 'diagram.svg',
            modifiedAt: 1,
            createdAt: null,
            size: 10
          }
        ]
      }
    })

    render(<App />)

    const graphViewButtons = await screen.findAllByRole('button', {
      name: 'グラフビュー'
    })
    fireEvent.click(graphViewButtons[0])
    expect(
      screen.queryByRole('button', { name: 'diagram.svg（リンク先）を開く' })
    ).toBeNull()

    expect(
      screen.getByRole('complementary', { name: 'グラフ設定' })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    const attachments = screen.getByRole('checkbox', {
      name: '添付書類'
    }) as HTMLInputElement
    expect(attachments.checked).toBe(false)
    fireEvent.click(attachments)

    const attachmentNode = await screen.findByRole('button', {
      name: 'diagram.svg（添付書類）を開く'
    })
    fireEvent.click(attachmentNode)

    await waitFor(() => {
      expect(api.openVaultFile).toHaveBeenCalledWith('assets/diagram.svg')
    })
    expect(api.setGraphFilters).toHaveBeenCalledWith({
      ...DEFAULT_GRAPH_FILTER_SETTINGS,
      showAttachments: true
    })

    fireEvent.contextMenu(attachmentNode)
    fireEvent.click(screen.getByRole('menuitem', { name: 'パスをコピー' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'システムルートから' }))
    await waitFor(() => {
      expect(api.copyText).toHaveBeenCalledWith(
        'C:\\Vault\\assets\\diagram.svg'
      )
    })

    vi.mocked(api.openVaultFile).mockClear()
    fireEvent.contextMenu(attachmentNode)
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'デフォルトアプリで開く' })
    )
    await waitFor(() => {
      expect(api.openVaultFile).toHaveBeenCalledOnce()
      expect(api.openVaultFile).toHaveBeenCalledWith('assets/diagram.svg')
    })

    vi.mocked(api.revealVaultFile).mockClear()
    fireEvent.contextMenu(attachmentNode)
    fireEvent.click(screen.getByRole('menuitem', { name: 'フォルダで表示' }))
    expect(api.revealVaultFile).toHaveBeenCalledOnce()
    expect(api.revealVaultFile).toHaveBeenCalledWith('assets/diagram.svg')

    vi.mocked(api.revealVaultFile).mockClear()
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'A（現在のノート）' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'フォルダで表示' }))
    expect(api.revealVaultFile).toHaveBeenCalledOnce()
    expect(api.revealVaultFile).toHaveBeenCalledWith('A.md')

    vi.mocked(api.openVaultFile).mockResolvedValueOnce({
      ok: false,
      error: { code: 'UNKNOWN', message: '既定アプリを開けません。' }
    })
    fireEvent.contextMenu(attachmentNode)
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'デフォルトアプリで開く' })
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getAllByText('既定アプリを開けません。').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('tab', { name: 'グラフビュー' }).getAttribute(
        'aria-selected'
      )
    ).toBe('true')

  })

  it('shows a folder reveal error without leaving the graph view', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '![[assets/diagram.svg]]' }, noteB, noteC],
        attachments: [
          {
            path: 'assets/diagram.svg',
            name: 'diagram.svg',
            modifiedAt: 1,
            createdAt: null,
            size: 10
          }
        ]
      }
    })
    vi.mocked(api.revealVaultFile).mockResolvedValueOnce({
      ok: false,
      error: { code: 'UNKNOWN', message: 'フォルダを開けません。' }
    })

    render(<App />)
    const graphViewButtons = await screen.findAllByRole('button', {
      name: 'グラフビュー'
    })
    fireEvent.click(graphViewButtons[0])
    fireEvent.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    fireEvent.click(
      screen.getByRole('checkbox', { name: '添付書類' })
    )
    const attachmentNode = await screen.findByRole('button', {
      name: 'diagram.svg（添付書類）を開く'
    })
    fireEvent.contextMenu(attachmentNode)
    fireEvent.click(screen.getByRole('menuitem', { name: 'フォルダで表示' }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getAllByText('フォルダを開けません。').length).toBeGreaterThan(0)
    expect(api.revealVaultFile).toHaveBeenCalledOnce()
    expect(api.revealVaultFile).toHaveBeenCalledWith('assets/diagram.svg')
    expect(
      screen.getByRole('tab', { name: 'グラフビュー' }).getAttribute(
        'aria-selected'
      )
    ).toBe('true')
  })

  it('creates, edits, and removes a Vault bookmark from the graph menu', async () => {
    const attachment = {
      path: 'assets/diagram.svg',
      name: 'diagram.svg',
      modifiedAt: 1,
      createdAt: null,
      size: 10
    }
    const initialSnapshot: VaultSnapshot = {
      ...snapshot,
      notes: [{ ...noteA, content: '![[assets/diagram.svg]]' }, noteB, noteC],
      attachments: [attachment],
      bookmarks: []
    }
    const bookmark = {
      type: 'file' as const,
      path: attachment.path,
      title: '構成図',
      group: '資料',
      ctime: 1
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(initialSnapshot))
    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({ ...initialSnapshot, bookmarks: [bookmark] })
    )
    vi.mocked(api.saveBookmark).mockResolvedValue(await ok(bookmark))

    render(<App />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'グラフビュー' }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '添付書類' }))
    fireEvent.contextMenu(
      await screen.findByRole('button', { name: 'diagram.svg（添付書類）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'ブックマーク…' }))

    fireEvent.change(screen.getByLabelText('タイトル'), {
      target: { value: '構成図' }
    })
    fireEvent.change(screen.getByLabelText('Bookmark group'), {
      target: { value: '資料' }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(api.saveBookmark).toHaveBeenCalledWith({
        path: attachment.path,
        title: '構成図',
        group: '資料'
      })
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'diagram.svg（添付書類）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'ブックマークを編集' }))
    expect(screen.getByLabelText('タイトル')).toHaveProperty('value', '構成図')

    vi.mocked(api.getSnapshot).mockResolvedValue(
      await ok({ ...initialSnapshot, bookmarks: [] })
    )
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => {
      expect(api.removeBookmark).toHaveBeenCalledWith(attachment.path)
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('lists grouped bookmarks, opens their targets, and edits from right click', async () => {
    const attachment = {
      path: 'assets/diagram.svg',
      name: 'diagram.svg',
      modifiedAt: 1,
      createdAt: null,
      size: 10
    }
    const bookmarkSnapshot: VaultSnapshot = {
      ...snapshot,
      attachments: [attachment],
      bookmarks: [
        { type: 'file', path: 'B.md', title: '重要ノート', group: '仕事', ctime: 1 },
        { type: 'file', path: attachment.path, title: '構成図', group: '資料', ctime: 2 },
        { type: 'file', path: 'Missing.md', ctime: 3 }
      ]
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(bookmarkSnapshot))

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'ブックマーク' }))

    const list = screen.getByRole('region', { name: 'ブックマーク一覧' })
    expect(within(list).getByRole('heading', { name: '仕事' })).toBeTruthy()
    expect(within(list).getByRole('heading', { name: '資料' })).toBeTruthy()
    expect(within(list).getByRole('heading', { name: '未分類' })).toBeTruthy()
    expect(within(list).getByText('見つかりません')).toBeTruthy()

    fireEvent.click(within(list).getByRole('button', { name: /Missing.md/ }))
    expect(screen.getByText(/ブックマーク先「Missing.md」が見つかりません/)).toBeTruthy()

    fireEvent.click(within(list).getByRole('button', { name: /重要ノート/ }))
    await screen.findByText('Bの本文')
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    await waitFor(() =>
      expect(
        (screen.getByRole('textbox', {
          name: 'Markdown編集欄'
        }) as HTMLTextAreaElement).value
      ).toBe('Bの本文')
    )

    fireEvent.click(within(list).getByRole('button', { name: /構成図/ }))
    await waitFor(() =>
      expect(api.openVaultFile).toHaveBeenCalledWith(attachment.path)
    )

    fireEvent.contextMenu(within(list).getByRole('button', { name: /重要ノート/ }))
    expect(screen.getByRole('dialog', { name: 'ブックマークを編集' })).toBeTruthy()
    expect(screen.getByLabelText('タイトル')).toHaveProperty('value', '重要ノート')
  })

  it('opens a graph note in a real switchable workspace tab', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '[[B]]' }, noteB, noteC]
      }
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'ローカルグラフ' }))
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'B（リンク先）を開く' })
    )

    const openInNewTab = screen.getByRole('menuitem', { name: '新規タブに開く' })
    expect((openInNewTab as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(openInNewTab)

    const tablist = await screen.findByRole('tablist', { name: '開いているタブ' })
    expect(tablist).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe(
      'false'
    )
    expect(screen.getByRole('tab', { name: 'B' }).getAttribute('aria-selected')).toBe(
      'true'
    )
    await screen.findByText('Bの本文')
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    expect(
      (screen.getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement)
        .value
    ).toBe('Bの本文')

    fireEvent.click(screen.getByRole('tab', { name: 'A' }))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe(
        'true'
      )
    })
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    await waitFor(() => {
      expect(
        (screen.getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement)
          .value
      ).toBe('[[B]]')
    })
  })

  it('provides ARIA-linked roving keyboard navigation for workspace tabs', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '[[B]]' }, noteB, noteC]
      }
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'ローカルグラフ' }))
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'B（リンク先）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: '新規タブに開く' }))

    const tabA = await screen.findByRole('tab', { name: 'A' })
    const tabB = screen.getByRole('tab', { name: 'B' })
    await waitFor(() => {
      expect(tabA.tabIndex).toBe(-1)
      expect(tabB.tabIndex).toBe(0)
    })
    expect(tabA.id).not.toBe('')
    expect(tabB.id).not.toBe('')
    expect(tabA.getAttribute('aria-controls')).toBe('workspace-tabpanel')
    expect(tabB.getAttribute('aria-controls')).toBe('workspace-tabpanel')
    expect(
      screen.getByRole('tabpanel', { name: 'B' }).getAttribute('aria-labelledby')
    ).toBe(tabB.id)

    tabB.focus()
    fireEvent.keyDown(tabB, { key: 'ArrowLeft' })
    await waitFor(() => {
      expect(document.activeElement).toBe(tabA)
      expect(tabA.tabIndex).toBe(0)
      expect(tabB.tabIndex).toBe(-1)
    })
    expect(tabA.getAttribute('aria-selected')).toBe('false')

    fireEvent.keyDown(tabA, { key: 'Enter' })
    await waitFor(() => {
      expect(tabA.getAttribute('aria-selected')).toBe('true')
      expect(screen.getByRole('tabpanel', { name: 'A' })).toBeTruthy()
    })

    fireEvent.keyDown(tabA, { key: 'ArrowLeft' })
    await waitFor(() => expect(document.activeElement).toBe(tabB))
    fireEvent.keyDown(tabB, { key: ' ' })
    await waitFor(() => {
      expect(tabB.getAttribute('aria-selected')).toBe('true')
    })
    fireEvent.keyDown(tabB, { key: 'ArrowRight' })
    await waitFor(() => expect(document.activeElement).toBe(tabA))
  })

  it('cycles, selects, and safely closes workspace tabs with global shortcuts', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '[[B]]' }, noteB, noteC]
      }
    })

    render(<App />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'グラフビュー' }))[0])
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'B（リンク先）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: '新規タブに開く' }))

    const selectedTabName = (): string | null =>
      screen
        .getAllByRole('tab')
        .find((tab) => tab.getAttribute('aria-selected') === 'true')
        ?.textContent ?? null

    await screen.findByRole('tab', { name: 'B' })
    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    await waitFor(() => expect(selectedTabName()).toBe('A'))
    fireEvent.keyDown(window, { key: '2', ctrlKey: true })
    await waitFor(() => expect(selectedTabName()).toBe('グラフビュー'))
    fireEvent.keyDown(window, { key: '9', ctrlKey: true })
    await waitFor(() => expect(selectedTabName()).toBe('B'))
    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true, shiftKey: true })
    await waitFor(() => expect(selectedTabName()).toBe('グラフビュー'))
    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true })
    await waitFor(() => expect(selectedTabName()).toBe('B'))

    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    const editor = await screen.findByRole('textbox', { name: 'Markdown編集欄' })
    editor.focus()
    expect(fireEvent.keyDown(editor, { key: 'w', ctrlKey: true })).toBe(false)
    expect(screen.getByRole('tab', { name: 'B' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '設定' }))
    const settingsDialog = await screen.findByRole('dialog', { name: '設定' })
    expect(fireEvent.keyDown(window, { key: 'w', ctrlKey: true })).toBe(false)
    expect(screen.getByRole('tab', { name: 'B' })).toBeTruthy()
    fireEvent.keyDown(settingsDialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '設定' })).toBeNull())

    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: 'B' })).toBeNull()
      expect(selectedTabName()).toBe('グラフビュー')
      expect(document.activeElement).toBe(
        screen.getByRole('tab', { name: 'グラフビュー' })
      )
    })
    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    await waitFor(() => expect(selectedTabName()).toBe('A'))
    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    expect(
      await screen.findByRole('region', { name: '開いているタブはありません' })
    ).toBeTruthy()
  })

  it('keeps Global Graph as a workspace tab after opening a note in a new tab', async () => {
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '[[B]]' }, noteB, noteC]
      }
    })

    render(<App />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'グラフビュー' }))[0])

    expect(
      (await screen.findByRole('tab', { name: 'グラフビュー' })).getAttribute(
        'aria-selected'
      )
    ).toBe('true')
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'B（リンク先）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: '新規タブに開く' }))

    expect(
      (await screen.findByRole('tab', { name: 'B' })).getAttribute('aria-selected')
    ).toBe('true')
    expect(
      screen.getByRole('tab', { name: 'グラフビュー' }).getAttribute('aria-selected')
    ).toBe('false')

    fireEvent.click(screen.getByRole('tab', { name: 'グラフビュー' }))
    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'Vault全体グラフ' })
      ).toBeTruthy()
    })
    expect(
      screen.getByRole('tab', { name: 'グラフビュー' }).getAttribute('aria-selected')
    ).toBe('true')
  })

  it('opens a graph attachment in an internal workspace tab before the OS app', async () => {
    const attachment = {
      path: 'assets/diagram.svg',
      name: 'diagram.svg',
      modifiedAt: 500,
      createdAt: 400,
      size: 10
    }
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '![[assets/diagram.svg]]' }, noteB, noteC],
        attachments: [attachment]
      }
    })

    render(<App />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'グラフビュー' }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '添付書類' }))
    fireEvent.contextMenu(
      await screen.findByRole('button', { name: 'diagram.svg（添付書類）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: '新規タブに開く' }))

    expect(
      (await screen.findByRole('tab', { name: 'diagram.svg' })).getAttribute(
        'aria-selected'
      )
    ).toBe('true')
    expect(
      await screen.findByRole('region', { name: '添付ファイルプレビュー' })
    ).toBeTruthy()
    await waitFor(() => {
      expect(api.readVaultImage).toHaveBeenCalledWith('assets/diagram.svg')
    })
    expect(api.openVaultFile).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '既定のアプリで開く' }))
    await waitFor(() => {
      expect(api.openVaultFile).toHaveBeenCalledWith('assets/diagram.svg')
    })

    fireEvent.click(screen.getByRole('tab', { name: 'グラフビュー' }))
    fireEvent.contextMenu(
      await screen.findByRole('button', { name: 'diagram.svg（添付書類）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: '新規ウィンドウで開く' }))
    await waitFor(() => {
      expect(api.openVaultFileWindow).toHaveBeenCalledWith('assets/diagram.svg')
    })
  })

  it('opens an attachment linked view while preserving the graph workspace tab', async () => {
    const attachment = {
      path: 'assets/diagram.svg',
      name: 'diagram.svg',
      modifiedAt: 500,
      createdAt: 400,
      size: 10
    }
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '![[assets/diagram.svg]]' }, noteB, noteC],
        attachments: [attachment]
      }
    })

    render(<App />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'グラフビュー' }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '添付書類' }))
    fireEvent.contextMenu(
      await screen.findByRole('button', { name: 'diagram.svg（添付書類）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'リンクされたビューを開く' }))
    const linkedMenu = screen.getByRole('menu', { name: 'リンクされたビュー' })
    fireEvent.click(
      within(linkedMenu).getByRole('menuitem', { name: 'バックリンクを開く' })
    )

    expect(
      (await screen.findByRole('tab', { name: 'diagram へのバックリンク' })).getAttribute(
        'aria-selected'
      )
    ).toBe('true')
    expect(
      screen.getByRole('region', { name: 'バックリンクビュー' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'A.md' })).toBeTruthy()
    expect(
      screen.getByRole('tab', { name: 'グラフビュー' }).getAttribute('aria-selected')
    ).toBe('false')

    fireEvent.click(screen.getByRole('tab', { name: 'A' }))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe(
        'true'
      )
    })
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    await screen.findByRole('textbox', { name: 'Markdown編集欄' })
    fireEvent.click(screen.getByRole('tab', { name: 'diagram へのバックリンク' }))

    expect(
      await screen.findByRole('region', { name: 'バックリンクビュー' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'A.md' })).toBeTruthy()
  })

  it('keeps the dirty active tab when closing it cannot save', async () => {
    vi.mocked(api.saveNote).mockResolvedValue({
      ok: false,
      error: { code: 'IO_ERROR', message: '保存できません。' }
    })

    render(<App />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'グラフビュー' }))[0])
    fireEvent.click(await screen.findByRole('tab', { name: 'A' }))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe(
        'true'
      )
    })
    fireEvent.click(screen.getByRole('button', { name: '編集' }))

    const editor = await screen.findByRole('textbox', { name: 'Markdown編集欄' })
    fireEvent.change(editor, { target: { value: '保存できていない本文' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aを閉じる' }))

    await screen.findByText('保存できません。')
    expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe(
      'true'
    )
    expect(
      screen.getByRole('tab', { name: 'グラフビュー' }).getAttribute('aria-selected')
    ).toBe('false')
    expect((editor as HTMLTextAreaElement).value).toBe('保存できていない本文')
  })

  it('moves a graph attachment while preserving Global Graph and its workspace tab', async () => {
    const attachment = {
      path: 'assets/diagram.svg',
      name: 'diagram.svg',
      modifiedAt: 500,
      createdAt: 400,
      size: 10
    }
    const initialSnapshot: VaultSnapshot = {
      ...snapshot,
      directories: ['', '20_knowledge', 'assets'],
      notes: [{ ...noteA, content: '![[assets/diagram.svg]]' }, noteB, noteC],
      attachments: [attachment]
    }
    const movedPath = '20_knowledge/diagram.svg'
    const movedSnapshot: VaultSnapshot = {
      ...initialSnapshot,
      notes: initialSnapshot.notes,
      attachments: [{ ...attachment, path: movedPath }]
    }
    vi.mocked(api.openLastVault).mockResolvedValue(await ok(initialSnapshot))
    vi.mocked(api.getSnapshot).mockResolvedValue(await ok(movedSnapshot))
    vi.mocked(api.moveNote).mockResolvedValue(
      await ok({ oldPath: attachment.path, path: movedPath })
    )

    render(<App />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'グラフビュー' }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '添付書類' }))
    fireEvent.contextMenu(
      await screen.findByRole('button', { name: 'diagram.svg（添付書類）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: '新規タブに開く' }))
    await waitFor(() => {
      expect(
        screen.getByRole('tab', { name: 'diagram.svg' }).getAttribute(
          'aria-selected'
        )
      ).toBe('true')
    })
    fireEvent.click(screen.getByRole('tab', { name: 'グラフビュー' }))
    await waitFor(() => {
      expect(
        screen.getByRole('tab', { name: 'グラフビュー' }).getAttribute(
          'aria-selected'
        )
      ).toBe('true')
    })

    fireEvent.contextMenu(
      await screen.findByRole('button', { name: 'diagram.svg（添付書類）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'ファイルを移動…' }))
    fireEvent.change(screen.getByRole('combobox', { name: '移動先' }), {
      target: { value: '20_knowledge' }
    })
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'ファイルを移動' })).getByRole(
        'button',
        { name: '移動' }
      )
    )

    await waitFor(() => {
      expect(api.moveNote).toHaveBeenCalledWith({
        path: attachment.path,
        destinationDirectory: '20_knowledge'
      })
    })
    expect(api.saveNote).not.toHaveBeenCalled()
    expect(
      screen.getByRole('tab', { name: 'グラフビュー' }).getAttribute('aria-selected')
    ).toBe('true')
    expect(screen.getByRole('region', { name: 'Vault全体グラフ' })).toBeTruthy()

    vi.mocked(api.readVaultImage).mockClear()
    fireEvent.click(screen.getByRole('tab', { name: 'diagram.svg' }))
    await waitFor(() => {
      expect(api.readVaultImage).toHaveBeenCalledWith(movedPath)
    })
  })

  it('moves a file-backed graph node to trash from its context menu', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: {
        ...snapshot,
        notes: [{ ...noteA, content: '[[B]]' }, noteB, noteC]
      }
    })
    vi.mocked(api.trashEntry).mockResolvedValue(
      await ok({ path: '.trash/B.md', oldPath: 'B.md' })
    )

    render(<App />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'ローカルグラフ' })
    )
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'B（リンク先）を開く' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'ファイルを削除' }))

    await waitFor(() => {
      expect(api.trashEntry).toHaveBeenCalledWith('B.md')
    })
  })

  it('previews Google Drive changes before applying them', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Google / 同期' }))
    expect(await screen.findByText('user@example.com')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '同期内容を確認' }))

    expect(await screen.findByText('A.md')).toBeTruthy()
    expect(screen.getByText('送信 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'この内容で同期' })).toBeTruthy()
    expect(api.applyDriveSync).not.toHaveBeenCalled()
  })

  it('shows Google feature grants and enables Calendar only after explicit consent', async () => {
    api.getGoogleDriveStatus = vi.fn(() =>
      ok({
        configured: true,
        connected: true,
        account: {
          sub: 'google-user',
          name: 'TSUZUNE User',
          email: 'user@example.com',
          picture: null
        },
        authorizedFeatures: ['drive_sync'],
        lastSyncAt: null,
        vaultFolderUrl: null
      })
    )
    const authorizeGoogleCalendar = vi.fn(() =>
      ok({
        configured: true,
        connected: true,
        account: {
          sub: 'google-user',
          name: 'TSUZUNE User',
          email: 'user@example.com',
          picture: null
        },
        authorizedFeatures: ['drive_sync', 'calendar_read'],
        lastSyncAt: null,
        vaultFolderUrl: null
      })
    )
    Object.assign(api, { authorizeGoogleCalendar })

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Google / 同期' }))
    expect(await screen.findByText('Drive同期: 許可済み')).toBeTruthy()
    expect(screen.getByText('Calendar読取: 未許可')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Calendar読取を有効にする' })
    )

    await waitFor(() => {
      expect(authorizeGoogleCalendar).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('Calendar読取: 許可済み')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Calendar読取を有効にする' })
    ).toBeNull()
  })

  it('keeps Google login primary and OAuth JSON configuration behind advanced settings', async () => {
    const disconnectedStatus = {
      configured: true,
      connected: false,
      account: null,
      authorizedFeatures: [],
      lastSyncAt: null,
      vaultFolderUrl: null
    }
    api.getGoogleDriveStatus = vi.fn(() => ok(disconnectedStatus))
    api.connectGoogle = vi.fn(() => ok(disconnectedStatus))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Google / 同期' }))

    fireEvent.click(
      await screen.findByRole('button', { name: 'Googleでログイン' })
    )
    await waitFor(() => {
      expect(api.connectGoogle).toHaveBeenCalledTimes(1)
    })
    expect(api.chooseGoogleOAuthConfig).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: '独自のOAuth JSONを選ぶ' })
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '詳細設定を開く' }))
    fireEvent.click(
      screen.getByRole('button', { name: '独自のOAuth JSONを選ぶ' })
    )

    await waitFor(() => {
      expect(api.chooseGoogleOAuthConfig).toHaveBeenCalledTimes(1)
    })
  })

  it('shows Google connection errors inside the open dialog', async () => {
    api.getGoogleDriveStatus = vi.fn(() =>
      ok({
        configured: true,
        connected: false,
        account: null,
        authorizedFeatures: [],
        lastSyncAt: null,
        vaultFolderUrl: null
      })
    )
    api.connectGoogle = vi.fn(() =>
      Promise.resolve({
        ok: false,
        error: {
          code: 'UNKNOWN',
          message: 'Googleへの接続に失敗しました。'
        }
      })
    )

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Google / 同期' }))
    const dialog = await screen.findByRole('dialog', { name: 'Google Drive同期' })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Googleでログイン' })
    )

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Googleへの接続に失敗しました。')
    expect(dialog.contains(alert)).toBe(true)
  })

  it('offers OAuth JSON setup when no bundled client is available', async () => {
    api.getGoogleDriveStatus = vi.fn(() =>
      ok({
        configured: false,
        connected: false,
        account: null,
        authorizedFeatures: [],
        lastSyncAt: null,
        vaultFolderUrl: null
      })
    )

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Google / 同期' }))

    expect(
      await screen.findByRole('button', { name: 'OAuth JSONを選ぶ' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Googleでログイン' })
    ).toBeNull()
  })

  it('moves focus into the Google dialog and restores it when Escape closes', async () => {
    const { container } = render(<App />)
    const opener = await screen.findByRole('button', { name: 'Google / 同期' })
    opener.focus()

    fireEvent.click(opener)

    const dialog = await screen.findByRole('dialog', { name: 'Google Drive同期' })
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(container.querySelector('.app-header')?.hasAttribute('inert')).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Google Drive同期' })).toBeNull()
    })
    expect(document.activeElement).toBe(opener)
    expect(container.querySelector('.app-header')?.hasAttribute('inert')).toBe(false)
  })

  it('traps Tab and Shift+Tab within the Google dialog', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Google / 同期' }))

    const closeButton = await screen.findByRole('button', {
      name: 'Google Drive同期を閉じる'
    })
    const lastButton = await screen.findByRole('button', { name: '同期内容を確認' })

    closeButton.focus()
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastButton)

    fireEvent.keyDown(lastButton, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)
  })

  it('pairs the local Vault with an existing TSUZUNE Drive Vault', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Google / 同期' }))
    fireEvent.click(
      await screen.findByRole('button', { name: '既存のDrive Vaultを探す' })
    )
    expect(
      await screen.findByRole('option', { name: 'TSUZUNE - Main Vault' })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'このDrive Vaultを使う' }))

    await waitFor(() => {
      expect(api.pairDriveVault).toHaveBeenCalledWith({
        rootFolderId: 'remote-root',
        vaultId: 'remote-vault'
      })
    })
    expect(await screen.findByText('Drive Vaultを接続しました。')).toBeTruthy()
  })

  it('keeps malformed temporal metadata visible without blocking note editing', async () => {
    const malformedContent = [
      '---',
      'kind: state',
      'subject: "[[A]]"',
      'status: active',
      'valid_from: someday',
      '---',
      '# 編集できる本文'
    ].join('\n')
    const malformedSnapshot: VaultSnapshot = {
      ...snapshot,
      notes: [{ ...noteA, content: malformedContent }, noteB, noteC]
    }
    vi.mocked(api.openLastVault).mockResolvedValue({
      ok: true,
      value: malformedSnapshot
    })

    render(<App />)

    fireEvent.click(await screen.findByRole('tab', { name: '時間' }))
    expect(await screen.findByText('メタデータ不完全。本文の編集は続けられます。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    const editor = screen.getByLabelText('Markdown編集欄')
    fireEvent.change(editor, {
      target: { value: `${malformedContent}\n\n追記` }
    })

    expect((editor as HTMLTextAreaElement).value).toContain('追記')
    expect((editor as HTMLTextAreaElement).readOnly).toBe(false)
  })

  it('keeps local text recoverable when autosave reports that the note is missing', async () => {
    vi.mocked(api.saveNote).mockResolvedValue({
      ok: false,
      error: { code: 'NOT_FOUND', message: '見つかりません。' }
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const editor = await screen.findByLabelText('Markdown編集欄')

    fireEvent.change(editor, { target: { value: '失いたくない編集中の本文' } })

    await screen.findByText('別名で保存', {}, { timeout: 2_000 })
    expect((screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).value).toBe(
      '失いたくない編集中の本文'
    )
    expect(screen.getByText('A.md')).toBeTruthy()
  })

  it('freezes navigation until the current note save has finished', async () => {
    let resolveSave:
      | ((result: Awaited<ReturnType<TsuzuneApi['saveNote']>>) => void)
      | null = null
    vi.mocked(api.saveNote).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        })
    )
    const { container } = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const editor = await screen.findByLabelText('Markdown編集欄')
    fireEvent.change(editor, { target: { value: '保存待ちのA' } })

    const noteButton = (name: string): HTMLButtonElement => {
      const button = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button.tree-note')
      ).find((candidate) => candidate.textContent?.includes(name))
      if (!button) {
        throw new Error(`${name} button was not found`)
      }
      return button
    }

    fireEvent.click(noteButton('B'))
    await waitFor(() => {
      expect((screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).readOnly).toBe(
        true
      )
    })
    fireEvent.click(noteButton('C'))

    await act(async () => {
      resolveSave?.({
        ok: true,
        value: {
          path: 'A.md',
          modifiedAt: 101,
          size: 13
        }
      })
    })

    await waitFor(() => {
      expect(
        container.querySelector<HTMLButtonElement>('button.tree-note.is-selected')
          ?.textContent
      ).toContain('B')
    })
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    expect((screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).value).toBe(
      'Bの本文'
    )
  })
})
