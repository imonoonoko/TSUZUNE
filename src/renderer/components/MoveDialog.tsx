import { useEffect, useRef } from 'react'

interface MoveDialogProps {
  notePath: string
  entryKind?: 'file' | 'directory'
  directories: string[]
  currentDirectory: string
  onCancel: () => void
  onConfirm: (directory: string) => void
}
export default function MoveDialog({
  notePath,
  entryKind = 'file',
  directories,
  currentDirectory,
  onCancel,
  onConfirm
}: MoveDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLFormElement | null>(null)
  const selectRef = useRef<HTMLSelectElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    selectRef.current?.focus()
    return () => {
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) {
        previousFocus.focus()
      }
    }
  }, [])

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-dialog-title"
        aria-describedby="move-dialog-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
            return
          }
          if (event.key !== 'Tab') {
            return
          }
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
            'select, button:not(:disabled)'
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
          const data = new FormData(event.currentTarget)
          onConfirm(String(data.get('directory') ?? ''))
        }}
      >
        <h2 id="move-dialog-title">
          {entryKind === 'directory' ? 'フォルダーを移動' : 'ファイルを移動'}
        </h2>
        <p id="move-dialog-description">{notePath}</p>
        <label>
          移動先
          <select ref={selectRef} name="directory" defaultValue={currentDirectory}>
            {directories.map((directory) => (
              <option value={directory} key={directory || '__root__'}>
                {directory || 'Vault直下'}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="primary-button">
            移動
          </button>
        </div>
      </form>
    </div>
  )
}
