import {
  MAX_WORKSPACE_PANES,
  parseWorkspaceSnapshotV2,
  projectWorkspaceSnapshotV2,
  type PaneLayoutNode,
  type SavedWorkspaceTab,
  type WorkspaceSnapshotV2
} from './workspace-state'

export function paneIds(layout: PaneLayoutNode): string[] {
  return layout.kind === 'pane' ? [layout.paneId] : [...paneIds(layout.first), ...paneIds(layout.second)]
}

export function resizePaneSplit(layout: PaneLayoutNode, path: readonly ('first' | 'second')[], ratio: number): PaneLayoutNode {
  if (layout.kind === 'pane') return layout
  if (!path.length) return { ...layout, ratio: Math.min(0.9, Math.max(0.1, ratio)) }
  const [side, ...rest] = path
  return { ...layout, [side]: resizePaneSplit(layout[side], rest, ratio) }
}

export function splitWorkspacePane(
  snapshot: WorkspaceSnapshotV2,
  paneId: string,
  direction: 'horizontal' | 'vertical',
  newPaneId = `pane-${crypto.randomUUID()}`
): WorkspaceSnapshotV2 {
  if (snapshot.panes.length >= MAX_WORKSPACE_PANES) throw new Error('ペインは8個までです。')
  const source = snapshot.panes.find((pane) => pane.id === paneId)
  if (!source || snapshot.panes.some((pane) => pane.id === newPaneId)) throw new Error('pane id is invalid.')
  const activeTab = source.activeIndex === null ? undefined : source.tabs[source.activeIndex]
  const newPane = { ...source, id: newPaneId, tabs: activeTab ? [{ ...activeTab }] : [], activeIndex: activeTab ? 0 : null,
    scroll: { ...source.scroll }, localGraph: { ...source.localGraph } }
  const replace = (node: PaneLayoutNode): PaneLayoutNode => node.kind === 'pane'
    ? node.paneId === paneId ? { kind: 'split', direction, ratio: 0.5, first: node, second: { kind: 'pane', paneId: newPaneId } } : node
    : { ...node, first: replace(node.first), second: replace(node.second) }
  return parseWorkspaceSnapshotV2(projectWorkspaceSnapshotV2({ ...snapshot, panes: [...snapshot.panes, newPane],
    layout: replace(snapshot.layout), activePaneId: newPaneId }))
}

export function closeWorkspacePane(snapshot: WorkspaceSnapshotV2, paneId: string): WorkspaceSnapshotV2 {
  if (snapshot.panes.length === 1) throw new Error('最後のペインは閉じられません。')
  if (!snapshot.panes.some((pane) => pane.id === paneId)) throw new Error('pane id is invalid.')
  const remove = (node: PaneLayoutNode): PaneLayoutNode | null => {
    if (node.kind === 'pane') return node.paneId === paneId ? null : node
    const first = remove(node.first)
    const second = remove(node.second)
    return first && second ? { ...node, first, second } : first ?? second
  }
  const layout = remove(snapshot.layout)!
  return projectWorkspaceSnapshotV2({ ...snapshot, layout, panes: snapshot.panes.filter((pane) => pane.id !== paneId),
    activePaneId: snapshot.activePaneId === paneId ? paneIds(layout)[0] : snapshot.activePaneId })
}

function sameTab(left: SavedWorkspaceTab, right: SavedWorkspaceTab): boolean {
  return left.kind === right.kind && (!('path' in left) || ('path' in right && left.path === right.path))
}

export function moveWorkspaceTab(snapshot: WorkspaceSnapshotV2, fromPaneId: string, tabIndex: number, toPaneId: string): WorkspaceSnapshotV2 {
  if (fromPaneId === toPaneId) return snapshot
  const source = snapshot.panes.find((pane) => pane.id === fromPaneId)
  const target = snapshot.panes.find((pane) => pane.id === toPaneId)
  const tab = source?.tabs[tabIndex]
  if (!source || !target || !Number.isInteger(tabIndex) || !tab) throw new Error('workspace tab is invalid.')
  const existingIndex = target.tabs.findIndex((item) => sameTab(item, tab))
  const panes = snapshot.panes.map((pane) => {
    if (pane.id === fromPaneId) {
      const tabs = pane.tabs.filter((_, index) => index !== tabIndex)
      const activeIndex = tabs.length === 0 ? null : pane.activeIndex === null ? 0
        : pane.activeIndex > tabIndex ? pane.activeIndex - 1 : Math.min(pane.activeIndex, tabs.length - 1)
      return { ...pane, tabs, activeIndex }
    }
    return pane.id === toPaneId ? { ...pane, tabs: existingIndex < 0 ? [...pane.tabs, tab] : pane.tabs,
      activeIndex: existingIndex < 0 ? pane.tabs.length : existingIndex } : pane
  })
  return projectWorkspaceSnapshotV2({ ...snapshot, panes, activePaneId: toPaneId })
}
