import { useEffect, useRef, useState } from 'react'

export interface QuickNoteCreateDialogProps {
  initialName: string
  directories: string[]
  initialDirectory: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (value: { name: string; directory: string }) => void
}

function noteName(value: string): string {
  return value.trim().replace(/\.md$/i, '').trim()
}

function destinationPath(directory: string, name: string): string {
  const fileName = noteName(name)
  return `${directory ? `${directory.replace(/[\\/]+$/, '')}/` : ''}${fileName}.md`
}

export default function QuickNoteCreateDialog({
  initialName,
  directories,
  initialDirectory,
  busy = false,
  error = null,
  onCancel,
  onConfirm
}: QuickNoteCreateDialogProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [name, setName] = useState(initialName)
  const availableDirectories = [
    '',
    ...directories.filter((directory, index) => directory && directories.indexOf(directory) === index)
  ]
  const [directory, setDirectory] = useState(
    availableDirectories.includes(initialDirectory) ? initialDirectory : ''
  )
  const normalizedName = noteName(name)
  const validationError = normalizedName ? error : 'ノート名を入力してください'

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

  useEffect(() => {
    if (!busy) nameRef.current?.focus()
  }, [busy])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>): void => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') {
      return
    }
    const focusable = formRef.current?.querySelectorAll<HTMLElement>(
      'input:not(:disabled), select:not(:disabled), button:not(:disabled)'
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
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <form
        ref={formRef}
        className="modal quick-note-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-note-create-dialog-title"
        aria-busy={busy}
        onKeyDown={handleKeyDown}
        onSubmit={(event) => {
          event.preventDefault()
          if (busy || !normalizedName) {
            return
          }
          onConfirm({ name: normalizedName, directory })
        }}
      >
        <h2 id="quick-note-create-dialog-title">新規ノートを作成</h2>
        <label>
          名前
          <input
            ref={nameRef}
            name="name"
            value={name}
            disabled={busy}
            autoComplete="off"
            aria-invalid={Boolean(validationError)}
            aria-describedby={`quick-note-create-dialog-preview${
              validationError ? ' quick-note-create-dialog-error' : ''
            }`}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          作成先
          <select
            name="directory"
            value={directory}
            disabled={busy}
            onChange={(event) => setDirectory(event.target.value)}
          >
            {availableDirectories.map((option) => (
              <option key={option || 'vault-root'} value={option}>
                {option || 'Vault直下'}
              </option>
            ))}
          </select>
        </label>
        <p id="quick-note-create-dialog-preview">作成先: {destinationPath(directory, name)}</p>
        {validationError && (
          <p id="quick-note-create-dialog-error" role="alert">
            {validationError}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="primary-button" disabled={busy || !normalizedName}>
            作成
          </button>
        </div>
      </form>
    </div>
  )
}
