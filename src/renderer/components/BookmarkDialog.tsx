import { useEffect, useRef, useState } from 'react'
import type { VaultBookmark } from '../../shared/types'
import { basenameRelative } from '../../core/paths'

interface BookmarkDialogProps {
  path: string
  bookmark?: VaultBookmark
  onCancel: () => void
  onSave: (title: string, group: string) => Promise<void>
  onDelete: () => Promise<void>
}

export default function BookmarkDialog({
  path,
  bookmark,
  onCancel,
  onSave,
  onDelete
}: BookmarkDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLFormElement | null>(null)
  const titleRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    titleRef.current?.focus()
    return () => {
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) {
        previousFocus.focus()
      }
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <form
        ref={dialogRef}
        className="modal bookmark-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookmark-dialog-title"
        aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.preventDefault()
            onCancel()
            return
          }
          if (event.key !== 'Tab') {
            return
          }
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
            'input:not(:disabled), button:not(:disabled)'
          )
          if (!focusable || focusable.length === 0) {
            return
          }
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }}
        onSubmit={(event) => {
          event.preventDefault()
          if (busy) {
            return
          }
          const data = new FormData(event.currentTarget)
          setBusy(true)
          void onSave(
            String(data.get('title') ?? ''),
            String(data.get('group') ?? '')
          ).finally(() => setBusy(false))
        }}
      >
        <h2 id="bookmark-dialog-title">
          {bookmark ? 'ブックマークを編集' : 'ブックマークを追加'}
        </h2>
        <p>{path}</p>
        <label>
          タイトル
          <input
            ref={titleRef}
            name="title"
            defaultValue={bookmark?.title ?? ''}
            placeholder={basenameRelative(path)}
            disabled={busy}
          />
        </label>
        <label>
          Bookmark group
          <input
            name="group"
            defaultValue={bookmark?.group ?? ''}
            disabled={busy}
          />
        </label>
        <div className="modal-actions">
          {bookmark && (
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void onDelete().finally(() => setBusy(false))
              }}
            >
              削除
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            保存
          </button>
        </div>
      </form>
    </div>
  )
}
