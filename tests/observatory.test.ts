import { describe, expect, it } from 'vitest'
import type { WikiGraph } from '../src/core/graph'
import type { LifeWeatherObservation } from '../src/core/life-weather'
import {
  createObservatoryField,
  stepObservatoryField,
  shortenObservatoryLabel
} from '../src/core/observatory'

const smallGraph: WikiGraph = {
  nodes: [
    { path: 'A.md', name: 'A', kind: 'note', exists: true },
    { path: 'B.md', name: 'B', kind: 'note', exists: true },
    { path: 'C.md', name: 'C', kind: 'note', exists: true },
    { path: 'D.md', name: 'D', kind: 'note', exists: true },
    { path: 'E.md', name: 'E', kind: 'note', exists: true },
    { path: 'F.md', name: 'F', kind: 'note', exists: true },
    { path: 'Missing.md', name: 'Missing', kind: 'unresolved', exists: false }
  ],
  edges: [
    { sourcePath: 'A.md', targetPath: 'B.md' },
    { sourcePath: 'B.md', targetPath: 'A.md' },
    { sourcePath: 'B.md', targetPath: 'C.md' },
    { sourcePath: 'D.md', targetPath: 'E.md' },
    { sourcePath: 'A.md', targetPath: 'Missing.md' }
  ]
}

function createDenseGraph(nodeCount = 589, edgeCount = 4_175): WikiGraph {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    path: `Note-${index.toString().padStart(3, '0')}.md`,
    name: `Note ${index}`,
    kind: 'note' as const,
    exists: true
  }))
  const edges: WikiGraph['edges'] = []
  for (let offset = 1; edges.length < edgeCount; offset += 1) {
    for (let index = 0; index < nodeCount && edges.length < edgeCount; index += 1) {
      edges.push({
        sourcePath: nodes[index].path,
        targetPath: nodes[(index + offset) % nodeCount].path
      })
    }
  }
  return { nodes, edges }
}

function observed(path: string, variant: 'source' | 'proposal'): LifeWeatherObservation {
  return {
    sourceNoteId: path,
    observedAt: variant === 'source' ? 1 : 2,
    contentFeatures: Array.from({ length: 128 }, (_, index) =>
      index === (variant === 'source' ? 3 : 87) ? 1 : 0
    ),
    linkTargets: variant === 'source' ? ['B.md'] : [],
    structureFeatures: {
      characterCount: variant === 'source' ? 8_000 : 80,
      headingCount: variant === 'source' ? 8 : 1,
      outboundLinkCount: variant === 'source' ? 1 : 0
    },
    phaseFeatures: {
      boundaryExplicitness: variant === 'source' ? 1 : 0,
      sourceBearing: variant === 'source' ? 1 : 0,
      observationBearing: variant === 'source' ? 1 : 0,
      proposalBearing: variant === 'proposal' ? 1 : 0,
      revisionResidue: variant === 'source' ? 1 : 0,
      provenanceTrace: variant === 'source' ? 1 : 0,
      temporalTrace: variant === 'source' ? 1 : 0,
      uncertainty: variant === 'proposal' ? 1 : 0
    }
  }
}

function rmsSpread(field: ReturnType<typeof createObservatoryField>): number {
  const center = field.particles.reduce((total, particle) => ({
    x: total.x + particle.x / field.particles.length,
    y: total.y + particle.y / field.particles.length
  }), { x: 0, y: 0 })
  return Math.sqrt(field.particles.reduce((total, particle) => total + Math.hypot(
    particle.x - center.x,
    particle.y - center.y
  ) ** 2, 0) / field.particles.length)
}

function fieldCenter(field: ReturnType<typeof createObservatoryField>): { x: number, y: number } {
  return field.particles.reduce((total, particle) => ({
    x: total.x + particle.x / field.particles.length,
    y: total.y + particle.y / field.particles.length
  }), { x: 0, y: 0 })
}

function severeOverlapCount(field: ReturnType<typeof createObservatoryField>): number {
  let count = 0
  for (let left = 0; left < field.particles.length; left += 1) {
    for (let right = left + 1; right < field.particles.length; right += 1) {
      if (Math.hypot(
        field.particles[left].x - field.particles[right].x,
        field.particles[left].y - field.particles[right].y
      ) < 0.01) count += 1
    }
  }
  return count
}

function nearestNeighbors(field: ReturnType<typeof createObservatoryField>): Map<string, string> {
  return new Map(field.particles.map((particle) => {
    const nearest = field.particles
      .filter((candidate) => candidate.id !== particle.id)
      .sort((left, right) => Math.hypot(particle.x - left.x, particle.y - left.y)
        - Math.hypot(particle.x - right.x, particle.y - right.y))[0]
    return [particle.id, nearest?.id ?? '']
  }))
}

function motionDistances(
  before: ReturnType<typeof createObservatoryField>,
  after: ReturnType<typeof createObservatoryField>
): number[] {
  return before.particles.map((particle, index) => Math.hypot(
    particle.x - after.particles[index].x,
    particle.y - after.particles[index].y
  ))
}

function localGroups(field: ReturnType<typeof createObservatoryField>, radius = 0.11): string[][] {
  const unseen = new Set(field.particles.flatMap((particle, index) => {
    const closeNeighbors = field.particles.filter((candidate) => candidate.id !== particle.id && Math.hypot(
      particle.x - candidate.x,
      particle.y - candidate.y
    ) < 0.075).length
    return closeNeighbors >= 2 ? [index] : []
  }))
  const groups: string[][] = []
  while (unseen.size > 0) {
    const start = unseen.values().next().value as number
    const stack = [start]
    const group: string[] = []
    unseen.delete(start)
    while (stack.length > 0) {
      const current = stack.pop() as number
      group.push(field.particles[current].id)
      for (const candidate of [...unseen]) {
        if (Math.hypot(
          field.particles[current].x - field.particles[candidate].x,
          field.particles[current].y - field.particles[candidate].y
        ) < radius) {
          unseen.delete(candidate)
          stack.push(candidate)
        }
      }
    }
    groups.push(group.sort())
  }
  return groups.sort((left, right) => right.length - left.length)
}

function visibleGroups(field: ReturnType<typeof createObservatoryField>): string[][] {
  return localGroups(field).filter((group) => group.length >= 4)
}

function motionState(field: ReturnType<typeof createObservatoryField>): Array<readonly unknown[]> {
  return field.particles.map((particle) => [
    particle.id,
    particle.x,
    particle.y,
    particle.vx,
    particle.vy,
    particle.radius,
    particle.energy,
    particle.phase
  ])
}

function sampledFields(seed: string): Map<number, ReturnType<typeof createObservatoryField>> {
  const frames = [0, 30, 60, 120, 160, 240, 360, 480, 600, 720, 840, 960, 1080, 1200]
  const samples = new Map<number, ReturnType<typeof createObservatoryField>>()
  let field = createObservatoryField(createDenseGraph(72), { seed })
  for (const frame of frames) {
    field = stepObservatoryField(field, frame - field.frame)
    samples.set(frame, field)
  }
  return samples
}

describe('observatory particle field', () => {
  it('uses only resolved Markdown notes, preserves their paths, and leaves an empty field empty', () => {
    expect(createObservatoryField({ nodes: [], edges: [] }, { seed: 'fixed' }).particles).toEqual([])

    const field = createObservatoryField(smallGraph, { seed: 'fixed' })
    expect(field.particles.map((particle) => particle.path).sort()).toEqual([
      'A.md', 'B.md', 'C.md', 'D.md', 'E.md', 'F.md'
    ])
    expect(field.omittedCount).toBe(0)
  })

  it('is deterministic for the same seed and evolves identically', () => {
    const first = createObservatoryField(createDenseGraph(12), { seed: 'same-seed' })
    const second = createObservatoryField(createDenseGraph(12), { seed: 'same-seed' })

    expect(second).toEqual(first)
    expect(stepObservatoryField(second, 40)).toEqual(stepObservatoryField(first, 40))
    expect(createObservatoryField(createDenseGraph(12), { seed: 'other-seed' })).not.toEqual(first)
  })

  it('ignores graph links and caps a bounded observation without erasing omitted notes', () => {
    const dense = createDenseGraph()
    const withoutLinks = createObservatoryField({ ...dense, edges: [] }, { seed: 'bounded' })
    const withLinks = createObservatoryField(dense, { seed: 'bounded' })

    expect(withLinks).toEqual(withoutLinks)
    expect(withLinks.particles).toHaveLength(72)
    expect(new Set(withLinks.particles.map((particle) => particle.path)).size).toBe(72)
    expect(withLinks.resolvedCount).toBe(589)
    expect(withLinks.omittedCount).toBe(517)
  })

  it('does not let display names influence selection, position, or motion', () => {
    const graph = createDenseGraph(72)
    const renamed = {
      ...graph,
      nodes: graph.nodes.map((node, index) => ({ ...node, name: `別名 ${71 - index}` }))
    }
    const original = createObservatoryField(graph, { seed: 'name-independent' })
    const withOtherNames = createObservatoryField(renamed, { seed: 'name-independent' })

    expect(motionState(withOtherNames)).toEqual(motionState(original))
    expect(motionState(stepObservatoryField(withOtherNames, 240)))
      .toEqual(motionState(stepObservatoryField(original, 240)))
  })

  it('lets note observations change motion response without turning them into a rank', () => {
    const graph = createDenseGraph(2, 0)
    const source = createObservatoryField(graph, {
      seed: 'observed',
      observations: [observed('Note-000.md', 'source'), observed('Note-001.md', 'proposal')]
    })
    const swapped = createObservatoryField(graph, {
      seed: 'observed',
      observations: [observed('Note-000.md', 'proposal'), observed('Note-001.md', 'source')]
    })

    expect(source.particles[0].response).not.toEqual(swapped.particles[0].response)
    expect(stepObservatoryField(source, 240).particles.map(({ x, y }) => [x, y]))
      .not.toEqual(stepObservatoryField(swapped, 240).particles.map(({ x, y }) => [x, y]))
    expect(source.particles[0]).not.toHaveProperty('importance')
    expect(source.particles[0]).not.toHaveProperty('category')
  })

  it('moves particles over time while keeping every coordinate in the bounded world', () => {
    const initial = createObservatoryField(createDenseGraph(24), { seed: 'motion' })
    const evolved = stepObservatoryField(initial, 120)
    const shortRun = stepObservatoryField(initial, 4)
    const shortMotion = motionDistances(initial, shortRun)

    expect(evolved.particles.some((particle, index) =>
      particle.x !== initial.particles[index].x || particle.y !== initial.particles[index].y
    )).toBe(true)
    expect(evolved.particles.every((particle) =>
      particle.x >= 0.04 && particle.x <= 0.96 && particle.y >= 0.04 && particle.y <= 0.82
    )).toBe(true)
    expect(shortMotion.reduce((total, distance) => total + distance, 0) / shortMotion.length).toBeGreaterThanOrEqual(0.004)
    expect(Math.max(...shortMotion)).toBeGreaterThanOrEqual(0.006)
  })

  it('forms moving, differently sized local components without collapsing the field', () => {
    for (const seed of ['alpha', 'beta', 'gamma', 'delta']) {
      const samples = sampledFields(seed)
      const later = [...samples.entries()].filter(([frame]) => frame >= 120).map(([, field]) => field)
      const neighborChanges = [...samples.values()].slice(1).map((field, index) => {
        const before = nearestNeighbors([...samples.values()][index])
        const after = nearestNeighbors(field)
        return [...before.keys()].filter((id) => before.get(id) !== after.get(id)).length / before.size
      })
      const groupObservations = [...samples.entries()]
        .filter(([frame]) => [120, 360, 600, 840, 1080].includes(frame))
        .map(([frame, field]) => ({ frame, groups: visibleGroups(field) }))
      const firstGatheringIndex = groupObservations.findIndex(({ groups }) => groups.length >= 2)
      const hasDissolvedAndReformed = firstGatheringIndex >= 0 && groupObservations
        .slice(firstGatheringIndex + 1)
        .some(({ groups }, index, afterGathering) => {
          const original = groupObservations[firstGatheringIndex].groups
          const dissolved = original.every((group) => !groups.some((candidate) =>
            group.filter((id) => candidate.includes(id)).length / group.length >= 0.75
          ))
          return dissolved && afterGathering.slice(index + 1).some((later) => later.groups.length >= 2)
        })
      expect(later.every((field) => rmsSpread(field) >= 0.16)).toBe(true)
      expect(later.every((field) => severeOverlapCount(field) <= 5)).toBe(true)
      expect([...samples.values()].every((field) => field.particles.every((particle) =>
        particle.x >= 0.04 && particle.x <= 0.96 && particle.y >= 0.04 && particle.y <= 0.82
      ))).toBe(true)
      expect(Math.max(...neighborChanges)).toBeGreaterThanOrEqual(0.25)
      expect(later.every((field) => (localGroups(field)[0]?.length ?? 0) <= 60)).toBe(true)
      expect(groupObservations.filter(({ groups }) => groups.length >= 2).length).toBeGreaterThanOrEqual(4)
      expect(new Set(groupObservations.map(({ groups }) => groups.length)).size).toBeGreaterThanOrEqual(2)
      expect(groupObservations.some(({ groups }) => new Set(groups.map((group) => group.length)).size >= 2)).toBe(true)
      const peakCenters = groupObservations.map(({ frame }) => fieldCenter(samples.get(frame) as ReturnType<typeof createObservatoryField>))
      expect(Math.max(...peakCenters.slice(1).map((center) => Math.hypot(
        center.x - peakCenters[0].x,
        center.y - peakCenters[0].y
      )))).toBeGreaterThanOrEqual(0.08)
      expect(hasDissolvedAndReformed).toBe(true)
    }
  })

  it('lets a singleton drift without inventing a companion or relationship', () => {
    const initial = createObservatoryField({
      nodes: [{ path: 'Only.md', name: 'Only', kind: 'note', exists: true }],
      edges: []
    }, { seed: 'one' })
    const evolved = stepObservatoryField(initial, 30)

    expect(evolved.particles).toHaveLength(1)
    expect(evolved.particles[0].path).toBe('Only.md')
    expect([evolved.particles[0].x, evolved.particles[0].y])
      .not.toEqual([initial.particles[0].x, initial.particles[0].y])
    const longRun = stepObservatoryField(initial, 600).particles[0]
    expect(Math.hypot(longRun.x - 0.5, longRun.y - 0.43)).toBeGreaterThan(0.04)
  })
})

describe('shortenObservatoryLabel', () => {
  it('keeps full short names and ellipsizes long technical titles', () => {
    expect(shortenObservatoryLabel('短い名前')).toBe('短い名前')
    expect(shortenObservatoryLabel('123456789012345678901234567890', 24))
      .toBe('12345678901234567890123…')
  })
})
