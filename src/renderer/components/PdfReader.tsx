import { useEffect, useRef, useState } from 'react'
import { AnnotationMode, getDocument, PDFWorker, type PDFDocumentLoadingTask } from 'pdfjs-dist'
import { EventBus, PDFFindController, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import viewerCss from 'pdfjs-dist/web/pdf_viewer.css?inline'
import { createPdfCitation } from '../../core/pdf-links'

export default function PdfReader({ path, page: initialPage = 1, search: initialSearch = '', onOpenExternally, compact = false, expectedRoot }: {
  path: string; page?: number; search?: string; onOpenExternally?: () => void; compact?: boolean; expectedRoot?: string
}): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const viewer = useRef<PDFViewer | null>(null)
  const events = useRef<EventBus | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(initialPage), [pages, setPages] = useState(0)
  const [pageInput, setPageInput] = useState(String(initialPage))
  const [query, setQuery] = useState(initialSearch)
  const [matches, setMatches] = useState({ current: 0, total: 0 })
  const [finding, setFinding] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [selection, setSelection] = useState<{ text: string; page: number } | null>(null)
  const [zoom, setZoom] = useState('page-width')

  useEffect(() => {
    let active = true, task: PDFDocumentLoadingTask | undefined
    const port = new Worker(workerUrl, { type: 'module' })
    const worker = PDFWorker.create({ port })
    const bus = new EventBus()
    const links = new PDFLinkService({ eventBus: bus })
    links.externalLinkEnabled = false
    const find = new PDFFindController({ eventBus: bus, linkService: links })
    const abort = new AbortController()
    // PDF.js 6.4 supports abortSignal; its generated option type omits it.
    const viewerOptions = { container: container.current!, eventBus: bus, linkService: links,
      findController: find, annotationMode: AnnotationMode.DISABLE, enableAutoLinking: false,
      enablePermissions: true, maxCanvasPixels: 16 * 1024 * 1024, abortSignal: abort.signal }
    const pdfViewer = new PDFViewer(viewerOptions)
    links.setViewer(pdfViewer)
    viewer.current = pdfViewer; events.current = bus
    setPages(0); setError(''); setNotice(''); setSelection(null); setQuery(initialSearch)
    setPage(initialPage); setPageInput(String(initialPage))
    setZoom('page-width'); setMatches({ current: 0, total: 0 }); setFinding(false)
    bus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
      if (active) { setPage(pageNumber); setPageInput(String(pageNumber)) }
    })
    bus.on('updatefindmatchescount', ({ matchesCount }: { matchesCount: { current: number; total: number } }) => { if (active) setMatches(matchesCount) })
    bus.on('updatefindcontrolstate', ({ state, matchesCount }: { state: number; matchesCount: { current: number; total: number } }) => {
      if (active) { setFinding(state === 3); setMatches(matchesCount) }
    })
    bus.on('pagesinit', () => {
      if (!active) return
      pdfViewer.currentScaleValue = 'page-width'
      pdfViewer.currentPageNumber = Math.min(initialPage, pdfViewer.pagesCount)
      setPage(pdfViewer.currentPageNumber); setPageInput(String(pdfViewer.currentPageNumber))
      if (initialPage > pdfViewer.pagesCount) setNotice('指定ページが文書の範囲外のため、最終ページを表示しました。')
      if (initialSearch) bus.dispatch('find', { type: '', query: initialSearch, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: false })
    })
    const resize = compact ? new ResizeObserver(() => {
      if (active && pdfViewer.pagesCount) pdfViewer.currentScaleValue = 'page-width'
    }) : null
    resize?.observe(container.current!)
    const selectionChanged = (): void => {
      const selected = window.getSelection()
      if (!selected || selected.isCollapsed || !selected.rangeCount) { if (active) setSelection(null); return }
      const range = selected.getRangeAt(0)
      if (!container.current?.contains(range.startContainer) || !container.current.contains(range.endContainer)) return
      const element = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as Element : range.startContainer.parentElement
      const number = Number(element?.closest('[data-page-number]')?.getAttribute('data-page-number'))
      if (active) setSelection(number > 0 ? { text: selected.toString(), page: number } : null)
    }
    document.addEventListener('selectionchange', selectionChanged)
    void (async () => {
      try {
        const result = await window.tsuzune.readVaultPdf(path, expectedRoot)
        if (!active) return
        if (!result.ok) throw new Error(result.error.message)
        const base = new URL(import.meta.env.DEV ? '/node_modules/pdfjs-dist/' : './assets/pdfjs/', document.baseURI).href
        task = getDocument({ data: new Uint8Array(result.value), worker, enableXfa: false,
          cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`,
          wasmUrl: `${base}wasm/`, iccUrl: `${base}iccs/` })
        const pdf = await task.promise
        if (!active) return
        links.setDocument(pdf); pdfViewer.setDocument(pdf); setPages(pdf.numPages)
      } catch (cause) {
        if (active) setError(cause instanceof Error && cause.name === 'PasswordException'
          ? 'パスワード付きPDFは外部アプリで開いてください。' : `PDFを表示できませんでした。${cause instanceof Error ? cause.message : String(cause)}`)
      }
    })()
    return () => {
      active = false; document.removeEventListener('selectionchange', selectionChanged)
      resize?.disconnect()
      viewer.current = null; events.current = null
      pdfViewer.setDocument(null); links.setDocument(null)
      abort.abort()
      void (async () => {
        try { await task?.destroy() }
        catch { /* A failed load may already have destroyed its transport. */ }
        finally { worker.destroy(); port.terminate() }
      })()
    }
  }, [path, initialPage, initialSearch, compact, expectedRoot])

  const find = (value: string, again = false, previous = false): void => {
    setQuery(value)
    events.current?.dispatch('find', { type: again ? 'again' : '', query: value, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: previous })
  }
  const goToPage = (number: number): void => {
    if (!viewer.current || !pages) return
    viewer.current.currentPageNumber = Math.max(1, Math.min(pages, Number.isFinite(number) ? Math.trunc(number) : page))
    setPageInput(String(viewer.current.currentPageNumber))
  }
  const copy = async (quote: boolean): Promise<void> => {
    try {
      const result = await window.tsuzune.copyText(createPdfCitation({ path, page: quote && selection ? selection.page : page, search: '' }, quote ? selection?.text : ''))
      setNotice(result.ok ? quote ? '選択文と引用リンクをコピーしました。' : 'ページリンクをコピーしました。' : result.error.message)
    } catch { setNotice('コピーできませんでした。再度お試しください。') }
  }
  return <section className={`pdf-reader${compact ? ' pdf-reader-compact' : ''}`} aria-label="PDFビューア" onKeyDown={event => {
    if (!compact && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); event.stopPropagation(); searchInput.current?.focus(); searchInput.current?.select() }
  }}>
    <style>{`@scope (.pdf-reader) { ${viewerCss.replaceAll(':root', ':scope')} }`}</style>
    <div className="pdf-toolbar" role="group" aria-label="PDF操作">
      <button type="button" disabled={!pages || page <= 1} onClick={() => goToPage(page - 1)}>前ページ</button>
      <label>ページ <input aria-label="PDFページ" type="number" min="1" max={pages || 1} value={pageInput} disabled={!pages}
        onChange={event => setPageInput(event.target.value)} onBlur={() => goToPage(Number(pageInput))}
        onKeyDown={event => { if (event.key === 'Enter') goToPage(Number(pageInput)) }} /></label>
      <span aria-label="PDF総ページ数">/ {pages || '—'}</span>
      <button type="button" disabled={!pages || page >= pages} onClick={() => goToPage(page + 1)}>次ページ</button>
      {!compact && <><select aria-label="PDF倍率" disabled={!pages} value={zoom} onChange={event => { setZoom(event.target.value); if (viewer.current) viewer.current.currentScaleValue = event.target.value }}>
        <option value="page-width">幅に合わせる</option><option value="page-fit">ページ全体</option>
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value * 100}%</option>)}
      </select>
      <button type="button" disabled={!pages} onClick={() => void copy(false)}>ページリンクをコピー</button>
      <button type="button" disabled={!selection?.text.trim()} onMouseDown={event => event.preventDefault()} onClick={() => void copy(true)}>選択文を引用</button>
      <button type="button" onClick={() => onOpenExternally ? onOpenExternally() : void window.tsuzune.openVaultFile(path, expectedRoot)}>外部アプリで開く</button></>}
    </div>
    {!compact && <div className="pdf-toolbar pdf-search" role="search" aria-label="PDF内検索">
      <input ref={searchInput} type="search" aria-label="PDF内を検索" placeholder="PDF内を検索" maxLength={500} value={query} disabled={!pages}
        onChange={event => find(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); find(query, true, event.shiftKey) } }} />
      <button type="button" disabled={!pages || !query} onClick={() => find(query, true, true)}>前の一致</button>
      <button type="button" disabled={!pages || !query} onClick={() => find(query, true)}>次の一致</button>
      <span role="status" aria-live="polite">{query ? finding ? '検索中…' : `${matches.current} / ${matches.total} 件` : '文字を含むPDFを検索できます。'}</span>
    </div>}
    {notice && <p className="pdf-notice" role="status">{notice}</p>}
    {error && <p className="pdf-notice" role="alert">{error}</p>}
    {!pages && !error && <p className="pdf-notice" role="status">PDFを読み込んでいます…</p>}
    <div className="pdf-canvas-area"><div ref={container} className="pdf-viewer-container" tabIndex={0} aria-label="PDF本文"><div className="pdfViewer" /></div></div>
  </section>
}
