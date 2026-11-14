import { useEffect, useMemo, useRef, useState } from 'react'
import { compareNoteVersions } from '../../core/note-history-diff'
import type { NoteHistory } from '../../shared/note-history'
import './NoteHistoryDialog.css'

export default function NoteHistoryDialog({ history, onRestore, onClose }: {
  history: NoteHistory
  onRestore: (id: string) => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const [selected, setSelected] = useState(history.versions[0]?.id ?? '')
  const [loaded, setLoaded] = useState<{ id: string; content: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [retry, setRetry] = useState(0)
  const dialog = useRef<HTMLElement>(null)
  const saving = useRef(false)
  const cancelRestore = useRef<HTMLButtonElement>(null)
  const beginRestore = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const current = loaded?.id === selected ? loaded.content : null
  const diff = useMemo(() => current === null ? null : compareNoteVersions(current, history.content), [current, history.content])
  const summary = history.versions.reduce((total, version) => ({
    size: total.size + version.size,
    oldest: Math.min(total.oldest, version.savedAt),
    latest: Math.max(total.latest, version.savedAt)
  }), { size: 0, oldest: Infinity, latest: -Infinity })
  useEffect(() => { dialog.current?.querySelector<HTMLElement>('select, button')?.focus() }, [])
  useEffect(() => {
    let active = true
    setLoaded(null); setError(null); setConfirming(false)
    if (selected) void window.tsuzune.getNoteVersion({ scope: history.scope, path: history.path, id: selected }).then(result => {
      if (!active) return
      if (result.ok) setLoaded({ id: selected, content: result.value.content })
      else setError(result.error.message)
    }).catch(cause => { if (active) setError(String(cause)) })
    return () => { active = false }
  }, [selected, history, retry])
  useEffect(() => {
    if (confirming) cancelRestore.current?.focus()
    else if (wasConfirming.current) {
      if (beginRestore.current?.disabled) dialog.current?.focus()
      else beginRestore.current?.focus()
    }
    wasConfirming.current = confirming
  }, [confirming])
  const restore = async (): Promise<void> => {
    if (saving.current || current === null) return
    saving.current = true; setRestoring(true); setError(null)
    dialog.current?.focus()
    try { await onRestore(selected) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setConfirming(false) }
    finally { saving.current = false; setRestoring(false) }
  }
  return <div className="modal-backdrop" role="presentation" onClick={event => {
    if (event.target === event.currentTarget && !saving.current) onClose()
  }}>
    <section ref={dialog} className="modal note-history-dialog" role="dialog" aria-modal="true" aria-labelledby="note-history-title"
      tabIndex={-1} aria-busy={restoring || Boolean(selected && !loaded && !error)} onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); if (!saving.current) { if (confirming) setConfirming(false); else onClose() } }
        if (event.key !== 'Tab') return
        const controls = dialog.current?.querySelectorAll<HTMLElement>('select:not(:disabled), textarea, button:not(:disabled)')
        if (!controls?.length) { event.preventDefault(); dialog.current?.focus(); return }
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}>
      <h2 id="note-history-title">版履歴</h2>
      <p className="muted note-history-path">{history.path}</p>
      <section aria-label="このパスの履歴">
        <p>このパスの過去版: {history.versions.length.toLocaleString('ja-JP')}件・保存本文の合計 {summary.size.toLocaleString('ja-JP')} B</p>
        <p>最古の履歴保存: {history.versions.length ? new Date(summary.oldest).toLocaleString('ja-JP') : '日時なし'} ／ 最新の履歴保存: {history.versions.length ? new Date(summary.latest).toLocaleString('ja-JP') : '日時なし'}</p>
      </section>
      <p className="muted">保持期間・件数上限なし。自動整理は行いません。</p>
      <p className="muted">TSUZUNE内の通常Markdownの変更保存前が対象です。MCP・同期・外部編集は直接記録しません。改名・移動前の履歴は旧パスに残ります。</p>
      <p className="muted">40_情報源・50_履歴・隠し領域・Canvas・添付ファイルは対象外です。</p>
      <p className="muted">容量は、この画面を開いた時点の過去版の本文合計です。現在の本文や管理ファイルは含みません。</p>
      {history.versions.length === 0 ? <p role="status">保存前の版はまだありません。本文を編集して保存すると、ここから戻せます。</p> : <>
        <label>保存前の版<select aria-label="保存前の版" value={selected} disabled={restoring} onChange={event => setSelected(event.target.value)}>
          {history.versions.map((version, index) => <option key={version.id} value={version.id}>
            {new Date(version.savedAt).toLocaleString('ja-JP')} · {version.size} bytes · {history.versions.length - index}
          </option>)}
        </select></label>
        {!loaded && !error && <p role="status">版を読み込んでいます…</p>}
        {current !== null && <>
          <p className="muted">選択した版 → 現在の保存済み本文。「−」は削除、「＋」は追加です。</p>
          <div className="note-history-content">
            <label>選択した版の本文<textarea readOnly aria-label="選択した版の本文" value={current} spellCheck={false} /></label>
            <label>現在との差分<textarea readOnly aria-label="選択した版から現在への差分" value={diff?.text ?? ''} spellCheck={false} /></label>
          </div>
          {diff?.coarse && <p className="muted">変更範囲が大きいため、その範囲をまとめて比較しています。</p>}
          {diff?.truncated && <p role="status">差分表示の上限に達しました。全文は左の本文と、閉じた後の現在のノートで確認できます。</p>}
        </>}
      </>}
      {error && <p role="alert">{error} <button type="button" disabled={restoring} onClick={() => setRetry(value => value + 1)}>版を再読込</button></p>}
      {confirming && <p role="status">表示中の版へ復元します。現在の本文も履歴に残るため、後で戻せます。</p>}
      <div className="modal-actions">
        <button type="button" disabled={restoring} onClick={onClose}>閉じる</button>
        {confirming ? <>
          <button ref={cancelRestore} type="button" disabled={restoring} onClick={() => setConfirming(false)}>復元をやめる</button>
          <button type="button" className="primary-button" disabled={restoring} onClick={() => void restore()}>復元を実行</button>
        </> : <button ref={beginRestore} type="button" className="primary-button" disabled={current === null || current === history.content || restoring} onClick={() => setConfirming(true)}>この版に復元</button>}
      </div>
    </section>
  </div>
}
