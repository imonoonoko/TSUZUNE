// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BaseTableView from '../src/renderer/components/BaseTableView'
import BaseSettingsPanel from '../src/renderer/components/BaseSettingsPanel'
import { parseBaseProfile } from '../src/core/base-profile'
import { evaluateBase } from '../src/core/base-evaluator'
const content = '# keep\ncustom: retained\nformulas: {price: "1+2"}\nviews:\n - {type: table, name: Main, order: [file.name, status, formula.price]}\n - {type: table, name: Second, order: [file.path]}\n'
function profile() { const result = parseBaseProfile(content); if (!result.ok) throw new Error(result.diagnostics[0].message); return result.profile }
const note = { path: 'A.md', name: 'A.md', content: '---\nstatus: open\n---', modifiedAt: 1000, size: 10 }
afterEach(cleanup)
describe('Base table and configuration controls', () => {
  it('offers multiple views, keeps note edits and makes formulas/file cells readonly', () => {
    const base = profile(); const select = vi.fn(); const edit = vi.fn(); const open = vi.fn()
    render(<BaseTableView state={{ status: 'ready', path: 'A.base', profile: base, evaluation: evaluateBase(base, [note]) }} onReload={vi.fn()} onOpenNote={open} onEditCell={edit} onSelectView={select} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'ビュー' }), { target: { value: '1' } }); expect(select).toHaveBeenCalledWith(1)
    expect(screen.getAllByRole('button', { name: /を編集$/ })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'A.mdのstatusを編集' })); expect(edit).toHaveBeenCalledWith('A.md', 'status')
    fireEvent.click(screen.getByRole('button', { name: 'A.mdを開く' })); expect(open).toHaveBeenCalledWith('A.md')
  })
  it('can stop the initial loading/evaluation state', () => {
    const stop = vi.fn(); render(<BaseTableView state={{ status: 'loading', path: 'A.base' }} onReload={vi.fn()} onOpenNote={vi.fn()} evaluating onStopEvaluation={stop} />)
    fireEvent.click(screen.getByRole('button', { name: '評価を停止' })); expect(stop).toHaveBeenCalledTimes(1)
  })
  it('requires a completed draft preview before save and invalidates it on edits', async () => {
    const save = vi.fn(); const preview = vi.fn().mockResolvedValue(true)
    render(<BaseSettingsPanel content={content} profile={profile()} selectedView={0} onPreview={preview} onSave={save} onClose={vi.fn()} />)
    const button = screen.getByRole('button', { name: '確認した変更を保存' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'ビュー名' }), { target: { value: 'Edited' } })
    fireEvent.click(screen.getByRole('button', { name: '下書きをプレビュー' }))
    await waitFor(() => expect(button.disabled).toBe(false))
    expect(preview.mock.calls[0][0]).toContain('# keep'); expect(preview.mock.calls[0][0]).toContain('custom: retained')
    fireEvent.click(button); expect(save).toHaveBeenCalledWith(preview.mock.calls[0][0])
    fireEvent.change(screen.getByRole('textbox', { name: 'ビュー名' }), { target: { value: 'Another' } }); expect(button.disabled).toBe(true)
  })
  it('does not authorize stale previews or failed evaluations', async () => {
    let resolve: (value: boolean) => void = () => {}
    const preview = vi.fn(() => new Promise<boolean>((accepted) => { resolve = accepted }))
    render(<BaseSettingsPanel content={content} profile={profile()} selectedView={0} onPreview={preview} onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '下書きをプレビュー' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'ビュー名' }), { target: { value: 'Changed while evaluating' } }); resolve(true)
    await waitFor(() => expect(screen.getByRole('button', { name: '下書きをプレビュー' }).hasAttribute('disabled')).toBe(false))
    expect(screen.getByRole('button', { name: '確認した変更を保存' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '下書きをプレビュー' })); resolve(false)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('失敗'))
  })
  it('provides column, recursive condition, sort, group, formula and summary controls', () => {
    render(<BaseSettingsPanel content={content} profile={profile()} selectedView={0} onPreview={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: '追加Property' }), { target: { value: 'note.priority' } }); fireEvent.click(screen.getByRole('button', { name: '列追加' }))
    expect(screen.getByRole('textbox', { name: 'note.priorityの表示名' })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: '条件グループ追加' })[0])
    fireEvent.change(screen.getByRole('combobox', { name: '条件グループの演算' }), { target: { value: 'or' } })
    fireEvent.click(within(screen.getByRole('group', { name: '条件グループ' })).getByRole('button', { name: '条件追加' }))
    expect(screen.getByRole('textbox', { name: '条件Property' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ソート追加' })); expect(screen.getByRole('textbox', { name: 'ソート1のProperty' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'グループProperty' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'priceの式' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'note.priorityの集計' })).toBeTruthy()
  })
  it('sanitizes HTML while rendering icons, links, and readonly image values', () => {
    const base = profile(); base.view.order = ['formula.html', 'formula.icon', 'formula.link', 'formula.image']; base.formulas = { html: 'html("<b>safe</b><img src=x onerror=alert(1)><script>alert(1)</script>")', icon: 'icon("arrow-right")', link: 'link("A.md", "Open")', image: 'image("local.png")' }
    const open = vi.fn(); const { container } = render(<BaseTableView state={{ status: 'ready', path: 'A.base', profile: base, evaluation: evaluateBase(base, [note]) }} onReload={vi.fn()} onOpenNote={open} />)
    expect(container.querySelector('script')).toBeNull(); expect(container.querySelector('[onerror]')).toBeNull()
    expect(screen.getByText('safe')).toBeTruthy(); expect(screen.getByLabelText('arrow-right')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open' })); expect(open).toHaveBeenCalledWith('A.md')
    expect(screen.getByText('local.png')).toBeTruthy()
  })
})
