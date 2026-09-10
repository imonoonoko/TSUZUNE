import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { validateRelativePath } from '../../core/paths'
import { isAuditHistoryPath } from '../../shared/ai-write-policy'

export interface BasePathDialogProps {
  candidates: string[]
  loading: boolean
  listError: string | null
  busy?: boolean
  error?: string | null
  onRefresh: () => void
  onCancel: () => void
  onConfirm: (path: string, mode: 'list' | 'manual') => void
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase()
}

function tokensFor(query: string): string[] {
  return normalize(query).trim().split(/\s+/).filter(Boolean)
}

function matches(path: string, tokens: string[]): boolean {
  return tokens.every((token) => normalize(path).includes(token))
}

function optionId(path: string): string {
  return `base-path-option-${encodeURIComponent(path)}`
}

function isComposing(event: ReactKeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.key === 'Process'
}

export default function BasePathDialog({
  candidates,
  loading,
  listError,
  busy = false,
  error = null,
  onRefresh,
  onCancel,
  onConfirm
}: BasePathDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLFormElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const manualInputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const composingRef = useRef(false)
  const [query, setQuery] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [mode, setMode] = useState<'list' | 'manual'>('list')
  const [path, setPath] = useState('')

  const queryTokens = useMemo(() => tokensFor(query), [query])
  const results = useMemo(() => candidates.filter((candidate) => matches(candidate, queryTokens)), [candidates, queryTokens])
  const listAvailable = !loading && !listError
  const activePath = mode === 'list' && listAvailable && selectedPath && results.includes(selectedPath)
    ? selectedPath
    : null
  const activeId = activePath ? optionId(activePath) : undefined
  const normalizedPath = path.trim().replaceAll('\\', '/')
  const validation = validateRelativePath(normalizedPath)
  const pathError = !validation.valid ? validation.reason
    : isAuditHistoryPath(normalizedPath) ? '監査履歴はBasesの入力にできません。'
      : !normalizedPath.toLocaleLowerCase().endsWith('.base') ? '.baseで終わるVault相対パスを入力してください。'
        : null
  const manualValid = !pathError

  useEffect(() => {
    if (mode === 'manual') manualInputRef.current?.focus()
    else searchRef.current?.focus()
  }, [mode])

  useEffect(() => {
    if (loading) return
    setSelectedPath((current) => current && results.includes(current) ? current : results[0] ?? null)
  }, [loading, results])

  useEffect(() => {
    if (!activeId) return
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [activeId])

  const confirm = (): void => {
    if (busy) return
    if (mode === 'manual') {
      if (manualValid) onConfirm(normalizedPath, 'manual')
      return
    }
    if (listAvailable && activePath) onConfirm(activePath, 'list')
  }

  const changeQuery = (value: string): void => {
    const tokens = tokensFor(value)
    setQuery(value)
    setSelectedPath(candidates.find((candidate) => matches(candidate, tokens)) ?? null)
  }

  const moveSelection = (delta: number): void => {
    if (!listAvailable || results.length === 0) return
    const current = activePath ? results.indexOf(activePath) : 0
    setSelectedPath(results[Math.max(0, Math.min(results.length - 1, current + delta))])
  }

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    const composing = composingRef.current || isComposing(event)
    if (composing || busy) {
      if (composing && event.key === 'Enter') event.preventDefault()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      if (listAvailable && results[0]) setSelectedPath(results[0])
    } else if (event.key === 'End') {
      event.preventDefault()
      if (listAvailable && results.at(-1)) setSelectedPath(results.at(-1)!)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      confirm()
    }
  }

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (composingRef.current || isComposing(event)) return
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')
    if (!focusable?.length) return
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

  const filename = (candidate: string): string => candidate.split('/').at(-1) ?? candidate

  return (
    <div
      className="modal-backdrop base-path-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <form
        ref={dialogRef}
        className="modal base-path-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="base-path-dialog-title"
        aria-busy={busy || loading}
        onKeyDown={handleDialogKeyDown}
        onSubmit={(event) => {
          event.preventDefault()
          if (!composingRef.current) confirm()
        }}
      >
        <h2 id="base-path-dialog-title" className="base-path-dialog-title">Baseを開く</h2>
        <label className="sr-only" htmlFor="base-path-search">Baseを検索</label>
        <input
          ref={searchRef}
          id="base-path-search"
          className="base-path-search"
          type="search"
          role="combobox"
          aria-label="Baseを検索"
          aria-controls="base-path-list"
          aria-expanded={mode === 'list'}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={query}
          disabled={busy}
          autoComplete="off"
          placeholder="名前またはフォルダーで絞り込む"
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        {mode === 'list' ? (
          <>
            <div ref={listRef} id="base-path-list" className="base-path-list" role="listbox" aria-label="Base候補" aria-busy={loading}>
              {loading && <p className="base-path-status" role="status">Baseを探しています</p>}
              {!loading && listError && <p className="base-path-error" role="alert">一覧を取得できませんでした: {listError}</p>}
              {!loading && !listError && results.map((candidate) => (
                <div
                  key={candidate}
                  id={optionId(candidate)}
                  className={`base-path-option${candidate === activePath ? ' is-selected' : ''}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={candidate === activePath}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { if (!busy) setSelectedPath(candidate) }}
                  onDoubleClick={() => { if (!busy) onConfirm(candidate, 'list') }}
                >
                  <span className="base-path-option-name">{filename(candidate)}</span>
                  <span className="base-path-option-path">{candidate}</span>
                </div>
              ))}
              {!loading && !listError && results.length === 0 && (
                <div className="base-path-status" role="status">
                  {query.trim()
                    ? '一致するBaseがありません'
                    : <>一覧に表示できるBaseがありません。<br />除外設定の対象は一覧に出ません。</>}
                </div>
              )}
            </div>
            <div className="base-path-summary">
              <span>{listAvailable ? `${results.length}件` : ''}</span>
              <button type="button" className="secondary-button" disabled={busy || loading} onClick={onRefresh}>一覧を更新</button>
            </div>
            <button type="button" className="base-path-manual-toggle" disabled={busy} onClick={() => setMode('manual')}>
              パスを入力して開く
            </button>
          </>
        ) : (
          <section className="base-path-manual" aria-label="Baseパスを入力">
            <label htmlFor="base-path-input">Vault相対の.baseパス</label>
            <input
              ref={manualInputRef}
              id="base-path-input"
              value={path}
              disabled={busy}
              autoComplete="off"
              placeholder="views/projects.base"
              aria-invalid={path.length > 0 && !manualValid}
              onCompositionStart={() => { composingRef.current = true }}
              onCompositionEnd={() => { composingRef.current = false }}
              onChange={(event) => setPath(event.target.value)}
              onKeyDown={(event) => {
                const composing = composingRef.current || isComposing(event)
                if (composing || busy) {
                  if (composing && event.key === 'Enter') event.preventDefault()
                  return
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  confirm()
                }
              }}
            />
            {path.length > 0 && !manualValid && <p className="base-path-error" role="alert">{pathError}</p>}
            <button type="button" className="base-path-manual-toggle" disabled={busy} onClick={() => setMode('list')}>
              一覧から選ぶ
            </button>
          </section>
        )}
        {error && <p className="base-path-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>キャンセル</button>
          <button type="submit" className="primary-button" disabled={busy || (mode === 'list' ? !activePath : !manualValid)}>開く</button>
        </div>
      </form>
    </div>
  )
}
