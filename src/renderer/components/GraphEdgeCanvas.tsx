import { useEffect, useRef } from 'react'
import type { WikiGraph } from '../../core/graph'
import { deduplicateGraphGeometryEdges } from '../../core/graph-geometry'
import type {
  GraphPosition,
  WikiGraphSimulation
} from '../../core/graph-layout'
import { calculateGraphZoomGeometry } from '../../shared/graph-display'

export interface GraphEdgeDrawCommand {
  sourcePath: string
  targetPath: string
  source: GraphPosition
  target: GraphPosition
  color: string
  lineWidth: number
  opacity: number
}

export interface GraphArrowDrawCommand extends GraphEdgeDrawCommand {
  localScale: number
}

interface GraphEdgeCanvasProps {
  graph: WikiGraph
  positions: Map<string, GraphPosition>
  nodeRadii?: Map<string, number>
  activePath: string | null
  simulation?: WikiGraphSimulation
  showArrows?: boolean
  lineSizeMultiplier?: number
  zoom?: number
  pan?: PixelPoint
}

export interface PixelPoint {
  x: number
  y: number
}

export interface GraphViewportTransform {
  width: number
  height: number
  zoom: number
  pan: PixelPoint
}

export const GRAPH_NODE_RADIUS = 8

export function graphPointToViewport(
  point: PixelPoint,
  viewport: GraphViewportTransform
): PixelPoint {
  return {
    x: viewport.width / 2 + viewport.pan.x + point.x * viewport.zoom,
    y: viewport.height / 2 + viewport.pan.y + point.y * viewport.zoom
  }
}

export function graphRadiusToViewport(radius: number, zoom: number): number {
  return radius * zoom
}

export function buildGraphEdgeDrawCommands(
  graph: WikiGraph,
  positions: Map<string, GraphPosition>,
  activePath: string | null
): GraphEdgeDrawCommand[] {
  return deduplicateGraphGeometryEdges(graph.edges).flatMap(
    (edge): GraphEdgeDrawCommand[] => {
      const source = positions.get(edge.sourcePath)
      const target = positions.get(edge.targetPath)
      if (!source || !target) {
        return []
      }

      const emphasized =
        activePath === edge.sourcePath || activePath === edge.targetPath
      return [
        {
          ...edge,
          source,
          target,
          color: emphasized ? '#7c5cf0' : '#dadada',
          lineWidth: emphasized ? 1.8 : 1,
          opacity: activePath && !emphasized ? 0.16 : 1
        }
      ]
    }
  )
}

export function buildGraphArrowDrawCommands(
  graph: WikiGraph,
  positions: Map<string, GraphPosition>,
  activePath: string | null,
  zoom: number,
  lineSizeMultiplier: number
): GraphArrowDrawCommand[] {
  const seen = new Set<string>()
  const zoomAlpha = Math.min(1, Math.max(0, 2 * (zoom - 0.3)))
  const localScale = (2 * Math.sqrt(lineSizeMultiplier)) / zoom

  return graph.edges.flatMap((edge): GraphArrowDrawCommand[] => {
    const key = `${edge.sourcePath}\0${edge.targetPath}`
    if (seen.has(key)) {
      return []
    }
    seen.add(key)

    const source = positions.get(edge.sourcePath)
    const target = positions.get(edge.targetPath)
    if (!source || !target) {
      return []
    }

    const emphasized =
      activePath === edge.sourcePath || activePath === edge.targetPath
    const relationAlpha = activePath && !emphasized ? 0.2 : 1
    return [
      {
        ...edge,
        source,
        target,
        color: emphasized ? '#7c5cf0' : '#5c5c5c',
        lineWidth: emphasized ? 1.8 : 1,
        opacity: relationAlpha * zoomAlpha * 0.5,
        localScale
      }
    ]
  })
}

export function edgeEndpointsAtNodeBoundaries(
  source: PixelPoint,
  target: PixelPoint,
  sourceRadius: number,
  targetRadius = sourceRadius
): { source: PixelPoint; target: PixelPoint } {
  const deltaX = target.x - source.x
  const deltaY = target.y - source.y
  const distance = Math.hypot(deltaX, deltaY)
  if (distance === 0) {
    return { source, target }
  }

  const radiusTotal = sourceRadius + targetRadius
  const radiusScale = radiusTotal > distance ? distance / radiusTotal : 1
  const sourceInset = sourceRadius * radiusScale
  const targetInset = targetRadius * radiusScale
  const unitX = deltaX / distance
  const unitY = deltaY / distance
  return {
    source: {
      x: source.x + unitX * sourceInset,
      y: source.y + unitY * sourceInset
    },
    target: {
      x: target.x - unitX * targetInset,
      y: target.y - unitY * targetInset
    }
  }
}

function drawArrow(
  context: CanvasRenderingContext2D,
  target: PixelPoint,
  angle: number,
  color: string,
  localScale: number
): void {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const point = (x: number, y: number): PixelPoint => ({
    x: target.x + localScale * (x * cosine - y * sine),
    y: target.y + localScale * (x * sine + y * cosine)
  })
  const rearTop = point(-4, -2)
  const notch = point(-3, 0)
  const rearBottom = point(-4, 2)
  context.beginPath()
  context.moveTo(target.x, target.y)
  context.lineTo(rearTop.x, rearTop.y)
  context.lineTo(notch.x, notch.y)
  context.lineTo(rearBottom.x, rearBottom.y)
  context.closePath()
  context.fillStyle = color
  context.fill()
}

export default function GraphEdgeCanvas({
  graph,
  positions,
  nodeRadii,
  activePath,
  simulation,
  showArrows = false,
  lineSizeMultiplier = 1,
  zoom = 1,
  pan = { x: 0, y: 0 }
}: GraphEdgeCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const draw = (): void => {
      const currentPositions = simulation?.positions() ?? positions
      const zoomGeometry = calculateGraphZoomGeometry(
        zoom,
        lineSizeMultiplier
      )
      const commands = buildGraphEdgeDrawCommands(
        graph,
        currentPositions,
        activePath
      )
      const arrowCommands = showArrows
        ? buildGraphArrowDrawCommands(
            graph,
            currentPositions,
            activePath,
            zoom,
            lineSizeMultiplier
          )
        : []
      const bounds = canvas.getBoundingClientRect()
      const width = Math.max(
        1,
        Math.round(canvas.clientWidth || bounds.width || 1000)
      )
      const height = Math.max(
        1,
        Math.round(canvas.clientHeight || bounds.height || 600)
      )
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const pixelWidth = Math.round(width * pixelRatio)
      const pixelHeight = Math.round(height * pixelRatio)

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)

      // Rasterize after applying pan and zoom. The canvas itself stays fixed to
      // the viewport, so distant edges are not clipped by a scaled bitmap.
      context.setTransform(
        pixelRatio * zoom,
        0,
        0,
        pixelRatio * zoom,
        pixelRatio * (width / 2 + pan.x),
        pixelRatio * (height / 2 + pan.y)
      )

      const batches = new Map<string, GraphEdgeDrawCommand[]>()
      for (const command of commands) {
        const key = `${command.color}\0${command.lineWidth}\0${command.opacity}`
        const batch = batches.get(key)
        if (batch) {
          batch.push(command)
        } else {
          batches.set(key, [command])
        }
      }

      for (const batch of batches.values()) {
        const style = batch[0]
        context.globalAlpha = style.opacity
        context.strokeStyle = style.color
        context.lineWidth = style.lineWidth * zoomGeometry.lineWidth
        context.beginPath()
        for (const command of batch) {
          const endpoints = edgeEndpointsAtNodeBoundaries(
            command.source,
            command.target,
            nodeRadii?.get(command.sourcePath) ?? GRAPH_NODE_RADIUS,
            nodeRadii?.get(command.targetPath) ?? GRAPH_NODE_RADIUS
          )
          context.moveTo(endpoints.source.x, endpoints.source.y)
          context.lineTo(endpoints.target.x, endpoints.target.y)
        }
        context.stroke()
      }

      for (const command of arrowCommands) {
        if (command.opacity <= 0.001) {
          continue
        }
        const source = command.source
        const targetCenter = command.target
        const distance = Math.hypot(
          targetCenter.x - source.x,
          targetCenter.y - source.y
        )
        if (distance <= lineSizeMultiplier / zoom) {
          continue
        }
        const endpoints = edgeEndpointsAtNodeBoundaries(
          source,
          targetCenter,
          nodeRadii?.get(command.sourcePath) ?? GRAPH_NODE_RADIUS,
          nodeRadii?.get(command.targetPath) ?? GRAPH_NODE_RADIUS
        )
        const angle = Math.atan2(
          endpoints.target.y - endpoints.source.y,
          endpoints.target.x - endpoints.source.x
        )
        const arrowTarget = {
          x: endpoints.target.x - Math.cos(angle),
          y: endpoints.target.y - Math.sin(angle)
        }
        context.globalAlpha = command.opacity
        drawArrow(
          context,
          arrowTarget,
          angle,
          command.color,
          command.localScale
        )
      }
      context.globalAlpha = 1
    }

    draw()
    const unsubscribe = simulation?.subscribe(draw)
    if (typeof ResizeObserver === 'undefined') {
      return unsubscribe
    }

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(canvas)
    return () => {
      unsubscribe?.()
      resizeObserver.disconnect()
    }
  }, [
    activePath,
    graph,
    lineSizeMultiplier,
    nodeRadii,
    pan.x,
    pan.y,
    positions,
    showArrows,
    simulation,
    zoom
  ])

  return (
    <canvas
      ref={canvasRef}
      className="wiki-graph-edges"
      aria-hidden="true"
      data-active-path={activePath ?? ''}
      data-edge-count={deduplicateGraphGeometryEdges(graph.edges).length}
      data-render-space="viewport"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}
    />
  )
}
