import { useEffect, useRef } from 'react'

interface RenameDialogProps {
  entryPath: string
  entryKind: 'note' | 'directory'
  currentName: string
  error?: string | null
  busy?: boolean
  onCancel: () => void
  onConfirm: (name: string) => void
}

export default function RenameDialog({
  entryPath,
  entryKind,
  currentName,
  error,
  busy = false,
  onCancel,
  onConfirm
}: RenameDialogProps): React.JSX.Element {
  const title = `${entryKind === 'note' ? 'ノート' : 'フォルダ'}の名前を変更`
  const dialogRef = useRef<HTMLFormElement | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    nameRef.current?.focus()
    nameRef.current?.select()
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
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-dialog-title"
        aria-describedby="rename-dialog-description"
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
          onConfirm(String(data.get('name') ?? ''))
        }}
      >
        <h2 id="rename-dialog-title">{title}</h2>
        <p id="rename-dialog-description">{entryPath}</p>
        {error && (
          <p className="google-sync-error" role="alert">
            {error}
          </p>
        )}
        <label>
          新しい名前
          <input
            ref={nameRef}
            name="name"
            defaultValue={currentName}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            名前変更
          </button>
        </div>
      </form>
    </div>
  )
}
