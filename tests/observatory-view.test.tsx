// @vitest-environment jsdom

import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WikiGraph } from '../src/core/graph'
import ObservatoryView from '../src/renderer/components/ObservatoryView'

function createViewingGraph(nodeCount = 96): WikiGraph {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    path: `Note-${index.toString().padStart(3, '0')}.md`,
    name: index === 0
      ? 'TSUZUNE改善項目批判的現実的探求決定実施記録という非常に長い名前'
      : `Note ${index}`,
    kind: 'note' as const,
    exists: true
  }))
  return {
    nodes: [
      ...nodes,
      { path: 'Missing.md', name: 'Missing', kind: 'unresolved', exists: false },
      { path: 'tag:sample', name: '#sample', kind: 'tag', exists: true },
      { path: 'image.png', name: 'image.png', kind: 'attachment', exists: true }
    ],
    edges: nodes.slice(1).map((node, index) => ({
      sourcePath: nodes[index].path,
      targetPath: node.path
    }))
  }
}

interface MockGradient {
  addColorStop: ReturnType<typeof vi.fn>
}

const gradient = (): MockGradient => ({ addColorStop: vi.fn() })
const canvasContext = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  createLinearGradient: vi.fn(gradient),
  createRadialGradient: vi.fn(gradient),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  fillStyle: '',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  lineCap: 'butt',
  lineWidth: 1,
  shadowBlur: 0,
  shadowColor: '',
  strokeStyle: ''
}

let rafCallbacks = new Map<number, FrameRequestCallback>()
let nextRafId = 1
let hiddenSpy: ReturnType<typeof vi.spyOn>
let resizeCallback: ResizeObserverCallback | null = null

function runAnimationFrame(timestamp: number): void {
  const first = rafCallbacks.entries().next().value as [number, FrameRequestCallback] | undefined
  if (!first) throw new Error('No animation frame is pending')
  rafCallbacks.delete(first[0])
  act(() => first[1](timestamp))
}

function particleSample(canvas: HTMLCanvasElement): Array<{
  index: number
  path: string
  name: string
  x: number
  y: number
}> {
  return JSON.parse(canvas.dataset.particleSample ?? '[]') as Array<{
    index: number
    path: string
    name: string
    x: number
    y: number
  }>
}

beforeEach(() => {
  vi.clearAllMocks()
  rafCallbacks = new Map()
  nextRafId = 1
  resizeCallback = null
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextRafId
    nextRafId += 1
    rafCallbacks.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
    rafCallbacks.delete(id)
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => canvasContext as unknown as CanvasRenderingContext2D
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    bottom: 640,
    height: 640,
    left: 0,
    right: 1024,
    top: 0,
    width: 1024,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })
  hiddenSpy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ObservatoryView autonomous particle world', () => {
  it('renders one quiet Canvas world of real notes without graph or scene residue', () => {
    const { container } = render(
      <ObservatoryView graph={createViewingGraph()} onOpen={() => undefined} />
    )

    const region = screen.getByRole('region', { name: '観測宙域' })
    const canvas = screen.getByRole('application', { name: '知識粒子の観測面' })

    expect(region.getAttribute('data-observation-mode')).toBe('autonomous')
    expect(canvas.classList.contains('observatory-particle-world')).toBe(true)
    expect(canvas.dataset.particleCount).toBe('72')
    expect(canvas.dataset.realNoteCount).toBe('72')
    expect(JSON.parse(canvas.dataset.particlePaths ?? '[]')).toHaveLength(72)
    expect(new Set(JSON.parse(canvas.dataset.particlePaths ?? '[]')).size).toBe(72)
    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('.observatory-link')).toBeNull()
    expect(container.querySelector('.observatory-star')).toBeNull()
    expect(container.querySelector('.observatory-scene')).toBeNull()
    expect(canvasContext.createLinearGradient).not.toHaveBeenCalled()
    expect(container.textContent).not.toMatch(/星座|cluster|重要度|真の分類/)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: '一時停止' })).toBeTruthy()
  })

  it('exposes the observation boundary without claiming that proximity is knowledge truth', () => {
    const { container } = render(
      <ObservatoryView graph={createViewingGraph(8)} onOpen={() => undefined} />
    )

    expect(container.querySelector('.observatory-caption-context')?.textContent)
      .toContain('8個の光はすべて実在ノート')
    expect(container.querySelector('.observatory-caption-context')?.textContent)
      .toContain('現在の観測表現')
    expect(screen.getByRole('region', { name: '観測宙域' }).getAttribute('aria-description'))
      .toMatch(/関係.*分類.*重要度/)
    expect(container.textContent).not.toContain('存在相そのもの')
    expect(container.textContent).not.toContain('意味距離')
  })

  it('advances through one requestAnimationFrame chain and exposes moving particle samples', () => {
    render(<ObservatoryView graph={createViewingGraph(12)} onOpen={() => undefined} />)
    const canvas = screen.getByRole('application', { name: '知識粒子の観測面' }) as HTMLCanvasElement
    const initial = particleSample(canvas)

    expect(rafCallbacks.size).toBe(1)
    runAnimationFrame(0)
    expect(rafCallbacks.size).toBe(1)
    runAnimationFrame(100)
    expect(rafCallbacks.size).toBe(1)

    expect(Number(canvas.dataset.simulationTime)).toBeGreaterThan(0)
    expect(particleSample(canvas).some((particle, index) =>
      particle.x !== initial[index].x || particle.y !== initial[index].y
    )).toBe(true)
  })

  it('pauses, resumes, and cleans up on visibility, graph replacement, and unmount', () => {
    const { rerender, unmount } = render(
      <ObservatoryView graph={createViewingGraph(12)} onOpen={() => undefined} />
    )
    const region = screen.getByRole('region', { name: '観測宙域' })
    expect(rafCallbacks.size).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: '一時停止' }))
    expect(region.getAttribute('data-playing')).toBe('false')
    expect(region.getAttribute('data-paused-reason')).toBe('user')
    expect(rafCallbacks.size).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: '再生' }))
    expect(region.getAttribute('data-playing')).toBe('true')
    expect(rafCallbacks.size).toBe(1)

    hiddenSpy.mockReturnValue(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(region.getAttribute('data-paused-reason')).toBe('background')
    expect(rafCallbacks.size).toBe(0)

    hiddenSpy.mockReturnValue(false)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(region.getAttribute('data-playing')).toBe('true')
    expect(rafCallbacks.size).toBe(1)

    rerender(<ObservatoryView graph={createViewingGraph(4)} onOpen={() => undefined} />)
    expect((screen.getByRole('application', { name: '知識粒子の観測面' }) as HTMLCanvasElement)
      .dataset.particleCount).toBe('4')
    expect(rafCallbacks.size).toBe(1)

    unmount()
    expect(rafCallbacks.size).toBe(0)
  })

  it('keeps the same observation time when only display names change', () => {
    const graph = createViewingGraph(12)
    const { rerender } = render(
      <ObservatoryView graph={graph} onOpen={() => undefined} />
    )
    const canvas = screen.getByRole('application', { name: '知識粒子の観測面' }) as HTMLCanvasElement
    runAnimationFrame(0)
    runAnimationFrame(180)
    const before = Number(canvas.dataset.simulationTime)

    rerender(<ObservatoryView graph={{
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, name: `別名 ${node.path}` }))
    }} onOpen={() => undefined} />)

    expect(Number(canvas.dataset.simulationTime)).toBe(before)
    runAnimationFrame(360)
    expect(Number(canvas.dataset.simulationTime)).toBeGreaterThan(before)
  })

  it('redraws and keeps pointer hit-testing aligned when a paused field is resized', () => {
    const onOpen = vi.fn()
    render(<ObservatoryView graph={createViewingGraph(8)} onOpen={onOpen} />)
    const canvas = screen.getByRole('application', { name: '知識粒子の観測面' }) as HTMLCanvasElement
    const before = particleSample(canvas)[0]

    fireEvent.click(screen.getByRole('button', { name: '一時停止' }))
    expect(rafCallbacks.size).toBe(0)
    vi.mocked(HTMLCanvasElement.prototype.getBoundingClientRect).mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 640,
      top: 0,
      width: 640,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
    expect(resizeCallback).not.toBeNull()
    act(() => resizeCallback?.([], {} as ResizeObserver))

    const after = particleSample(canvas)[0]
    expect(after.x).not.toBe(before.x)
    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(400)
    expect(rafCallbacks.size).toBe(0)
    fireEvent.click(canvas, { clientX: after.x, clientY: after.y })
    expect(onOpen).toHaveBeenCalledWith(after.path)
  })

  it('hit-tests pointer input and offers one-stop keyboard navigation', () => {
    const onOpen = vi.fn()
    render(<ObservatoryView graph={createViewingGraph(4)} onOpen={onOpen} />)
    const canvas = screen.getByRole('application', { name: '知識粒子の観測面' }) as HTMLCanvasElement
    const first = particleSample(canvas)[0]

    fireEvent.pointerMove(canvas, { clientX: first.x, clientY: first.y })
    expect(screen.getByRole('status').textContent).toContain(first.name)
    fireEvent.click(canvas, { clientX: first.x, clientY: first.y })
    expect(onOpen).toHaveBeenLastCalledWith(first.path)

    fireEvent.focus(canvas)
    const before = screen.getByRole('status').textContent
    fireEvent.keyDown(canvas, { key: 'ArrowRight' })
    expect(screen.getByRole('status').textContent).not.toBe(before)
    const selectedPath = canvas.dataset.activePath
    fireEvent.keyDown(canvas, { key: 'Enter' })
    expect(onOpen).toHaveBeenLastCalledWith(selectedPath)
    fireEvent.keyDown(canvas, { key: 'Escape' })
    expect(canvas.dataset.activePath).toBeUndefined()
  })

  it('honors reduced motion with a static field and no animation control', () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as unknown as MediaQueryList)

    render(<ObservatoryView graph={createViewingGraph(8)} onOpen={() => undefined} />)

    const region = screen.getByRole('region', { name: '観測宙域' })
    expect(region.getAttribute('data-motion')).toBe('reduced')
    expect(region.getAttribute('data-playing')).toBe('false')
    expect(region.getAttribute('data-paused-reason')).toBe('reduced-motion')
    expect(rafCallbacks.size).toBe(0)
    expect(screen.queryByRole('button', { name: /再生|一時停止/ })).toBeNull()
  })

  it('keeps empty and singleton fields honest', () => {
    const onOpen = vi.fn()
    const { rerender } = render(
      <ObservatoryView graph={{ nodes: [], edges: [] }} onOpen={onOpen} />
    )
    expect(screen.getByText('まだ観測できるノートはありません')).toBeTruthy()
    expect(screen.queryByRole('application', { name: '知識粒子の観測面' })).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<ObservatoryView graph={{
      nodes: [{ path: 'Only.md', name: 'Only', kind: 'note', exists: true }],
      edges: []
    }} onOpen={onOpen} />)
    const canvas = screen.getByRole('application', { name: '知識粒子の観測面' }) as HTMLCanvasElement
    expect(canvas.dataset.particleCount).toBe('1')
    expect(screen.getByText(/1個の光はすべて実在ノート/)).toBeTruthy()

    const only = particleSample(canvas)[0]
    fireEvent.click(canvas, { clientX: only.x, clientY: only.y })
    expect(onOpen).toHaveBeenCalledWith('Only.md')
    expect(document.body.textContent).not.toMatch(/関係がある|集団/)
  })
})
