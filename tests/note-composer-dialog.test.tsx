// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NoteComposerDialog from '../src/renderer/components/NoteComposerDialog'
import type { NoteComposeInput, NoteComposePreview } from '../src/shared/note-composer'

afterEach(cleanup)
const initial: NoteComposeInput = { scope: { rootPath: 'c:/vault', rootRevision: 1 }, mode: 'extract',
  sourcePath: 'Source.md', expectedSourceContent: 'Before\nSelected\nAfter', targetPath: '', targetMode: 'new',
  placement: 'append', range: { from: 7, to: 15 } }
const preview: NoteComposePreview = { fingerprint: 'proof', sourcePath: 'Source.md', targetPath: 'Target.md', updatedLinkCount: 1,
  changes: [{ path: 'Source.md', kind: 'update', before: initial.expectedSourceContent, after: 'Before\n[[Target]]\nAfter' },
    { path: 'Target.md', kind: 'create', before: null, after: 'Selected' }] }
function mount(overrides = {}) {
  const props = { initial, paths: ['Target.md'], onPreview: vi.fn(async (_input: NoteComposeInput) => preview), onApply: vi.fn(async () => {}), onClose: vi.fn(), ...overrides }
  render(<NoteComposerDialog {...props} />)
  return props
}
async function showPreview() {
  fireEvent.change(screen.getByRole('textbox', { name: '移動先ノートのパス' }), { target: { value: 'Target.md' } })
  fireEvent.click(screen.getByRole('button', { name: '変更を確認' }))
  await screen.findByRole('button', { name: '抽出を実行' })
}
describe('NoteComposerDialog', () => {
  it('previews template and exact removal choices, invalidates changes, and cancels without apply', async () => {
    const props = mount({ templates: [{ path: '90_テンプレート/抽出.md', name: '抽出' }] })
    const template = screen.getByRole('combobox', { name: '抽出先テンプレート' }) as HTMLSelectElement
    expect(template.value).toBe('')
    fireEvent.change(template, { target: { value: '90_テンプレート/抽出.md' } })
    fireEvent.change(screen.getByLabelText('元本文の残し方'), { target: { value: 'none' } })
    expect(screen.getByText(/選択範囲を削除し、元の場所には何も挿入しません/)).toBeTruthy()
    await showPreview()
    const sent = props.onPreview.mock.calls.at(-1)![0]
    expect(sent).toEqual(expect.objectContaining({ sourceReplacement: 'none', targetTemplate: { path: '90_テンプレート/抽出.md', now: expect.any(String) } }))
    expect(Number.isNaN(Date.parse(sent.targetTemplate!.now))).toBe(false)
    fireEvent.change(template, { target: { value: '' } })
    expect(screen.queryByRole('button', { name: '抽出を実行' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(props.onApply).not.toHaveBeenCalled()
  })
  it('uses a stable template date and clears it for existing destinations and merge', async () => {
    const props = mount({ templates: [{ path: '90_テンプレート/抽出.md', name: '抽出' }] })
    const choose = () => fireEvent.change(screen.getByLabelText('抽出先テンプレート'), { target: { value: '90_テンプレート/抽出.md' } })
    choose()
    expect((screen.getByLabelText('挿入位置') as HTMLSelectElement).disabled).toBe(true)
    await showPreview()
    const first = props.onPreview.mock.calls.at(-1)![0].targetTemplate
    fireEvent.change(screen.getByLabelText('移動先ノートのパス'), { target: { value: 'Other.md' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を確認' }))
    await screen.findByRole('button', { name: '抽出を実行' })
    expect(props.onPreview.mock.calls.at(-1)![0].targetTemplate).toEqual(first)
    fireEvent.change(screen.getByLabelText('移動先の種類'), { target: { value: 'existing' } })
    expect(screen.queryByLabelText('抽出先テンプレート')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '変更を確認' }))
    await screen.findByRole('button', { name: '抽出を実行' })
    expect(props.onPreview.mock.calls.at(-1)![0].targetTemplate).toBeUndefined()
    fireEvent.change(screen.getByLabelText('移動先の種類'), { target: { value: 'new' } })
    choose()
    fireEvent.change(screen.getByLabelText('操作'), { target: { value: 'merge' } })
    expect(screen.queryByLabelText('抽出先テンプレート')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '変更を確認' }))
    await screen.findByRole('button', { name: '統合を実行' })
    expect(props.onPreview.mock.calls.at(-1)![0].targetTemplate).toBeUndefined()
  })
  it('defaults to link and requires a fresh preview when the replacement changes', async () => {
    const props = mount()
    const replacement = screen.getByRole('combobox', { name: '元本文の残し方' }) as HTMLSelectElement
    expect(replacement.value).toBe('link')
    await showPreview()
    fireEvent.change(replacement, { target: { value: 'embed' } })
    expect(screen.queryByRole('button', { name: '抽出を実行' })).toBeNull()
    expect(props.onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '変更を確認' }))
    await screen.findByRole('button', { name: '抽出を実行' })
    expect(props.onPreview).toHaveBeenLastCalledWith({ ...initial, targetPath: 'Target.md', sourceReplacement: 'embed' })
    fireEvent.click(screen.getByRole('button', { name: '抽出を実行' }))
    await waitFor(() => expect(props.onApply).toHaveBeenCalledWith({ input: { ...initial, targetPath: 'Target.md', sourceReplacement: 'embed' }, fingerprint: 'proof' }))
  })
  it('requires preview, shows actual saved output and invalidates it when destination changes', async () => {
    const props = mount()
    expect(screen.queryByRole('button', { name: '抽出を実行' })).toBeNull()
    await showPreview()
    expect((screen.getByRole('textbox', { name: 'Target.mdの変更後' }) as HTMLTextAreaElement).value).toBe('Selected')
    expect(props.onPreview).toHaveBeenCalledWith({ ...initial, targetPath: 'Target.md' })
    fireEvent.change(screen.getByRole('combobox', { name: '挿入位置' }), { target: { value: 'prepend' } })
    expect(screen.queryByRole('button', { name: '抽出を実行' })).toBeNull()
    expect(props.onApply).not.toHaveBeenCalled()
  })
  it('sends only the checked input and fingerprint and cannot dismiss or apply twice while saving', async () => {
    let complete!: () => void
    const props = mount({ onApply: vi.fn(() => new Promise<void>(resolve => { complete = resolve })) })
    await showPreview()
    const apply = screen.getByRole('button', { name: '抽出を実行' })
    fireEvent.click(apply); fireEvent.click(apply)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(props.onClose).not.toHaveBeenCalled()
    expect(props.onApply).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('combobox', { name: '元本文の残し方' }) as HTMLSelectElement).disabled).toBe(true)
    expect(props.onApply).toHaveBeenCalledWith({ input: { ...initial, targetPath: 'Target.md' }, fingerprint: 'proof' })
    await act(async () => { complete() })
  })
  it('keeps choices but requires a new preview after failed apply', async () => {
    mount({ onApply: vi.fn(async () => { throw new Error('外部変更があります') }) })
    fireEvent.change(screen.getByRole('combobox', { name: '元本文の残し方' }), { target: { value: 'embed' } })
    await showPreview()
    fireEvent.click(screen.getByRole('button', { name: '抽出を実行' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '外部変更があります')
    expect((screen.getByRole('textbox', { name: '移動先ノートのパス' }) as HTMLInputElement).value).toBe('Target.md')
    expect(screen.queryByRole('button', { name: '抽出を実行' })).toBeNull()
    expect((screen.getByRole('combobox', { name: '元本文の残し方' }) as HTMLSelectElement).value).toBe('embed')
  })
  it('allows whole-note merge only into an existing note and explains trash preservation', async () => {
    const props = mount()
    fireEvent.change(screen.getByRole('combobox', { name: '操作' }), { target: { value: 'merge' } })
    expect((screen.getByRole('combobox', { name: '移動先の種類' }) as HTMLSelectElement).value).toBe('existing')
    expect(screen.getByText(/統合元はごみ箱へ/)).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: '元本文の残し方' })).toBeNull()
    fireEvent.change(screen.getByLabelText('移動先ノートのパス'), { target: { value: 'Target.md' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を確認' }))
    await waitFor(() => expect(props.onPreview).toHaveBeenCalledWith(expect.objectContaining({ mode: 'merge', targetMode: 'existing' })))
  })
  it('traps keyboard focus and closes on Escape outside an operation', () => {
    const props = mount()
    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'キャンセル' })
    close.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(within(dialog).getByRole('combobox', { name: '元本文の残し方' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
