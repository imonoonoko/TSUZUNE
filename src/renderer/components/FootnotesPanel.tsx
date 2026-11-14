import './FootnotesPanel.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { markdownFootnotes, type MarkdownFootnote } from '../../core/markdown-footnotes'

interface Props {
  source: string
  documentKey: string
  disabledReason?: string
  onSelect: (source: string, from: number, to: number) => void
  onApply: (source: string, from: number, replacement: string) => string | null
  onEditingChange?: (editing: boolean) => void
}

export default function FootnotesPanel({ source, documentKey, disabledReason, onSelect, onApply, onEditingChange }: Props): React.JSX.Element {
  const footnotes = useMemo(() => markdownFootnotes(source), [source])
  const [session, setSession] = useState<{ source: string; key: string; footnote: MarkdownFootnote; draft: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const returnFocus = useRef<{ button: HTMLButtonElement; fallback: HTMLButtonElement; key: string } | null>(null)
  const editing = session !== null
  useEffect(() => {
    if (editing) { dialog.current?.showModal(); dialog.current?.querySelector('textarea')?.focus() }
  }, [editing])
  useEffect(() => { onEditingChange?.(editing); return () => { if (editing) onEditingChange?.(false) } }, [editing, onEditingChange])
  useEffect(() => {
    if (editing || !returnFocus.current) return
    const target = returnFocus.current
    const frame = requestAnimationFrame(() => {
      if (!target.button.isConnected || target.key !== documentKey || ![document.body, target.button, target.fallback].includes(document.activeElement as HTMLElement)) { returnFocus.current = null; return }
      // Autosave can disable the opener after the dialog has already closed.
      const button = target.button.disabled ? target.fallback : target.button
      button.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [editing, disabledReason, documentKey])
  const close = (): void => {
    if (opener.current && session) returnFocus.current = { button: opener.current, fallback: opener.current.previousElementSibling as HTMLButtonElement, key: session.key }
    setSession(null); setError(null)
  }
  const apply = (): void => {
    if (!session) return
    if (session.source !== source || session.key !== documentKey) { setError('本文やノートの表示が変更されています。入力を控え、キャンセルして開き直してください。'); return }
    if (disabledReason) { setError(disabledReason); return }
    const issue = onApply(session.source, session.footnote.from, session.draft)
    if (issue) setError(issue)
    else close()
  }
  return <>
    {disabledReason && <p className="related-empty">{disabledReason}</p>}
    {footnotes.length === 0 && <p className="related-empty">脚注の定義はありません。</p>}
    <div className="footnotes-list">{footnotes.map(footnote => <section className="footnote-item" key={footnote.from} data-footnote-id={footnote.label}>
      <header><strong>[^{footnote.label}]</strong><span>{footnote.references.length ? `参照 ${footnote.references.length}件` : '参照なし'}</span></header>
      <pre>{footnote.source}</pre>
      <div className="footnote-actions">
        <button type="button" aria-label={`脚注 ${footnote.label} の定義へ移動`} onClick={() => onSelect(source, footnote.from, footnote.to)}>定義へ</button>
        <button type="button" aria-label={`脚注 ${footnote.label} を編集`} disabled={!!disabledReason || !footnote.editable} title={disabledReason ?? footnote.reason}
          onClick={event => { returnFocus.current = null; opener.current = event.currentTarget; setError(null); setSession({ source, key: documentKey, footnote, draft: footnote.source }) }}>編集</button>
        {footnote.references.map((reference, index) => <button type="button" key={reference.from} aria-label={`脚注 ${footnote.label} の参照 ${index + 1}へ移動`}
          onClick={() => onSelect(source, reference.from, reference.to)}>参照 {index + 1}へ</button>)}
      </div>
      {footnote.reason && <p className="related-empty">{footnote.reason}</p>}
    </section>)}</div>
    {session && createPortal(<dialog ref={dialog} className="footnote-dialog" aria-label="脚注を編集"
      onCancel={event => { event.preventDefault(); close() }} onKeyDown={event => {
        event.stopPropagation()
        if (event.key === 'Escape' && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); close() }
      }}>
      <header><h2>脚注を編集</h2><button type="button" onClick={close}>キャンセル</button></header>
      <p>[^{session.footnote.label}] の定義を編集します。識別子はそのままに、継続行は字下げしてください。</p>
      <label>脚注の定義（Markdown）<textarea autoFocus aria-label="脚注の定義（Markdown）" value={session.draft}
        onChange={event => setSession({ ...session, draft: event.target.value })} /></label>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={apply}>脚注を適用</button></footer>
    </dialog>, document.body)}
  </>
}
