import { useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'

let engine: Promise<typeof import('mermaid')['default']> | undefined
let renderSequence = 0
let renderQueue = Promise.resolve()

function loadMermaid(): NonNullable<typeof engine> {
  engine ??= import('mermaid').then(({ default: mermaid }) => mermaid).catch(error => { engine = undefined; throw error })
  return engine
}

function currentTheme(): 'dark' | 'default' {
  const selected = document.documentElement.dataset.theme
  if (selected === 'light') return 'default'
  if (selected === 'dark') return 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches === false ? 'default' : 'dark'
}

function safeSvg(svg: string): string {
  // Mermaid measures in the live document before returning SVG; the renderer CSP
  // must keep blocking remote resources as well as sanitizing the final result.
  const fragment = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'image', 'feImage', 'a'],
    RETURN_DOM_FRAGMENT: true
  })
  const element = fragment.querySelector('svg')
  if (!element) throw new Error('図のSVGを作成できませんでした。')
  for (const child of [element, ...element.querySelectorAll('*')]) {
    for (const attribute of [...child.attributes]) {
      if (attribute.localName === 'href' && !attribute.value.startsWith('#')) child.removeAttributeNode(attribute)
    }
  }
  element.setAttribute('role', 'img')
  if (!element.hasAttribute('aria-labelledby') && !element.hasAttribute('aria-label')) {
    element.setAttribute('aria-label', 'Mermaid図')
  }
  return element.outerHTML
}

export default function MermaidDiagram({ code, forExport = false }: { code: string; forExport?: boolean }): React.JSX.Element {
  const [previewTheme, setPreviewTheme] = useState(currentTheme)
  const theme = forExport ? 'neutral' : previewTheme
  const [position, setPosition] = useState({ x: 0, y: 0, scale: 1 })
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const zoom = (factor: number) => setPosition(value => ({ ...value, scale: Math.max(0.25, Math.min(4, value.scale * factor)) }))
  const reset = () => setPosition({ x: 0, y: 0, scale: 1 })
  const [result, setResult] = useState<{ code: string; theme: string; svg?: string; error?: string } | null>(null)
  const invalid = code.length > 20000 ? '図は20,000文字まで表示できます。'
    : /%%\s*\{|^\s*---\s*$/m.test(code) ? '図内のfrontmatterや設定ディレクティブには対応していません。' : null

  useEffect(() => {
    reset()
  }, [code])

  useEffect(() => {
    if (forExport) return
    const update = () => setPreviewTheme(currentTheme())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener('change', update)
    update()
    return () => { observer.disconnect(); media?.removeEventListener('change', update) }
  }, [forExport])

  useEffect(() => {
    if (invalid) return
    let active = true
    // Mermaid shares configuration between diagrams, so initialize and render together.
    renderQueue = renderQueue.then(async () => {
      if (!active) return
      const mermaid = await loadMermaid()
      if (!active) return
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', htmlLabels: false,
        suppressErrorRendering: true, maxTextSize: 20000, maxEdges: 200,
        theme, fontFamily: '"Yu Gothic UI", Meiryo, sans-serif',
        secure: ['secure', 'securityLevel', 'startOnLoad', 'suppressErrorRendering', 'maxTextSize', 'maxEdges', 'htmlLabels', 'dompurifyConfig']
      })
      const rendered = await mermaid.render(`ts-mermaid-${++renderSequence}`, code)
      if (active) setResult({ code, theme, svg: safeSvg(rendered.svg) })
    }).catch(error => {
      if (active) setResult({ code, theme, error: error instanceof Error ? error.message.slice(0, 240) : '構文を確認してください。' })
    })
    return () => { active = false }
  }, [code, invalid, theme])

  const current = result?.code === code && (!forExport || result.theme === theme) ? result : null
  const error = invalid ?? current?.error
  if (error) return <div className="mermaid-error" role="group" aria-label="Mermaid図のエラー">
    <p>図を表示できませんでした。{error}</p>
    <pre><code className="language-mermaid">{code}</code></pre>
  </div>
  if (!current?.svg) return <div className="mermaid-diagram" role="status">図を描画中…</div>
  if (forExport) return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: current.svg }} />
  return <div className="mermaid-diagram" aria-busy={current.theme !== theme}>
    <div role="group" aria-label="図の表示操作" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button type="button" aria-label="図を縮小" onClick={() => zoom(0.8)}>−</button>
      <output aria-label="図の倍率">{Math.round(position.scale * 100)}%</output>
      <button type="button" aria-label="図を拡大" onClick={() => zoom(1.25)}>＋</button>
      <button type="button" aria-label="図の表示をリセット" onClick={reset}>リセット</button>
    </div>
    <div role="region" aria-label="Mermaid図を移動・拡大" tabIndex={0}
      title="ドラッグまたは矢印キーで移動、＋／−で拡大縮小、0でリセット"
      style={{ overflow: 'hidden', touchAction: 'none', cursor: 'grab', minHeight: 80 }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
        const delta = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }[event.key]
        if (delta) setPosition(value => ({ ...value, x: value.x + delta[0], y: value.y + delta[1] }))
        else if (event.key === '+' || event.key === '=') zoom(1.25)
        else if (event.key === '-') zoom(0.8)
        else if (event.key === '0') reset()
        else return
        event.preventDefault(); event.stopPropagation()
      }}
      onPointerDown={event => {
        if (event.button !== 0) return
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        event.currentTarget.focus(); event.preventDefault(); event.stopPropagation()
      }}
      onPointerMove={event => {
        const previous = drag.current
        if (!previous || previous.id !== event.pointerId) return
        const dx = event.clientX - previous.x, dy = event.clientY - previous.y
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
        setPosition(value => ({ ...value, x: value.x + dx, y: value.y + dy }))
      }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
      onLostPointerCapture={() => { drag.current = null }}>
      <div data-mermaid-transform style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${position.scale})`, transformOrigin: 'center center' }}
        dangerouslySetInnerHTML={{ __html: current.svg }} />
    </div>
  </div>
}
