import { describe, expect, it } from 'vitest'
import * as graphSettingsModule from '../src/shared/graph-settings'
import type { GraphForceSettings } from '../src/shared/types'

interface GraphForceRange {
  min: number
  max: number
}

interface GraphWorkerForceSettings {
  centerForce: number
  repelForce: number
  linkForce: number
  linkDistance: number
}

const graphSettings = graphSettingsModule as typeof graphSettingsModule & {
  GRAPH_FORCE_RANGES: Record<keyof GraphForceSettings, GraphForceRange>
  toGraphWorkerForceSettings(
    settings: GraphForceSettings
  ): GraphWorkerForceSettings
  migrateLegacyGraphForceSettings(value: unknown): GraphForceSettings
}

describe('Obsidian 1.13.4 graph force settings contract', () => {
  it('uses the observed Obsidian defaults in slider space', () => {
    expect(
      graphSettings.DEFAULT_GRAPH_FORCE_SETTINGS.centerForce
    ).toBeCloseTo(0.51871324897, 11)
    expect(graphSettings.DEFAULT_GRAPH_FORCE_SETTINGS).toMatchObject({
      repelForce: 10,
      linkForce: 1,
      linkDistance: 250
    })
  })

  it('exposes the observed slider ranges', () => {
    expect(graphSettings.GRAPH_FORCE_RANGES).toEqual({
      centerForce: { min: 0, max: 1 },
      repelForce: { min: 0, max: 20 },
      linkForce: { min: 0, max: 1 },
      linkDistance: { min: 30, max: 500 }
    })
  })

  it('converts slider values to the values consumed by the graph worker', () => {
    const defaults = graphSettings.toGraphWorkerForceSettings(
      graphSettings.DEFAULT_GRAPH_FORCE_SETTINGS
    )

    expect(defaults.centerForce).toBeCloseTo(0.1, 12)
    expect(defaults.repelForce).toBe(-1000)
    expect(defaults.linkForce).toBe(1)
    expect(defaults.linkDistance).toBe(250)

    const minimums = graphSettings.toGraphWorkerForceSettings({
      centerForce: 0,
      repelForce: 0,
      linkForce: 0,
      linkDistance: 30
    })

    expect(minimums.centerForce).toBeCloseTo(0, 12)
    expect(minimums.repelForce).toBe(-1)
    expect(minimums.linkForce).toBeCloseTo(0, 12)
    expect(minimums.linkDistance).toBe(30)
  })

  it('migrates legacy TSUZUNE 0..100 slider values without changing their force meaning', () => {
    expect(
      graphSettings.migrateLegacyGraphForceSettings({
        centerForce: 50,
        repelForce: 50,
        linkForce: 50,
        linkDistance: 50
      })
    ).toEqual({
      centerForce: 0.5,
      repelForce: 10,
      linkForce: 0.5,
      linkDistance: 265
    })

    expect(
      graphSettings.migrateLegacyGraphForceSettings({
        centerForce: 100,
        repelForce: 100,
        linkForce: 100,
        linkDistance: 100
      })
    ).toEqual({
      centerForce: 1,
      repelForce: 20,
      linkForce: 1,
      linkDistance: 500
    })
  })

  it('uses the legacy migration when parsing existing saved settings', () => {
    expect(
      graphSettings.parseGraphForceSettings({
        centerForce: 50,
        repelForce: 50,
        linkForce: 50,
        linkDistance: 50
      })
    ).toEqual({
      centerForce: 0.5,
      repelForce: 10,
      linkForce: 0.5,
      linkDistance: 265
    })
  })
})
