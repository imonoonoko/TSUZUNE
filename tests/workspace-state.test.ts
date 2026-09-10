import { describe, expect, it } from 'vitest'
import {
  parseVaultWorkspacesV1,
  parseWorkspaceName,
  parseWorkspaceSnapshotV1
} from '../src/shared/workspace-state'

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
