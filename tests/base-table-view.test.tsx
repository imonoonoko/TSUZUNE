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
  it('renders cards and filters them with the Base-local search box', () => {
    const base = parseBaseProfile(`views:\n - {type: cards, name: Tasks, order: [file.name, status]}\n`)
    if (!base.ok) throw new Error(base.diagnostics[0].message)
    const notes = [note, { ...note, path: 'B.md', name: 'B.md', content: '---\nstatus: done\n---' }]
    render(<BaseTableView state={{ status: 'ready', path: 'Tasks.base', profile: base.profile, evaluation: evaluateBase(base.profile, notes) }} onReload={vi.fn()} onOpenNote={vi.fn()} />)
    expect(screen.getAllByRole('article')).toHaveLength(2)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Base内を検索' }), { target: { value: 'done' } })
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('B.md')).toBeTruthy()
  })
  it('lets the profile editor switch a view to Kanban before previewing its saved YAML', async () => {
    const preview = vi.fn().mockResolvedValue(true)
    render(<BaseSettingsPanel content={content} profile={profile()} selectedView={0} onPreview={preview} onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox', { name: '表示形式' }), { target: { value: 'kanban' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'グループProperty' }), { target: { value: 'status' } })
    fireEvent.click(screen.getByRole('button', { name: '下書きをプレビュー' }))
    await waitFor(() => expect(preview).toHaveBeenCalled())
    expect(preview.mock.calls[0][0]).toContain('type: "kanban"')
    expect(preview.mock.calls[0][0]).toContain('groupBy')
  })
  it('routes a Kanban card drop to the preview callback and disables dragging in read-only panes', () => {
    const parsed = parseBaseProfile('views:\n - {type: kanban, name: Board, order: [file.name], groupBy: {property: status}}\n')
    if (!parsed.ok) throw new Error(parsed.diagnostics[0].message)
    const notes = [note, { ...note, path: 'B.md', name: 'B.md', content: '---\nstatus: done\n---' }]
    const callback = vi.fn()
    const state = { status: 'ready' as const, path: 'Board.base', profile: parsed.profile, evaluation: evaluateBase(parsed.profile, notes), notes, viewIndex: 0 }
    const { container, rerender } = render(<BaseTableView state={state} onReload={vi.fn()} onOpenNote={vi.fn()} onMoveCard={callback} />)
    const card = [...container.querySelectorAll('.base-card')].find(item => item.textContent?.includes('A.md')) as HTMLElement
    expect(card.draggable).toBe(true)
    const dataTransfer = { effectAllowed: 'none', types: ['application/x-tsuzune-kanban-card'], setData: vi.fn(), getData: vi.fn(() => 'A.md') }
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true }); Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer }); card.dispatchEvent(dragStart)
    const drop = new Event('drop', { bubbles: true, cancelable: true }); Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer }); container.querySelectorAll('.base-kanban-column')[0].dispatchEvent(drop)
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-tsuzune-kanban-card', 'A.md')
    expect(callback).toHaveBeenCalledWith('A.md', { kind: 'set', property: 'status', value: { type: 'text', value: 'done' } })
    callback.mockClear()
    const unrelatedData = { effectAllowed: 'none', types: ['text/plain'], setData: vi.fn(), getData: vi.fn(() => 'A.md') }
    const unrelatedDrop = new Event('drop', { bubbles: true, cancelable: true }); Object.defineProperty(unrelatedDrop, 'dataTransfer', { value: unrelatedData }); container.querySelectorAll('.base-kanban-column')[0].dispatchEvent(unrelatedDrop)
    expect(callback).not.toHaveBeenCalled()
    rerender(<BaseTableView state={state} onReload={vi.fn()} onOpenNote={vi.fn()} onMoveCard={callback} editingDisabled />)
    expect((container.querySelector('.base-card') as HTMLElement).draggable).toBe(false)
  })
  it('routes a folder-card drop only through the saved Base move callback and offers a keyboard target selector', () => {
    const parsed = parseBaseProfile('views:\n - {type: kanban, name: Folders, order: [file.name], groupBy: {property: file.folder}}\n')
    if (!parsed.ok) throw new Error(parsed.diagnostics[0].message)
    const notes = [{ ...note, path: 'A.md', name: 'A.md' }, { ...note, path: 'folder/B.md', name: 'B.md' }]
    const callback = vi.fn()
    const state = { status: 'ready' as const, path: 'Folders.base', revision: 'rev-1', profile: parsed.profile, evaluation: evaluateBase(parsed.profile, notes), notes, viewIndex: 0 }
    const { container } = render(<BaseTableView state={state} onReload={vi.fn()} onOpenNote={vi.fn()} onMoveFile={callback} />)
    const card = [...container.querySelectorAll('.base-kanban-column .base-card')].find(item => item.textContent?.includes('B.md')) as HTMLElement
    const dataTransfer = { effectAllowed: 'none', types: ['application/x-tsuzune-kanban-file'], setData: vi.fn(), getData: vi.fn(() => 'folder/B.md') }
    const drag = new Event('dragstart', { bubbles: true, cancelable: true }); Object.defineProperty(drag, 'dataTransfer', { value: dataTransfer }); card.dispatchEvent(drag)
    const target = [...container.querySelectorAll('.base-kanban-column')].find(section => section.textContent?.includes('ルート')) ?? container.querySelectorAll('.base-kanban-column')[1]
    const drop = new Event('drop', { bubbles: true, cancelable: true }); Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer }); target.dispatchEvent(drop)
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-tsuzune-kanban-file', 'folder/B.md')
    expect(callback).toHaveBeenCalledWith(state, 'folder/B.md', '')
    callback.mockClear()
    const selector = screen.getByRole('combobox', { name: 'folderへファイルを移動' })
    fireEvent.focus(selector)
    fireEvent.change(selector, { target: { value: 'A.md' } })
    expect(callback).toHaveBeenCalledWith(state, 'A.md', 'folder')
  })
  it('hides hidden Kanban groups and excludes their notes from per-column file selectors', () => {
    const parsed = parseBaseProfile('views:\n - {type: kanban, name: Folders, order: [file.name], groupBy: {property: file.folder, hidden: [folder]}}\n')
    if (!parsed.ok) throw new Error(parsed.diagnostics[0].message)
    const notes = [{ ...note, path: 'A.md', name: 'A.md' }, { ...note, path: 'folder/B.md', name: 'B.md' }, { ...note, path: 'other/C.md', name: 'C.md' }]
    const state = { status: 'ready' as const, path: 'Folders.base', revision: 'rev-1', profile: parsed.profile, evaluation: evaluateBase(parsed.profile, notes), notes, viewIndex: 0 }
    const { container } = render(<BaseTableView state={state} onReload={vi.fn()} onOpenNote={vi.fn()} onMoveFile={vi.fn()} />)
    expect(container.querySelectorAll('.base-kanban-column')).toHaveLength(2)
    const selector = container.querySelector('.base-kanban-column select') as HTMLSelectElement
    fireEvent.focus(selector)
    const options = [...selector.querySelectorAll('option')].map(option => option.textContent)
    expect(options).not.toContain('folder/B.md')
  })
  it('lets keyboard controls reorder Kanban columns in a previewable YAML draft', async () => {
    const parsed = parseBaseProfile('views:\n - {type: kanban, name: Board, order: [file.name], groupBy: {property: status, hidden: [secret]}, groupOrder: [open, secret, done]}\n')
    if (!parsed.ok) throw new Error(parsed.diagnostics[0].message)
    const preview = vi.fn().mockResolvedValue(true)
    render(<BaseSettingsPanel content={'views:\n - {type: kanban, name: Board, order: [file.name], groupBy: {property: status, hidden: [secret]}, groupOrder: [open, secret, done]}\n'} profile={parsed.profile} selectedView={0} groupValues={['open', 'secret', 'done']} groupValuesProperty="status" onPreview={preview} onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'done列を上へ' }))
    fireEvent.click(screen.getByRole('button', { name: '下書きをプレビュー' }))
    await waitFor(() => expect(preview).toHaveBeenCalled())
    expect(preview.mock.calls[0][0]).toContain('groupOrder')
    expect(preview.mock.calls[0][0].indexOf('done')).toBeLessThan(preview.mock.calls[0][0].indexOf('open'))
    expect(preview.mock.calls[0][0]).toContain('secret')
  })
})
