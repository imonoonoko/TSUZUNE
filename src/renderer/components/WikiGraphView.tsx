import { useEffect, useId, useRef, useState } from 'react'
import { filterWikiGraph } from '../../core/graph'
import type {
  WikiGraph,
  WikiGraphDepth,
  WikiGraphNode,
  WikiGraphScope
} from '../../core/graph'

interface WikiGraphViewProps {
  graph: WikiGraph
  currentPath: string
  depth: WikiGraphDepth
  scope: WikiGraphScope
  includeOrphans: boolean
  onDepthChange: (depth: WikiGraphDepth) => void
  onScopeChange: (scope: WikiGraphScope) => void
  onIncludeOrphansChange: (include: boolean) => void
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

const canvasStyle: React.CSSProperties = {
  position: 'relative',
  minWidth: 0,
  minHeight: 360,
  flex: '1 1 auto',
  overflow: 'hidden',
  border: '1px solid #ded8cb',
  borderRadius: 8,
  background: '#fbf9f4'
}

function positionNodes(
  nodes: WikiGraphNode[],
  currentPath: string
): PositionedNode[] {
  const current = nodes.find((node) => node.path === currentPath)
  if (!current) {
    return []
  }

  const neighbors = nodes
    .filter((node) => node.path !== currentPath)
    .sort((left, right) => left.path.localeCompare(right.path, 'ja'))
  const innerCount =
    neighbors.length > 12 ? Math.min(12, neighbors.length) : neighbors.length

  const positioned: PositionedNode[] = [{ node: current, x: 50, y: 50 }]
  for (const [index, node] of neighbors.entries()) {
    const inner = index < innerCount
    const ringIndex = inner ? index : index - innerCount
    const count = inner ? innerCount : neighbors.length - innerCount
    const radius = neighbors.length > 12 ? (inner ? 28 : 43) : 38
    const angle = -Math.PI / 2 + (ringIndex * Math.PI * 2) / count
    positioned.push({
      node,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius
    })
  }

  return positioned
}

function nodeRelation(
  graph: WikiGraph,
  currentPath: string,
  nodePath: string
): NodeRelation {
  if (nodePath === currentPath) {
    return 'current'
  }

  const outgoing = graph.edges.some(
    (edge) => edge.sourcePath === currentPath && edge.targetPath === nodePath
  )
  const incoming = graph.edges.some(
    (edge) => edge.sourcePath === nodePath && edge.targetPath === currentPath
  )

  if (outgoing && incoming) {
    return 'both'
  }
  if (outgoing) {
    return 'outgoing'
  }
  if (incoming) {
    return 'incoming'
  }
  return 'related'
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

function nodeColors(relation: NodeRelation): {
  color: string
  background: string
  borderColor: string
} {
  switch (relation) {
    case 'current':
      return {
        color: '#fff',
        background: '#365f59',
        borderColor: '#294b46'
      }
    case 'outgoing':
      return {
        color: '#244e48',
        background: '#dcebe8',
        borderColor: '#9ebeb8'
      }
    case 'incoming':
      return {
        color: '#624c2a',
        background: '#f4e6cd',
        borderColor: '#d1b984'
      }
    case 'both':
      return {
        color: '#4e4163',
        background: '#e9e1f2',
        borderColor: '#b8a5ce'
      }
    default:
      return {
        color: '#46423b',
        background: '#f3efe6',
        borderColor: '#c9c1b3'
      }
  }
}

export default function WikiGraphView({
  graph,
  currentPath,
  depth,
  scope,
  includeOrphans,
  onDepthChange,
  onScopeChange,
  onIncludeOrphansChange,
  onOpen
}: WikiGraphViewProps): React.JSX.Element {
  const markerId = `wiki-graph-arrow-${useId().replaceAll(':', '')}`
  const [filterQuery, setFilterQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<GraphPan>({ x: 0, y: 0 })
  const drag = useRef<GraphDrag | null>(null)
  const visibleGraph = filterWikiGraph(graph, currentPath, filterQuery)
  const positioned = positionNodes(visibleGraph.nodes, currentPath)
  const positions = new Map(
    positioned.map(({ node, x, y }) => [node.path, { x, y }])
  )
  const current = visibleGraph.nodes.find((node) => node.path === currentPath)

  const fitGraph = (): void => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  useEffect(() => {
    fitGraph()
  }, [currentPath])

  const changeZoom = (amount: number): void => {
    setZoom((currentZoom) =>
      Math.min(1.8, Math.max(0.6, Number((currentZoom + amount).toFixed(1))))
    )
  }

  const panWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>): void => {
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
    setPan((currentPan) => ({
      x: currentPan.x + delta.x,
      y: currentPan.y + delta.y
    }))
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
    if (!drag.current || drag.current.pointerId !== event.pointerId) {
      return
    }
    setPan({
      x: drag.current.pan.x + event.clientX - drag.current.startX,
      y: drag.current.pan.y + event.clientY - drag.current.startY
    })
  }

  const stopPan = (event: React.PointerEvent<HTMLDivElement>): void => {
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
        display: 'flex',
        minWidth: 0,
        minHeight: 0,
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        overflow: 'auto',
        background: '#f6f2e9'
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <strong style={{ fontSize: 13, color: '#4f4b43' }}>
            {scope === 'local' ? 'ローカルグラフ' : 'Vault全体グラフ'}
          </strong>
          <span style={{ fontSize: 11, color: '#777167' }}>
            矢印はWikiリンクの向き
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap'
          }}
        >
          <div
            role="group"
            aria-label="グラフの範囲"
            style={{ display: 'flex', gap: 3 }}
          >
            {(['local', 'vault'] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={scope === candidate}
                onClick={() => onScopeChange(candidate)}
                style={{
                  minWidth: candidate === 'local' ? 72 : 78,
                  padding: '4px 8px',
                  color: scope === candidate ? '#fff' : '#4f4b43',
                  font: 'inherit',
                  fontSize: 11,
                  background: scope === candidate ? '#365f59' : '#fffdf8',
                  border: '1px solid #c9c1b3',
                  borderRadius: 5,
                  cursor: 'pointer'
                }}
              >
                {candidate === 'local' ? 'ローカル' : 'Vault全体'}
              </button>
            ))}
          </div>
          {scope === 'local' ? (
          <div
            role="group"
            aria-label="ローカルグラフの深度"
            style={{ display: 'flex', gap: 3 }}
          >
            {([1, 2] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-label={`深度${candidate}`}
                aria-pressed={depth === candidate}
                onClick={() => onDepthChange(candidate)}
                style={{
                  minWidth: 34,
                  padding: '3px 7px',
                  color: depth === candidate ? '#fff' : '#4f4b43',
                  font: 'inherit',
                  fontSize: 11,
                  background: depth === candidate ? '#365f59' : '#fffdf8',
                  border: '1px solid #c9c1b3',
                  borderRadius: 5,
                  cursor: 'pointer'
                }}
              >
                {candidate}段
              </button>
            ))}
          </div>
          ) : (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#5d584f',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={includeOrphans}
                onChange={(event) => onIncludeOrphansChange(event.target.checked)}
              />
              孤立ノートを表示
            </label>
          )}
        </div>
        <input
          type="search"
          aria-label="グラフを絞り込み"
          placeholder="ノート名またはパス"
          value={filterQuery}
          onChange={(event) => setFilterQuery(event.target.value)}
          style={{
            width: '100%',
            padding: '6px 9px',
            color: '#4f4b43',
            font: 'inherit',
            fontSize: 12,
            background: '#fffdf8',
            border: '1px solid #c9c1b3',
            borderRadius: 5
          }}
        />
        <div
          role="group"
          aria-label="グラフ表示"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            aria-label="縮小"
            disabled={zoom <= 0.6}
            onClick={() => changeZoom(-0.2)}
          >
            −
          </button>
          <span aria-live="polite" style={{ minWidth: 82, fontSize: 11 }}>
            表示倍率 {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="拡大"
            disabled={zoom >= 1.8}
            onClick={() => changeZoom(0.2)}
          >
            ＋
          </button>
          <button type="button" aria-label="全体表示" onClick={fitGraph}>
            全体表示
          </button>
        </div>
      </header>

      {!current ? (
        <p style={{ margin: 8, color: '#777167' }}>
          現在のノートをグラフに表示できません。
        </p>
      ) : (
        <>
          <div
            className="wiki-graph-canvas"
            role="region"
            aria-label="グラフキャンバス"
            tabIndex={0}
            onKeyDown={panWithKeyboard}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={stopPan}
            onPointerCancel={stopPan}
            style={{ ...canvasStyle, cursor: 'grab', touchAction: 'none' }}
          >
            <div
              className="wiki-graph-stage"
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center'
              }}
            >
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                overflow: 'visible',
                pointerEvents: 'none'
              }}
            >
              <defs>
                <marker
                  id={markerId}
                  markerWidth="5"
                  markerHeight="5"
                  refX="4"
                  refY="2.5"
                  orient="auto"
                >
                  <path d="M0,0 L5,2.5 L0,5 z" fill="#888276" />
                </marker>
              </defs>
              {visibleGraph.edges.map((edge) => {
                const source = positions.get(edge.sourcePath)
                const target = positions.get(edge.targetPath)
                if (!source || !target) {
                  return null
                }
                return (
                  <line
                    key={`${edge.sourcePath}\0${edge.targetPath}`}
                    data-source-path={edge.sourcePath}
                    data-target-path={edge.targetPath}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="#9c968a"
                    strokeWidth="0.65"
                    vectorEffect="non-scaling-stroke"
                    markerEnd={`url(#${markerId})`}
                  />
                )
              })}
            </svg>

            {positioned.map(({ node, x, y }) => {
              const relation = nodeRelation(
                visibleGraph,
                currentPath,
                node.path
              )
              const colors = nodeColors(relation)
              const isCurrent = relation === 'current'
              const label = isCurrent
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
                  onClick={isCurrent ? undefined : () => onOpen(node.path)}
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    zIndex: isCurrent ? 2 : 1,
                    maxWidth: 150,
                    minHeight: 32,
                    padding: '6px 10px',
                    overflow: 'hidden',
                    color: colors.color,
                    font: 'inherit',
                    fontSize: 12,
                    fontWeight: isCurrent ? 700 : 500,
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: isCurrent ? 'default' : 'pointer',
                    background: colors.background,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: 999,
                    boxShadow: '0 2px 7px rgb(45 40 32 / 12%)',
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {node.name}
                </button>
              )
            })}
            </div>
          </div>

          {visibleGraph.edges.length === 0 && (
            <p
              className="wiki-graph-empty"
              style={{
                margin: 0,
                fontSize: 12,
                color: '#777167',
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
