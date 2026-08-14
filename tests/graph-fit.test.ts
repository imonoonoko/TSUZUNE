import { describe, expect, it } from 'vitest'
import { calculateGraphFit } from '../src/core/graph-fit'

describe('Graph fit-to-bounds', () => {
  it('fits world-space content centered around the canvas origin', () => {
    const fit = calculateGraphFit(
      { width: 800, height: 400 },
      { minX: -300, minY: -100, maxX: 300, maxY: 100 }
    )

    expect(fit.zoom).toBeCloseTo(752 / 600)
    expect(fit.pan).toEqual({ x: 0, y: 0 })
  })

  it('centers offset world-space content without adding the viewport center twice', () => {
    const fit = calculateGraphFit(
      { width: 800, height: 400 },
      { minX: 100, minY: -100, maxX: 300, maxY: 100 }
    )

    expect(fit.zoom).toBeCloseTo(352 / 200)
    expect(fit.pan.x).toBeCloseTo(-352)
    expect(fit.pan.y).toBe(0)
  })

  it('keeps fit zoom inside the same 1/128 to 8 camera limits as Obsidian', () => {
    const singleNode = calculateGraphFit(
      { width: 800, height: 400 },
      { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    )
    const hugeGraph = calculateGraphFit(
      { width: 800, height: 400 },
      { minX: -100_000, minY: -100_000, maxX: 100_000, maxY: 100_000 }
    )

    expect(singleNode.zoom).toBe(8)
    expect(singleNode.pan).toEqual({ x: 0, y: 0 })
    expect(hugeGraph.zoom).toBe(1 / 128)
  })
})
