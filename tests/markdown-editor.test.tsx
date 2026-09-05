// @vitest-environment jsdom

import React, { createRef } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import MarkdownEditor, { type MarkdownEditorHandle } from '../src/renderer/components/MarkdownEditor'

afterEach(cleanup)

describe('MarkdownEditor navigation', () => {
  it('adds an unchecked property, accepts a checked value, and deletes it through the existing form', () => {
    const onChange = vi.fn()
    const { rerender } = render(<MarkdownEditor value="本文" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'プロパティを追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ名' }), { target: { value: 'done' } })
    fireEvent.change(screen.getByRole('combobox', { name: '新しいプロパティの型' }), { target: { value: 'checkbox' } })
    const checkbox = screen.getByRole('checkbox', { name: '新しいプロパティ値' }) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    expect(screen.queryByText(/数値は 12/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '追加を確定' }))
    expect(onChange).toHaveBeenLastCalledWith('---\ndone: false\n---\n本文')
    rerender(<MarkdownEditor value={'---\ndone: false\n---\n本文'} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'プロパティを追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ名' }), { target: { value: 'favorite' } })
    fireEvent.change(screen.getByRole('combobox', { name: '新しいプロパティの型' }), { target: { value: 'checkbox' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '新しいプロパティ値' }))
    fireEvent.click(screen.getByRole('button', { name: '追加を確定' }))
    const added = '---\ndone: false\nfavorite: true\n---\n本文'
    expect(onChange).toHaveBeenLastCalledWith(added)
    rerender(<MarkdownEditor value={added} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'doneを削除' }))
    expect(onChange).toHaveBeenLastCalledWith('---\nfavorite: true\n---\n本文')
  })

  it.each([{ readOnly: true }, { propertiesReadOnly: true }])('blocks checkbox mutations while read-only: %o', (props) => {
    const onChange = vi.fn()
    render(<MarkdownEditor value={'---\ndone: false\n---\n本文'} onChange={onChange} {...props} />)
    const checkbox = screen.getByRole('checkbox', { name: 'done' }) as HTMLInputElement
    expect(checkbox.disabled || checkbox.getAttribute('aria-disabled') === 'true').toBe(true)
    fireEvent.click(checkbox)
    expect(onChange).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'doneを削除' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps malformed YAML warnings visible and does not offer checkbox mutations', () => {
    render(<MarkdownEditor value={'---\ndone: true\nmissing delimiter'} onChange={vi.fn()} />)
    expect(screen.getByRole('alert').textContent).toContain('YAMLを安全に読み取れない')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect((screen.getByRole('button', { name: 'プロパティを追加' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('toggles an existing boolean with a checkbox while retaining quoted text and surrounding bytes', () => {
    const source = '\uFEFF---\r\ndone: false  # keep\r\nquoted: "true"\r\n---\r\n本文\r\n'
    const onChange = vi.fn()
    const { rerender } = render(<MarkdownEditor value={source} onChange={onChange} />)
    const checkbox = screen.getByRole('checkbox', { name: 'done' }) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    checkbox.focus()
    fireEvent.click(checkbox)
    const changed = source.replace('done: false', 'done: true')
    expect(onChange).toHaveBeenLastCalledWith(changed)
    rerender(<MarkdownEditor value={changed} onChange={onChange} />)
    expect((screen.getByRole('checkbox', { name: 'done' }) as HTMLInputElement).checked).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'done' }))
    onChange.mockClear()
    rerender(<MarkdownEditor value={changed} onChange={onChange} propertiesReadOnly />)
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'done' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'done' }))
    expect(onChange).not.toHaveBeenCalled()
    expect((screen.getByRole('checkbox', { name: 'done' }) as HTMLInputElement).checked).toBe(true)
    rerender(<MarkdownEditor value={changed} onChange={onChange} />)
    expect(screen.queryByRole('checkbox', { name: 'quoted' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'done' }))
    expect(onChange).toHaveBeenLastCalledWith(source)
  })

  it('keeps excluded link candidates but places them after ordinary notes', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={vi.fn()}
        notes={[
          {
            path: '80_excluded/Hidden.md',
            name: 'Hidden',
            content: '',
            modifiedAt: 1,
            size: 1
          },
          {
            path: 'Visible.md',
            name: 'Visible',
            content: '',
            modifiedAt: 1,
            size: 1
          }
        ]}
        deprioritizedPaths={new Set(['80_excluded/Hidden.md'])}
      />
    )

    const options = within(
      screen.getByRole('combobox', { name: '関連ノートを挿入' })
    ).getAllByRole('option') as HTMLOptionElement[]
    expect(options.map((option) => option.value)).toEqual([
      '',
      'Visible.md',
      '80_excluded/Hidden.md'
    ])
  })

  it('scrollToOffset preserves read-only content and moves the selection', () => {
    const content = '# 見出し\n\n本文です'
    const ref = createRef<MarkdownEditorHandle>()
    const onChange = vi.fn()
    const { container } = render(
      <MarkdownEditor ref={ref} value={content} onChange={onChange} readOnly />
    )

    const editor = container.querySelector('.cm-editor') as HTMLElement
    const textBefore = editor.querySelector('.cm-content')?.textContent
    const target = content.indexOf('本文')
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')

    ref.current?.scrollToOffset(target)

    expect(editor.querySelector('.cm-content')?.textContent).toBe(textBefore)
    expect(EditorView.findFromDOM(editor)?.state.selection.main.anchor).toBe(target)
    expect(focus).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    focus.mockRestore()
  })

  it('imports attachments and inserts Obsidian-compatible embeds at the cursor', async () => {
    const onChange = vi.fn()
    render(
      <MarkdownEditor
        value="本文"
        onChange={onChange}
        onImportAttachments={async () => [
          'attachments/image.png',
          'attachments/paper.pdf'
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '添付ファイルを挿入' }))

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        '![[attachments/image.png]]\n![[attachments/paper.pdf]]\n本文'
      )
    })
  })
})

describe('MarkdownEditor properties', () => {
  it.each(['', '01', '1e3', 'NaN', '1 + 2'])('keeps invalid numeric input %j in the form without changing source', (input) => {
    const onChange = vi.fn()
    render(<MarkdownEditor value={'---\namount: 2.50\n---\nBody'} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'amountを編集' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'amountの値' }), { target: { value: input } })
    fireEvent.click(screen.getByRole('button', { name: 'amountの変更を確定' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'amountの値' }) as HTMLTextAreaElement).value).toBe(input)
  })

  it('requires a valid number after explicitly switching a list item type', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor value={'---\nitems: ["word"]\n---\nBody'} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'itemsを編集' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'itemsの値の項目1の型' }), { target: { value: 'number' } })
    fireEvent.click(screen.getByRole('button', { name: 'itemsの変更を確定' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'itemsの値の項目1' }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'itemsの変更を確定' }))
    expect(onChange).toHaveBeenCalledWith('---\nitems:\n  - 2\n---\nBody')
  })

  it('blocks list draft submission during save and discards it on external source replacement', () => {
    const onChange = vi.fn()
    const source = '---\nitems: ["old"]\n---\nBody'
    const { rerender } = render(<MarkdownEditor value={source} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'itemsを編集' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'itemsの値の項目1' }), { target: { value: 'draft' } })
    rerender(<MarkdownEditor value={source} onChange={onChange} propertiesReadOnly />)
    expect((screen.getByRole('button', { name: 'itemsの値に項目を追加' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(screen.getByRole('button', { name: 'itemsの変更を確定' }).closest('form')!)
    expect(onChange).not.toHaveBeenCalled()
    rerender(<MarkdownEditor value={source.replace('old', 'external')} onChange={onChange} />)
    expect(screen.queryByRole('textbox', { name: 'itemsの値の項目1' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'itemsを編集' }))
    expect((screen.getByRole('textbox', { name: 'itemsの値の項目1' }) as HTMLTextAreaElement).value).toBe('external')
  })

  it('edits list elements with their existing types, preserves a no-op, and deletes the property', () => {
    const onChange = vi.fn()
    const source = '---\nitems: ["42", 2, "first\\nsecond", ""]\nnext: keep\n---\nBody'
    const { rerender } = render(<MarkdownEditor value={source} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'itemsを編集' }))
    expect((screen.getByRole('combobox', { name: 'itemsの値の項目1の型' }) as HTMLSelectElement).value).toBe('text')
    expect((screen.getByRole('combobox', { name: 'itemsの値の項目2の型' }) as HTMLSelectElement).value).toBe('number')
    expect((screen.getByRole('textbox', { name: 'itemsの値の項目3' }) as HTMLTextAreaElement).value).toBe('first\nsecond')
    expect((screen.getByRole('textbox', { name: 'itemsの値の項目4' }) as HTMLTextAreaElement).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'itemsの変更を確定' }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'itemsを編集' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'itemsの値の項目2' }), { target: { value: '3.50' } })
    fireEvent.click(screen.getByRole('button', { name: 'itemsの値の項目4を削除' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'itemsの値に項目を追加' }))
    fireEvent.click(screen.getByRole('button', { name: 'itemsの変更を確定' }))
    const changed = '---\nitems:\n  - "42"\n  - 3.50\n  - "first\\nsecond"\nnext: keep\n---\nBody'
    expect(onChange).toHaveBeenLastCalledWith(changed)
    rerender(<MarkdownEditor value={changed} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'itemsを削除' }))
    expect(onChange).toHaveBeenLastCalledWith('---\nnext: keep\n---\nBody')
  })

  it('adds a list with explicit text and number items, retaining empty and multiline text', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor value="Body" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'プロパティを追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ名' }), { target: { value: 'items' } })
    fireEvent.change(screen.getByRole('combobox', { name: '新しいプロパティの型' }), { target: { value: 'list' } })
    fireEvent.click(screen.getByRole('button', { name: '新しいプロパティ値に項目を追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ値の項目1' }), { target: { value: '42' } })
    fireEvent.click(screen.getByRole('button', { name: '新しいプロパティ値に項目を追加' }))
    fireEvent.change(screen.getByRole('combobox', { name: '新しいプロパティ値の項目2の型' }), { target: { value: 'number' } })
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ値の項目2' }), { target: { value: '42' } })
    fireEvent.click(screen.getByRole('button', { name: '新しいプロパティ値に項目を追加' }))
    fireEvent.click(screen.getByRole('button', { name: '新しいプロパティ値に項目を追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ値の項目4' }), { target: { value: 'first\nsecond' } })
    fireEvent.click(screen.getByRole('button', { name: '追加を確定' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const output = onChange.mock.calls[0][0] as string
    expect(output).toContain('"42"')
    expect(output).toMatch(/(?:- |, )42(?:\n|,|\])/)
    expect(output).toContain('""')
    expect(output).toContain('"first\\nsecond"')
    expect(output.endsWith('---\nBody')).toBe(true)
  })

  it('adds a decimal number without quoting or rounding it, then edits and deletes it', () => {
    const onChange = vi.fn()
    const original = '\uFEFF---\r\nlabel: "42"\r\n---\r\nBody'
    const { rerender } = render(<MarkdownEditor value={original} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'プロパティを追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ名' }), { target: { value: 'amount' } })
    fireEvent.change(screen.getByRole('combobox', { name: '新しいプロパティの型' }), { target: { value: 'number' } })
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ値' }), { target: { value: '9007199254740993.123456789' } })
    fireEvent.click(screen.getByRole('button', { name: '追加を確定' }))
    const added = original.replace('label: "42"\r\n', 'label: "42"\r\namount: 9007199254740993.123456789\r\n')
    expect(onChange).toHaveBeenLastCalledWith(added)
    rerender(<MarkdownEditor value={added} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'amountを編集' }))
    expect((screen.getByRole('textbox', { name: 'amountの値' }) as HTMLTextAreaElement).value).toBe('9007199254740993.123456789')
    fireEvent.change(screen.getByRole('textbox', { name: 'amountの値' }), { target: { value: '-12.50' } })
    fireEvent.click(screen.getByRole('button', { name: 'amountの変更を確定' }))
    const changed = added.replace('9007199254740993.123456789', '-12.50')
    expect(onChange).toHaveBeenLastCalledWith(changed)
    rerender(<MarkdownEditor value={changed} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'amountを削除' }))
    expect(onChange).toHaveBeenLastCalledWith(original)
  })

  it('shows an existing prototype-named key and refuses to overwrite it through add', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor value={'---\n__proto__: preserved\n---\nBody'} onChange={onChange} />)
    expect(screen.getByText('__proto__')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'プロパティを追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ名' }), { target: { value: '__proto__' } })
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ値' }), { target: { value: 'overwrite' } })
    fireEvent.click(screen.getByRole('button', { name: '追加を確定' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('同じ名前')
  })

  it('keeps escaped line breaks when an existing text property is opened and committed unchanged', () => {
    const onChange = vi.fn()
    const value = '---\nsummary: "first\\nsecond"\n---\nBody'
    render(<MarkdownEditor value={value} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'summaryを編集' }))
    expect((screen.getByRole('textbox', { name: 'summaryの値' }) as HTMLTextAreaElement).value).toBe('first\nsecond')
    fireEvent.click(screen.getByRole('button', { name: 'summaryの変更を確定' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('deletes a scalar and returns focus to the add button', () => {
    const onChange = vi.fn()
    const value = '---\nstatus: active\nkind: state\n---\n# Body'
    render(<MarkdownEditor value={value} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'statusを削除' }))
    expect(onChange).toHaveBeenCalledWith('---\nkind: state\n---\n# Body')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'プロパティを追加' }))
  })

  it('does not replace an existing property through the add form', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor value={'---\nstatus: active\n---\n本文'} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'プロパティを追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ名' }), { target: { value: 'status' } })
    fireEvent.click(screen.getByRole('button', { name: '追加を確定' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('同じ名前')
  })

  it('opens an indentless list with a header comment and preserves an unchanged commit', () => {
    const onChange = vi.fn()
    const value = '---\nitems: # list description\n- "42"\n- -2.50\nnext: unchanged\n---\nBody'
    render(<MarkdownEditor value={value} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'itemsを編集' }))
    expect((screen.getByRole('combobox', { name: 'itemsの値の項目1の型' }) as HTMLSelectElement).value).toBe('text')
    expect((screen.getByRole('combobox', { name: 'itemsの値の項目2の型' }) as HTMLSelectElement).value).toBe('number')
    expect((screen.getByRole('textbox', { name: 'itemsの値の項目2' }) as HTMLTextAreaElement).value).toBe('-2.50')
    fireEvent.click(screen.getByRole('button', { name: 'itemsの変更を確定' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps unsupported values visible but disables their mutation', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor value={'---\nstatus: active\ntags: yes\n---\n本文'} onChange={onChange} />)
    expect((screen.getByRole('button', { name: 'tagsを編集' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'tagsを削除' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'statusを編集' }) as HTMLButtonElement).disabled).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('discards a pending property draft when the source changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(<MarkdownEditor value={'---\nstatus: active\n---\n本文'} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'statusを編集' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'statusの値' }), { target: { value: 'old draft' } })
    rerender(<MarkdownEditor value={'---\nstatus: external\n---\n本文'} onChange={onChange} />)
    expect(screen.queryByRole('textbox', { name: 'statusの値' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'statusを編集' }))
    expect((screen.getByRole('textbox', { name: 'statusの値' }) as HTMLInputElement).value).toBe('external')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('blocks property submits while busy without disabling source editing', () => {
    const onChange = vi.fn()
    const { rerender } = render(<MarkdownEditor value="本文" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'プロパティを追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ名' }), { target: { value: 'status' } })
    rerender(<MarkdownEditor value="本文" onChange={onChange} propertiesReadOnly />)
    fireEvent.submit(screen.getByRole('button', { name: '追加を確定' }).closest('form')!)
    expect(onChange).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'プロパティを追加' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('adds a scalar property through the editor surface', () => {
    const onChange = vi.fn()
    const value = ['---', 'kind: state', '---', '# Body'].join('\n')
    render(<MarkdownEditor value={value} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'プロパティを追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ名' }), {
      target: { value: 'status' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ値' }), {
      target: { value: 'active' }
    })
    fireEvent.click(screen.getByRole('button', { name: '追加を確定' }))

    expect(onChange).toHaveBeenCalledWith(
      ['---', 'kind: state', 'status: "active"', '---', '# Body'].join('\n')
    )
  })

  it('edits an existing scalar property through the editor surface', () => {
    const onChange = vi.fn()
    const value = ['---', 'kind: state', 'status: active', '---', '# Body'].join(
      '\n'
    )
    render(<MarkdownEditor value={value} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'statusを編集' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'statusの値' }), {
      target: { value: 'complete' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'statusの変更を確定' }))

    expect(onChange).toHaveBeenCalledWith(
      value.replace('status: active', 'status: "complete"')
    )
  })
})
