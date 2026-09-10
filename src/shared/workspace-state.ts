import { validateRelativePath } from '../core/paths'
import { isSupportedAttachmentPath } from './attachments'
import { isAuditHistoryPath } from './ai-write-policy'

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
export type WorkspaceCollection = { scope: WorkspaceScope; state: VaultWorkspacesV1 }

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

export function emptyVaultWorkspaces(): VaultWorkspacesV1 {
  return { version: 1, lastSession: null, named: [] }
}
