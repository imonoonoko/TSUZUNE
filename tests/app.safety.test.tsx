// @vitest-environment jsdom

import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
let api: TsuzuneApi

function ok<T>(value: T): Promise<Result<T>> {
  return Promise.resolve({ ok: true, value })
}

beforeEach(() => {
  vaultChanged = null
  updateStatusChanged = null
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
    trashEntry: vi.fn(),
    setLastNote: vi.fn(() => ok(null)),
    setUserIgnoreFilters: vi.fn(() => ok(null)),
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
    onRequestClose: vi.fn(() => () => undefined),
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
  it('batches a burst of external file events into one Vault refresh', async () => {
    vi.mocked(api.readNote).mockResolvedValue(
      await ok({ ...noteA, content: '外部で更新された本文', modifiedAt: 400 })
    )

    render(<App />)
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

  it('focuses Vault search with Ctrl+K', async () => {
    render(<App />)
    const editor = await screen.findByLabelText('Markdown編集欄')
    editor.focus()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(document.activeElement).toBe(
      screen.getByPlaceholderText('Vaultを検索')
    )
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

    expect(
      await screen.findByRole('button', { name: 'B（現在のノート）' })
    ).toBeTruthy()
    expect(api.setLastNote).toHaveBeenCalledWith('B.md')
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
    expect(screen.getByRole('searchbox', { name: 'ファイルを検索…' })).toBeTruthy()
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
      (screen.getByRole('textbox', { name: 'Vaultを検索' }) as HTMLInputElement)
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

    expect(await screen.findByText('メタデータ不完全。本文の編集は続けられます。')).toBeTruthy()
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
    expect((screen.getByLabelText('Markdown編集欄') as HTMLTextAreaElement).value).toBe(
      'Bの本文'
    )
  })
})
