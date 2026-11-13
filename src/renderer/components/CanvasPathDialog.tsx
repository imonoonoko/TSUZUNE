import { useEffect, useRef, useState } from 'react'
import { validateRelativePath } from '../../core/paths'
import { isAuditHistoryPath } from '../../shared/ai-write-policy'

interface Props {
  candidates: string[]
  loading: boolean
  busy: boolean
  error: string | null
  initialDirectory: string
  onConfirm(path: string, create: boolean): void
  onCancel(): void
}

export default function CanvasPathDialog({ candidates, loading, busy, error, initialDirectory, onConfirm, onCancel }: Props) {
  const [path, setPath] = useState('')
  const [query, setQuery] = useState('')
  const [create, setCreate] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const composing = useRef(false)
  useEffect(() => { input.current?.focus() }, [])
  const validated = validateRelativePath(path)
  const valid = validated.valid && !!validated.normalized && /\.canvas$/i.test(validated.normalized) && !isAuditHistoryPath(validated.normalized)
  const submit = (): void => { if (!busy && !composing.current && valid) onConfirm(validated.normalized!, create) }
  return <div className="modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <form ref={form} className="modal base-path-dialog" role="dialog" aria-modal="true" aria-labelledby="canvas-dialog-title" aria-busy={busy}
      onSubmit={event => { event.preventDefault(); submit() }}
      onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
      onKeyDown={event => {
        event.stopPropagation()
        if (composing.current || event.nativeEvent.isComposing) { if (event.key === 'Enter') event.preventDefault(); return }
        if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel() }
        if (event.key === 'Tab') {
          const items = form.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), select:not(:disabled)')
          if (!items?.length) return
          if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus() }
          else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus() }
        }
      }}>
      <h2 id="canvas-dialog-title">Canvas</h2>
      <div className="modal-actions">
        <button type="button" className="secondary-button" aria-pressed={!create} disabled={busy} onClick={() => { setCreate(false); setPath(''); input.current?.focus() }}>既存を開く</button>
        <button type="button" className="secondary-button" aria-pressed={create} disabled={busy} onClick={() => { setCreate(true); setPath(`${initialDirectory ? `${initialDirectory}/` : ''}新しいCanvas.canvas`); input.current?.focus() }}>新規作成</button>
      </div>
      {!create && <>
        <label htmlFor="canvas-search">Canvasを検索</label>
        <input id="canvas-search" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} />
        <select size={7} aria-label="Canvas一覧" disabled={busy || loading} value={path}
          onChange={event => setPath(event.target.value)} onDoubleClick={() => submit()}>
          {candidates.filter(candidate => candidate.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(candidate => <option value={candidate} key={candidate}>{candidate}</option>)}
        </select>
        {loading ? <p role="status">Canvasを探しています…</p> : !candidates.length && <p>Canvasがありません。「新規作成」から始められます。</p>}
      </>}
      <label htmlFor="canvas-path">Canvasのパス</label>
      <input ref={input} id="canvas-path" value={path} disabled={busy} onChange={event => setPath(event.target.value)} placeholder="構想.canvas" autoComplete="off" aria-invalid={!!path && !valid} />
      <p className="muted">Vault内の.canvasファイル。作成先には既存のフォルダーを指定してください。</p>
      {path && !valid && <p role="alert">Vault内の.canvasパスを入力してください。</p>}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>キャンセル</button>
        <button type="submit" className="primary-button" disabled={busy || !valid}>{create ? '作成' : '開く'}</button></div>
    </form>
  </div>
}
