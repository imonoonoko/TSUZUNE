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
