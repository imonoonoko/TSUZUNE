import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { filterWikiGraph } from '../../core/graph'
import { getGraphNodeGroupColor } from '../../core/graph-groups'
import { calculateGraphFit } from '../../core/graph-fit'
import { calculateGraphNodeWeights } from '../../core/graph-geometry'
import {
  getGraphTimelinePrefix,
  getGraphTimelineTiming,
  orderGraphTimelineFileNodes
} from '../../core/graph-timeline'
import {
  createWikiGraphSimulation,
  DEFAULT_GRAPH_FORCE_SETTINGS,
  type WikiGraphSimulation
} from '../../core/graph-layout'
import type {
  WikiGraph,
  WikiGraphNode,
  WikiGraphScope
} from '../../core/graph'
import type {
  GraphFilterSettings,
  GraphForceSettings,
  GraphGroup,
  GraphSettingsSectionState,
  GraphViewState,
  NoteDocument
} from '../../shared/types'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../../shared/graph-filters'
import { GRAPH_FORCE_RANGES } from '../../shared/graph-settings'
import {
  DEFAULT_GRAPH_VIEW_STATE,
  parseGraphViewState
} from '../../shared/graph-view-state'
import {
  calculateGraphLabelOpacity,
  calculateGraphNodeRadius,
  calculateGraphZoomGeometry,
  DEFAULT_GRAPH_DISPLAY_SETTINGS,
  GRAPH_DISPLAY_RANGES,
  type GraphDisplaySettings
} from '../../shared/graph-display'
import GraphEdgeCanvas from './GraphEdgeCanvas'

interface WikiGraphViewProps {
  graph: WikiGraph
  notes?: NoteDocument[]
  currentPath: string | null
  scope: WikiGraphScope
  includeOrphans: boolean
  filterSettings?: GraphFilterSettings
  forceSettings?: GraphForceSettings
  displaySettings?: GraphDisplaySettings
  groups?: GraphGroup[]
  viewState?: GraphViewState
  onScopeChange: (scope: WikiGraphScope) => void
  onIncludeOrphansChange: (include: boolean) => void
  onFilterSettingsChange?: (settings: GraphFilterSettings) => void
  onFilterSettingsCommit?: (settings: GraphFilterSettings) => void
  onForceSettingsChange?: (settings: GraphForceSettings) => void
  onForceSettingsCommit?: (settings: GraphForceSettings) => void
  onDisplaySettingsChange?: (settings: GraphDisplaySettings) => void
  onDisplaySettingsCommit?: (settings: GraphDisplaySettings) => void
  onGroupsChange?: (groups: GraphGroup[]) => void
  onGroupsCommit?: (groups: GraphGroup[]) => void
  onViewStateCommit?: (state: GraphViewState) => void
  onSearchTag?: (tag: string) => void
  onOpenInNewTab?: (path: string) => void
  onOpenInNewWindow?: (path: string) => void
  onMove?: (path: string) => void
  bookmarkedPaths?: ReadonlySet<string>
  onBookmark?: (path: string) => void
  onTrash?: (path: string) => void
  onOpen: (path: string) => void
}

interface PositionedNode {
  node: WikiGraphNode
  x: number
  y: number
}

type NodeRelation = 'current' | 'outgoing' | 'incoming' | 'both' | 'related'

interface GraphPan {
  x: number
  y: number
}

interface GraphDrag {
  pointerId: number
  startX: number
  startY: number
  pan: GraphPan
}

interface GraphNodeDrag {
  pointerId: number
  path: string
  startX: number
  startY: number
  moved: boolean
}

interface GraphNodeContextMenu {
  node: WikiGraphNode
  x: number
  y: number
}

const EMPTY_NOTES: NoteDocument[] = []
const EMPTY_GROUPS: GraphGroup[] = []

const canvasStyle: React.CSSProperties = {
  position: 'relative',
  minWidth: 0,
  minHeight: 360,
  flex: '1 1 auto',
  overflow: 'hidden',
  border: 0,
  borderRadius: 0,
  background: '#fff'
}

function nodeRelations(
  graph: WikiGraph,
  currentPath: string | null
): Map<string, NodeRelation> {
  const relations = new Map<string, NodeRelation>(
    graph.nodes.map((node) => [
      node.path,
      node.path === currentPath ? 'current' : 'related'
    ] satisfies [string, NodeRelation])
  )

  for (const edge of graph.edges) {
    if (edge.sourcePath === currentPath) {
      relations.set(
        edge.targetPath,
        relations.get(edge.targetPath) === 'incoming' ? 'both' : 'outgoing'
      )
    }
    if (edge.targetPath === currentPath) {
      relations.set(
        edge.sourcePath,
        relations.get(edge.sourcePath) === 'outgoing' ? 'both' : 'incoming'
      )
    }
  }
  return relations
}

function relationLabel(relation: NodeRelation): string {
  switch (relation) {
    case 'outgoing':
      return 'リンク先'
    case 'incoming':
      return 'バックリンク'
    case 'both':
      return '相互リンク'
    case 'current':
      return '現在のノート'
    default:
      return '関連ノート'
  }
}

function nodeColors(
  isSelected: boolean,
  isActive: boolean,
  isUnresolved: boolean,
  isTag: boolean,
  isAttachment: boolean,
  groupColor: string | null
): {
  color: string
  background: string
  borderColor: string
} {
  if (isSelected || isActive) {
    return {
      color: '#222',
      background: '#7c5cf0',
      borderColor: '#7c5cf0'
    }
  }
  if (groupColor) {
    return {
      color: '#222',
      background: groupColor,
      borderColor: groupColor
    }
  }
  if (isUnresolved) {
    return {
      color: '#222',
      background: '#ababab',
      borderColor: '#ababab'
    }
  }
  if (isTag) {
    return {
      color: '#222',
      background: '#08b94e',
      borderColor: '#08b94e'
    }
  }
  if (isAttachment) {
    return {
      color: '#222',
      background: '#e0ac00',
      borderColor: '#e0ac00'
    }
  }
  return {
    color: '#222',
    background: '#5c5c5c',
    borderColor: '#5c5c5c'
  }
}

export default function WikiGraphView({
  graph,
  notes = EMPTY_NOTES,
  currentPath,
  scope,
  includeOrphans,
  filterSettings: savedFilterSettings,
  forceSettings = DEFAULT_GRAPH_FORCE_SETTINGS,
  displaySettings: savedDisplaySettings = DEFAULT_GRAPH_DISPLAY_SETTINGS,
  groups = EMPTY_GROUPS,
  viewState: savedViewState = DEFAULT_GRAPH_VIEW_STATE,
  onIncludeOrphansChange,
  onFilterSettingsChange = () => undefined,
  onFilterSettingsCommit = () => undefined,
  onForceSettingsChange = () => undefined,
  onForceSettingsCommit = () => undefined,
  onDisplaySettingsChange = () => undefined,
  onDisplaySettingsCommit = () => undefined,
  onGroupsChange = () => undefined,
  onGroupsCommit = () => undefined,
  onViewStateCommit = () => undefined,
  onSearchTag = () => undefined,
  onOpenInNewTab,
  onOpenInNewWindow,
  onMove,
  bookmarkedPaths = new Set(),
  onBookmark,
  onTrash,
  onOpen
}: WikiGraphViewProps): React.JSX.Element {
  const initialViewState = parseGraphViewState(savedViewState)
  const filterSettings = savedFilterSettings ?? {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    showOrphans: includeOrphans
  }
  const [filterQuery, setFilterQuery] = useState(initialViewState.query)
  const [zoom, setZoom] = useState(initialViewState.scale)
  const [pan, setPan] = useState<GraphPan>({ x: 0, y: 0 })
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(
    initialViewState.settingsOpen
  )
  const [nodeContextMenu, setNodeContextMenu] =
    useState<GraphNodeContextMenu | null>(null)
  const [settingsSections, setSettingsSections] =
    useState<GraphSettingsSectionState>(initialViewState.settingsSections)
  const [displaySettings, setDisplaySettings] = useState<GraphDisplaySettings>(
    savedDisplaySettings
  )
  const [timelineRevealedCount, setTimelineRevealedCount] = useState<
    number | null
  >(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<GraphDrag | null>(null)
  const nodeDrag = useRef<GraphNodeDrag | null>(null)
  const nodeElements = useRef(new Map<string, HTMLButtonElement>())
  const suppressNodeClick = useRef<string | null>(null)
  const pendingForceSettings = useRef(forceSettings)
  const forceSettingsDirty = useRef(false)
  const pendingDisplaySettings = useRef(savedDisplaySettings)
  const pendingGroups = useRef(groups)
  const nextGroupNumber = useRef(1)
  const draggedGroupId = useRef<string | null>(null)
  const timelineTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const viewStateRef = useRef(initialViewState)

  useEffect(() => {
    const next = parseGraphViewState(savedViewState)
    viewStateRef.current = next
    setZoom(next.scale)
    setFilterQuery(next.query)
    setSettingsOpen(next.settingsOpen)
    setSettingsSections(next.settingsSections)
  }, [savedViewState, scope])

  const commitViewState = useCallback(
    (patch: Partial<GraphViewState>): void => {
      const next = parseGraphViewState({
        ...viewStateRef.current,
        ...patch,
        settingsSections:
          patch.settingsSections ?? viewStateRef.current.settingsSections
      })
      viewStateRef.current = next
      onViewStateCommit(next)
    },
    [onViewStateCommit]
  )

  const changeSettingsOpen = (open: boolean): void => {
    setSettingsOpen(open)
    commitViewState({ settingsOpen: open })
  }

  useEffect(() => {
    if (!nodeContextMenu) {
      return
    }
    const closeOnPointerDown = (event: PointerEvent): void => {
      if (!(event.target as HTMLElement).closest('.wiki-graph-context-menu')) {
        setNodeContextMenu(null)
      }
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setNodeContextMenu(null)
      }
    }
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [nodeContextMenu])

  useEffect(() => {
    pendingGroups.current = groups
  }, [groups])

  const changeGroups = (next: GraphGroup[], commit = false): void => {
    pendingGroups.current = next
    onGroupsChange(next)
    if (commit) {
      onGroupsCommit(next)
    }
  }

  const addGroup = (): void => {
    const next = [
      ...groups,
      {
        id: `graph-group-${Date.now()}-${nextGroupNumber.current++}`,
        query: '',
        color: '#e57373'
      }
    ]
    changeGroups(next, true)
  }

  const updateGroup = (
    id: string,
    patch: Partial<Pick<GraphGroup, 'query' | 'color'>>,
    commit = false
  ): void => {
    changeGroups(
      groups.map((group) => (group.id === id ? { ...group, ...patch } : group)),
      commit
    )
  }

  const commitGroups = (): void => {
    onGroupsCommit(pendingGroups.current)
  }

  const deleteGroup = (id: string): void => {
    changeGroups(groups.filter((group) => group.id !== id), true)
  }

  const dropGroup = (targetId: string): void => {
    const sourceId = draggedGroupId.current
    draggedGroupId.current = null
    if (!sourceId || sourceId === targetId) {
      return
    }
    const sourceIndex = groups.findIndex((group) => group.id === sourceId)
    const targetIndex = groups.findIndex((group) => group.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }
    const next = [...groups]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)
    changeGroups(next, true)
  }

  useEffect(() => {
    pendingDisplaySettings.current = savedDisplaySettings
    setDisplaySettings(savedDisplaySettings)
  }, [savedDisplaySettings])

  const changeDisplaySettings = (
    next: GraphDisplaySettings,
    commit = false
  ): void => {
    pendingDisplaySettings.current = next
    setDisplaySettings(next)
    onDisplaySettingsChange(next)
    if (commit) {
      onDisplaySettingsCommit(next)
    }
  }

  const commitDisplaySettings = (): void => {
    onDisplaySettingsCommit(pendingDisplaySettings.current)
  }

  useEffect(() => {
    pendingForceSettings.current = forceSettings
  }, [forceSettings])

  const changeForceSetting = (
    setting: keyof GraphForceSettings,
    value: number
  ): void => {
    const next = {
      ...forceSettings,
      [setting]: value
    }
    pendingForceSettings.current = next
    forceSettingsDirty.current = true
    onForceSettingsChange(next)
  }

  const commitForceSettings = (): void => {
    if (!forceSettingsDirty.current) {
      return
    }
    forceSettingsDirty.current = false
    onForceSettingsCommit(pendingForceSettings.current)
  }

  const changeFilterSetting = (
    setting: keyof GraphFilterSettings,
    value: boolean
  ): void => {
    const next = { ...filterSettings, [setting]: value }
    if (setting === 'showOrphans') {
      onIncludeOrphansChange(value)
    }
    onFilterSettingsChange(next)
    onFilterSettingsCommit(next)
  }

  const restoreGraphSettings = (): void => {
    setFilterQuery('')
    commitViewState({ query: '' })
    if (!filterSettings.showOrphans) {
      onIncludeOrphansChange(true)
    }
    onFilterSettingsChange(DEFAULT_GRAPH_FILTER_SETTINGS)
    onFilterSettingsCommit(DEFAULT_GRAPH_FILTER_SETTINGS)
    changeGroups([], true)
    changeDisplaySettings(DEFAULT_GRAPH_DISPLAY_SETTINGS, true)
    pendingForceSettings.current = DEFAULT_GRAPH_FORCE_SETTINGS
    forceSettingsDirty.current = false
    onForceSettingsChange(DEFAULT_GRAPH_FORCE_SETTINGS)
    onForceSettingsCommit(DEFAULT_GRAPH_FORCE_SETTINGS)
  }

  const toggleSettingsSection = (
    section: keyof typeof settingsSections
  ): void => {
    const next = {
      ...viewStateRef.current.settingsSections,
      [section]: !viewStateRef.current.settingsSections[section]
    }
    setSettingsSections(next)
    commitViewState({ settingsSections: next })
  }
  const stopTimeline = useCallback((): void => {
    if (timelineTimer.current !== null) {
      clearInterval(timelineTimer.current)
      timelineTimer.current = null
    }
  }, [])

  useEffect(() => stopTimeline, [stopTimeline])

  const filteredGraph = useMemo(
    () =>
      filterWikiGraph(
        graph,
        scope === 'local' ? currentPath : null,
        filterQuery,
        notes
      ),
    [graph, currentPath, filterQuery, notes, scope]
  )
  const visibleGraph = useMemo(
    () =>
      scope === 'vault' && timelineRevealedCount !== null
        ? getGraphTimelinePrefix(filteredGraph, timelineRevealedCount)
        : filteredGraph,
    [filteredGraph, scope, timelineRevealedCount]
  )
  const [simulation] = useState<WikiGraphSimulation>(() =>
    createWikiGraphSimulation(visibleGraph, forceSettings)
  )
  const [simulationRevision, setSimulationRevision] = useState(0)
  const startTimeline = useCallback((): void => {
    stopTimeline()
    const fileCount = orderGraphTimelineFileNodes(filteredGraph.nodes).length
    setTimelineRevealedCount(0)
    if (fileCount === 0) {
      return
    }

    const { revealIntervalMs } = getGraphTimelineTiming(fileCount)
    let revealed = 0
    timelineTimer.current = setInterval(() => {
      revealed = Math.min(fileCount, revealed + 1)
      setTimelineRevealedCount(revealed)
      if (revealed === fileCount) {
        stopTimeline()
      }
    }, revealIntervalMs)
  }, [filteredGraph, stopTimeline])

  useEffect(() => {
    if (scope !== 'vault') {
      stopTimeline()
      setTimelineRevealedCount(null)
    }
  }, [scope, stopTimeline])

  useLayoutEffect(() => {
    simulation.setGraph(visibleGraph)
    setSimulationRevision((revision) => revision + 1)
  }, [simulation, visibleGraph])

  const positions = useMemo(
    () => simulation.positions(),
    [simulation, simulationRevision]
  )
  const positioned = useMemo(
    () =>
      visibleGraph.nodes.flatMap((node): PositionedNode[] => {
        const position = positions.get(node.path)
        return position ? [{ node, ...position }] : []
      }),
    [visibleGraph.nodes, positions]
  )

  useLayoutEffect(() => {
    const updateNodes = (): void => {
      for (const node of simulation.nodes) {
        const element = nodeElements.current.get(node.path)
        if (!element) {
          continue
        }
        element.style.left = `calc(50% + ${node.x}px)`
        element.style.top = `calc(50% + ${node.y}px)`
      }
    }

    updateNodes()
    const unsubscribe = simulation.subscribe(updateNodes)
    simulation.start()
    return () => {
      unsubscribe()
      simulation.stop()
    }
  }, [simulation])

  useEffect(() => {
    simulation.setForces(forceSettings)
  }, [forceSettings, simulation])
  const visiblePaths = useMemo(
    () => new Set(visibleGraph.nodes.map((node) => node.path)),
    [visibleGraph.nodes]
  )
  const relations = useMemo(
    () => nodeRelations(visibleGraph, currentPath),
    [visibleGraph, currentPath]
  )
  const nodeWeights = useMemo(
    () =>
      calculateGraphNodeWeights(
        filteredGraph,
        scope === 'local' ? currentPath : null
      ),
    [currentPath, filteredGraph, scope]
  )
  const zoomGeometry = calculateGraphZoomGeometry(
    zoom,
    displaySettings.lineSize
  )
  const groupColors = useMemo(
    () =>
      new Map(
        visibleGraph.nodes.map((node) => [
          node.path,
          getGraphNodeGroupColor(node, groups, notes)
        ])
      ),
    [groups, notes, visibleGraph.nodes]
  )
  const nodeRadii = useMemo(
    () =>
      new Map(
        visibleGraph.nodes.map((node) => [
          node.path,
          calculateGraphNodeRadius(
            nodeWeights.get(node.path) ?? 0,
            displaySettings.nodeSize
          ) * zoomGeometry.nodeScale
        ])
      ),
    [
      displaySettings.nodeSize,
      nodeWeights,
      visibleGraph.nodes,
      zoomGeometry.nodeScale
    ]
  )
  const current = currentPath
    ? visibleGraph.nodes.find((node) => node.path === currentPath)
    : undefined
  const visibleHoveredPath =
    hoveredPath && visiblePaths.has(hoveredPath) ? hoveredPath : null
  const visibleFocusedPath =
    focusedPath && visiblePaths.has(focusedPath) ? focusedPath : null
  const activePath =
    visibleHoveredPath ??
    visibleFocusedPath ??
    (scope === 'local' ? currentPath : null)
  const emphasizedPaths = useMemo(() => {
    const paths = new Set<string>()
    if (activePath) {
      paths.add(activePath)
      for (const edge of visibleGraph.edges) {
        if (edge.sourcePath === activePath) {
          paths.add(edge.targetPath)
        }
        if (edge.targetPath === activePath) {
          paths.add(edge.sourcePath)
        }
      }
    }
    return paths
  }, [activePath, visibleGraph.edges])

  const fitGraph = useCallback((): void => {
    const canvas = canvasRef.current
    if (!canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) {
      return
    }

    const currentPositions = simulation.positions()
    if (currentPositions.size === 0) {
      return
    }

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (const graphNode of visibleGraph.nodes) {
      const position = currentPositions.get(graphNode.path)
      if (!position) {
        continue
      }
      const element = nodeElements.current.get(graphNode.path)
      const radius = nodeRadii.get(graphNode.path) ?? 8
      const width = Math.max(element?.offsetWidth ?? 0, radius * 2)
      const height = Math.max(element?.offsetHeight ?? 0, radius * 2)
      const left = position.x - width / 2
      const top = position.y - radius
      minX = Math.min(minX, left)
      minY = Math.min(minY, top)
      maxX = Math.max(maxX, left + width)
      maxY = Math.max(maxY, top + height)
    }

    const fit = calculateGraphFit(
      { width: canvas.clientWidth, height: canvas.clientHeight },
      { minX, minY, maxX, maxY }
    )
    setZoom(fit.zoom)
    commitViewState({ scale: fit.zoom })
    setPan(fit.pan)
  }, [commitViewState, nodeRadii, simulation, visibleGraph.nodes])

  const zoomAround = useCallback(
    (nextZoom: number, center: GraphPan = { x: 0, y: 0 }): void => {
      const clampedZoom = Math.min(8, Math.max(1 / 128, nextZoom))
      const ratio = clampedZoom / zoom
      setPan({
        x: center.x - (center.x - pan.x) * ratio,
        y: center.y - (center.y - pan.y) * ratio
      })
      setZoom(clampedZoom)
      commitViewState({ scale: clampedZoom })
    },
    [commitViewState, pan, zoom]
  )

  const changeZoom = (factor: number): void => {
    zoomAround(zoom * factor)
  }

  const zoomWithWheel = (event: React.WheelEvent<HTMLDivElement>): void => {
    event.preventDefault()
    let delta = event.deltaY
    if (event.deltaMode === 1) {
      delta *= 40
    } else if (event.deltaMode === 2) {
      delta *= 800
    }
    const nextZoom = zoom * Math.pow(1.5, -delta / 120)
    if (nextZoom < zoom) {
      zoomAround(nextZoom)
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    zoomAround(nextZoom, {
      x: event.clientX - bounds.left - bounds.width / 2,
      y: event.clientY - bounds.top - bounds.height / 2
    })
  }

  const panWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      changeZoom(1.5)
      return
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      changeZoom(1 / 1.5)
      return
    }
    if (event.key === '0') {
      event.preventDefault()
      fitGraph()
      return
    }
    const movement: Record<string, GraphPan> = {
      ArrowLeft: { x: -32, y: 0 },
      ArrowRight: { x: 32, y: 0 },
      ArrowUp: { x: 0, y: -32 },
      ArrowDown: { x: 0, y: 32 }
    }
    const delta = movement[event.key]
    if (!delta) {
      return
    }
    event.preventDefault()
    const speed = event.shiftKey ? 3 : 1
    setPan((currentPan) => ({
      x: currentPan.x + delta.x * speed,
      y: currentPan.y + delta.y * speed
    }))
  }

  const pointInGraphWorld = useCallback(
    (clientX: number, clientY: number): GraphPan => {
      const canvas = canvasRef.current
      if (!canvas) {
        return { x: 0, y: 0 }
      }
      const bounds = canvas.getBoundingClientRect()
      return {
        x: (clientX - bounds.left - bounds.width / 2 - pan.x) / zoom,
        y: (clientY - bounds.top - bounds.height / 2 - pan.y) / zoom
      }
    },
    [pan, zoom]
  )

  const startNodeDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    path: string
  ): void => {
    if (event.button !== 0) {
      return
    }
    event.stopPropagation()
    const point = pointInGraphWorld(event.clientX, event.clientY)
    nodeDrag.current = {
      pointerId: event.pointerId,
      path,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    }
    simulation.dragStart(path, point.x, point.y)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const updateNodeDrag = (
    pointerId: number,
    clientX: number,
    clientY: number
  ): boolean => {
    const currentDrag = nodeDrag.current
    if (!currentDrag || currentDrag.pointerId !== pointerId) {
      return false
    }
    const deltaX = clientX - currentDrag.startX
    const deltaY = clientY - currentDrag.startY
    if (deltaX * deltaX + deltaY * deltaY > 25) {
      currentDrag.moved = true
      suppressNodeClick.current = currentDrag.path
    }
    const point = pointInGraphWorld(clientX, clientY)
    simulation.drag(currentDrag.path, point.x, point.y)
    return true
  }

  const moveNodeDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (updateNodeDrag(event.pointerId, event.clientX, event.clientY)) {
      event.stopPropagation()
    }
  }

  const finishNodeDrag = (pointerId: number): boolean => {
    const currentDrag = nodeDrag.current
    if (!currentDrag || currentDrag.pointerId !== pointerId) {
      return false
    }
    simulation.dragEnd(currentDrag.path)
    if (currentDrag.moved) {
      suppressNodeClick.current = currentDrag.path
    }
    nodeDrag.current = null
    return true
  }

  const stopNodeDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!finishNodeDrag(event.pointerId)) {
      return
    }
    event.stopPropagation()
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const startPan = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) {
      return
    }
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pan
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const movePan = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (updateNodeDrag(event.pointerId, event.clientX, event.clientY)) {
      return
    }
    if (!drag.current || drag.current.pointerId !== event.pointerId) {
      return
    }
    setPan({
      x: drag.current.pan.x + event.clientX - drag.current.startX,
      y: drag.current.pan.y + event.clientY - drag.current.startY
    })
  }

  const stopPan = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (finishNodeDrag(event.pointerId)) {
      return
    }
    if (!drag.current || drag.current.pointerId !== event.pointerId) {
      return
    }
    drag.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  return (
    <section
      className="wiki-graph-view"
      role="region"
      aria-label={scope === 'local' ? 'ローカルグラフ' : 'Vault全体グラフ'}
      style={{
        position: 'relative',
        display: 'flex',
        minWidth: 0,
        minHeight: 0,
        flexDirection: 'column',
        gap: 0,
        padding: 0,
        overflow: 'hidden',
        background: '#fff'
      }}
    >
      {scope === 'vault' && (
        <button
          type="button"
          aria-label="グラフのタイムラプスアニメーションを開始"
          title="タイムラプスアニメーションの開始"
          onClick={startTimeline}
          style={{
            position: 'absolute',
            top: 12,
            right: settingsOpen ? 264 : 52,
            zIndex: 20,
            width: 32,
            height: 32,
            padding: 0,
            color: '#5c5c5c',
            background: '#fff',
            border: '1px solid #dadada',
            borderRadius: 5,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)'
          }}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 4 5 5L7 22l-5-5Z" />
            <path d="m14 15 4-4" />
            <path d="M6 4v4M4 6h4M19 17v4M17 19h4" />
          </svg>
        </button>
      )}
      {!settingsOpen && (
        <button
          type="button"
          aria-label="グラフ設定を開く"
          aria-expanded="false"
          onClick={() => changeSettingsOpen(true)}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 20,
            width: 32,
            height: 32,
            padding: 0,
            color: '#5c5c5c',
            background: '#fff',
            border: '1px solid #dadada',
            borderRadius: 5,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)'
          }}
        >
          ⚙
        </button>
      )}
      {settingsOpen && (
          <aside
            aria-label="グラフ設定"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 20,
              display: 'grid',
              width: 240,
              maxWidth: 'calc(100% - 24px)',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              background: '#fff',
              border: '1px solid #dadada',
              borderRadius: 5,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.14)'
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '9px 10px',
                background: '#fff',
                borderBottom: '1px solid #dadada'
              }}
            >
              <button type="button" onClick={restoreGraphSettings}>
                初期設定に戻す
              </button>
              <button
                type="button"
                aria-label="グラフ設定を閉じる"
                onClick={() => changeSettingsOpen(false)}
              >
                ×
              </button>
            </div>

            <section>
              <button
                type="button"
                aria-label={
                  settingsSections.filters
                    ? 'フィルタを閉じる'
                    : 'フィルタを開く'
                }
                aria-expanded={settingsSections.filters}
                aria-controls="graph-settings-filters"
                onClick={() => toggleSettingsSection('filters')}
                style={{ width: '100%', padding: '6px 12px', textAlign: 'left' }}
              >
                {settingsSections.filters ? '⌄' : '›'} フィルタ
              </button>
              {settingsSections.filters && (
                <div
                  id="graph-settings-filters"
                  style={{ display: 'grid', gap: 9, padding: '6px 12px' }}
                >
                  <input
                    type="search"
                    aria-label="ファイルを検索…"
                    placeholder="ファイルを検索…"
                    value={filterQuery}
                    onChange={(event) => {
                      const query = event.target.value
                      setFilterQuery(query)
                      commitViewState({ query })
                    }}
                    style={{ width: '100%', padding: '6px 8px' }}
                  />
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 11,
                      color: '#444'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filterSettings.showTags}
                      onChange={(event) =>
                        changeFilterSetting('showTags', event.target.checked)
                      }
                    />
                    タグ
                  </label>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 11,
                      color: '#444'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filterSettings.showAttachments}
                      onChange={(event) =>
                        changeFilterSetting(
                          'showAttachments',
                          event.target.checked
                        )
                      }
                    />
                    添付書類
                  </label>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 11,
                      color: '#444'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filterSettings.existingFilesOnly}
                      onChange={(event) =>
                        changeFilterSetting(
                          'existingFilesOnly',
                          event.target.checked
                        )
                      }
                    />
                    存在するファイルのみ表示
                  </label>
                  {scope === 'local' && (
                    <>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          fontSize: 11,
                          color: '#444'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={filterSettings.neighborLinks}
                          onChange={(event) =>
                            changeFilterSetting(
                              'neighborLinks',
                              event.target.checked
                            )
                          }
                        />
                        ネイバーリンク
                      </label>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          fontSize: 11,
                          color: '#444'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={filterSettings.outgoingLinks}
                          onChange={(event) =>
                            changeFilterSetting(
                              'outgoingLinks',
                              event.target.checked
                            )
                          }
                        />
                        出ていくリンク
                      </label>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          fontSize: 11,
                          color: '#444'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={filterSettings.incomingLinks}
                          onChange={(event) =>
                            changeFilterSetting(
                              'incomingLinks',
                              event.target.checked
                            )
                          }
                        />
                        入ってくるリンク
                      </label>
                    </>
                  )}
                  {scope === 'vault' && (
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        fontSize: 11,
                        color: '#444'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={filterSettings.showOrphans}
                        onChange={(event) =>
                          changeFilterSetting(
                            'showOrphans',
                            event.target.checked
                          )
                        }
                      />
                      オーファン
                    </label>
                  )}
                </div>
              )}
            </section>

            <section>
              <button
                type="button"
                aria-label={
                  settingsSections.groups
                    ? 'グループを閉じる'
                    : 'グループを開く'
                }
                aria-expanded={settingsSections.groups}
                aria-controls="graph-settings-groups"
                onClick={() => toggleSettingsSection('groups')}
                style={{ width: '100%', padding: '6px 12px', textAlign: 'left' }}
              >
                {settingsSections.groups ? '⌄' : '›'} グループ
              </button>
              {settingsSections.groups && (
                <div
                  id="graph-settings-groups"
                  style={{ display: 'grid', gap: 9, padding: '6px 12px' }}
                >
                  {groups.map((group, index) => (
                    <div
                      key={group.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px minmax(0, 1fr) 24px',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <input
                        type="color"
                        aria-label={`グループ${index + 1}の色`}
                        title={'クリックで色を変更\nドラッグでグループを並び替え'}
                        draggable
                        value={group.color}
                        onDragStart={() => {
                          draggedGroupId.current = group.id
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => dropGroup(group.id)}
                        onDragEnd={() => {
                          draggedGroupId.current = null
                        }}
                        onChange={(event) =>
                          updateGroup(
                            group.id,
                            { color: event.target.value },
                            true
                          )
                        }
                        style={{ width: 24, height: 24, padding: 0 }}
                      />
                      <input
                        type="text"
                        aria-label={`グループ${index + 1}のクエリ`}
                        placeholder="クエリを入力…"
                        value={group.query}
                        onChange={(event) =>
                          updateGroup(group.id, { query: event.target.value })
                        }
                        onBlur={commitGroups}
                        style={{ minWidth: 0, padding: '6px 8px' }}
                      />
                      <button
                        type="button"
                        aria-label={`グループ${index + 1}を削除`}
                        onClick={() => deleteGroup(group.id)}
                        style={{ width: 24, height: 24, padding: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addGroup}>
                    新規グループ
                  </button>
                </div>
              )}
            </section>

            <section>
              <button
                type="button"
                aria-label={
                  settingsSections.display ? '表示を閉じる' : '表示を開く'
                }
                aria-expanded={settingsSections.display}
                aria-controls="graph-settings-display"
                onClick={() => toggleSettingsSection('display')}
                style={{ width: '100%', padding: '6px 12px', textAlign: 'left' }}
              >
                {settingsSections.display ? '⌄' : '›'} 表示
              </button>
              {settingsSections.display && (
                <div
                  id="graph-settings-display"
                  style={{ display: 'grid', gap: 9, padding: '6px 12px' }}
                >
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 11,
                      color: '#444'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={displaySettings.arrows}
                      onChange={(event) =>
                        changeDisplaySettings(
                          {
                            ...displaySettings,
                            arrows: event.target.checked
                          },
                          true
                        )
                      }
                    />
                    矢印
                  </label>
                  {(
                    [
                      ['textFade', 'テキストフェードの閾値'],
                      ['nodeSize', 'ノードの大きさ'],
                      ['lineSize', 'リンクの太さ']
                    ] as const
                  ).map(([setting, label]) => {
                    const range = GRAPH_DISPLAY_RANGES[setting]
                    return (
                      <label
                        key={setting}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '74px minmax(64px, 1fr) 28px',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 11,
                          color: '#444'
                        }}
                      >
                        <span>{label}</span>
                        <input
                          type="range"
                          aria-label={label}
                          min={range.min}
                          max={range.max}
                          step={range.step}
                          value={displaySettings[setting]}
                          onChange={(event) =>
                            changeDisplaySettings({
                              ...displaySettings,
                              [setting]: Number(event.target.value)
                            })
                          }
                          onBlur={commitDisplaySettings}
                          onPointerUp={commitDisplaySettings}
                          onKeyUp={commitDisplaySettings}
                        />
                        <output>{displaySettings[setting]}</output>
                      </label>
                    )
                  })}
                </div>
              )}
            </section>

            <section>
              <button
                type="button"
                aria-label={
                  settingsSections.forces
                    ? '力の強さを閉じる'
                    : '力の強さを開く'
                }
                aria-expanded={settingsSections.forces}
                aria-controls="graph-settings-forces"
                onClick={() => toggleSettingsSection('forces')}
                style={{ width: '100%', padding: '6px 12px', textAlign: 'left' }}
              >
                {settingsSections.forces ? '⌄' : '›'} 力の強さ
              </button>
              {settingsSections.forces && (
                <div
                  id="graph-settings-forces"
                  style={{ display: 'grid', gap: 9, padding: '6px 12px' }}
                >
                  {(
                    [
                      ['centerForce', '中心力'],
                      ['repelForce', '反発力'],
                      ['linkForce', 'リンクする力'],
                      ['linkDistance', 'リンク距離']
                    ] as const
                  ).map(([setting, label]) => (
                    <label
                      key={setting}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '74px minmax(64px, 1fr) 28px',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 11,
                        color: '#444'
                      }}
                    >
                      <span>{label}</span>
                      <input
                        type="range"
                        aria-label={label}
                        min={GRAPH_FORCE_RANGES[setting].min}
                        max={GRAPH_FORCE_RANGES[setting].max}
                        step={setting === 'linkDistance' ? 1 : 'any'}
                        value={forceSettings[setting]}
                        onChange={(event) =>
                          changeForceSetting(setting, Number(event.target.value))
                        }
                        onBlur={commitForceSettings}
                        onPointerUp={commitForceSettings}
                        onKeyUp={commitForceSettings}
                      />
                      <output>
                        {setting === 'linkDistance'
                          ? Math.round(forceSettings[setting])
                          : Number(forceSettings[setting].toFixed(3))}
                      </output>
                    </label>
                  ))}
                </div>
              )}
            </section>
          </aside>
        )}

      {scope === 'local' && !current ? (
          <p style={{ margin: 8, color: '#777' }}>
          現在のノートをグラフに表示できません。
        </p>
      ) : (
        <>
          <div
            ref={canvasRef}
            className="wiki-graph-canvas"
            role="region"
            aria-label="グラフキャンバス"
            tabIndex={0}
            onKeyDown={panWithKeyboard}
            onWheel={zoomWithWheel}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={stopPan}
            onPointerCancel={stopPan}
            style={{ ...canvasStyle, cursor: 'grab', touchAction: 'none' }}
          >
            <GraphEdgeCanvas
              graph={visibleGraph}
              positions={positions}
              nodeRadii={nodeRadii}
              activePath={activePath}
              simulation={simulation}
              showArrows={displaySettings.arrows}
              lineSizeMultiplier={displaySettings.lineSize}
              zoom={zoom}
              pan={pan}
            />
            <div
              className="wiki-graph-stage"
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center'
              }}
            >
            {positioned.map(({ node, x, y }) => {
              const relation = relations.get(node.path) ?? 'related'
              const isCurrent = relation === 'current'
              const dimmed = Boolean(activePath) && !emphasizedPaths.has(node.path)
              const isActive = activePath === node.path
              const isUnresolved =
                node.kind === 'unresolved' || node.exists === false
              const isTag =
                'kind' in node &&
                (node as WikiGraphNode & { kind?: string }).kind === 'tag'
              const isAttachment = node.kind === 'attachment'
              const colors = nodeColors(
                isCurrent,
                isActive,
                isUnresolved,
                isTag,
                isAttachment,
                groupColors.get(node.path) ?? null
              )
              const nodeRadius = nodeRadii.get(node.path) ?? 8
              const nodeDiameter = nodeRadius * 2
              const isHighlighted =
                visibleHoveredPath === node.path ||
                visibleFocusedPath === node.path
              const labelScale = isHighlighted
                ? zoomGeometry.highlightedLabelScale
                : zoomGeometry.nodeScale
              const label = isTag
                ? `${node.name}（タグ）を検索`
                : isAttachment
                  ? `${node.name}（添付書類）を開く`
                : isCurrent
                  ? `${node.name}（現在のノート）`
                  : `${node.name}（${relationLabel(relation)}）を開く`

              return (
                <button
                  type="button"
                  className={`wiki-graph-node is-${relation}`}
                  key={node.path}
                  aria-label={label}
                  aria-current={isCurrent ? 'true' : undefined}
                  title={node.path}
                  ref={(element) => {
                    if (element) {
                      nodeElements.current.set(node.path, element)
                    } else {
                      nodeElements.current.delete(node.path)
                    }
                  }}
                  onClick={(event) => {
                    if (suppressNodeClick.current === node.path) {
                      suppressNodeClick.current = null
                      event.preventDefault()
                      return
                    }
                    if (isTag) {
                      onSearchTag(node.name)
                      return
                    }
                    onOpen(node.path)
                  }}
                  onContextMenu={(event) => {
                    if (isTag) {
                      event.preventDefault()
                      onSearchTag(node.name)
                      return
                    }
                    if (isUnresolved) {
                      return
                    }
                    event.preventDefault()
                    const bounds = canvasRef.current?.getBoundingClientRect()
                    setNodeContextMenu({
                      node,
                      x: event.clientX - (bounds?.left ?? 0),
                      y: event.clientY - (bounds?.top ?? 0)
                    })
                  }}
                  onPointerDown={(event) => startNodeDrag(event, node.path)}
                  onPointerMove={moveNodeDrag}
                  onPointerUp={stopNodeDrag}
                  onPointerCancel={stopNodeDrag}
                  onMouseEnter={() => setHoveredPath(node.path)}
                  onMouseLeave={() => setHoveredPath(null)}
                  onFocus={() => setFocusedPath(node.path)}
                  onBlur={() => setFocusedPath(null)}
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    zIndex: isCurrent ? 2 : 1,
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5 * zoomGeometry.nodeScale,
                    maxWidth: 150,
                    minWidth: nodeDiameter,
                    minHeight: nodeDiameter,
                    padding: '0 3px 2px',
                    overflow: 'visible',
                    color: colors.color,
                    font: 'inherit',
                    fontWeight: isCurrent ? 700 : 500,
                    opacity: dimmed ? 0.28 : isUnresolved ? 0.5 : 1,
                    cursor: 'grab',
                    background: 'transparent',
                    border: 0,
                    borderRadius: 4,
                    boxShadow: 'none',
                    transform: `translate(-50%, -${nodeRadius}px)`
                  }}
                >
                  <span
                    className="wiki-graph-node-dot"
                    aria-hidden="true"
                    style={{
                      display: 'block',
                      width: nodeDiameter,
                      height: nodeDiameter,
                      flex: `0 0 ${nodeDiameter}px`,
                      background: colors.background,
                      border: `1px solid ${colors.borderColor}`,
                      borderRadius: '50%',
                      boxShadow: 'none'
                    }}
                  />
                  <span
                    className="wiki-graph-node-label"
                    aria-hidden="true"
                    style={{
                      display: 'block',
                      opacity: isHighlighted
                        ? 1
                        : calculateGraphLabelOpacity(
                            zoom,
                            displaySettings.textFade
                          ),
                      position: 'relative',
                      top: isHighlighted ? 15 / zoom : 0,
                      transform: `scale(${labelScale})`,
                      transformOrigin: 'top center',
                      maxWidth: 144,
                      overflow: 'hidden',
                      fontSize: 11,
                      lineHeight: '14px',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textShadow:
                        '0 1px #fff, 1px 0 #fff, 0 -1px #fff, -1px 0 #fff'
                    }}
                  >
                    {node.name}
                  </span>
                </button>
              )
            })}
            </div>
            {nodeContextMenu && (
              <div
                className="wiki-graph-context-menu"
                role="menu"
                aria-label={nodeContextMenu.node.name}
                style={{
                  position: 'absolute',
                  left: nodeContextMenu.x,
                  top: nodeContextMenu.y,
                  zIndex: 30
                }}
              >
                <div className="wiki-graph-context-title">
                  {nodeContextMenu.node.name}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!onOpenInNewTab}
                  title={onOpenInNewTab ? undefined : 'タブ表示は未実装です'}
                  onClick={() => {
                    onOpenInNewTab?.(nodeContextMenu.node.path)
                    setNodeContextMenu(null)
                  }}
                >
                  新規タブに開く
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={
                    nodeContextMenu.node.kind !== 'attachment' || !onOpenInNewWindow
                  }
                  title={
                    nodeContextMenu.node.kind === 'attachment' && onOpenInNewWindow
                      ? undefined
                      : '添付ファイル以外の新規ウィンドウ表示は未実装です'
                  }
                  onClick={() => {
                    onOpenInNewWindow?.(nodeContextMenu.node.path)
                    setNodeContextMenu(null)
                  }}
                >
                  新規ウィンドウで開く
                </button>
                {nodeContextMenu.node.exists !== false &&
                  nodeContextMenu.node.kind !== 'tag' &&
                  nodeContextMenu.node.kind !== 'unresolved' && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!onMove}
                        onClick={() => {
                          onMove?.(nodeContextMenu.node.path)
                          setNodeContextMenu(null)
                        }}
                      >
                        ファイルを移動…
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!onBookmark}
                        onClick={() => {
                          onBookmark?.(nodeContextMenu.node.path)
                          setNodeContextMenu(null)
                        }}
                      >
                        {bookmarkedPaths.has(nodeContextMenu.node.path)
                          ? 'ブックマークを編集'
                          : 'ブックマーク…'}
                      </button>
                    </>
                  )}
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  disabled={!onTrash}
                  onClick={() => {
                    onTrash?.(nodeContextMenu.node.path)
                    setNodeContextMenu(null)
                  }}
                >
                  ファイルを削除
                </button>
              </div>
            )}
          </div>

            {scope === 'local' && visibleGraph.edges.length === 0 && (
            <p
              className="wiki-graph-empty"
              style={{
                margin: 0,
                fontSize: 12,
                color: '#777',
                textAlign: 'center'
              }}
            >
              {filterQuery.trim()
                ? '絞り込み条件に一致する接続がありません。'
                : 'このノートには接続がありません。'}
            </p>
          )}
        </>
      )}
    </section>
  )
}
