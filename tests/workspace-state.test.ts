import { describe, expect, it } from 'vitest'
import {
  parseVaultWorkspacesV1,
  parseWorkspaceName,
  parseWorkspaceSnapshotV1,
  parseWorkspaceSnapshotV2,
  migrateWorkspaceSnapshotV1,
  parseVaultWorkspaces
} from '../src/shared/workspace-state'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'

const snapshot = {
  tabs: [
    { kind: 'note', path: 'Research/仮説.md' },
    { kind: 'attachment', path: 'Assets/図.png' },
    { kind: 'linked-view', path: 'Assets/図.png' },
    { kind: 'global-graph' }
  ],
  activeIndex: 0,
  noteView: 'edit',
  left: { open: true, view: 'search', query: '存在相' },
  right: { open: true, view: 'backlinks' }
} as const

describe('workspace state V1 parser', () => {
  it('accepts the complete public snapshot including attachment linked views', () => {
    expect(parseWorkspaceSnapshotV1(snapshot)).toEqual(snapshot)
  })

  it('accepts and round-trips the singleton global properties tab', () => {
    const value = {
      ...snapshot,
      tabs: [{ kind: 'global-properties' as const }],
      activeIndex: 0
    }
    expect(parseWorkspaceSnapshotV1(value)).toEqual(value)
  })

  it.each([
    { ...snapshot, extra: true },
    { ...snapshot, activeIndex: null },
    { ...snapshot, tabs: [{ kind: 'note', path: '../Outside.md' }] },
    { ...snapshot, tabs: [{ kind: 'note', path: 'Assets/図.png' }] },
    { ...snapshot, tabs: [{ kind: 'attachment', path: 'Research/仮説.md' }] },
    { ...snapshot, tabs: [{ kind: 'global-graph' }, { kind: 'global-graph' }] },
    { ...snapshot, tabs: [{ kind: 'global-properties' }, { kind: 'global-properties' }] },
    { ...snapshot, tabs: [], activeIndex: 0 },
    { ...snapshot, left: { ...snapshot.left, query: 'x'.repeat(4097) } }
  ])('rejects malformed or out-of-bounds snapshots', (value) => {
    expect(() => parseWorkspaceSnapshotV1(value)).toThrow()
  })

  it('enforces Unicode code-point name bounds without normalizing identity', () => {
    expect(parseWorkspaceName('  調査  ')).toBe('調査')
    expect(parseWorkspaceName('😀'.repeat(80))).toBe('😀'.repeat(80))
    expect(() => parseWorkspaceName('😀'.repeat(81))).toThrow()
    expect(() => parseWorkspaceName('bad\nname')).toThrow()
  })

  it('round-trips Base paths while rejecting protected, invalid, and duplicate tabs', () => {
    const value = { ...snapshot, tabs: [{ kind: 'base', path: 'views\\notes.base' }] }
    expect(parseWorkspaceSnapshotV1(value).tabs).toEqual([{ kind: 'base', path: 'views/notes.base' }])
    for (const path of ['../outside.base', '50_履歴/audit.base', 'notes.md']) {
      expect(() => parseWorkspaceSnapshotV1({ ...value, tabs: [{ kind: 'base', path }] })).toThrow()
    }
    expect(() => parseWorkspaceSnapshotV1({ ...value, tabs: [
      { kind: 'base', path: 'views/notes.base' }, { kind: 'base', path: 'VIEWS/NOTES.BASE' }
    ] })).toThrow(/only one tab/)
  })

  it('strictly validates persisted V1 collections and all-or-nothing limits', () => {
    expect(
      parseVaultWorkspacesV1({
        version: 1,
        lastSession: null,
        named: [{ name: '調査', savedAt: '2026-09-06T00:00:00.000Z', snapshot }]
      })
    ).toMatchObject({ version: 1, named: [{ name: '調査' }] })

    expect(() =>
      parseVaultWorkspacesV1({ version: 2, lastSession: null, named: [] })
    ).toThrow()
    expect(() =>
      parseVaultWorkspacesV1({
        version: 1,
        lastSession: null,
        named: Array.from({ length: 51 }, (_, index) => ({
          name: `W${index}`,
          savedAt: '2026-09-06T00:00:00.000Z',
          snapshot
        }))
      })
    ).toThrow()
  })
})

describe('workspace state V2 parser', () => {
  const migrated = migrateWorkspaceSnapshotV1(parseWorkspaceSnapshotV1(snapshot))

  it('migrates every named snapshot and last session without losing V1 tabs', () => {
    const state = parseVaultWorkspaces({ version: 1, lastSession: snapshot,
      named: [{ name: '調査', savedAt: '2026-09-06T00:00:00.000Z', snapshot }] })
    expect(state.version).toBe(2)
    expect(state.lastSession?.panes[0].tabs).toEqual(snapshot.tabs)
    expect(state.named[0].snapshot).toEqual(migrated)
    expect(state.lastSession?.panes[0].noteView).toBe('source')
  })

  it('round-trips nested layouts and pane-specific state, rebuilding stale legacy fields', () => {
    const second = { ...migrated.panes[0], id: 'pane-2', noteView: 'live-preview' as const,
      scroll: { top: 123, left: 4 }, localGraph: { depth: 3, direction: 'incoming' as const } }
    const parsed = parseWorkspaceSnapshotV2({ ...migrated, panes: [...migrated.panes, second], activePaneId: 'pane-2',
      tabs: [], activeIndex: null, noteView: 'preview', layout: { kind: 'split', direction: 'vertical', ratio: 0.25,
        first: migrated.layout, second: { kind: 'pane', paneId: 'pane-2' } } })
    expect(parsed.tabs).toEqual(second.tabs)
    expect(parsed.activeIndex).toBe(0)
    expect(parsed.noteView).toBe('edit')
    expect(parsed.panes[1]).toEqual(second)
    expect(parseVaultWorkspaces({ version: 2, lastSession: parsed, named: [] }).lastSession).toEqual(parsed)
    expect(parseWorkspaceSnapshotV2({ ...parsed, left: { ...parsed.left, width: 120 } }).left.width).toBe(120)
  })

  it('keeps legacy filters unset for global inheritance and persists explicit per-pane graph filters', () => {
    expect(migrated.panes[0].localGraph.filters).toBeUndefined()
    expect(parseWorkspaceSnapshotV2(migrated).panes[0].localGraph.filters).toBeUndefined()
    const filters = { ...DEFAULT_GRAPH_FILTER_SETTINGS, showTags: true, showAttachments: true, neighborLinks: true, showOrphans: false }
    const saved = { ...migrated, panes: [{ ...migrated.panes[0], localGraph: { ...migrated.panes[0].localGraph, filters } }] }
    const parsed = parseWorkspaceSnapshotV2(saved)
    expect(parsed.panes[0].localGraph.filters).toEqual(filters)
    expect(parseVaultWorkspaces({ version: 2, lastSession: parsed,
      named: [{ name: 'グラフ', savedAt: '2026-09-06T00:00:00.000Z', snapshot: parsed }] }).named[0].snapshot.panes[0].localGraph.filters).toEqual(filters)
    expect(() => parseWorkspaceSnapshotV2({ ...saved, panes: [{ ...saved.panes[0], localGraph: { ...saved.panes[0].localGraph,
      filters: { ...filters, showTags: 'yes' } } }] })).toThrow()
    expect(() => parseWorkspaceSnapshotV2({ ...saved, panes: [{ ...saved.panes[0], localGraph: { ...saved.panes[0].localGraph,
      filters: { ...filters, unknown: true } } }] })).toThrow()
  })

  it.each([
    { ...migrated, panes: [] },
    { ...migrated, panes: Array.from({ length: 9 }, (_, index) => ({ ...migrated.panes[0], id: `pane-${index}` })) },
    { ...migrated, activePaneId: 'absent' },
    { ...migrated, layout: { kind: 'pane', paneId: 'absent' } },
    { ...migrated, panes: [...migrated.panes, migrated.panes[0]] },
    { ...migrated, layout: { kind: 'split', direction: 'horizontal', ratio: 0.5, first: migrated.layout, second: migrated.layout } },
    { ...migrated, layout: { kind: 'split', direction: 'horizontal', ratio: 0.01, first: migrated.layout, second: migrated.layout } },
    { ...migrated, left: { ...migrated.left, width: 0 } },
    { ...migrated, panes: [{ ...migrated.panes[0], scroll: { top: -1, left: 0 } }] },
    { ...migrated, panes: [{ ...migrated.panes[0], localGraph: { depth: 4, direction: 'both' } }] },
    { ...migrated, panes: [{ ...migrated.panes[0], localGraph: { depth: 1.5, direction: 'both' } }] }
  ])('rejects invalid V2 layouts and bounds', (value) => {
    expect(() => parseWorkspaceSnapshotV2(value)).toThrow()
  })
})
