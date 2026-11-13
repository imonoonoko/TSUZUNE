// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateBase } from '../src/core/base-evaluator'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'
import { evaluateBaseInWorker } from '../src/renderer/base-worker-client'

vi.mock('../src/renderer/base-worker-client', () => ({ evaluateBaseInWorker: vi.fn(async (...args: Parameters<typeof evaluateBase>) => evaluateBase(...args)) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.mocked(evaluateBaseInWorker).mockReset().mockImplementation(async (...args) => evaluateBase(...args)) })
const notes = [1, 3, 2].map(price => ({ path: `${price}.md`, name: `${price}.md`, content: `---\nprice: ${price}\nstatus: open\n---`, modifiedAt: 1, size: 20 }))
const content = 'views:\n - type: table\n   name: Tasks\n   order: [file.name, price]\n   filters: price >= 2\n   sort: [{property: price, direction: DESC}]\n'
function api(source = content, paths = ['Tasks.base']) {
  const readBase = vi.fn(async (path: string) => ({ ok: true, value: { path, content: source, modifiedAt: 1 } }))
  vi.stubGlobal('tsuzune', { readBase, listBases: vi.fn(async () => ({ ok: true, value: paths })), readVaultImage: vi.fn(), applyBaseChanges: vi.fn(), applyPropertyChanges: vi.fn() })
  return readBase
}
function preview(target = 'Tasks.base', open = vi.fn()) {
  return <MarkdownPreview content={`![[${target}]]`} notePath="Home.md" notes={notes} attachments={[]} embedContext={{ vaultPath: "C:/fixture", notes, attachments: [], onOpenBase: open }} onWikiLink={vi.fn()} />
}
describe('read-only Base embeds', () => {
  it('resolves a saved view name exactly and keeps the original file navigation read-only', async () => {
    api(content + ' - type: list\n   name: Done\n   filters: price == 1\n   order: [file.name]\n')
    const open = vi.fn()
    const view = render(preview('Tasks.base#Done', open))
    await waitFor(() => expect(view.container.querySelector('.base-list-view')).toBeTruthy())
    expect((screen.getByLabelText('ビュー') as HTMLSelectElement).value).toBe('1')
    expect(screen.getByRole('button', { name: '1.md' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '設定' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Baseを開く' }))
    expect(open).toHaveBeenCalledWith('Tasks.base')
    expect(window.tsuzune.applyBaseChanges).not.toHaveBeenCalled()
    expect(window.tsuzune.applyPropertyChanges).not.toHaveBeenCalled()
  })
  it('uses saved filters and sorting without editing controls, and opens the original Base', async () => {
    api(); const open = vi.fn()
    const { container } = render(preview(undefined, open))
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row').slice(1).map(row => row.textContent)).toEqual(['3.md3', '2.md2'])
    expect(container.querySelector('.base-embed input:not([type=search]), .base-embed textarea, [draggable="true"]')).toBeNull()
    expect(screen.queryByRole('button', { name: '設定' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Baseを開く' }))
    expect(open).toHaveBeenCalledWith('Tasks.base')
    expect(window.tsuzune.applyBaseChanges).not.toHaveBeenCalled()
    expect(window.tsuzune.applyPropertyChanges).not.toHaveBeenCalled()
  })
  it('selects all saved views temporarily, preserving their filters and sorting', async () => {
    api('views:\n' + ['table', 'cards', 'list', 'kanban'].map(type => ` - type: ${type}\n   name: ${type}\n   order: [file.name, price]\n   filters: price >= 2\n   sort: [{property: price, direction: DESC}]\n   groupBy: {property: status}\n`).join(''))
    const view = render(preview())
    await screen.findByRole('table')
    for (const [index, type] of ['cards', 'list', 'kanban'].entries()) {
      fireEvent.change(screen.getByLabelText('ビュー'), { target: { value: String(index + 1) } })
      const selector = { cards: '.base-cards-grid', list: '.base-list-view', kanban: '.base-kanban-board' }[type as 'cards' | 'list' | 'kanban']
      await waitFor(() => expect(view.container.querySelector(selector)).toBeTruthy())
      const links = within(view.container.querySelector(selector) as HTMLElement).getAllByRole('button', { name: /[23]\.md/ })
      expect(links.map(link => link.textContent)).toEqual(['3.md', '2.md'])
      expect(view.container.querySelector('input:not([type=search]), textarea, [draggable="true"], .base-cell-edit')).toBeNull()
      expect(screen.queryByRole('button', { name: /設定|新規|列を追加/ })).toBeNull()
    }
    view.unmount(); render(preview())
    await screen.findByRole('table')
    expect((screen.getByLabelText('ビュー') as HTMLSelectElement).value).toBe('0')
  })
  it.each(['Missing.base', '../Tasks.base', 'Tasks.base#^block'])('explains %s without reading it', async target => {
    const read = api(); render(preview(target))
    await screen.findByText(/Baseを表示できません/)
    expect(read).not.toHaveBeenCalled()
  })
  it.each([
    ['Tasks.base#tasks', content, /ビューが見つかりません/],
    ['Tasks.base#Missing', content, /ビューが見つかりません/],
    ['Tasks.base#', content, /ビューが見つかりません/],
    ['Tasks.base#Tasks', content + ' - type: list\n   name: Tasks\n', /ビューが複数/]
  ])('reports an unresolved or ambiguous saved name in %s', async (target, source, message) => {
    const read = api(source)
    render(preview(target))
    await screen.findByText(message)
    expect(read).toHaveBeenCalledWith('Tasks.base', 'C:/fixture')
    expect(screen.queryByRole('table')).toBeNull()
  })
})
