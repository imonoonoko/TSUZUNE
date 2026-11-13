// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { canvasPngSnapshot, renderCanvasPng } from '../src/renderer/canvas-png'

describe('Canvas PNG snapshot', () => {
  it('doubles full bounds including padding and crops a fractional viewport without extra padding', () => {
    const world = document.createElement('div')
    world.style.transform = 'translate(40px, 40px) scale(0.5)'
    const data = { nodes: [{ id: 'a', type: 'text' as const, text: '', x: -100, y: 20, width: 300, height: 200 }], edges: [] }
    const full = canvasPngSnapshot(world, data, { scale: 2 })
    expect([full.width, full.height]).toEqual([728, 528])
    expect(full.svg).toContain('scale(2) translate(132px, 12px)')
    for (const scale of [1, 2] as const) {
      const crop = canvasPngSnapshot(world, data, { scale, viewport: { x: -12.5, y: 7.25, width: 210.25, height: 110.5 } })
      expect([crop.width, crop.height]).toEqual([Math.ceil(210.25 * scale), Math.ceil(110.5 * scale)])
      expect(crop.svg).toContain(`scale(${scale}) translate(12.5px, -7.25px)`)
    }
    expect(world.style.transform).toBe('translate(40px, 40px) scale(0.5)')
  })
  it('applies pixel limits after scale and rejects invalid viewport dimensions before cloning', () => {
    const world = document.createElement('div')
    const data = { nodes: [{ id: 'a', type: 'text' as const, text: '', x: 0, y: 0, width: 4100, height: 100 }], edges: [] }
    expect(() => canvasPngSnapshot(world, data, { scale: 1 })).not.toThrow()
    expect(() => canvasPngSnapshot(world, data, { scale: 2 })).toThrow('PNGの上限')
    expect(() => canvasPngSnapshot(world, data, { scale: 2, viewport: { x: 0, y: 0, width: 2100, height: 2100 } })).toThrow('PNGの上限')
    for (const width of [0, -1, Infinity, NaN]) {
      expect(() => canvasPngSnapshot(world, data, { scale: 1, viewport: { x: 0, y: 0, width, height: 10 } })).toThrow('表示範囲')
    }
  })
  it('waits for Markdown Vault images before taking the snapshot', async () => {
    vi.useFakeTimers()
    const world = document.createElement('div')
    world.innerHTML = '<span class="vault-image-status">画像を読み込み中…</span>'
    document.body.append(world)
    try {
      let settled = false
      const result = renderCanvasPng(world, { nodes: [], edges: [] }).catch(error => { settled = true; return error })
      await vi.advanceTimersByTimeAsync(100)
      expect(settled).toBe(false)
      world.replaceChildren()
      await vi.advanceTimersByTimeAsync(50)
      expect((await result).message).toContain('カードがない')
    } finally { world.remove(); vi.useRealTimers() }
  })
  it('includes negative and offscreen nodes at native size without changing the live view', () => {
    const world = document.createElement('div')
    world.style.transform = 'translate(40px, 40px) scale(0.5)'
    world.innerHTML = '<article class="canvas-card selected"><button class="canvas-card-handle">日本語</button><div class="canvas-card-content">content<button>ファイルを開く</button></div><button class="canvas-resize">resize</button></article><div class="canvas-marquee"></div>'
    document.body.append(world)
    const before = world.outerHTML
    const result = canvasPngSnapshot(world, { nodes: [
      { id: 'a', type: 'text', text: '日本語', x: -200, y: -100, width: 200, height: 100 },
      { id: 'b', type: 'text', text: 'far', x: 1200, y: 600, width: 300, height: 200 }
    ], edges: [] })
    expect(result.width).toBe(1764)
    expect(result.height).toBe(964)
    expect(result.svg).toContain('translate(232px, 132px)')
    expect(result.svg).toContain('日本語')
    expect(new DOMParser().parseFromString(result.svg, 'image/svg+xml').querySelector('parsererror')).toBeNull()
    expect(result.svg).not.toContain('canvas-resize')
    expect(result.svg).not.toContain('ファイルを開く')
    expect(result.svg).not.toContain('canvas-marquee')
    expect(new DOMParser().parseFromString(result.svg, 'image/svg+xml').querySelector('.canvas-card-content')?.getAttribute('style')).toContain('overflow: hidden')
    expect(world.outerHTML).toBe(before)
    world.remove()
  })
  it('includes labels outside card bounds, drops edge selection and keeps arrows and inline images', () => {
    const world = document.createElement('div')
    world.style.setProperty('--graph-edge', '#123456')
    world.innerHTML = '<svg class="canvas-edges"><g class="selected"><line style="stroke:red;stroke-width:5px" marker-end="url(#arrow)"/></g></svg><span class="canvas-edge-label" style="left:0px;top:0px">label</span><img src="data:image/png;base64,test"/>'
    const label = world.querySelector('span')!
    Object.defineProperties(label, { offsetWidth: { value: 240 }, offsetHeight: { value: 60 } })
    const result = canvasPngSnapshot(world, { nodes: [{ id: 'a', type: 'text', text: '', x: 0, y: 0, width: 10, height: 10 }], edges: [] })
    expect([result.width, result.height]).toEqual([304, 134])
    const svg = new DOMParser().parseFromString(result.svg, 'image/svg+xml')
    expect(svg.querySelector('line')?.getAttribute('style')).toContain('stroke: rgb(18, 52, 86)')
    expect(svg.querySelector('line')?.getAttribute('marker-end')).toBe('url(#arrow)')
    expect(result.svg).toContain('data:image/png;base64,test')
  })
  it('includes SVG edge labels in bounds without producing invalid geometry', () => {
    const world = document.createElement('div')
    world.dataset.originX = '80'; world.dataset.originY = '60'
    world.innerHTML = '<svg><text class="canvas-edge-label" x="280" y="160">edge label</text></svg>'
    const result = canvasPngSnapshot(world, { nodes: [{ id: 'a', type: 'text', text: '', x: 0, y: 0, width: 20, height: 20 }], edges: [] })
    expect(result.svg).not.toContain('NaN')
    expect(result.width).toBeGreaterThan(0)
  })
  it('exports the live text card value and uses the local board background', () => {
    const editor = document.createElement('div'); editor.className = 'canvas-editor'
    const board = document.createElement('div'); board.className = 'canvas-board-scroll'; board.style.backgroundColor = 'rgb(1, 2, 3)'
    const world = document.createElement('div'); world.className = 'canvas-world'
    world.innerHTML = '<article class="canvas-card canvas-card-text" data-node-id="a"><div class="canvas-card-content"><textarea>old</textarea></div></article>'
    const textarea = world.querySelector('textarea')!; textarea.value = 'edited value'
    board.append(world); editor.append(board); document.body.append(editor)
    const result = canvasPngSnapshot(world, { nodes: [{ id: 'a', type: 'text', text: 'old', x: 0, y: 0, width: 100, height: 80 }], edges: [] })
    expect(result.svg).toContain('edited value')
    expect(result.svg).not.toContain('<textarea')
    expect(result.svg).toContain('rgb(1, 2, 3)')
    editor.remove()
  })
  it('hides every card payload and group background while preserving bounds, frames, edge colors and arrows', () => {
    const world = document.createElement('div')
    world.style.setProperty('--graph-edge', '#123456')
    world.innerHTML = `<article class="canvas-card" style="border-color: rgb(1, 2, 3)"><button class="canvas-card-handle">private-title.md</button><div class="canvas-card-content"><p>private body</p><img src="private-image.png"><video src="private-video.mp4"></video><audio src="private-audio.wav"></audio><div class="canvas-web-preview" data-web-url="https://private.test"><p>https://private.test</p><iframe src="https://private.test"></iframe></div></div></article><div class="canvas-group-background" style="background-image:url(private-background.png)"></div><svg class="canvas-edges"><g><line marker-end="url(#arrow)"/></g></svg><span class="canvas-edge-label" style="left:300px;top:40px">private edge label</span>`
    const label = world.querySelector('.canvas-edge-label')!
    Object.defineProperties(label, { offsetWidth: { value: 160 }, offsetHeight: { value: 20 } })
    document.body.append(world)
    const data = { nodes: [{ id: 'a', type: 'file' as const, file: 'private-title.md', x: 0, y: 0, width: 200, height: 100 }], edges: [] }
    const before = world.outerHTML
    try {
      const full = canvasPngSnapshot(world, data, { scale: 2 })
      const hidden = canvasPngSnapshot(world, data, { scale: 2, hideContent: true })
      expect([hidden.width, hidden.height]).toEqual([full.width, full.height])
      expect(hidden.svg).not.toMatch(/private-title|private body|private-image|private-video|private-audio|private\.test|private-background|private edge label|<iframe|<video|<audio|<img/)
      const exported = new DOMParser().parseFromString(hidden.svg, 'image/svg+xml')
      expect(exported.querySelector('.canvas-card')).not.toBeNull()
      expect(exported.querySelector('.canvas-card-handle, .canvas-card-content, .canvas-group-background, .canvas-edge-label')).toBeNull()
      expect(exported.querySelector('.canvas-card')?.getAttribute('style')).toContain('border-color')
      expect(exported.querySelector('line')?.getAttribute('marker-end')).toBe('url(#arrow)')
      expect(world.outerHTML).toBe(before)
    } finally { world.remove() }
  })
  it('does not wait for omitted image loading or decode when rendering content-free PNGs', async () => {
    vi.useFakeTimers()
    const world = document.createElement('div')
    world.innerHTML = '<article class="canvas-card"><div class="canvas-card-content"><span data-image-loading="true">pending</span><img src="missing.png"></div></article>'
    document.body.append(world)
    const originalImage = world.querySelector('img')!
    const decode = vi.fn(() => new Promise<void>(() => {}))
    originalImage.decode = decode
    const oldImage = globalThis.Image
    class ExportImage { src = ''; decode = vi.fn(async () => undefined) }
    globalThis.Image = ExportImage as unknown as typeof Image
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test')
    try {
      await expect(renderCanvasPng(world, { nodes: [{ id: 'a', type: 'file', file: 'missing.png', x: 0, y: 0, width: 20, height: 20 }], edges: [] }, { scale: 1, hideContent: true })).resolves.toBe('data:image/png;base64,test')
      expect(decode).not.toHaveBeenCalled()
    } finally { world.remove(); globalThis.Image = oldImage; getContext.mockRestore(); toDataURL.mockRestore(); vi.useRealTimers() }
  })
  it('waits for fonts before rasterizing hidden-content output, then skips incomplete omitted images', async () => {
    vi.useFakeTimers()
    const world = document.createElement('div')
    world.innerHTML = '<article class="canvas-card"><div class="canvas-card-content"><span class="vault-image-status">pending</span><img src="missing.png"></div></article>'
    document.body.append(world)
    const originalImage = world.querySelector('img')!
    Object.defineProperty(originalImage, 'complete', { configurable: true, get: () => false })
    const originalDecode = vi.fn(() => Promise.reject(new Error('must not decode omitted image')))
    originalImage.decode = originalDecode
    const previousFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
    const fonts = { status: 'loading' }
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
    const oldImage = globalThis.Image
    const rasterDecode = vi.fn(async () => undefined)
    class ExportImage { src = ''; decode = rasterDecode }
    globalThis.Image = ExportImage as unknown as typeof Image
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test')
    try {
      let settled = false
      const rendered = renderCanvasPng(world, { nodes: [{ id: 'a', type: 'file', file: 'missing.png', x: 0, y: 0, width: 20, height: 20 }], edges: [] }, { scale: 1, hideContent: true }).then(value => { settled = true; return value })
      await vi.advanceTimersByTimeAsync(100)
      expect(settled).toBe(false)
      expect(rasterDecode).not.toHaveBeenCalled()
      fonts.status = 'loaded'
      await vi.advanceTimersByTimeAsync(50)
      await expect(rendered).resolves.toBe('data:image/png;base64,test')
      expect(originalDecode).not.toHaveBeenCalled()
      expect(rasterDecode).toHaveBeenCalledOnce()
    } finally {
      world.remove(); globalThis.Image = oldImage; getContext.mockRestore(); toDataURL.mockRestore()
      if (previousFonts) Object.defineProperty(document, 'fonts', previousFonts)
      else Reflect.deleteProperty(document, 'fonts')
      vi.useRealTimers()
    }
  })
  it('rejects empty or oversized canvases before allocating a raster image', () => {
    const world = document.createElement('div')
    expect(() => canvasPngSnapshot(world, { nodes: [], edges: [] })).toThrow('カードがない')
    for (const [width, height] of [[9000, 1], [1, 9000], [4100, 4100]]) {
      expect(() => canvasPngSnapshot(world, { nodes: [{ id: 'a', type: 'text', text: '', x: 0, y: 0, width, height }], edges: [] })).toThrow('PNGの上限')
    }
  })
})
