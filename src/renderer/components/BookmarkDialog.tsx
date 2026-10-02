import { useEffect, useRef, useState } from 'react'
import type { SaveBookmarkInput, VaultBookmark } from '../../shared/bookmarks'
import { basenameRelative } from '../../core/paths'

interface BookmarkDialogProps {
  path?: string
  query?: string
  headings?: readonly { slug: string; title: string }[]
  bookmark?: VaultBookmark
  onCancel: () => void
  onSave: (title: string, group: string, target?: SaveBookmarkInput) => Promise<void>
  onDelete: () => Promise<void>
}

export default function BookmarkDialog({
  path,
  query,
  headings = [],
  bookmark,
  onCancel,
  onSave,
  onDelete
}: BookmarkDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLFormElement | null>(null)
  const titleRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const effectivePath = path ?? (bookmark?.type !== 'search' ? bookmark?.path : undefined)
  const effectiveQuery = query ?? (bookmark?.type === 'search' ? bookmark.query : undefined)
  const [kind, setKind] = useState<'file' | 'heading' | 'search'>(bookmark?.type ?? (effectivePath ? 'file' : 'search'))
  const [headingSlug, setHeadingSlug] = useState(bookmark?.type === 'heading' ? bookmark.slug : headings[0]?.slug ?? '')
  const availableHeadings = bookmark?.type === 'heading' && !headings.some(heading => heading.slug === bookmark.slug)
    ? [{ slug: bookmark.slug, title: bookmark.headingTitle }, ...headings] : headings
  const availableKinds = bookmark ? [bookmark.type] : [
    ...(effectivePath ? ['file'] : []),
    ...(effectivePath && availableHeadings.length ? ['heading'] : []),
    ...(effectiveQuery !== undefined ? ['search'] : [])
  ] as ('file' | 'heading' | 'search')[]

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
          const target: SaveBookmarkInput | null = kind === 'search'
            ? { type: 'search', query: effectiveQuery ?? '' }
            : kind === 'heading'
              ? (() => {
                  const heading = availableHeadings.find(item => item.slug === headingSlug)
                  return effectivePath && heading ? { type: 'heading', path: effectivePath, slug: heading.slug, headingTitle: heading.title } : null
                })()
              : effectivePath ? { type: 'file', path: effectivePath } : null
          if (!target) return
          setBusy(true)
          const title = String(data.get('title') ?? '')
          const group = String(data.get('group') ?? '')
          void (target.type === 'file' ? onSave(title, group) : onSave(title, group, target))
            .finally(() => setBusy(false))
        }}
      >
        <h2 id="bookmark-dialog-title">
          {bookmark ? 'ブックマークを編集' : 'ブックマークを追加'}
        </h2>
        <p>{kind === 'search' ? effectiveQuery : effectivePath}</p>
        {availableKinds.length > 1 ? (
          <label>種類
            <select aria-label="ブックマークの種類" value={kind} disabled={busy}
              onChange={event => setKind(event.target.value as typeof kind)}>
              {availableKinds.includes('file') && <option value="file">ファイル</option>}
              {availableKinds.includes('heading') && <option value="heading">見出し</option>}
              {availableKinds.includes('search') && <option value="search">検索</option>}
            </select>
          </label>
        ) : null}
        {kind === 'heading' ? (
          <label>見出し
            <select aria-label="ブックマークする見出し" value={headingSlug} disabled={busy}
              onChange={event => setHeadingSlug(event.target.value)}>
              {availableHeadings.map(heading => <option key={heading.slug} value={heading.slug}>{heading.title}</option>)}
            </select>
          </label>
        ) : null}
        <label>
          タイトル
          <input
            ref={titleRef}
            name="title"
            defaultValue={bookmark?.title ?? ''}
            placeholder={kind === 'search' ? effectiveQuery ?? '検索' : kind === 'heading'
              ? availableHeadings.find(heading => heading.slug === headingSlug)?.title ?? ''
              : effectivePath ? basenameRelative(effectivePath) : ''}
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
