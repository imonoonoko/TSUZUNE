import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../src/shared/canvas'
import { canvasAlign, canvasDistribute, canvasFit, canvasGroupMembers, canvasResize, canvasTranslate, canvasZoomAt } from '../src/renderer/canvas-geometry'

const card = (id: string, x: number, y = 0, width = 100, height = 80): CanvasNode => ({ id, type: 'text', text: id, x, y, width, height })

describe('Canvas geometry', () => {
  it('creates recursive group movement membership without duplicates', () => {
    const nodes: CanvasNode[] = [
      { id: 'outer', type: 'group', x: 0, y: 0, width: 500, height: 400 },
      { id: 'inner', type: 'group', x: 20, y: 20, width: 200, height: 200 },
      card('inside', 30, 30), card('peer', 700, 20)
    ]
    expect(canvasGroupMembers(nodes, ['outer', 'peer'])).toEqual(['outer', 'inner', 'inside', 'peer'])
    expect(canvasTranslate(nodes, ['outer'], 12, -5).map(node => [node.x, node.y])).toEqual([[12, -5], [32, 15], [42, 25], [700, 20]])
  })

  it('aligns selection to the outer bound and evenly distributes without overlap', () => {
    const nodes = [card('a', 0), card('b', 250), card('c', 600)]
    expect(canvasAlign(nodes, ['a', 'b', 'c'], 'x', 'start').map(node => node.x)).toEqual([0, 0, 0])
    expect(canvasAlign(nodes, ['a', 'b', 'c'], 'x', 'end').map(node => node.x)).toEqual([600, 600, 600])
    expect(canvasDistribute(nodes, ['a', 'b', 'c'], 'x')?.map(node => node.x)).toEqual([0, 300, 600])
    expect(canvasDistribute([card('a', 0, 0, 400), card('b', 200, 0, 400), card('c', 700)], ['a', 'b', 'c'], 'x')).toBeNull()
  })

  it('clamps geometry and keeps the pointer world position fixed while zooming', () => {
    const node = card('a', 0)
    expect(canvasResize(node, 0, 100001)).toMatchObject({ width: 1, height: 100000 })
    const zoomed = canvasZoomAt({ x: 40, y: 30, zoom: 1 }, 2, { x: 100, y: 80 })
    expect(zoomed).toEqual({ x: -20, y: -20, zoom: 2 })
    expect(canvasFit([card('a', -100, -50, 200, 100)], { width: 400, height: 300 })).toEqual({ x: 140, y: 90, zoom: 1 })
  })
})
