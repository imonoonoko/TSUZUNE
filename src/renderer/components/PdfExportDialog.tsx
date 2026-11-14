import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CompiledPathAliases } from '../../core/path-aliases'
import type { NoteDocument, VaultAttachment } from '../../shared/types'
import type { PdfExportOptions } from '../../shared/pdf-export'
import { preparePdfContent, waitForPdfReady } from '../pdf-export'
import MarkdownPreview from './MarkdownPreview'
import './PdfExportDialog.css'

export interface PdfExportSnapshot {
  content: string
  notePath: string
  attachments: readonly VaultAttachment[]
  notes: readonly NoteDocument[]
  pathAliases?: CompiledPathAliases
}

export default function PdfExportDialog({ snapshot, onClose, onSaved }: {
  snapshot: PdfExportSnapshot
  onClose: () => void
  onSaved: (path: string) => void
}): React.JSX.Element {
  const [pageSize, setPageSize] = useState<PdfExportOptions['pageSize']>('A4')
  const [landscape, setLandscape] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canceled, setCanceled] = useState(false)
  const dialog = useRef<HTMLElement>(null)
  const printable = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  const operation = useRef<AbortController | null>(null)
  useLayoutEffect(() => {
    if (printable.current) preparePdfContent(printable.current)
  }, [])
  useEffect(() => {
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => operation.current?.abort()
  }, [])
  const save = async (): Promise<void> => {
    if (pending.current || !printable.current) return
    pending.current = true
    setBusy(true); setError(null); setCanceled(false)
    const controller = new AbortController()
    operation.current = controller
    try {
      await waitForPdfReady(printable.current, { signal: controller.signal })
      const result = await window.tsuzune.exportNotePdf({
        suggestedName: (snapshot.notePath.split('/').at(-1) ?? 'note.md').replace(/\.md$/i, '') + '.pdf', pageSize, landscape
      })
      if (controller.signal.aborted) return
      if (!result.ok) throw new Error(result.error.message)
      if (result.value.canceled) setCanceled(true)
      else onSaved(result.value.path)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'PDFを書き出せませんでした。')
    } finally {
      pending.current = false
      if (!controller.signal.aborted) { setBusy(false); dialog.current?.focus() }
    }
  }
  const paperWidth = pageSize === 'A4' ? (landscape ? 297 : 210) : (landscape ? 279.4 : 215.9)
  const paperHeight = pageSize === 'A4' ? (landscape ? 210 : 297) : (landscape ? 215.9 : 279.4)
  return <>
    <div className="modal-backdrop" role="presentation" onClick={event => {
      if (event.target === event.currentTarget && !pending.current) onClose()
    }}>
      <section ref={dialog} className="modal pdf-export-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-export-title" tabIndex={-1} aria-busy={busy}
        onKeyDown={event => {
          event.stopPropagation()
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape') { event.preventDefault(); if (!pending.current) onClose() }
          if (event.key !== 'Tab') return
          const controls = [...(dialog.current?.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('button, select') ?? [])].filter(control => !control.disabled)
          if (!controls?.length) { event.preventDefault(); dialog.current?.focus(); return }
          const first = controls[0], last = controls[controls.length - 1]
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus() }
        }}>
        <header><h2 id="pdf-export-title">PDF書き出し</h2><button type="button" disabled={busy} onClick={onClose}>キャンセル</button></header>
        <p className="pdf-export-path">{snapshot.notePath}</p>
        <p>この画面を開いた時点の本文を書き出します。未保存の編集も含みます。</p>
        <div className="pdf-export-options">
          <label>用紙<select aria-label="用紙" value={pageSize} disabled={busy} onChange={event => setPageSize(event.target.value as PdfExportOptions['pageSize'])}><option value="A4">A4</option><option value="Letter">Letter</option></select></label>
          <label>向き<select aria-label="向き" value={landscape ? 'landscape' : 'portrait'} disabled={busy} onChange={event => setLandscape(event.target.value === 'landscape')}><option value="portrait">縦</option><option value="landscape">横</option></select></label>
        </div>
        <p className="muted">余白15mm。calloutは展開し、音声・動画はファイル名で表示します。</p>
        {error && <p role="alert">{error}</p>}
        {canceled && <p role="status">保存をキャンセルしました。</p>}
        <footer className="modal-actions"><button type="button" className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? 'PDFを準備・保存しています…' : '保存先を選んで書き出す'}</button></footer>
      </section>
    </div>
    {createPortal(<div ref={printable} className="pdf-export-root" aria-hidden="true" inert style={{width:`${paperWidth - 30}mm`, '--pdf-media-height': `${Math.min(180, paperHeight - 60)}mm`} as React.CSSProperties}>
      <MarkdownPreview {...snapshot} onWikiLink={() => {}} localImagesOnly printAttachments />
    </div>, document.body)}
  </>
}
