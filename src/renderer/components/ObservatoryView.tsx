import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { WikiGraph } from '../../core/graph'
import { createLifeWeatherObservations } from '../../core/life-weather'
import {
  createObservatoryField,
  shortenObservatoryLabel,
  stepObservatoryField,
  type ObservatoryField,
  type ObservatoryParticle
} from '../../core/observatory'
import type { NoteDocument } from '../../shared/types'

const LOGICAL_STEP_MS = 90
const MAX_FRAME_GAP_MS = 240
const MAX_PIXEL_RATIO = 2
const HIT_RADIUS_PX = 13

interface ObservatoryViewProps {
  graph: WikiGraph
  notes?: readonly NoteDocument[]
  onOpen: (path: string) => void
}

interface SimulationCursor {
  key: string
  previous: ObservatoryField
  next: ObservatoryField
  progress: number
  lastTimestamp: number | null
  hasDispersed: boolean
  phase: 'drifting' | 'gathering' | 'dispersing' | 'reforming'
}

interface RenderedParticle extends ObservatoryParticle {
  index: number
  pixelX: number
  pixelY: number
  pixelRadius: number
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (): void => setReduced(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  return reduced
}

function fieldKey(field: ObservatoryField): string {
  return [
    field.seed,
    ...field.particles.map((particle) => [
      particle.path,
      particle.response.contentPhase.toFixed(4),
      particle.response.memory.toFixed(4),
      particle.response.permeability.toFixed(4)
    ].join(':'))
  ].join('\u0001')
}

function syncObservationMetadata(
  observed: ObservatoryField,
  current: ObservatoryField
): ObservatoryField {
  const metadata = new Map(current.particles.map((particle) => [particle.path, particle]))
  return {
    ...observed,
    resolvedCount: current.resolvedCount,
    omittedCount: current.omittedCount,
    particles: observed.particles.map((particle) => ({
      ...particle,
      name: metadata.get(particle.path)?.name ?? particle.name,
      response: metadata.get(particle.path)?.response ?? particle.response
    }))
  }
}

function createCursor(field: ObservatoryField, key: string): SimulationCursor {
  return {
    key,
    previous: field,
    next: stepObservatoryField(field),
    progress: 0,
    lastTimestamp: null,
    hasDispersed: false,
    phase: 'drifting'
  }
}

function proximityScore(particles: readonly ObservatoryParticle[]): number {
  let score = 0
  for (let left = 0; left < particles.length; left += 1) {
    for (let right = left + 1; right < particles.length; right += 1) {
      const distance = Math.hypot(
        particles[left].x - particles[right].x,
        particles[left].y - particles[right].y
      )
      if (distance < 0.16) score += 1 - distance / 0.16
    }
  }
  return score
}

function updateCursorPhase(cursor: SimulationCursor): void {
  const change = proximityScore(cursor.next.particles) - proximityScore(cursor.previous.particles)
  if (change < -0.02) {
    cursor.phase = 'dispersing'
    cursor.hasDispersed = true
  } else if (change > 0.02) {
    cursor.phase = cursor.hasDispersed ? 'reforming' : 'gathering'
  } else {
    cursor.phase = 'drifting'
  }
}

function interpolateParticles(cursor: SimulationCursor): ObservatoryParticle[] {
  return cursor.previous.particles.map((particle, index) => {
    const next = cursor.next.particles[index] ?? particle
    const progress = cursor.progress
    return {
      ...particle,
      x: particle.x + (next.x - particle.x) * progress,
      y: particle.y + (next.y - particle.y) * progress,
      vx: particle.vx + (next.vx - particle.vx) * progress,
      vy: particle.vy + (next.vy - particle.vy) * progress,
      radius: particle.radius + (next.radius - particle.radius) * progress,
      energy: particle.energy + (next.energy - particle.energy) * progress
    }
  })
}

function particleDensities(particles: readonly ObservatoryParticle[]): number[] {
  const densities = particles.map(() => 0)
  for (let left = 0; left < particles.length; left += 1) {
    for (let right = left + 1; right < particles.length; right += 1) {
      const distance = Math.hypot(
        particles[left].x - particles[right].x,
        particles[left].y - particles[right].y
      )
      if (distance >= 0.145) continue
      const contribution = 1 - distance / 0.145
      densities[left] += contribution
      densities[right] += contribution
    }
  }
  return densities.map((density) => Math.min(1, density / 3.2))
}

function canvasSize(canvas: HTMLCanvasElement): {
  width: number
  height: number
  pixelRatio: number
} {
  const bounds = canvas.getBoundingClientRect()
  return {
    width: Math.max(1, Math.round(canvas.clientWidth || bounds.width || 1_000)),
    height: Math.max(1, Math.round(canvas.clientHeight || bounds.height || 600)),
    pixelRatio: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  }
}

function drawWorld(
  canvas: HTMLCanvasElement,
  particles: readonly ObservatoryParticle[],
  activeIndex: number | null
): RenderedParticle[] {
  const { width, height, pixelRatio } = canvasSize(canvas)
  const shortSide = Math.min(width, height)
  const rendered = particles.map((particle, index): RenderedParticle => {
    const depth = 0.82 + (particle.depth + 1) * 0.13
    return {
      ...particle,
      index,
      pixelX: particle.x * width,
      pixelY: particle.y * height,
      pixelRadius: Math.min(3.4, Math.max(1.35, particle.radius * shortSide * depth * 0.72))
    }
  })

  canvas.dataset.particleSample = JSON.stringify(
    rendered.slice(0, 16).map((particle) => ({
      index: particle.index,
      path: particle.path,
      name: particle.name,
      x: Number(particle.pixelX.toFixed(3)),
      y: Number(particle.pixelY.toFixed(3))
    }))
  )

  const context = canvas.getContext('2d')
  if (!context) return rendered

  const pixelWidth = Math.round(width * pixelRatio)
  const pixelHeight = Math.round(height * pixelRatio)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, width, height)
  const densities = particleDensities(particles)

  context.save()
  context.globalCompositeOperation = 'lighter'
  const cloudCenters: number[] = []
  for (const index of densities
    .map((density, index) => ({ density, index }))
    .sort((left, right) => right.density - left.density)
    .map(({ index }) => index)) {
    const candidate = rendered[index]
    if (densities[index] < 0.22) break
    if (cloudCenters.some((center) => Math.hypot(
      rendered[center].pixelX - candidate.pixelX,
      rendered[center].pixelY - candidate.pixelY
    ) < shortSide * 0.2)) continue
    cloudCenters.push(index)
    if (cloudCenters.length >= 4) break
  }
  for (const centerIndex of cloudCenters) {
    const center = rendered[centerIndex]
    const nearby = rendered.filter((particle) => Math.hypot(
      particle.pixelX - center.pixelX,
      particle.pixelY - center.pixelY
    ) < shortSide * 0.23)
    const weight = nearby.reduce((sum, particle) => sum + 0.35 + densities[particle.index], 0)
    const cloudX = nearby.reduce(
      (sum, particle) => sum + particle.pixelX * (0.35 + densities[particle.index]),
      0
    ) / weight
    const cloudY = nearby.reduce(
      (sum, particle) => sum + particle.pixelY * (0.35 + densities[particle.index]),
      0
    ) / weight
    const cloudRadius = Math.min(shortSide * 0.24, 56 + nearby.length * 5.5)
    const cloud = context.createRadialGradient(cloudX, cloudY, 0, cloudX, cloudY, cloudRadius)
    cloud.addColorStop(0, `rgba(224, 233, 239, ${(0.018 + densities[centerIndex] * 0.025).toFixed(3)})`)
    cloud.addColorStop(0.26, 'rgba(175, 190, 202, 0.026)')
    cloud.addColorStop(0.68, 'rgba(104, 124, 143, 0.012)')
    cloud.addColorStop(1, 'rgba(68, 84, 103, 0)')
    context.fillStyle = cloud
    context.beginPath()
    context.arc(cloudX, cloudY, cloudRadius, 0, Math.PI * 2)
    context.fill()
  }

  rendered.forEach((particle, index) => {
    const density = densities[index]
    if (density < 0.18) return
    const haloRadius = 24 + density * 58
    const halo = context.createRadialGradient(
      particle.pixelX,
      particle.pixelY,
      0,
      particle.pixelX,
      particle.pixelY,
      haloRadius
    )
    halo.addColorStop(0, `rgba(226, 237, 241, ${(0.035 + density * 0.065).toFixed(3)})`)
    halo.addColorStop(0.38, `rgba(166, 187, 198, ${(0.014 + density * 0.028).toFixed(3)})`)
    halo.addColorStop(1, 'rgba(103, 125, 139, 0)')
    context.fillStyle = halo
    context.beginPath()
    context.arc(particle.pixelX, particle.pixelY, haloRadius, 0, Math.PI * 2)
    context.fill()
  })
  context.restore()

  rendered.forEach((particle, index) => {
    const energy = Math.min(1, particle.energy)
    const depthLight = 0.78 + (particle.depth + 1) * 0.11
    const glowRadius = particle.pixelRadius * 4.2 + densities[index] * 12
    const glow = context.createRadialGradient(
      particle.pixelX,
      particle.pixelY,
      0,
      particle.pixelX,
      particle.pixelY,
      glowRadius
    )
    glow.addColorStop(0, `rgba(255, 255, 255, ${((0.68 + energy * 0.2) * depthLight).toFixed(3)})`)
    glow.addColorStop(0.16, `rgba(220, 233, 240, ${(0.36 + energy * 0.16).toFixed(3)})`)
    glow.addColorStop(0.52, 'rgba(151, 176, 191, 0.085)')
    glow.addColorStop(1, 'rgba(95, 119, 134, 0)')
    context.fillStyle = glow
    context.beginPath()
    context.arc(particle.pixelX, particle.pixelY, glowRadius, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = `rgba(245, 249, 250, ${Math.min(1, (0.58 + energy * 0.25 + particle.response.luminosity * 0.12) * depthLight).toFixed(3)})`
    context.beginPath()
    context.arc(
      particle.pixelX,
      particle.pixelY,
      particle.pixelRadius,
      0,
      Math.PI * 2
    )
    context.fill()

    if (index === activeIndex) {
      context.strokeStyle = 'rgba(236, 246, 250, 0.9)'
      context.lineWidth = 1.4
      context.beginPath()
      context.arc(
        particle.pixelX,
        particle.pixelY,
        particle.pixelRadius + 6,
        0,
        Math.PI * 2
      )
      context.stroke()
    }
  })

  return rendered
}

function pausedReason(
  reducedMotion: boolean,
  documentVisible: boolean,
  userPaused: boolean,
  hasParticles: boolean
): 'reduced-motion' | 'background' | 'user' | 'empty' | 'none' {
  if (!hasParticles) return 'empty'
  if (reducedMotion) return 'reduced-motion'
  if (!documentVisible) return 'background'
  if (userPaused) return 'user'
  return 'none'
}

export default function ObservatoryView({
  graph,
  notes = [],
  onOpen
}: ObservatoryViewProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()
  const observations = useMemo(
    () => createLifeWeatherObservations(notes, graph),
    [graph, notes]
  )
  const field = useMemo(
    () => createObservatoryField(graph, { observations }),
    [graph, observations]
  )
  const key = useMemo(() => fieldKey(field), [field])
  const cursorRef = useRef<SimulationCursor>(createCursor(field, key))
  const latestFieldRef = useRef(field)
  latestFieldRef.current = field
  if (cursorRef.current.key !== key) {
    cursorRef.current = createCursor(field, key)
  }

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const regionRef = useRef<HTMLElement>(null)
  const renderedParticlesRef = useRef<RenderedParticle[]>([])
  const activeIndexRef = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [userPaused, setUserPaused] = useState(false)
  const [documentVisible, setDocumentVisible] = useState(() =>
    typeof document === 'undefined' || !document.hidden
  )

  const hasParticles = field.particles.length > 0
  const isPlaying = hasParticles && !reducedMotion && documentVisible && !userPaused
  const reason = pausedReason(reducedMotion, documentVisible, userPaused, hasParticles)

  const activate = useCallback((index: number | null): void => {
    activeIndexRef.current = index
    setActiveIndex(index)
  }, [])

  const redraw = useCallback((): void => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cursor = cursorRef.current
    const particles = interpolateParticles(cursor)
    renderedParticlesRef.current = drawWorld(canvas, particles, activeIndexRef.current)
    const simulationTime =
      cursor.previous.time + (cursor.next.time - cursor.previous.time) * cursor.progress
    canvas.dataset.simulationTime = simulationTime.toFixed(4)
    canvas.dataset.simulationFrame = cursor.previous.frame.toString()
    canvas.dataset.fieldState = cursor.phase
    const region = regionRef.current
    if (region) {
      region.dataset.simulationTime = canvas.dataset.simulationTime
      region.dataset.phase = cursor.phase
    }
  }, [])

  useEffect(() => {
    activeIndexRef.current = null
    setActiveIndex(null)
    cursorRef.current = createCursor(latestFieldRef.current, key)
    redraw()
  }, [key, redraw])

  useEffect(() => {
    const cursor = cursorRef.current
    cursor.previous = syncObservationMetadata(cursor.previous, field)
    cursor.next = syncObservationMetadata(cursor.next, field)
    redraw()
  }, [field, redraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleResize = (): void => redraw()
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(handleResize)
      observer.observe(canvas)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [hasParticles, redraw])

  useEffect(() => {
    const updateVisibility = (): void => setDocumentVisible(!document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    redraw()
  }, [activeIndex, redraw])

  useEffect(() => {
    redraw()
    if (!isPlaying) {
      cursorRef.current.lastTimestamp = null
      return
    }

    let frameId = 0
    let disposed = false
    const animate = (timestamp: number): void => {
      if (disposed) return
      const cursor = cursorRef.current
      if (cursor.lastTimestamp === null) {
        cursor.lastTimestamp = timestamp
      } else {
        const elapsed = Math.min(
          MAX_FRAME_GAP_MS,
          Math.max(0, timestamp - cursor.lastTimestamp)
        )
        cursor.lastTimestamp = timestamp
        cursor.progress += elapsed / LOGICAL_STEP_MS
        while (cursor.progress >= 1) {
          cursor.previous = cursor.next
          cursor.next = stepObservatoryField(cursor.next)
          cursor.progress -= 1
          updateCursorPhase(cursor)
        }
      }
      redraw()
      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)
    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      cursorRef.current.lastTimestamp = null
    }
  }, [isPlaying, key, redraw])

  const particleAtPointer = useCallback((
    clientX: number,
    clientY: number
  ): number | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const bounds = canvas.getBoundingClientRect()
    const x = clientX - bounds.left
    const y = clientY - bounds.top
    let closest: { index: number; distance: number } | null = null
    for (const particle of renderedParticlesRef.current) {
      const distance = Math.hypot(particle.pixelX - x, particle.pixelY - y)
      const radius = Math.max(HIT_RADIUS_PX, particle.pixelRadius + 8)
      if (distance <= radius && (!closest || distance < closest.distance)) {
        closest = { index: particle.index, distance }
      }
    }
    return closest?.index ?? null
  }, [])

  const openParticle = useCallback((index: number | null): void => {
    if (index === null) return
    const particle = cursorRef.current.previous.particles[index]
    if (particle) onOpen(particle.path)
  }, [onOpen])

  const activeParticle = activeIndex === null
    ? null
    : field.particles[activeIndex] ?? null
  const captionTitle = activeParticle
    ? shortenObservatoryLabel(activeParticle.name, 28)
    : '知識の粒子を観測中'
  const omission = field.omittedCount > 0
    ? ` · 観測外にも${field.omittedCount}個`
    : ''
  const captionContext = activeParticle
    ? 'クリックまたは Enter でノートを開く'
    : `${field.particles.length}個の光はすべて実在ノート${omission} · 内容、時点、履歴、境界を含む現在の観測表現`

  return (
    <section
      ref={regionRef}
      className="observatory"
      role="region"
      aria-label="観測宙域"
      aria-description="表示する光は取得済みの実在ノートです。近さ、動き、光、集まりは現在の観測表現であり、関係、分類、重要度、価値、同一性を確定しません。表示されないノートも存在します。"
      data-observation-mode="autonomous"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-playing={isPlaying}
      data-paused-reason={reason}
      data-particle-count={field.particles.length}
      data-real-note-count={field.particles.length}
      data-edge-count="0"
    >
      {hasParticles ? (
        <canvas
          ref={canvasRef}
          className="observatory-particle-world"
          role="application"
          aria-label="知識粒子の観測面"
          aria-describedby="observatory-status"
          tabIndex={0}
          data-motion={reducedMotion ? 'reduced' : 'full'}
          data-animation={isPlaying ? 'running' : reducedMotion ? 'static' : 'paused'}
          data-particle-count={field.particles.length}
          data-real-note-count={field.particles.length}
          data-particle-paths={JSON.stringify(field.particles.map((particle) => particle.path))}
          data-edge-count="0"
          data-active-path={activeParticle?.path}
          title={activeParticle?.name ?? '矢印キーでノートを観測'}
          onPointerMove={(event) => activate(particleAtPointer(event.clientX, event.clientY))}
          onPointerLeave={(event) => {
            if (document.activeElement !== event.currentTarget) activate(null)
          }}
          onClick={(event) => {
            const index = particleAtPointer(event.clientX, event.clientY)
            activate(index)
            openParticle(index)
          }}
          onFocus={() => {
            if (activeIndexRef.current === null) activate(0)
          }}
          onBlur={() => activate(null)}
          onKeyDown={(event) => {
            const length = field.particles.length
            if (
              event.key === 'ArrowRight' ||
              event.key === 'ArrowDown' ||
              event.key === 'ArrowLeft' ||
              event.key === 'ArrowUp'
            ) {
              event.preventDefault()
              const direction =
                event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
              const current = activeIndexRef.current
              activate(current === null
                ? direction > 0 ? 0 : length - 1
                : (current + direction + length) % length)
              return
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openParticle(activeIndexRef.current)
              return
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              activate(null)
            }
          }}
        />
      ) : (
        <p className="observatory-empty">まだ観測できるノートはありません</p>
      )}

      {hasParticles ? (
        <div
          id="observatory-status"
          className="observatory-caption"
          role="status"
          aria-live="polite"
        >
          <strong className="observatory-caption-title">{captionTitle}</strong>
          <span className="observatory-caption-context">{captionContext}</span>
        </div>
      ) : null}

      {hasParticles && !reducedMotion ? (
        <div className="observatory-controls" role="group" aria-label="観測操作">
          <button
            type="button"
            aria-label={userPaused ? '再生' : '一時停止'}
            title={userPaused ? '再生' : '一時停止'}
            aria-pressed={userPaused}
            onClick={() => setUserPaused((current) => !current)}
          >
            {userPaused ? '再生' : '一時停止'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
