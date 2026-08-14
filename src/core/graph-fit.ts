export interface GraphViewport {
  width: number
  height: number
}

export interface GraphBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface GraphFitTransform {
  zoom: number
  pan: {
    x: number
    y: number
  }
}

export const GRAPH_FIT_PADDING = 24
export const GRAPH_MIN_ZOOM = 1 / 128
export const GRAPH_MAX_ZOOM = 8

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function calculateGraphFit(
  viewport: GraphViewport,
  bounds: GraphBounds
): GraphFitTransform {
  const availableWidth = Math.max(1, viewport.width - GRAPH_FIT_PADDING * 2)
  const availableHeight = Math.max(1, viewport.height - GRAPH_FIT_PADDING * 2)
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX)
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY)
  const zoom = clamp(
    Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
    GRAPH_MIN_ZOOM,
    GRAPH_MAX_ZOOM
  )
  const contentCenterX = (bounds.minX + bounds.maxX) / 2
  const contentCenterY = (bounds.minY + bounds.maxY) / 2
  const centeredPanX = -contentCenterX * zoom
  const centeredPanY = -contentCenterY * zoom

  return {
    zoom,
    pan: {
      x: centeredPanX === 0 ? 0 : centeredPanX,
      y: centeredPanY === 0 ? 0 : centeredPanY
    }
  }
}
