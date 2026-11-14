// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MermaidDiagram from '../src/renderer/components/MermaidDiagram'
const diagram = '<svg xmlns="http://www.w3.org/2000/svg"><text>Diagram</text></svg>'
const api = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn<(id: string, code: string) => Promise<{ svg: string }>>()
}))
vi.mock('mermaid', () => ({ default: api }))
afterEach(() => { cleanup(); delete document.documentElement.dataset.theme; vi.clearAllMocks(); vi.unstubAllGlobals() })
beforeEach(() => { api.render.mockReset().mockResolvedValue({ svg: diagram }) })

it('renders in the app light theme and follows a live theme change', async () => {
  document.documentElement.dataset.theme = 'light'
  render(<MermaidDiagram code="flowchart LR\nA-->B" />)
  await waitFor(() => expect(screen.getByRole('img')).toBeTruthy())
  expect(api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'default', securityLevel: 'strict' }))
  await act(async () => { document.documentElement.dataset.theme = 'dark' })
  await waitFor(() => expect(api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' })))
})

it('zooms, pans with the keyboard, and resets without rerendering source', async () => {
  const { container } = render(<MermaidDiagram code="flowchart LR\nA-->B" />)
  await waitFor(() => expect(screen.getByRole('img')).toBeTruthy())
  const initialCalls = api.render.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: '図を拡大' }))
  const viewport = screen.getByRole('region', { name: 'Mermaid図を移動・拡大' })
  fireEvent.keyDown(viewport, { key: 'ArrowRight' })
  expect(container.querySelector('[data-mermaid-transform]')?.getAttribute('style')).toContain('translate(40px, 0px) scale(1.25)')
  fireEvent.click(screen.getByRole('button', { name: '図の表示をリセット' }))
  expect(container.querySelector('[data-mermaid-transform]')?.getAttribute('style')).toContain('translate(0px, 0px) scale(1)')
  expect(api.render).toHaveBeenCalledTimes(initialCalls)
})

it('keeps diagram focus while its theme redraw is pending', async () => {
  document.documentElement.dataset.theme = 'light'
  render(<MermaidDiagram code="flowchart LR\nA-->B" />)
  await waitFor(() => expect(screen.getByRole('img')).toBeTruthy())
  const viewport = screen.getByRole('region', { name: 'Mermaid図を移動・拡大' })
  viewport.focus()
  let finish!: (result: {svg: string}) => void
  api.render.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await act(async () => { document.documentElement.dataset.theme = 'dark' })
  expect(document.activeElement).toBe(viewport)
  await act(async () => { finish({svg:'<svg xmlns="http://www.w3.org/2000/svg"><text>Dark</text></svg>'}) })
  expect(document.activeElement).toBe(viewport)
})

it('follows the OS appearance when no explicit app theme is present', async () => {
  const media = {matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()}
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  render(<MermaidDiagram code="flowchart LR\nA-->B" />)
  await waitFor(() => expect(screen.getByRole('img')).toBeTruthy())
  expect(api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({theme:'default'}))
  media.matches = true
  await act(async () => { media.addEventListener.mock.calls[0][1]() })
  await waitFor(() => expect(api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({theme:'dark'})))
})

it('waits for a print-friendly SVG and omits interactive controls in PDF export', async () => {
  document.documentElement.dataset.theme = 'dark'
  const { container } = render(<MermaidDiagram code={'flowchart LR\nA-->B'} forExport />)
  expect(screen.getByRole('status').className).toBe('mermaid-diagram')
  await waitFor(() => expect(container.querySelector('.mermaid-diagram > svg[role="img"]')).not.toBeNull())
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
  expect(api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'neutral' }))
})

it('preserves SVG geometry and removes external resources from the output', async () => {
  api.render.mockResolvedValue({ svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" aria-labelledby="title">
    <title id="title">Flowchart</title>
    <g transform="translate(20, 10)">
      <path d="M0 0L100 50" />
      <image href="https://example.invalid/diagram.svg" />
      <feImage href="https://example.invalid/diagram.svg" />
      <a href="https://example.invalid"><text>Label</text></a>
      <foreignObject><p>HTML</p></foreignObject>
    </g>
  </svg>` })
  const { container } = render(<MermaidDiagram code={'flowchart LR\nA-->B'} />)
  const svg = await screen.findByRole('img', { name: 'Flowchart' })
  expect(svg.getAttribute('viewBox')).toBe('0 0 200 100')
  expect(svg.querySelector('g')?.getAttribute('transform')).toBe('translate(20, 10)')
  expect(container.querySelector('image, feImage, a, foreignObject')).toBeNull()
})

it('keeps Mermaid configuration isolated while diagrams are rendering', async () => {
  document.documentElement.dataset.theme = 'dark'
  let finishPreview!: (result: { svg: string }) => void
  api.render.mockImplementationOnce(() => new Promise(resolve => { finishPreview = resolve }))
  render(<MermaidDiagram code="preview" />)
  await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
  render(<MermaidDiagram code="print" forExport />)
  await act(async () => {})
  expect(api.initialize).toHaveBeenCalledTimes(1)
  expect(api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' }))
  await act(async () => { finishPreview({ svg: diagram }) })
  expect(api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'neutral' }))
  expect(new Set(api.render.mock.calls.map(([id]) => id)).size).toBe(2)
})

it('ignores a stale render after its source changes and continues after a failed render', async () => {
  let finishOld!: (result: { svg: string }) => void
  api.render.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
  api.render.mockRejectedValueOnce(new Error('Invalid syntax'))
  const { rerender } = render(<MermaidDiagram code="old" />)
  await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
  rerender(<MermaidDiagram code="invalid" />)
  await act(async () => { finishOld({ svg: diagram }) })
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByRole('group', { name: 'Mermaid図のエラー' }).textContent).toContain('Invalid syntax')
  rerender(<MermaidDiagram code="new" />)
  expect(await screen.findByRole('img')).toBeTruthy()
})

it.each(['%%{init: {} }%%\nflowchart LR\nA-->B', '---\nconfig: {}\n---\nflowchart LR\nA-->B', 'x'.repeat(20001)])(
  'shows the source fallback instead of rendering disallowed settings or excessive input',
  code => {
    const { container } = render(<MermaidDiagram code={code} />)
    expect(container.querySelector('.mermaid-error code')?.textContent).toBe(code)
    expect(api.render).not.toHaveBeenCalled()
  }
)
