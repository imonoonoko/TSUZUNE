// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BookmarkDialog from '../src/renderer/components/BookmarkDialog'

afterEach(cleanup)

describe('BookmarkDialog', () => {
  it('captures an optional title and group for a new bookmark', async () => {
    const onSave = vi.fn(async () => undefined)

    render(
      <BookmarkDialog
        path="attachments/diagram.svg"
        onCancel={() => undefined}
        onSave={onSave}
        onDelete={async () => undefined}
      />
    )

    expect(
      screen.getByRole('dialog', { name: 'ブックマークを追加' })
    ).toBeTruthy()
    expect(screen.getByLabelText('タイトル')).toHaveProperty(
      'placeholder',
      'diagram.svg'
    )
    expect(document.activeElement).toBe(screen.getByLabelText('タイトル'))

    fireEvent.change(screen.getByLabelText('タイトル'), {
      target: { value: '構成図' }
    })
    fireEvent.change(screen.getByLabelText('Bookmark group'), {
      target: { value: '資料' }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('構成図', '資料'))
  })

  it('edits or removes one existing bookmark and restores focus', async () => {
    const onDelete = vi.fn()

    function Harness(): React.JSX.Element {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            ブックマークを開く
          </button>
          {open && (
            <BookmarkDialog
              path="attachments/diagram.svg"
              bookmark={{
                type: 'file',
                path: 'attachments/diagram.svg',
                title: '構成図',
                group: '資料',
                ctime: 1
              }}
              onCancel={() => setOpen(false)}
              onSave={async () => undefined}
              onDelete={async () => {
                onDelete()
                setOpen(false)
              }}
            />
          )}
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'ブックマークを開く' })
    opener.focus()
    fireEvent.click(opener)

    expect(
      screen.getByRole('dialog', { name: 'ブックマークを編集' })
    ).toBeTruthy()
    expect(screen.getByLabelText('タイトル')).toHaveProperty('value', '構成図')
    expect(screen.getByLabelText('Bookmark group')).toHaveProperty('value', '資料')
    fireEvent.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledOnce()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(opener)
    })
  })
})
