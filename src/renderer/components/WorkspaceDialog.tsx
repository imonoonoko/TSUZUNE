import React, { useEffect, useRef, useState } from 'react'
import type { VaultWorkspacesV1, WorkspaceSnapshotV1 } from '../../shared/workspace-state'
import './workspace-dialog.css'

export interface WorkspaceDialogProps {
  named: VaultWorkspacesV1['named']
  mode: 'save' | 'open'
  busy: boolean
  error: string | null
  onSave: (name: string, replaceExisting: boolean) => void
  onLoad: (snapshot: WorkspaceSnapshotV1, name: string) => void
  onDelete: (name: string) => void
  onClose: () => void
}

function validateName(value: string): string | null {
  if (!value || Array.from(value).length > 80 || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
    return '名前は1〜80文字で入力してください。'
  }
  return null
}

function isComposing(event: React.KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.key === 'Process'
}

export default function WorkspaceDialog({
  named,
  mode,
  busy,
  error,
  onSave,
  onLoad,
  onDelete,
  onClose
}: WorkspaceDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const originRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null)
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const trimmedName = name.trim()
  const nameError = validateName(trimmedName)
  const existing = named.find((item) => item.name === trimmedName)

  useEffect(() => {
    if (deleting) cancelDeleteRef.current?.focus()
    else if (mode === 'save') nameRef.current?.focus()
    else {
      const firstOpen = dialogRef.current?.querySelector<HTMLButtonElement>('[data-workspace-open]')
      if (firstOpen) firstOpen.focus()
      else closeRef.current?.focus()
    }
  }, [deleting, mode])

  const close = (): void => {
    onClose()
    queueMicrotask(() => originRef.current?.focus())
  }

  const submit = (): void => {
    if (busy || nameError) return
    onSave(trimmedName, Boolean(existing))
  }

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (deleting) setDeleting(null)
      else close()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (focusable.length === 1 || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (deleting) {
    return (
      <div className="modal-backdrop workspace-dialog-backdrop" role="presentation">
        <section ref={dialogRef} className="modal workspace-dialog" role="dialog" aria-modal="true"
          aria-labelledby="workspace-delete-title" onKeyDown={handleDialogKeyDown}>
          <h2 id="workspace-delete-title">{deleting}を削除</h2>
          <p>ノートは削除されません。</p>
          <div className="modal-actions">
            <button ref={cancelDeleteRef} type="button" disabled={busy} onClick={() => setDeleting(null)}>キャンセル</button>
            <button type="button" className="workspace-dialog-danger" disabled={busy} onClick={() => {
              setDeleting(null)
              onDelete(deleting)
            }}>削除する</button>
          </div>
          {error && <p className="workspace-dialog-error" role="alert">{error}</p>}
        </section>
      </div>
    )
  }

  return (
    <div className="modal-backdrop workspace-dialog-backdrop" role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget && !busy) close()
    }}>
      <section ref={dialogRef} className="modal workspace-dialog" role="dialog" aria-modal="true"
        aria-labelledby="workspace-dialog-title" onKeyDown={handleDialogKeyDown}>
        <header className="workspace-dialog-heading">
          <h2 id="workspace-dialog-title">ワークスペース</h2>
          <button ref={closeRef} type="button" aria-label="閉じる" title="閉じる（Esc）" disabled={busy} onClick={close}>×</button>
        </header>
        {mode === 'save' && <form className="workspace-dialog-save" onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}>
            <label htmlFor="workspace-name">現在の配置を保存</label>
            <div className="workspace-dialog-save-row">
              <input ref={nameRef} id="workspace-name" aria-label="ワークスペース名" value={name} disabled={busy}
                aria-invalid={nameError ? 'true' : undefined} onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => { if (isComposing(event)) event.preventDefault() }} />
              <button type="submit" disabled={busy || Boolean(nameError)}>{existing ? 'この名前で更新' : '保存'}</button>
            </div>
            {nameError && <p className="workspace-dialog-error" role="alert">{nameError}</p>}
          </form>}
        <section className="workspace-dialog-list" aria-label="保存済みワークスペース">
          <h3>保存済み</h3>
          {named.length === 0 ? <p role="status">保存済みのワークスペースはありません。</p> : named.map((item) => (
            <div className="workspace-dialog-item" key={item.name}>
              <div><strong>{item.name}</strong><span>{item.snapshot.tabs.length}タブ・{new Date(item.savedAt).toLocaleString()}</span></div>
              <div>
                <button type="button" data-workspace-open disabled={busy} onClick={() => onLoad(item.snapshot, item.name)}>開く</button>
                <button type="button" disabled={busy} onClick={() => setDeleting(item.name)}>削除</button>
              </div>
            </div>
          ))}
        </section>
        <p className="workspace-dialog-status" role="status" aria-live="polite">{busy ? '処理中です。' : error ?? ''}</p>
      </section>
    </div>
  )
}
