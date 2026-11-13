import type { CanvasNode } from '../shared/canvas'

export interface CanvasViewTransform { x: number; y: number; zoom: number }
export interface CanvasPoint { x: number; y: number }

export function canvasGroupMembers(nodes: readonly CanvasNode[], selectedIds: readonly string[]): string[] {
  const members = new Set(selectedIds.filter(id => nodes.some(node => node.id === id)))
  let changed = true
  while (changed) {
    changed = false
    for (const id of members) {
      const group = nodes.find(node => node.id === id && node.type === 'group')
      if (!group) continue
      for (const node of nodes) {
        if (members.has(node.id)) continue
        if (node.x >= group.x && node.y >= group.y && node.x + node.width <= group.x + group.width && node.y + node.height <= group.y + group.height) {
          members.add(node.id); changed = true
        }
      }
    }
  }
  return nodes.filter(node => members.has(node.id)).map(node => node.id)
}

export function canvasTranslate(nodes: readonly CanvasNode[], selectedIds: readonly string[], dx: number, dy: number): CanvasNode[] {
  const selected = new Set(canvasGroupMembers(nodes, selectedIds))
  const moving = nodes.filter(node => selected.has(node.id))
  if (!moving.length) return [...nodes]
  const minX = Math.min(...moving.map(node => node.x)), maxX = Math.max(...moving.map(node => node.x))
  const minY = Math.min(...moving.map(node => node.y)), maxY = Math.max(...moving.map(node => node.y))
  const x = Math.max(-1_000_000 - minX, Math.min(1_000_000 - maxX, Math.round(dx)))
  const y = Math.max(-1_000_000 - minY, Math.min(1_000_000 - maxY, Math.round(dy)))
  return nodes.map(node => selected.has(node.id) ? { ...node, x: node.x + x, y: node.y + y } as CanvasNode : node)
}

export function canvasAlign(nodes: readonly CanvasNode[], selectedIds: readonly string[], axis: 'x' | 'y', side: 'start' | 'center' | 'end'): CanvasNode[] {
  const selected = nodes.filter(node => selectedIds.includes(node.id))
  if (selected.length < 2) return [...nodes]
  const size = axis === 'x' ? 'width' : 'height'
  const start = Math.min(...selected.map(node => node[axis]))
  const end = Math.max(...selected.map(node => node[axis] + node[size]))
  const positions = new Map(selected.map(node => [node.id, Math.round(side === 'start' ? start : side === 'end' ? end - node[size] : (start + end - node[size]) / 2)]))
  return nodes.map(node => positions.has(node.id) ? { ...node, [axis]: Math.max(-1_000_000, Math.min(1_000_000, positions.get(node.id)!)) } as CanvasNode : node)
}

export function canvasDistribute(nodes: readonly CanvasNode[], selectedIds: readonly string[], axis: 'x' | 'y'): CanvasNode[] | null {
  const size = axis === 'x' ? 'width' : 'height'
  const selected = nodes.filter(node => selectedIds.includes(node.id)).sort((a, b) => a[axis] - b[axis])
  if (selected.length < 3) return null
  const gap = (selected.at(-1)![axis] - selected[0][axis] - selected.slice(0, -1).reduce((sum, node) => sum + node[size], 0)) / (selected.length - 1)
  if (gap < 0) return null
  let cursor = selected[0][axis]
  const positions = new Map(selected.map(node => {
    const position = Math.round(cursor)
    cursor += node[size] + gap
    return [node.id, position]
  }))
  return nodes.map(node => positions.has(node.id) ? { ...node, [axis]: positions.get(node.id)! } as CanvasNode : node)
}

export function canvasResize(node: CanvasNode, width: number, height: number): CanvasNode {
  return { ...node, width: Math.round(Math.max(1, Math.min(100_000, width))), height: Math.round(Math.max(1, Math.min(100_000, height))) } as CanvasNode
}

export function canvasZoomAt(view: CanvasViewTransform, factor: number, point: CanvasPoint): CanvasViewTransform {
  const zoom = Math.max(.1, Math.min(4, view.zoom * factor))
  const ratio = zoom / view.zoom
  return { x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio, zoom }
}

export function canvasFit(nodes: readonly CanvasNode[], viewport: { width: number; height: number }): CanvasViewTransform {
  if (!nodes.length || viewport.width <= 0 || viewport.height <= 0) return { x: 40, y: 40, zoom: 1 }
  const left = Math.min(...nodes.map(node => node.x)), top = Math.min(...nodes.map(node => node.y))
  const right = Math.max(...nodes.map(node => node.x + node.width)), bottom = Math.max(...nodes.map(node => node.y + node.height))
  const scale = Math.max(.1, Math.min(1, (viewport.width - 80) / (right - left), (viewport.height - 80) / (bottom - top)))
  return { x: 40 - left * scale, y: 40 - top * scale, zoom: scale }
}
