import { useId } from 'react'
import type {
  WikiGraph,
  WikiGraphNode
} from '../../core/graph'

interface WikiGraphViewProps {
  graph: WikiGraph
  currentPath: string
  onOpen: (path: string) => void
}

interface PositionedNode {
  node: WikiGraphNode
  x: number
  y: number
}

type NodeRelation = 'current' | 'outgoing' | 'incoming' | 'both' | 'related'

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
  onOpen
}: WikiGraphViewProps): React.JSX.Element {
  const markerId = `wiki-graph-arrow-${useId().replaceAll(':', '')}`
  const positioned = positionNodes(graph.nodes, currentPath)
  const positions = new Map(
    positioned.map(({ node, x, y }) => [node.path, { x, y }])
  )
  const current = graph.nodes.find((node) => node.path === currentPath)

  return (
    <section
      className="wiki-graph-view"
      role="region"
      aria-label="ローカルグラフ"
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
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <strong style={{ fontSize: 13, color: '#4f4b43' }}>ローカルグラフ</strong>
        <span style={{ fontSize: 11, color: '#777167' }}>
          矢印はWikiリンクの向き
        </span>
      </header>

      {!current ? (
        <p style={{ margin: 8, color: '#777167' }}>
          現在のノートをグラフに表示できません。
        </p>
      ) : (
        <>
          <div className="wiki-graph-canvas" style={canvasStyle}>
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
              {graph.edges.map((edge) => {
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
              const relation = nodeRelation(graph, currentPath, node.path)
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

          {graph.edges.length === 0 && (
            <p
              className="wiki-graph-empty"
              style={{
                margin: 0,
                fontSize: 12,
                color: '#777167',
                textAlign: 'center'
              }}
            >
              このノートには接続がありません。
            </p>
          )}
        </>
      )}
    </section>
  )
}
