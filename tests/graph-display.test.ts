import { describe, expect, it } from 'vitest'
import {
  calculateGraphLabelOpacity,
  calculateGraphNodeRadius,
  calculateGraphZoomGeometry,
  DEFAULT_GRAPH_DISPLAY_SETTINGS,
  GRAPH_DISPLAY_RANGES
} from '../src/shared/graph-display'

describe('Obsidian 1.13.4 graph display calculation contract', () => {
  it('uses the observed Obsidian display defaults', () => {
    expect(DEFAULT_GRAPH_DISPLAY_SETTINGS).toEqual({
      arrows: false,
      textFade: 0,
      nodeSize: 1,
      lineSize: 1
    })
  })

  it('exposes the observed Obsidian display slider ranges', () => {
    expect(GRAPH_DISPLAY_RANGES).toEqual({
      textFade: { min: -3, max: 3, step: 0.1 },
      nodeSize: { min: 0.1, max: 5, step: 'any' },
      lineSize: { min: 0.1, max: 5, step: 'any' }
    })
  })

  it('scales a clamped square-root node radius by the node-size multiplier', () => {
    expect(calculateGraphNodeRadius(0, 1)).toBe(8)
    expect(calculateGraphNodeRadius(8, 1)).toBe(9)
    expect(calculateGraphNodeRadius(24, 1.5)).toBe(22.5)
    expect(calculateGraphNodeRadius(99, 1)).toBe(30)
    expect(calculateGraphNodeRadius(999, 2)).toBe(60)
  })

  it('keeps labels readable at the saved production zoom and clamps opacity to 0..1', () => {
    expect(calculateGraphLabelOpacity(0.25, 0)).toBe(0)
    expect(calculateGraphLabelOpacity(0.36288736930121135, 0)).toBeGreaterThan(0)
    expect(calculateGraphLabelOpacity(0.5, 0)).toBe(1)
    expect(calculateGraphLabelOpacity(Math.SQRT2, 0.75)).toBe(1)
    expect(calculateGraphLabelOpacity(1, 0)).toBe(1)
    expect(calculateGraphLabelOpacity(1, 1)).toBe(1)
    expect(calculateGraphLabelOpacity(1, 2)).toBe(0)
    expect(calculateGraphLabelOpacity(2, 1)).toBe(1)
    expect(calculateGraphLabelOpacity(8, -3)).toBe(1)
  })

  it('derives the observed node, highlighted-label, and line zoom compensation', () => {
    expect(calculateGraphZoomGeometry(0.25, 1.5)).toEqual({
      nodeScale: 2,
      highlightedLabelScale: 4,
      lineWidth: 6
    })
    expect(calculateGraphZoomGeometry(4, 1.5)).toEqual({
      nodeScale: 0.5,
      highlightedLabelScale: 0.5,
      lineWidth: 0.375
    })
  })
})
