import type { CanvasData } from '../shared/canvas'

export interface CanvasPngOptions {
  scale: 1 | 2
  viewport?: { x: number; y: number; width: number; height: number }
  hideContent?: boolean
}

export function canvasPngSnapshot(world: HTMLElement, data: CanvasData, { scale, viewport, hideContent = false }: CanvasPngOptions = { scale: 1 }): { svg: string; width: number; height: number } {
  if (!data.nodes.length) throw new Error('カードがないCanvasはPNGに保存できません。')
  if (scale !== 1 && scale !== 2) throw new Error('PNG倍率は1倍または2倍を選んでください。')
  if (viewport && (!Object.values(viewport).every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0)) throw new Error('PNGの表示範囲を取得できませんでした。')
  const originX = Number(world.dataset.originX ?? 0), originY = Number(world.dataset.originY ?? 0)
  const labels = [...world.querySelectorAll<HTMLElement>('.canvas-edge-label')].map(label => {
    if (label.namespaceURI === 'http://www.w3.org/2000/svg') {
      const svgLabel = label as unknown as SVGTextElement
      const x = Number(svgLabel.getAttribute('x')) - originX, y = Number(svgLabel.getAttribute('y')) - originY
      let box: DOMRect | null = null
      try { box = svgLabel.getBBox() } catch { /* SVG layout may be unavailable in tests or a hidden pane. */ }
      const width = box?.width || (svgLabel.textContent?.length ?? 0) * 8, height = box?.height || 16
      return { x: x - width / 2, y: y - height, width, height }
    }
    return { x: parseFloat(label.style.left) - label.offsetWidth / 2, y: parseFloat(label.style.top) - label.offsetHeight, width: label.offsetWidth, height: label.offsetHeight }
  }).filter(label => [label.x, label.y, label.width, label.height].every(Number.isFinite))
  const boxes = [...data.nodes, ...labels]
  const left = viewport?.x ?? Math.floor(Math.min(...boxes.map(n => n.x))) - 32
  const top = viewport?.y ?? Math.floor(Math.min(...boxes.map(n => n.y))) - 32
  const width = Math.ceil((viewport?.width ?? Math.ceil(Math.max(...boxes.map(n => n.x + n.width))) + 32 - left) * scale)
  const height = Math.ceil((viewport?.height ?? Math.ceil(Math.max(...boxes.map(n => n.y + n.height))) + 32 - top) * scale)
  if (width > 8192 || height > 8192 || width * height > 16_000_000) throw new Error('PNGの上限（縦横8,192px・合計1,600万px）を超えています。出力範囲・倍率を変更するか、カードの配置を近づけてください。')
  const clone = world.cloneNode(true) as HTMLElement
  const originals = [world, ...world.querySelectorAll<HTMLElement | SVGElement>('*')]
  const copies = [clone, ...clone.querySelectorAll<HTMLElement | SVGElement>('*')]
  originals.forEach((element, index) => {
    const style = getComputedStyle(element)
    for (const property of style) copies[index].style.setProperty(property, style.getPropertyValue(property))
  })
  if (hideContent) clone.querySelectorAll('.canvas-card > header, .canvas-card-handle, .canvas-card-content, .canvas-group-background, .canvas-edge-label').forEach(element => element.remove())
  clone.style.transformOrigin = '0 0'
  clone.style.transform = `scale(${scale}) translate(${-left - originX}px, ${-top - originY}px)`
  clone.querySelectorAll('.canvas-resize, .canvas-marquee, .canvas-card-content button, .canvas-group-tools, .canvas-port, .canvas-attachment-player, .media-player').forEach(element => element.remove())
  clone.querySelectorAll<HTMLTextAreaElement>('.canvas-card-text textarea').forEach(textarea => {
    const card = textarea.closest<HTMLElement>('.canvas-card[data-node-id]')
    const node = data.nodes.find(item => item.id === card?.dataset.nodeId)
    if (node?.type === 'text' && node.text.includes('![[')) { textarea.remove(); return }
    const text = document.createElement('p')
    text.style.cssText = 'margin:.6rem;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;'
    text.textContent = textarea.value
    textarea.replaceWith(text)
  })
  clone.querySelectorAll<HTMLElement>('.canvas-card').forEach(element => { element.style.outline = 'none' })
  clone.querySelectorAll<HTMLElement>('.canvas-card-content').forEach(element => { element.style.overflow = 'hidden' })
  clone.querySelectorAll<SVGElement>('.canvas-edges line').forEach(element => {
    element.style.strokeWidth = '3px'
    element.style.stroke = element.dataset.exportStroke || getComputedStyle(world).getPropertyValue('--graph-edge').trim()
    element.style.markerStart = element.getAttribute('marker-start') || 'none'
    element.style.markerEnd = element.getAttribute('marker-end') || 'none'
  })
  const background = getComputedStyle(world.closest('.canvas-board-scroll') || world.closest('.canvas-editor') || world).backgroundColor
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `position:relative;width:${width}px;height:${height}px;overflow:hidden;background:${background}`
  wrapper.append(clone)
  const html = new XMLSerializer().serializeToString(wrapper)
  return { width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>` }
}

export async function renderCanvasPng(world: HTMLElement, data: CanvasData, options?: CanvasPngOptions): Promise<string> {
  const deadline = Date.now() + 10_000
  const hideContent = options?.hideContent === true
  while (document.fonts?.status === 'loading' || (!hideContent && (world.querySelector('.vault-image-status') || [...world.querySelectorAll('img')].some(img => !img.complete)))) {
    if (!world.isConnected) throw new Error('Canvasが閉じられました。')
    if (Date.now() > deadline) throw new Error('PNGの画像・フォントの準備が終わりませんでした。もう一度お試しください。')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (!hideContent) await Promise.all([...world.querySelectorAll('img')].map(img => img.decode()))
  const { svg, width, height } = canvasPngSnapshot(world, data, options)
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('PNGを作成できませんでした。')
  context.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}
