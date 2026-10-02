import { validateRelativePath } from '../core/paths'
import { isSupportedAttachmentPath } from './attachments'
import { isAuditHistoryPath } from './ai-write-policy'
import { DEFAULT_GRAPH_FILTER_SETTINGS, parseGraphFilterSettings, type GraphFilterSettings } from './graph-filters'

export type SavedWorkspaceTab =
  | { kind: 'note' | 'attachment' | 'linked-view' | 'base'; path: string }
  | { kind: 'global-graph' }
  | { kind: 'global-properties' }

export type WorkspaceSnapshotV1 = {
  tabs: SavedWorkspaceTab[]
  activeIndex: number | null
  noteView: 'edit' | 'preview' | 'local-graph'
  left: { open: boolean; view: 'files' | 'search' | 'bookmarks'; query: string }
  right: { open: boolean; view: 'outline' | 'links' | 'backlinks' | 'temporal' }
}

export type VaultWorkspacesV1 = {
  version: 1
  lastSession: WorkspaceSnapshotV1 | null
  named: Array<{
    name: string
    savedAt: string
    snapshot: WorkspaceSnapshotV1
  }>
}

export type WorkspaceScope = { rootPath: string; rootRevision: number }
export type WorkspaceCollection = { scope: WorkspaceScope; state: VaultWorkspacesV2 }

export type PaneLayoutNode =
  | { kind: 'pane'; paneId: string }
  | { kind: 'split'; direction: 'horizontal' | 'vertical'; ratio: number; first: PaneLayoutNode; second: PaneLayoutNode }

export type WorkspacePaneState = {
  id: string
  tabs: SavedWorkspaceTab[]
  activeIndex: number | null
  noteView: 'source' | 'live-preview' | 'preview' | 'local-graph'
  scroll: { top: number; left: number }
  localGraph: {
    depth: 1 | 2 | 3
    direction: 'both' | 'outgoing' | 'incoming'
    // Older snapshots inherit the current global filters until explicitly saved.
    filters?: GraphFilterSettings
  }
}

// Flat fields are rebuilt from the active pane for legacy consumers.
export type WorkspaceSnapshotV2 = WorkspaceSnapshotV1 & {
  panes: WorkspacePaneState[]
  layout: PaneLayoutNode
  activePaneId: string
  left: WorkspaceSnapshotV1['left'] & { width: number }
  right: WorkspaceSnapshotV1['right'] & { width: number }
}

export type VaultWorkspacesV2 = {
  version: 2
  lastSession: WorkspaceSnapshotV2 | null
  named: Array<{ name: string; savedAt: string; snapshot: WorkspaceSnapshotV2 }>
}

export type WorkspaceCollectionV2 = WorkspaceCollection
export const MAX_WORKSPACE_PANES = 8
export const DEFAULT_LEFT_SIDEBAR_WIDTH = 260
export const DEFAULT_RIGHT_SIDEBAR_WIDTH = 240

export const MAX_NAMED_WORKSPACES = 50
export const MAX_WORKSPACE_TABS = 200
export const MAX_WORKSPACE_QUERY_CODE_POINTS = 4_096

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has invalid fields.`)
  }
}

function oneOf<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`${label} is invalid.`)
  }
  return value as T
}

function parseTab(value: unknown): SavedWorkspaceTab {
  const tab = record(value, 'workspace tab')
  const kind = oneOf(tab.kind, ['note', 'attachment', 'linked-view', 'base', 'global-graph', 'global-properties'], 'tab kind')
  if (kind === 'global-graph' || kind === 'global-properties') {
    exactKeys(tab, ['kind'], 'global graph tab')
    return { kind }
  }

  exactKeys(tab, ['kind', 'path'], 'workspace tab')
  if (typeof tab.path !== 'string') throw new Error('tab path is invalid.')
  const path = validateRelativePath(tab.path)
  if (!path.valid || !path.normalized) throw new Error('tab path is invalid.')
  const markdown = path.normalized.toLocaleLowerCase().endsWith('.md')
  const base = path.normalized.toLocaleLowerCase().endsWith('.base')
  const attachment = isSupportedAttachmentPath(path.normalized)
  if (
    (kind === 'note' && !markdown) ||
    (kind === 'attachment' && !attachment) ||
    (kind === 'linked-view' && !markdown && !attachment) ||
    (kind === 'base' && (!base || isAuditHistoryPath(path.normalized)))
  ) {
    throw new Error(`tab path is invalid for ${kind}.`)
  }
  return { kind, path: path.normalized }
}

export function parseWorkspaceName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('workspace name is invalid.')
  const name = value.trim()
  const length = [...name].length
  if (length < 1 || length > 80 || /[\u0000-\u001f\u007f-\u009f]/u.test(name)) {
    throw new Error('workspace name is invalid.')
  }
  return name
}

export function parseWorkspaceScope(value: unknown): WorkspaceScope {
  const scope = record(value, 'workspace scope')
  exactKeys(scope, ['rootPath', 'rootRevision'], 'workspace scope')
  if (
    typeof scope.rootPath !== 'string' ||
    scope.rootPath.length === 0 ||
    !Number.isSafeInteger(scope.rootRevision) ||
    (scope.rootRevision as number) < 1
  ) {
    throw new Error('workspace scope is invalid.')
  }
  return { rootPath: scope.rootPath, rootRevision: scope.rootRevision as number }
}

export function parseWorkspaceSnapshotV1(value: unknown): WorkspaceSnapshotV1 {
  const snapshot = record(value, 'workspace snapshot')
  exactKeys(snapshot, ['tabs', 'activeIndex', 'noteView', 'left', 'right'], 'workspace snapshot')
  if (!Array.isArray(snapshot.tabs) || snapshot.tabs.length > MAX_WORKSPACE_TABS) {
    throw new Error('workspace tabs are invalid.')
  }
  const tabs = snapshot.tabs.map(parseTab)
  if (tabs.filter((tab) => tab.kind === 'global-graph').length > 1) {
    throw new Error('workspace can contain only one global graph.')
  }
  if (tabs.filter((tab) => tab.kind === 'global-properties').length > 1) {
    throw new Error('workspace can contain only one global properties view.')
  }
  const basePaths = new Set<string>()
  for (const tab of tabs) {
    if (tab.kind !== 'base') continue
    const key = tab.path.toLocaleLowerCase()
    if (basePaths.has(key)) throw new Error('workspace can contain only one tab for each Base.')
    basePaths.add(key)
  }

  const activeIndex = snapshot.activeIndex
  if (
    (tabs.length === 0 && activeIndex !== null) ||
    (tabs.length > 0 &&
      (!Number.isSafeInteger(activeIndex) ||
        (activeIndex as number) < 0 ||
        (activeIndex as number) >= tabs.length))
  ) {
    throw new Error('workspace active index is invalid.')
  }

  const left = record(snapshot.left, 'left workspace state')
  exactKeys(left, ['open', 'view', 'query'], 'left workspace state')
  if (
    typeof left.open !== 'boolean' ||
    typeof left.query !== 'string' ||
    [...left.query].length > MAX_WORKSPACE_QUERY_CODE_POINTS
  ) {
    throw new Error('left workspace state is invalid.')
  }
  const right = record(snapshot.right, 'right workspace state')
  exactKeys(right, ['open', 'view'], 'right workspace state')
  if (typeof right.open !== 'boolean') throw new Error('right workspace state is invalid.')

  return {
    tabs,
    activeIndex: activeIndex as number | null,
    noteView: oneOf(snapshot.noteView, ['edit', 'preview', 'local-graph'], 'note view'),
    left: {
      open: left.open,
      view: oneOf(left.view, ['files', 'search', 'bookmarks'], 'left view'),
      query: left.query
    },
    right: {
      open: right.open,
      view: oneOf(right.view, ['outline', 'links', 'backlinks', 'temporal'], 'right view')
    }
  }
}

export function parseVaultWorkspacesV1(value: unknown): VaultWorkspacesV1 {
  const state = record(value, 'Vault workspace state')
  exactKeys(state, ['version', 'lastSession', 'named'], 'Vault workspace state')
  if (state.version !== 1 || !Array.isArray(state.named) || state.named.length > MAX_NAMED_WORKSPACES) {
    throw new Error('Vault workspace state is invalid.')
  }
  const names = new Set<string>()
  const named = state.named.map((value) => {
    const item = record(value, 'named workspace')
    exactKeys(item, ['name', 'savedAt', 'snapshot'], 'named workspace')
    const name = parseWorkspaceName(item.name)
    if (name !== item.name || names.has(name)) throw new Error('named workspace name is invalid.')
    names.add(name)
    if (
      typeof item.savedAt !== 'string' ||
      Number.isNaN(Date.parse(item.savedAt)) ||
      new Date(item.savedAt).toISOString() !== item.savedAt
    ) {
      throw new Error('named workspace date is invalid.')
    }
    return { name, savedAt: item.savedAt, snapshot: parseWorkspaceSnapshotV1(item.snapshot) }
  })
  return {
    version: 1,
    lastSession:
      state.lastSession === null ? null : parseWorkspaceSnapshotV1(state.lastSession),
    named
  }
}

export function emptyVaultWorkspaces(): VaultWorkspacesV2 {
  return { version: 2, lastSession: null, named: [] }
}

function boundedNumber(value: unknown, minimum: number, maximum: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is invalid.`)
  }
  return value
}

function paneId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error('pane id is invalid.')
  return value
}

export function projectWorkspaceSnapshotV2(snapshot: Omit<WorkspaceSnapshotV2, 'tabs' | 'activeIndex' | 'noteView'>): WorkspaceSnapshotV2 {
  const active = snapshot.panes.find((pane) => pane.id === snapshot.activePaneId)
  if (!active) throw new Error('active pane is invalid.')
  return {
    ...snapshot,
    tabs: active.tabs,
    activeIndex: active.activeIndex,
    noteView: active.noteView === 'source' || active.noteView === 'live-preview' ? 'edit' : active.noteView
  }
}

export function migrateWorkspaceSnapshotV1(value: WorkspaceSnapshotV1): WorkspaceSnapshotV2 {
  const snapshot = parseWorkspaceSnapshotV1(value)
  return projectWorkspaceSnapshotV2({
    panes: [{ id: 'pane-1', tabs: snapshot.tabs, activeIndex: snapshot.activeIndex,
      noteView: snapshot.noteView === 'edit' ? 'source' : snapshot.noteView,
      scroll: { top: 0, left: 0 }, localGraph: { depth: 1, direction: 'both' } }],
    layout: { kind: 'pane', paneId: 'pane-1' },
    activePaneId: 'pane-1',
    left: { ...snapshot.left, width: DEFAULT_LEFT_SIDEBAR_WIDTH },
    right: { ...snapshot.right, width: DEFAULT_RIGHT_SIDEBAR_WIDTH }
  })
}

export function parseWorkspaceSnapshotV2(value: unknown): WorkspaceSnapshotV2 {
  const snapshot = record(value, 'workspace snapshot V2')
  const projection = ['tabs', 'activeIndex', 'noteView']
  exactKeys(snapshot, ['panes', 'layout', 'activePaneId', 'left', 'right', ...projection.filter((key) => key in snapshot)], 'workspace snapshot V2')
  if (!Array.isArray(snapshot.panes) || snapshot.panes.length < 1 || snapshot.panes.length > MAX_WORKSPACE_PANES) {
    throw new Error('workspace panes are invalid.')
  }
  const ids = new Set<string>()
  const panes: WorkspacePaneState[] = snapshot.panes.map((value) => {
    const pane = record(value, 'workspace pane')
    exactKeys(pane, ['id', 'tabs', 'activeIndex', 'noteView', 'scroll', 'localGraph'], 'workspace pane')
    const id = paneId(pane.id)
    if (ids.has(id)) throw new Error('duplicate pane id.')
    ids.add(id)
    const validated = parseWorkspaceSnapshotV1({ tabs: pane.tabs, activeIndex: pane.activeIndex,
      noteView: 'edit', left: { open: true, view: 'files', query: '' }, right: { open: false, view: 'outline' } })
    const scroll = record(pane.scroll, 'pane scroll')
    exactKeys(scroll, ['top', 'left'], 'pane scroll')
    const graph = record(pane.localGraph, 'pane local graph')
    exactKeys(graph, ['depth', 'direction', ...('filters' in graph ? ['filters'] : [])], 'pane local graph')
    const depth = boundedNumber(graph.depth, 1, 3, 'local graph depth')
    if (!Number.isInteger(depth)) throw new Error('local graph depth is invalid.')
    let filters: GraphFilterSettings | undefined
    if ('filters' in graph) {
      const values = record(graph.filters, 'pane graph filters')
      exactKeys(values, Object.keys(DEFAULT_GRAPH_FILTER_SETTINGS), 'pane graph filters')
      if (Object.values(values).some(value => typeof value !== 'boolean')) throw new Error('pane graph filters are invalid.')
      filters = parseGraphFilterSettings(values)
    }
    return { id, tabs: validated.tabs, activeIndex: validated.activeIndex,
      noteView: oneOf(pane.noteView, ['source', 'live-preview', 'preview', 'local-graph'], 'pane note view'),
      scroll: { top: boundedNumber(scroll.top, 0, 1_000_000_000, 'scroll top'), left: boundedNumber(scroll.left, 0, 1_000_000_000, 'scroll left') },
      localGraph: { depth: depth as 1 | 2 | 3, direction: oneOf(graph.direction, ['both', 'outgoing', 'incoming'], 'local graph direction'),
        ...(filters ? { filters } : {}) } }
  })
  if (panes.reduce((count, pane) => count + pane.tabs.length, 0) > MAX_WORKSPACE_TABS) throw new Error('workspace tabs are invalid.')
  const leaves = new Set<string>()
  const parseLayout = (value: unknown, depth = 0): PaneLayoutNode => {
    if (depth >= MAX_WORKSPACE_PANES) throw new Error('pane layout is too deep.')
    const node = record(value, 'pane layout')
    if (node.kind === 'pane') {
      exactKeys(node, ['kind', 'paneId'], 'pane leaf')
      const id = paneId(node.paneId)
      if (!ids.has(id) || leaves.has(id)) throw new Error('pane layout leaf is invalid.')
      leaves.add(id)
      return { kind: 'pane', paneId: id }
    }
    exactKeys(node, ['kind', 'direction', 'ratio', 'first', 'second'], 'pane split')
    if (node.kind !== 'split') throw new Error('pane layout kind is invalid.')
    return { kind: 'split', direction: oneOf(node.direction, ['horizontal', 'vertical'], 'split direction'),
      ratio: boundedNumber(node.ratio, 0.1, 0.9, 'split ratio'), first: parseLayout(node.first, depth + 1), second: parseLayout(node.second, depth + 1) }
  }
  const layout = parseLayout(snapshot.layout)
  if (leaves.size !== ids.size) throw new Error('pane layout is missing panes.')
  const activePaneId = paneId(snapshot.activePaneId)
  if (!ids.has(activePaneId)) throw new Error('active pane is invalid.')
  const left = record(snapshot.left, 'left workspace state')
  const right = record(snapshot.right, 'right workspace state')
  exactKeys(left, ['open', 'view', 'query', 'width'], 'left workspace state')
  exactKeys(right, ['open', 'view', 'width'], 'right workspace state')
  const sidebar = parseWorkspaceSnapshotV1({ tabs: [], activeIndex: null, noteView: 'edit',
    left: { open: left.open, view: left.view, query: left.query }, right: { open: right.open, view: right.view } })
  return projectWorkspaceSnapshotV2({ panes, layout, activePaneId,
    left: { ...sidebar.left, width: boundedNumber(left.width, 120, 640, 'left width') },
    right: { ...sidebar.right, width: boundedNumber(right.width, 120, 640, 'right width') } })
}

export function parseWorkspaceSnapshot(value: unknown): WorkspaceSnapshotV2 {
  const snapshot = record(value, 'workspace snapshot')
  return 'panes' in snapshot ? parseWorkspaceSnapshotV2(snapshot) : migrateWorkspaceSnapshotV1(parseWorkspaceSnapshotV1(snapshot))
}

export function parseVaultWorkspacesV2(value: unknown): VaultWorkspacesV2 {
  const state = record(value, 'Vault workspace state')
  exactKeys(state, ['version', 'lastSession', 'named'], 'Vault workspace state')
  if (state.version !== 2 || !Array.isArray(state.named) || state.named.length > MAX_NAMED_WORKSPACES) throw new Error('Vault workspace state is invalid.')
  const names = new Set<string>()
  const named = state.named.map((value) => {
    const item = record(value, 'named workspace')
    exactKeys(item, ['name', 'savedAt', 'snapshot'], 'named workspace')
    const name = parseWorkspaceName(item.name)
    if (name !== item.name || names.has(name)) throw new Error('named workspace name is invalid.')
    names.add(name)
    if (typeof item.savedAt !== 'string' || Number.isNaN(Date.parse(item.savedAt)) || new Date(item.savedAt).toISOString() !== item.savedAt) throw new Error('named workspace date is invalid.')
    return { name, savedAt: item.savedAt, snapshot: parseWorkspaceSnapshotV2(item.snapshot) }
  })
  return { version: 2, lastSession: state.lastSession === null ? null : parseWorkspaceSnapshotV2(state.lastSession), named }
}

export function parseVaultWorkspaces(value: unknown): VaultWorkspacesV2 {
  if (record(value, 'Vault workspace state').version === 2) return parseVaultWorkspacesV2(value)
  const legacy = parseVaultWorkspacesV1(value)
  return { version: 2, lastSession: legacy.lastSession === null ? null : migrateWorkspaceSnapshotV1(legacy.lastSession),
    named: legacy.named.map((item) => ({ ...item, snapshot: migrateWorkspaceSnapshotV1(item.snapshot) })) }
}
