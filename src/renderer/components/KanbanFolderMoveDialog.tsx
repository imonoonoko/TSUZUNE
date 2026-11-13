import { useEffect, useRef, useState } from 'react'
import type { KanbanFolderMovePreview } from '../../shared/kanban-folder-move'
import { dirnameRelative } from '../../core/paths'
import { cycleDialogTab } from '../importer-dialog-focus'

export default function KanbanFolderMoveDialog({ source, destination, onPreview, onApply, onCancel }: {
  source: string
  destination: string
  onPreview: () => Promise<KanbanFolderMovePreview>
  onApply: (fingerprint: string) => Promise<void>
  onCancel: () => void
}): React.JSX.Element {
  const dialog = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  const alive = useRef(true)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<KanbanFolderMovePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    alive.current = true
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { alive.current = false; if (previous?.isConnected) previous.focus() }
  }, [])
  const run = async (apply: boolean): Promise<void> => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(null)
    try {
      if (apply && preview) await onApply(preview.fingerprint)
      else {
        const result = await onPreview()
        if (alive.current) setPreview(result)
      }
    } catch (cause) {
      if (alive.current) { setPreview(null); setError(cause instanceof Error ? cause.message : '移動できませんでした。') }
    } finally {
      pending.current = false
      if (alive.current) setBusy(false)
    }
  }
  return <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="ノートをフォルダーへ移動" ref={dialog}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.key === 'Process') return
      if (event.key === 'Escape' && !pending.current) { event.preventDefault(); event.stopPropagation(); onCancel() }
      cycleDialogTab(event, dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled)'))
    }}>
    <h2>ノートをフォルダーへ移動</h2>
    <p>移動元: {source}</p><p>移動先: {destination}</p><p>移動先フォルダー: {dirnameRelative(destination) || 'Vault直下'}</p>
    <p>ファイル名を保って移動します。同名ファイルがある場合は停止します。移動後はビューの絞り込みによって表示されなくなる場合があります。</p>
    {preview && <div role="status" aria-live="polite"><p>リンクの影響: {preview.linkImpact.affectedCount}件の参照元</p>
      <ul>{preview.linkImpact.sourcePaths.map(path => <li key={path}>{path}</li>)}</ul>
      <p>更新できる参照と移動ノート内の相対リンクを更新します。受信箱を含む保護・除外ノートや曖昧な参照は更新しません。保護された移動元の相対リンクは必要に応じて手動で確認してください。</p></div>}
    {error && <p role="alert">{error}</p>}
    <div className="modal-actions">
      <button type="button" className="secondary-button" disabled={busy} onClick={() => { void run(false) }}>移動をプレビュー</button>
      <button type="button" className="primary-button" disabled={busy || !preview} onClick={() => { void run(true) }}>確認した移動を実行</button>
      <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>キャンセル</button>
    </div>
  </div></div>
}
