import type { Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { extractNoteLinks, type NoteLinkOccurrence } from '../core/links'
import type { EditorPreviewLink } from './components/NoteHoverPreview'

export function attachEditorLinkHover(view: EditorView, context: () => { notePath: string; isComposing: () => boolean }, preview: (anchor: HTMLElement, link: EditorPreviewLink | null) => void): () => void {
  let documentVersion: Text | undefined
  let sourcePath: string | undefined
  let source = ''
  let links: NoteLinkOccurrence[] = []
  let pointer: PointerEvent | null = null
  const close = (): void => preview(view.dom, null)
  const update = (event: PointerEvent): void => {
    const { notePath, isComposing } = context()
    if (!notePath || event.buttons || event.pointerType === 'touch' || isComposing() || !(event.target instanceof Element)) { close(); return }
    const element = event.target
    if (element.closest('.ts-live-preview-block')) {
      const anchor = element.closest<HTMLElement>('[data-editor-preview-href]')
      const href = anchor?.dataset.editorPreviewHref
      const kind = anchor?.dataset.editorPreviewKind
      const path = anchor?.dataset.editorPreviewSource
      if (anchor && href !== undefined && (kind === 'wiki' || kind === 'markdown') && path) {
        preview(view.dom, { anchor: view.dom, rect: anchor.getBoundingClientRect(), href, kind, sourcePath: path,
          sourceContent: path === notePath ? view.state.doc.toString() : undefined })
      } else close()
      return
    }
    if (!element.closest('.cm-line')) { close(); return }
    const offset = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (offset === null) { close(); return }
    if (documentVersion !== view.state.doc || sourcePath !== notePath) {
      documentVersion = view.state.doc
      sourcePath = notePath
      source = documentVersion.toString()
      links = extractNoteLinks(source, notePath)
    }
    const link = links.find(item => item.range.from <= offset && offset <= item.range.to)
    if (!link) { close(); return }
    const rect = view.coordsAtPos(offset)
    if (!rect || event.clientY < rect.top || event.clientY > rect.bottom || Math.abs(event.clientX - rect.left) > view.defaultCharacterWidth * 2) { close(); return }
    const start = view.coordsAtPos(link.range.from)
    const end = view.coordsAtPos(link.range.to, -1)
    if (start && end && start.top === end.top && (event.clientX < Math.min(start.left, end.left) || event.clientX > Math.max(start.right, end.right))) { close(); return }
    const anchorRect = start && end && start.top === end.top ? { ...start, left: Math.min(start.left, end.left), right: Math.max(start.right, end.right) } : rect
    preview(view.dom, { anchor: view.dom, rect: anchorRect, href: link.target, kind: link.kind, sourcePath: notePath, sourceContent: source })
  }
  const move = (event: PointerEvent): void => {
    pointer = event
    if (event.ctrlKey || event.metaKey) update(event)
    else close()
  }
  const leave = (): void => { pointer = null; close() }
  const keyDown = (event: KeyboardEvent): void => {
    if (!event.repeat && (event.key === 'Control' || event.key === 'Meta') && pointer && view.dom.contains(pointer.target as Node)) update(pointer)
  }
  view.dom.addEventListener('pointerover', move)
  view.dom.addEventListener('pointermove', move)
  view.dom.addEventListener('pointerleave', leave)
  window.addEventListener('keydown', keyDown)
  window.addEventListener('blur', leave)
  return () => {
    view.dom.removeEventListener('pointerover', move)
    view.dom.removeEventListener('pointermove', move)
    view.dom.removeEventListener('pointerleave', leave)
    window.removeEventListener('keydown', keyDown)
    window.removeEventListener('blur', leave)
    leave()
  }
}
