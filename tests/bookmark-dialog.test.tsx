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

  it('passes a heading target when saving a heading bookmark', async () => {
    const onSave = vi.fn(async () => undefined)
    render(<BookmarkDialog path="A.md" headings={[{ slug: 'section', title: '節' }]}
      onCancel={() => undefined} onSave={onSave} onDelete={async () => undefined} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'ブックマークの種類' }), { target: { value: 'heading' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('', '', {
      type: 'heading', path: 'A.md', slug: 'section', headingTitle: '節'
    }))
  })

  it('passes a search target when saving a search bookmark', async () => {
    const onSave = vi.fn(async () => undefined)
    render(<BookmarkDialog query="tag:project" onCancel={() => undefined}
      onSave={onSave} onDelete={async () => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('', '', {
      type: 'search', query: 'tag:project'
    }))
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

  it('closes only when the backdrop itself is clicked', () => {
    const onCancel = vi.fn()
    render(
      <BookmarkDialog
        path="A.md"
        onCancel={onCancel}
        onSave={async () => undefined}
        onDelete={async () => undefined}
      />
    )
    const backdrop = document.querySelector('.modal-backdrop') as HTMLElement
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('ignores a backdrop click while saving', () => {
    const onCancel = vi.fn()
    let resolveSave: () => void = () => undefined
    render(
      <BookmarkDialog
        path="A.md"
        onCancel={onCancel}
        onSave={() => new Promise<void>((resolve) => { resolveSave = resolve })}
        onDelete={async () => undefined}
      />
    )
    const backdrop = document.querySelector('.modal-backdrop') as HTMLElement
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    fireEvent.click(backdrop)
    expect(onCancel).not.toHaveBeenCalled()
    resolveSave()
  })
})
