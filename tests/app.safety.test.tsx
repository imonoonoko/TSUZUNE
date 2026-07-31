// @vitest-environment jsdom

import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
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
let api: TsuzuneApi

function ok<T>(value: T): Promise<Result<T>> {
  return Promise.resolve({ ok: true, value })
}

beforeEach(() => {
  vaultChanged = null
  api = {
    chooseVault: vi.fn(() => ok(null)),
    openLastVault: vi.fn(() => ok(snapshot)),
    getSettings: vi.fn(() =>
      ok({
        lastVaultPath: snapshot.rootPath,
        lastNotePath: noteA.path
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
    openExternal: vi.fn(() => ok(null)),
    confirmClose: vi.fn(),
    onVaultChanged: vi.fn((callback) => {
      vaultChanged = callback
      return () => undefined
    }),
    onRequestClose: vi.fn(() => () => undefined)
  } as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', {
    configurable: true,
    value: api
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App data-loss guards', () => {
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

    fireEvent.click(await screen.findByRole('button', { name: 'グラフ' }))
    const linkedNote = await screen.findByRole('button', {
      name: 'B（リンク先）を開く'
    })
    fireEvent.click(linkedNote)

    expect(
      await screen.findByRole('button', { name: 'B（現在のノート）' })
    ).toBeTruthy()
    expect(api.setLastNote).toHaveBeenCalledWith('B.md')
  })

  it('switches the local graph between one and two hops', async () => {
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

    fireEvent.click(await screen.findByRole('button', { name: 'グラフ' }))
    expect(
      screen.getByRole('button', { name: 'B（リンク先）を開く' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'C（関連ノート）を開く' })
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '深度2' }))

    expect(
      await screen.findByRole('button', { name: 'C（関連ノート）を開く' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'D（関連ノート）を開く' })
    ).toBeNull()
  })

  it('switches between the local and Vault graph and reveals orphan notes explicitly', async () => {
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

    fireEvent.click(await screen.findByRole('button', { name: 'グラフ' }))
    expect(screen.queryByRole('button', { name: 'C（関連ノート）を開く' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Vault全体' }))

    expect(
      await screen.findByRole('button', { name: 'C（関連ノート）を開く' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'D（関連ノート）を開く' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '孤立（関連ノート）を開く' })).toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: '孤立ノートを表示' }))

    expect(
      await screen.findByRole('button', { name: '孤立（関連ノート）を開く' })
    ).toBeTruthy()
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
