import { useEffect, useRef, useState } from 'react'
import type { NoteComposeApplyInput, NoteComposeInput, NoteComposePreview } from '../../shared/note-composer'
import './NoteComposerDialog.css'

export default function NoteComposerDialog({ initial, paths, templates = [], onPreview, onApply, onClose }: {
  initial: NoteComposeInput
  paths: string[]
  templates?: Array<{ path: string; name: string }>
  onPreview: (input: NoteComposeInput) => Promise<NoteComposePreview>
  onApply: (input: NoteComposeApplyInput) => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const [input, setInput] = useState(initial)
  const [templateNow] = useState(() => new Date().toISOString())
  const [preview, setPreview] = useState<NoteComposePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialog = useRef<HTMLElement>(null)
  const pending = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    dialog.current?.querySelector<HTMLElement>('button')?.focus()
    return () => { active.current = false }
  }, [])
  const change = (patch: Partial<NoteComposeInput>): void => {
    if (pending.current) return
    setInput(value => ({ ...value, ...patch }))
    setPreview(null); setError(null)
  }
  const run = async (apply: boolean): Promise<void> => {
    if (pending.current || (apply && !preview)) return
    pending.current = true; setBusy(true); setError(null)
    try {
      if (apply) await onApply({ input, fingerprint: preview!.fingerprint })
      else {
        const result = await onPreview(input)
        if (active.current) setPreview(result)
      }
    } catch (cause) {
      if (active.current) { setError(cause instanceof Error ? cause.message : String(cause)); setPreview(null) }
    } finally {
      pending.current = false
      if (active.current) { setBusy(false); requestAnimationFrame(() => dialog.current?.focus()) }
    }
  }
  const canExtract = Boolean(initial.range && initial.range.to > initial.range.from)
  return <div className="modal-backdrop" role="presentation" onClick={event => {
    if (event.target === event.currentTarget && !pending.current) onClose()
  }}>
    <section ref={dialog} className="modal note-composer-dialog" role="dialog" aria-modal="true" aria-labelledby="note-composer-title"
      tabIndex={-1} aria-busy={busy} onKeyDown={event => {
        event.stopPropagation()
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); if (!pending.current) onClose() }
        if (event.key !== 'Tab') return
        const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, summary')
        if (!controls?.length) { event.preventDefault(); dialog.current?.focus(); return }
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus() }
      }}>
      <header><h2 id="note-composer-title">ノートの抽出・統合</h2><button type="button" disabled={busy} onClick={onClose}>キャンセル</button></header>
      <p className="muted note-composer-path">元のノート: {initial.sourcePath}</p>
      <div className="note-composer-options">
        <label>操作<select aria-label="操作" value={input.mode} disabled={busy} onChange={event => {
          const mode = event.target.value as NoteComposeInput['mode']
          change({ mode, targetMode: mode === 'merge' ? 'existing' : input.targetMode, targetTemplate: undefined })
        }}>
          <option value="extract" disabled={!canExtract}>選択範囲を抽出</option><option value="merge">ノート全体を統合</option>
        </select></label>
        <label>移動先の種類<select aria-label="移動先の種類" value={input.targetMode} disabled={busy || input.mode === 'merge'}
          onChange={event => change({ targetMode: event.target.value as NoteComposeInput['targetMode'], targetTemplate: undefined })}>
          <option value="new">新しいノート</option><option value="existing">既存のノート</option>
        </select></label>
        <label className="note-composer-target">移動先ノートのパス<input aria-label="移動先ノートのパス" value={input.targetPath} disabled={busy}
          list={input.targetMode === 'existing' ? 'note-composer-targets' : undefined}
          placeholder="30_知識/ノート名.md" onChange={event => change({ targetPath: event.target.value })} /></label>
        <datalist id="note-composer-targets">{paths.filter(path => path !== initial.sourcePath).map(path => <option key={path} value={path} />)}</datalist>
        <label>挿入位置<select aria-label="挿入位置" value={input.placement} disabled={busy || Boolean(input.targetTemplate)}
          onChange={event => change({ placement: event.target.value as NoteComposeInput['placement'] })}>
          <option value="append">末尾に追加</option><option value="prepend">本文の先頭に追加</option>
        </select></label>
        {input.mode === 'extract' && input.targetMode === 'new' && <label>抽出先テンプレート<select aria-label="抽出先テンプレート" value={input.targetTemplate?.path ?? ''} disabled={busy}
          onChange={event => change({ targetTemplate: event.target.value ? { path: event.target.value, now: templateNow } : undefined })}>
          <option value="">テンプレートなし</option>
          {templates.map(template => <option key={template.path} value={template.path}>{template.name} — {template.path}</option>)}
        </select></label>}
        {input.mode === 'extract' && <label>元本文の残し方<select aria-label="元本文の残し方" value={input.sourceReplacement ?? 'link'} disabled={busy}
          onChange={event => change({ sourceReplacement: event.target.value as NoteComposeInput['sourceReplacement'] })}>
          <option value="link">リンクに置換</option><option value="embed">埋込みに置換</option><option value="none">何も残さない</option>
        </select></label>}
      </div>
      {input.mode === 'extract' ? input.sourceReplacement === 'none'
        ? <p>選択した {initial.range ? initial.range.to - initial.range.from : 0} 文字を移動します。選択範囲を削除し、元の場所には何も挿入しません。</p>
        : <p>選択した {initial.range ? initial.range.to - initial.range.from : 0} 文字を移動し、元の場所には{input.sourceReplacement === 'embed' ? '移動先ノート全体の埋込み' : 'ノートリンク'}を残します。</p>
        : <p>本文と互換性のあるプロパティを統合し、参照リンクを更新します。統合元はごみ箱へ退避します。</p>}
      {input.targetTemplate && <p className="muted">テンプレートの本文位置は {'{{content}}'} で指定できます。指定がない場合は末尾に本文を追加します。新規ノートだけに適用します。</p>}
      {!canExtract && <p className="muted">部分抽出には、編集画面で本文を選択してから開いてください。</p>}
      {error && <p role="alert">{error}</p>}
      {preview && <section aria-label="変更のプレビュー">
        <p role="status">{preview.changes.length} ファイルを変更します。参照リンク更新: {preview.updatedLinkCount} 件</p>
        <div className="note-composer-changes">{preview.changes.map(item => <details key={item.path} open>
          <summary>{item.path} — {item.kind === 'create' ? '作成' : item.kind === 'trash' ? 'ごみ箱へ退避' : '更新'}</summary>
          <div className="note-composer-contents">
            {item.before !== null && <label>変更前<textarea readOnly aria-label={item.path + 'の変更前'} value={item.before} spellCheck={false} /></label>}
            {item.after !== null && <label>変更後<textarea readOnly aria-label={item.path + 'の変更後'} value={item.after} spellCheck={false} /></label>}
          </div>
        </details>)}</div>
      </section>}
      <footer className="modal-actions">
        <button type="button" disabled={busy || !input.targetPath.trim()} onClick={() => void run(false)}>{busy ? '処理中…' : '変更を確認'}</button>
        {preview && <button type="button" className="primary-button" disabled={busy} onClick={() => void run(true)}>
          {input.mode === 'extract' ? '抽出を実行' : '統合を実行'}
        </button>}
      </footer>
    </section>
  </div>
}
