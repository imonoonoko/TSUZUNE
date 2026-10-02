// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PaneAuxiliaryContent, { type PaneAuxiliaryContentProps } from '../src/renderer/components/PaneAuxiliaryContent'
import { evaluateBaseInWorker } from '../src/renderer/base-worker-client'
import type { BaseTableState } from '../src/renderer/components/BaseTableView'
import type { WikiGraph } from '../src/core/graph'
import * as graphModule from '../src/core/graph'
import type { PropertyInventory } from '../src/core/property-inventory'

const source = 'views:\n  - type: table\n    name: Before\n    order: [file.name]\n  - type: table\n    name: Second\n    order: [file.name]\n'
const changed = source.replace('Before', 'After')
vi.mock('../src/renderer/base-worker-client', () => ({ evaluateBaseInWorker: vi.fn() }))
vi.mock('../src/renderer/components/BaseTableView', () => ({ default: (props: {
  state: BaseTableState; onSelectView(index: number): void; onOpenNote(path: string): void; onPreviewProfile(source: string, index: number): Promise<boolean>; onSaveProfile(source: string): void; onEditCell?: (path: string, property: string) => void; editingDisabled?: boolean
}) => <section><span data-testid="base-state">{props.state.status}</span>{props.state.status === 'ready' && <><span data-testid="view">{props.state.viewIndex}</span><button onClick={() => props.onSelectView(1)}>Second view</button><button onClick={() => props.onOpenNote('A.md')}>Open cell note</button><button disabled={props.editingDisabled} onClick={() => props.onEditCell?.('A.md', 'count')}>Edit cell</button><button onClick={() => void props.onPreviewProfile(changed, 0)}>Preview</button><button onClick={() => props.onSaveProfile(changed)}>Save</button></>}</section> }))
vi.mock('../src/renderer/components/WikiGraphView', () => ({ default: (props: { graph: WikiGraph; onOpen(path: string): void }) => <section aria-label="Graph">{props.graph.nodes.map(node => <button key={node.path} onClick={() => props.onOpen(node.path)}>{node.path}</button>)}</section> }))
vi.mock('../src/renderer/components/PropertyInventoryView', () => ({ default: (props: { inventory: PropertyInventory; disabled: boolean; onOpenNote(path: string): void }) => <section aria-label="Properties"><span>{JSON.stringify(props.inventory)}</span><button disabled={props.disabled}>Declare</button><button onClick={() => props.onOpenNote('A.md')}>Open property note</button></section> }))
const note = (path: string, content = '') => ({ path, name: path.replace(/\.md$/, ''), content, modifiedAt: 1, size: content.length })
const evaluation = { scope: 'normal-discovery-snapshot' as const, columns: ['file.name'], targetCount: 1, excludedCount: 0, rows: [], diagnostics: [] }
function props(): PaneAuxiliaryContentProps { return { tab: { kind: 'base', path: 'table.base' }, notes: [note('A.md')], attachments: [], scope: { rootPath: 'fixture', rootRevision: 1 }, declaredTypes: {}, onOpenNote: vi.fn(), onEditCell: vi.fn() } }
function api() { return { readBase: vi.fn().mockResolvedValue({ ok: true, value: { path: 'table.base', content: source, modifiedAt: 1, revision: 'revision-1' } }), previewBaseChanges: vi.fn().mockResolvedValue({ ok: true, value: {} }), applyBaseChanges: vi.fn().mockResolvedValue({ ok: true, value: { path: 'table.base', content: changed, modifiedAt: 2, revision: 'revision-2' } }), readVaultImage: vi.fn().mockResolvedValue({ ok: true, value: 'data:image/png;base64,a' }), openVaultFile: vi.fn().mockResolvedValue({ ok: true, value: null }) } }
let bridge: ReturnType<typeof api>
beforeEach(() => { bridge = api(); Object.defineProperty(window, 'tsuzune', { configurable: true, value: bridge }); vi.mocked(evaluateBaseInWorker).mockReset().mockResolvedValue(evaluation) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('PaneAuxiliaryContent', () => {
  it('only builds a graph for graph or linked-view tabs and releases it on other tabs', async () => {
    const build = vi.spyOn(graphModule, 'buildWikiGraph')
    const common = props()
    const { rerender } = render(<PaneAuxiliaryContent {...common} />)
    await waitFor(() => expect(screen.getByTestId('base-state').textContent).toBe('ready'))
    rerender(<PaneAuxiliaryContent {...common} tab={{ kind: 'attachment', path: 'gone.png' }} />)
    rerender(<PaneAuxiliaryContent {...common} tab={{ kind: 'global-properties' }} />)
    expect(build).not.toHaveBeenCalled()
    rerender(<PaneAuxiliaryContent {...common} tab={{ kind: 'global-graph' }} />)
    expect(build).toHaveBeenCalledTimes(1)
    rerender(<PaneAuxiliaryContent {...common} tab={{ kind: 'linked-view', path: 'A.md' }} />)
    expect(build).toHaveBeenCalledTimes(1)
    rerender(<PaneAuxiliaryContent {...common} tab={{ kind: 'global-properties' }} />)
    expect(build).toHaveBeenCalledTimes(1)
    rerender(<PaneAuxiliaryContent {...common} tab={{ kind: 'global-graph' }} />)
    expect(build).toHaveBeenCalledTimes(2)
  })
  it('shows a missing attachment safely and displays an existing image simultaneously', async () => {
    const common = props()
    const { rerender } = render(<PaneAuxiliaryContent {...common} tab={{ kind: 'attachment', path: 'gone.png' }} />)
    expect(screen.getByRole('status').textContent).toContain('添付ファイルが見つかりません')
    rerender(<PaneAuxiliaryContent {...common} tab={{ kind: 'attachment', path: 'image.png' }} attachments={[{ path: 'image.png', name: 'image', modifiedAt: 1, createdAt: 1, size: 1 }]} />)
    expect(await screen.findByRole('img', { name: 'image' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '既定のアプリで開く' }))
    expect(bridge.openVaultFile).toHaveBeenCalledWith('image.png')
  })
  it('shows relative Markdown backlinks and excludes hidden sources', () => {
    const common = props()
    render(<PaneAuxiliaryContent {...common} tab={{ kind: 'linked-view', path: 'A.md' }} notes={[note('A.md'), note('B.md', '[a](A.md)'), note('Hidden.md', '[[A]]')]} userExcluded={path => path === 'Hidden.md'} />)
    expect(screen.getByRole('region', { name: 'バックリンクビュー' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /B/ }))
    expect(common.onOpenNote).toHaveBeenCalledWith('B.md')
    expect(screen.queryByText('Hidden')).toBeNull()
  })
  it('renders inventory with declaration disabled until a handler is provided', () => {
    const common = props()
    const { rerender } = render(<PaneAuxiliaryContent {...common} tab={{ kind: 'global-properties' }} notes={[note('A.md', '---\ncount: 2\n---\n')]} />)
    expect(screen.getByRole('region', { name: 'Properties' }).textContent).toContain('count')
    expect((screen.getByRole('button', { name: 'Declare' }) as HTMLButtonElement).disabled).toBe(true)
    rerender(<PaneAuxiliaryContent {...common} tab={{ kind: 'global-properties' }} onDeclare={vi.fn()} />)
    expect((screen.getByRole('button', { name: 'Declare' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('renders a simultaneous global graph with visible note navigation', () => {
    const common = props()
    render(<PaneAuxiliaryContent {...common} tab={{ kind: 'global-graph' }} notes={[note('A.md'), note('Hidden.md')]} userExcluded={path => path === 'Hidden.md'} />)
    fireEvent.click(screen.getByRole('button', { name: 'A.md' }))
    expect(common.onOpenNote).toHaveBeenCalledWith('A.md')
    expect(screen.queryByRole('button', { name: 'Hidden.md' })).toBeNull()
  })
  it('loads a Base in its own worker, switches views and routes note/property callbacks', async () => {
    const common = props()
    render(<PaneAuxiliaryContent {...common} />)
    await waitFor(() => expect(screen.getByTestId('base-state').textContent).toBe('ready'))
    expect(vi.mocked(evaluateBaseInWorker).mock.calls[0][3]?.signal).toBeInstanceOf(AbortSignal)
    fireEvent.click(screen.getByRole('button', { name: 'Second view' }))
    await waitFor(() => expect(screen.getByTestId('view').textContent).toBe('1'))
    expect(vi.mocked(evaluateBaseInWorker).mock.calls.at(-1)?.[2]).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Open cell note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit cell' }))
    expect(common.onOpenNote).toHaveBeenCalledWith('A.md')
    expect(common.onEditCell).toHaveBeenCalledWith('A.md', 'count')
  })
  it('requires a successful revision preview before saving settings', async () => {
    render(<PaneAuxiliaryContent {...props()} />)
    await waitFor(() => expect(screen.getByTestId('base-state').textContent).toBe('ready'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(bridge.applyBaseChanges).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    await waitFor(() => expect(evaluateBaseInWorker).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(bridge.applyBaseChanges).toHaveBeenCalledWith(expect.objectContaining({ path: 'table.base', expectedRevision: 'revision-1', content: changed })))
  })
  it('prevents preview, save and property editing when editing is disabled', async () => {
    render(<PaneAuxiliaryContent {...props()} editingDisabled />)
    await waitFor(() => expect(screen.getByTestId('base-state').textContent).toBe('ready'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(bridge.previewBaseChanges).not.toHaveBeenCalled()
    expect(bridge.applyBaseChanges).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Edit cell' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('aborts its worker on unmount', async () => {
    vi.mocked(evaluateBaseInWorker).mockImplementation(() => new Promise(() => {}))
    const { unmount } = render(<PaneAuxiliaryContent {...props()} />)
    await waitFor(() => expect(evaluateBaseInWorker).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(evaluateBaseInWorker).mock.calls[0][3]!.signal!
    unmount()
    expect(signal.aborted).toBe(true)
  })
  it('discards a delayed read from the previous Vault generation', async () => {
    let resolve!: (value: unknown) => void
    bridge.readBase.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const common = props()
    const { rerender } = render(<PaneAuxiliaryContent {...common} />)
    rerender(<PaneAuxiliaryContent {...common} scope={{ rootPath: 'second', rootRevision: 2 }} />)
    await waitFor(() => expect(screen.getByTestId('base-state').textContent).toBe('ready'))
    resolve({ ok: true, value: { path: 'table.base', content: 'malformed', revision: 'stale' } })
    await waitFor(() => expect(screen.getByTestId('base-state').textContent).toBe('ready'))
    expect(evaluateBaseInWorker).toHaveBeenCalledTimes(1)
  })
  it('keeps two Base panes independent', async () => {
    const common = props()
    render(<><PaneAuxiliaryContent {...common} /><PaneAuxiliaryContent {...common} tab={{ kind: 'base', path: 'other.base' }} /></>)
    await waitFor(() => expect(screen.getAllByTestId('base-state').every(item => item.textContent === 'ready')).toBe(true))
    expect(bridge.readBase.mock.calls.map(call => call[0])).toEqual(['table.base', 'other.base'])
    expect(evaluateBaseInWorker).toHaveBeenCalledTimes(2)
  })
})
