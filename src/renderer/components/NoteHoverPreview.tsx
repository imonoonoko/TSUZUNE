import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { notePreviewText, resolveNoteNavigation } from '../../core/note-navigation'
import type { CompiledPathAliases } from '../../core/path-aliases'
import type { NoteDocument } from '../../shared/types'

export interface EditorPreviewLink {
  anchor: HTMLElement
  rect?: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>
  href: string
  kind: 'wiki' | 'markdown'
  sourcePath: string
  sourceContent?: string
}

type Request = { anchor: HTMLElement; path: string } | EditorPreviewLink
type EditorHover = (anchor: HTMLElement, link: EditorPreviewLink | null) => void
const PreviewContext = createContext<EditorHover | null>(null)
const rowSelector = '[data-note-preview-path]'

export function useEditorLinkPreview(): EditorHover | null {
  return useContext(PreviewContext)
}

export default function NoteHoverPreview({ children, notes, aliases, contentPending, scope }: {
  children: ReactNode
  notes: readonly NoteDocument[]
  aliases: CompiledPathAliases
  contentPending?: boolean
  scope: string
}): React.JSX.Element {
  const active = useRef<Request | null>(null)
  const [request, setRequest] = useState<Request | null>(null)
  const [visible, setVisible] = useState<{ request: Request; title: string; text: string } | null>(null)
  const show = useCallback((next: Request | null): void => {
    active.current = next
    setRequest(next)
  }, [])
  const editorHover = useCallback<EditorHover>((anchor, link) => {
    const previous = active.current
    if (!link) {
      if (previous && 'href' in previous && previous.anchor === anchor) show(null)
      return
    }
    if (previous && 'href' in previous && previous.anchor === anchor && previous.href === link.href
      && previous.kind === link.kind && previous.sourcePath === link.sourcePath && previous.sourceContent === link.sourceContent
      && previous.rect?.left === link.rect?.left && previous.rect?.top === link.rect?.top) return
    show(link)
  }, [show])

  useEffect(() => { show(null) }, [scope, show])
  useEffect(() => {
    const rowAt = (target: EventTarget | null): HTMLElement | null => target instanceof Element ? target.closest(rowSelector) : null
    const start = (event: PointerEvent | FocusEvent): void => {
      if ('pointerType' in event && event.pointerType === 'touch') return
      const row = rowAt(event.target)
      const path = row?.dataset.notePreviewPath
      if (row && path && active.current?.anchor !== row) show({ anchor: row, path })
    }
    const focus = (event: FocusEvent): void => {
      if (rowAt(event.target)?.matches(':focus-visible')) start(event)
    }
    const stop = (event: PointerEvent | FocusEvent): void => {
      const current = active.current
      if (current && 'path' in current && rowAt(event.target) === current.anchor && rowAt(event.relatedTarget) !== current.anchor) show(null)
    }
    const dismiss = (): void => { if (active.current) show(null) }
    const scroll = (event: Event): void => {
      if (!(event.target instanceof Element && event.target.closest('.note-hover-preview'))) dismiss()
    }
    const keyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss()
    }
    const keyUp = (event: KeyboardEvent): void => {
      if ((event.key === 'Control' || event.key === 'Meta') && !event.ctrlKey && !event.metaKey && active.current && 'href' in active.current) dismiss()
    }
    document.addEventListener('pointerover', start)
    document.addEventListener('pointerout', stop)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', stop)
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('dragstart', dismiss)
    document.addEventListener('keydown', keyDown, true)
    document.addEventListener('keyup', keyUp, true)
    window.addEventListener('blur', dismiss)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerover', start)
      document.removeEventListener('pointerout', stop)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', stop)
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('dragstart', dismiss)
      document.removeEventListener('keydown', keyDown, true)
      document.removeEventListener('keyup', keyUp, true)
      window.removeEventListener('blur', dismiss)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [show])

  useEffect(() => {
    if (!request) return
    let disposed = false
    const current = (): boolean => !disposed && active.current === request && request.anchor.isConnected
    const timer = window.setTimeout(() => {
      if (!current()) return
      void (async () => {
        const direct = 'path' in request
        const sourcePath = direct ? request.path : request.sourcePath
        const sourceContent = direct ? undefined : request.sourceContent
        const path = direct ? request.path : resolveNoteNavigation(request.href.split('#', 1)[0], request.kind, sourcePath, notes, '', aliases)
        if (typeof path !== 'string' && path.status !== 'resolved') return
        const targetPath = typeof path === 'string' ? path : path.path
        let note = notes.find(item => item.path === targetPath)
        if (!note) return
        const draft = sourcePath === targetPath ? sourceContent : undefined
        let resolvedNotes = notes
        if (draft === undefined && contentPending && !note.content && note.size > 0) {
          const result = await window.tsuzune.readNote(targetPath)
          if (!current() || !result.ok) return
          note = result.value
          resolvedNotes = notes.map(item => item.path === targetPath ? result.value : item)
        }
        const body = draft ?? note.content
        const target = direct ? { kind: 'wiki' as const, status: 'resolved' as const, path: targetPath }
          : resolveNoteNavigation(request.href, request.kind, sourcePath, resolvedNotes, sourceContent ?? body, aliases)
        const text = notePreviewText(target, targetPath, body, notes)
        if (current()) setVisible({ request, title: targetPath, text })
      })().catch(() => undefined)
    }, 220)
    return () => { disposed = true; window.clearTimeout(timer) }
  }, [request, notes, aliases, contentPending])

  const popup = visible && visible.request === request && request.anchor.isConnected ? visible : null
  const rect = popup && ('rect' in popup.request ? popup.request.rect : undefined) || popup?.request.anchor.getBoundingClientRect()
  const width = Math.min(360, window.innerWidth - 16)
  const left = rect ? Math.max(8, Math.min(window.innerWidth - width - 8,
    rect.right + width <= window.innerWidth - 8 ? rect.right : rect.left - width)) : 8
  const top = rect ? Math.max(8, Math.min(rect.top, window.innerHeight - 190)) : 8
  return <PreviewContext.Provider value={editorHover}>
    {children}
    {popup && createPortal(
      <div className="note-link-preview note-hover-preview" role="tooltip" aria-label="ノートプレビュー" style={{ left, top, width }}>
        <strong>{popup.title}</strong>
        <span>{popup.text}</span>
      </div>, document.body)}
  </PreviewContext.Provider>
}
