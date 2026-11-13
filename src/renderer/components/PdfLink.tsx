import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PdfLocation } from '../../core/pdf-links'
export const LazyPdfReader = lazy(() => import('./PdfReader'))

export default function PdfLink({ location, href, children, expectedRoot }: { location: PdfLocation | null; href: string; children: React.ReactNode; expectedRoot?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLAnchorElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else if (wasOpen.current) opener.current?.focus()
    wasOpen.current = open
  }, [open])
  if (!location) return <span className="inactive-link" title="PDFのリンク先またはページ指定を確認してください。">{children}</span>
  return <>
    <a ref={opener} href={href} data-pdf-link="true" onClick={event => { event.preventDefault(); setOpen(true) }}>{children}</a>
    {open && createPortal(<dialog ref={dialog} className="pdf-dialog" aria-label={`PDF: ${location.path}`} onCancel={event => { event.preventDefault(); setOpen(false) }}
      onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); setOpen(false) } }}>
      <header><strong>{location.path}</strong><button type="button" onClick={() => setOpen(false)}>PDFを閉じる</button></header>
      <Suspense fallback={<p role="status">PDFビューアを準備しています…</p>}><LazyPdfReader {...location} expectedRoot={expectedRoot} /></Suspense>
    </dialog>, document.body)}
  </>
}
