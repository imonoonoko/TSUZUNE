import type { WikiGraph, WikiGraphNode } from './graph'
import type { LifeWeatherObservation } from './life-weather'

const MIN_X = 0.04
const MAX_X = 0.96
const MIN_Y = 0.04
const MAX_Y = 0.82
const DEFAULT_PARTICLE_LIMIT = 72

export interface ObservatoryPoint {
  /** Normalized visual coordinates, not a semantic position. */
  x: number
  y: number
}

export interface ObservatoryParticle extends ObservatoryPoint {
  /** Stable identity and real Markdown source. */
  id: string
  path: string
  name: string
  /** Current normalized velocity per simulation frame. */
  vx: number
  vy: number
  /** Visual-only values for a renderer; neither ranks nor classifies a note. */
  radius: number
  energy: number
  phase: number
  /** A local observation lens, never an intrinsic class or importance score. */
  response: {
    drift: number
    orbit: number
    memory: number
    permeability: number
    luminosity: number
    contentPhase: number
  }
  memoryX: number
  memoryY: number
  residue: number
  depth: number
}

export interface ObservatoryField {
  seed: string
  frame: number
  time: number
  particles: ObservatoryParticle[]
  resolvedCount: number
  /** Resolved notes outside this bounded observation still exist in the Vault. */
  omittedCount: number
}

export interface ObservatoryFieldOptions {
  seed?: string
  particleLimit?: number
  observations?: readonly LifeWeatherObservation[]
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'ja') || (left < right ? -1 : left > right ? 1 : 0)
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function seededUnit(value: string): number {
  return stableHash(value) / 0xffffffff
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function boundedLimit(value: number | undefined): number {
  const candidate = typeof value === 'number' && Number.isFinite(value)
    ? value
    : DEFAULT_PARTICLE_LIMIT
  return clamp(Math.floor(candidate), 1, DEFAULT_PARTICLE_LIMIT)
}

function resolvedNotes(graph: WikiGraph): WikiGraphNode[] {
  const notesByPath = new Map<string, WikiGraphNode>()
  for (const node of graph.nodes) {
    if ((node.kind ?? 'note') === 'note' && node.exists !== false) notesByPath.set(node.path, node)
  }
  return [...notesByPath.values()].sort((left, right) => compareText(left.path, right.path))
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function observationResponse(
  path: string,
  observation: LifeWeatherObservation | undefined,
  seed: string,
  temporalPosition = 0.5
): ObservatoryParticle['response'] {
  if (!observation) {
    return {
      drift: 0.7 + seededUnit(`${seed}:${path}:drift`) * 0.6,
      orbit: 0.65 + seededUnit(`${seed}:${path}:orbit`) * 0.7,
      memory: 0.35 + seededUnit(`${seed}:${path}:memory`) * 0.45,
      permeability: 0.35 + seededUnit(`${seed}:${path}:permeability`) * 0.5,
      luminosity: 0.45 + seededUnit(`${seed}:${path}:luminosity`) * 0.35,
      contentPhase: seededUnit(`${seed}:${path}:content`) * Math.PI * 2
    }
  }

  const phase = observation.phaseFeatures
  const structure = observation.structureFeatures
  const projection = observation.contentFeatures.reduce(
    (total, value, index) => ({
      x: total.x + value * Math.cos(index * 2.399963),
      y: total.y + value * Math.sin(index * 2.399963)
    }),
    { x: 0, y: 0 }
  )
  const contentPhase = (
    Math.atan2(projection.y, projection.x) + Math.PI * 2 + temporalPosition * Math.PI * 0.4
  ) % (Math.PI * 2)
  const structurePresence = clamp(
    Math.log1p(structure.characterCount) / 10
      + Math.log1p(structure.headingCount + structure.outboundLinkCount) / 12,
    0,
    1
  )
  const evidenceBearing = mean([
    phase.sourceBearing,
    phase.observationBearing,
    phase.provenanceTrace,
    phase.temporalTrace
  ])

  return {
    drift: 0.58 + (1 - structurePresence) * 0.38 + phase.uncertainty * 0.2 + temporalPosition * 0.18,
    orbit: 0.6 + phase.proposalBearing * 0.32 + evidenceBearing * 0.26 + (1 - temporalPosition) * 0.12,
    memory: 0.28 + phase.revisionResidue * 0.44 + evidenceBearing * 0.24,
    permeability: 0.24 + (1 - phase.boundaryExplicitness) * 0.48 + phase.uncertainty * 0.18,
    luminosity: 0.42 + structurePresence * 0.2 + evidenceBearing * 0.2,
    contentPhase
  }
}

/**
 * Creates a bounded visual observation of real Markdown notes. Links are
 * intentionally ignored. A path is only an opaque deterministic salt; its
 * wording and hierarchy have no semantic effect on the changing display.
 */
export function createObservatoryField(
  graph: WikiGraph,
  options: ObservatoryFieldOptions = {}
): ObservatoryField {
  const seed = options.seed ?? 'tsuzune-observatory-particles-v1'
  const notes = resolvedNotes(graph)
  const observations = new Map(
    (options.observations ?? []).map((observation) => [observation.sourceNoteId, observation])
  )
  const observedTimes = [...observations.values()]
    .map((observation) => observation.observedAt)
    .filter((value): value is number => value !== null && Number.isFinite(value))
  const observedStart = Math.min(...observedTimes)
  const observedSpan = Math.max(1, Math.max(...observedTimes) - observedStart)
  const selected = [...notes]
    .sort((left, right) => stableHash(`${seed}:${left.path}`) - stableHash(`${seed}:${right.path}`) || compareText(left.path, right.path))
    .slice(0, boundedLimit(options.particleLimit))
  const columns = Math.max(1, Math.ceil(Math.sqrt(selected.length * (MAX_X - MIN_X) / (MAX_Y - MIN_Y))))
  const rows = Math.max(1, Math.ceil(selected.length / columns))
  const particles = selected.map((note, index) => {
    const phase = seededUnit(`${seed}:${note.path}:phase`) * Math.PI * 2
    const observation = observations.get(note.path)
    const temporalPosition = observation?.observedAt === null || observation?.observedAt === undefined
      ? 0.5
      : clamp((observation.observedAt - observedStart) / observedSpan, 0, 1)
    const response = observationResponse(note.path, observation, seed, temporalPosition)
    const column = index % columns
    const row = Math.floor(index / columns)
    const jitterX = (seededUnit(`${seed}:${note.path}:x`) - 0.5) * 1.2
    const jitterY = (seededUnit(`${seed}:${note.path}:y`) - 0.5) * 1.2
    return {
      id: note.path,
      path: note.path,
      name: note.name,
      x: clamp(MIN_X + (column + 0.5 + jitterX) / columns * (MAX_X - MIN_X), MIN_X, MAX_X),
      y: clamp(MIN_Y + (row + 0.5 + jitterY) / rows * (MAX_Y - MIN_Y), MIN_Y, MAX_Y),
      vx: 0,
      vy: 0,
      radius: 0.006,
      energy: 0,
      phase,
      response,
      memoryX: 0.5,
      memoryY: 0.43,
      residue: 0,
      depth: Math.sin(phase)
    }
  })
  return {
    seed,
    frame: 0,
    time: 0,
    particles,
    resolvedCount: notes.length,
    omittedCount: notes.length - particles.length
  }
}

interface TemporaryTide extends ObservatoryPoint {
  strength: number
  tone: number
  radius: number
  id: number
}

function activeTides(seed: string, frame: number): TemporaryTide[] {
  const newest = Math.floor(frame / 150)
  const tides: TemporaryTide[] = []
  for (let id = Math.max(0, newest - 4); id <= newest; id += 1) {
    const age = frame - id * 150
    const lifetime = 760 + stableHash(`${seed}:tide:${id}:lifetime`) % 401
    if (age < 0 || age >= lifetime) continue
    const progress = age / lifetime
    const phase = seededUnit(`${seed}:tide:${id}:phase`) * Math.PI * 2
    tides.push({
      id,
      x: clamp(0.13 + seededUnit(`${seed}:tide:${id}:x`) * 0.74 + Math.cos(progress * Math.PI * 2 + phase) * 0.045, 0.09, 0.91),
      y: clamp(0.13 + seededUnit(`${seed}:tide:${id}:y`) * 0.6 + Math.sin(progress * Math.PI * 2 + phase * 1.3) * 0.04, 0.09, 0.77),
      strength: Math.sin(Math.PI * progress) ** 1.7,
      tone: seededUnit(`${seed}:tide:${id}:tone`) * Math.PI * 2,
      radius: 0.055 + seededUnit(`${seed}:tide:${id}:radius`) * 0.11
    })
  }
  return tides
}

function stepOnce(field: ObservatoryField): ObservatoryField {
  const frame = field.frame + 1
  const time = frame * 0.09
  const tides = activeTides(field.seed, frame)
  const selectedTides = field.particles.map((particle) => tides
    .map((tide) => {
      const affinity = (Math.cos(particle.response.contentPhase - tide.tone) + 1) / 2
      const porousChance = seededUnit(`${field.seed}:tide:${tide.id}:particle:${particle.path}`)
      const permeability = particle.response.permeability * 0.42
      const eligible = porousChance < 0.24 + particle.response.permeability * 0.18
      return {
        tide,
        weight: eligible
          ? tide.strength * (affinity * (1 - permeability) + porousChance * permeability)
          : 0
      }
    })
    .filter((candidate) => candidate.weight > 0.18)
    .sort((left, right) => right.weight - left.weight || left.tide.id - right.tide.id)[0])
  const accelerations = field.particles.map((particle) => ({
    x: (Math.cos(time * 0.19 + particle.phase) * 0.00072
      + Math.sin(time * 0.047 + particle.response.contentPhase) * 0.00038) * particle.response.drift,
    y: (Math.sin(time * 0.17 + particle.phase * 1.3) * 0.00072
      + Math.cos(time * 0.053 + particle.response.contentPhase) * 0.00038) * particle.response.drift
  }))

  for (let index = 0; index < field.particles.length; index += 1) {
    const particle = field.particles[index]
    const selection = selectedTides[index]
    if (!selection) {
      accelerations[index].x += (particle.memoryX - particle.x) * particle.residue * 0.0014
      accelerations[index].y += (particle.memoryY - particle.y) * particle.residue * 0.0014
      continue
    }
    const { tide, weight } = selection
    const dx = tide.x - particle.x
    const dy = tide.y - particle.y
    const distance = Math.max(0.0001, Math.hypot(dx, dy))
    const radialError = distance - tide.radius * (0.78 + particle.response.permeability * 0.7)
    const pull = radialError * weight * 0.034
    const orbit = weight * particle.response.orbit * 0.0034
    const direction = seededUnit(`${field.seed}:${particle.path}:handedness`) < 0.5 ? -1 : 1
    accelerations[index].x += dx / distance * pull - dy / distance * orbit * direction
    accelerations[index].y += dy / distance * pull + dx / distance * orbit * direction
  }

  // ponytail: O(n²) is intentional for a maximum of 72 particles; use a spatial index only above that ceiling.
  for (let left = 0; left < field.particles.length; left += 1) {
    for (let right = left + 1; right < field.particles.length; right += 1) {
      const first = field.particles[left]
      const second = field.particles[right]
      const dx = second.x - first.x
      const dy = second.y - first.y
      const distance = Math.max(0.00001, Math.hypot(dx, dy))
      const separation = 0.05
      if (distance > separation) continue

      const force = -(separation - distance) * 0.2
      const forceX = dx / distance * force
      const forceY = dy / distance * force
      accelerations[left].x += forceX
      accelerations[left].y += forceY
      accelerations[right].x -= forceX
      accelerations[right].y -= forceY
    }
  }

  return {
    ...field,
    frame,
    time,
    particles: field.particles.map((particle, index) => {
      const boundaryMargin = 0.08
      if (particle.x < MIN_X + boundaryMargin) accelerations[index].x += (MIN_X + boundaryMargin - particle.x) * 0.012
      if (particle.x > MAX_X - boundaryMargin) accelerations[index].x -= (particle.x - (MAX_X - boundaryMargin)) * 0.012
      if (particle.y < MIN_Y + boundaryMargin) accelerations[index].y += (MIN_Y + boundaryMargin - particle.y) * 0.012
      if (particle.y > MAX_Y - boundaryMargin) accelerations[index].y -= (particle.y - (MAX_Y - boundaryMargin)) * 0.012
      let vx = clamp((particle.vx + accelerations[index].x) * 0.92, -0.016, 0.016)
      let vy = clamp((particle.vy + accelerations[index].y) * 0.92, -0.016, 0.016)
      let x = particle.x + vx
      let y = particle.y + vy
      if (x <= MIN_X || x >= MAX_X) {
        x = clamp(x, MIN_X, MAX_X)
        vx *= -0.45
      }
      if (y <= MIN_Y || y >= MAX_Y) {
        y = clamp(y, MIN_Y, MAX_Y)
        vy *= -0.45
      }
      const selection = selectedTides[index]
      const memoryBlend = selection ? 0.004 + particle.response.memory * 0.01 : 0
      const memoryX = selection
        ? particle.memoryX + (selection.tide.x - particle.memoryX) * memoryBlend
        : particle.memoryX
      const memoryY = selection
        ? particle.memoryY + (selection.tide.y - particle.memoryY) * memoryBlend
        : particle.memoryY
      const residue = selection
        ? clamp(particle.residue + selection.weight * particle.response.memory * 0.008, 0, 1)
        : particle.residue * (0.996 - particle.response.permeability * 0.0015)
      const depth = Math.sin(time * (0.2 + particle.response.orbit * 0.08) + particle.phase)
      const energy = clamp(Math.hypot(vx, vy) / 0.016, 0, 1)
      return {
        ...particle,
        x,
        y,
        vx,
        vy,
        energy,
        radius: 0.0042 + energy * 0.0034 + (depth + 1) * 0.00065,
        memoryX,
        memoryY,
        residue,
        depth
      }
    })
  }
}

export function stepObservatoryField(field: ObservatoryField, steps = 1): ObservatoryField {
  let next = field
  for (let index = 0; index < Math.max(0, Math.floor(steps)); index += 1) next = stepOnce(next)
  return next
}

export function shortenObservatoryLabel(value: string, maxLength = 24): string {
  const characters = Array.from(value.trim())
  const limit = Math.max(1, Math.floor(maxLength))
  if (characters.length <= limit) return characters.join('')
  if (limit === 1) return '…'
  return `${characters.slice(0, limit - 1).join('')}…`
}
