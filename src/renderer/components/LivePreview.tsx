import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { EditorState, type Extension } from '@codemirror/state'
import { commonmarkLanguage } from '@codemirror/lang-markdown'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { parseFrontmatter } from '../../core/frontmatter'
import { resolveNoteNavigation, type NoteNavigationTarget } from '../../core/note-navigation'
import type { CompiledPathAliases } from '../../core/path-aliases'
import type { NoteDocument, VaultAttachment } from '../../shared/types'
import MarkdownPreview from './MarkdownPreview'

export interface LivePreviewContext {
  notePath: string
  attachments: readonly VaultAttachment[]
  notes: readonly NoteDocument[]
  pathAliases?: CompiledPathAliases
  onNavigate?: (target: NoteNavigationTarget) => void
  onWikiLink?: (target: string) => void
  isComposing: () => boolean
}

interface PreviewBlock { from: number; to: number; markdown: string }

function blocks(state: EditorState): PreviewBlock[] {
  const text = state.doc.toString()
  const frontmatter = parseFrontmatter(text)
  const bodyStart = frontmatter.found && frontmatter.warnings.length === 0 ? text.length - frontmatter.body.length : 0
  const lines = Array.from({ length: state.doc.lines }, (_, index) => state.doc.line(index + 1))
  const output: PreviewBlock[] = []
  const isList = (line: string): boolean => /^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/.test(line)
  const isHeading = (line: string): boolean => /^ {0,3}#{1,6}(?:[ \t]+|$)/.test(line)
  const isFence = (line: string): RegExpExecArray | null => /^ {0,3}(`{3,}|~{3,})/.exec(line)
  const isTableRule = (line: string): boolean => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
  const content = (index: number): string => lines[index] ? text.slice(lines[index].from, lines[index].to) : ''
  const definitions: string[] = []
  commonmarkLanguage.parser.parse(text).iterate({ enter(node) {
    if (node.name === 'LinkReference' && node.from >= bodyStart) definitions.push(text.slice(node.from, node.to))
  } })

  for (let index = 0; index < lines.length;) {
    if (lines[index].from < bodyStart || !content(index).trim()) { index += 1; continue }
    const start = index
    const first = content(index)
    const fence = isFence(first)
    if (fence) {
      index += 1
      const marker = fence[1][0]
      const close = new RegExp(`^ {0,3}${marker === '`' ? '`' : '~'}{${fence[1].length},}[ \\t]*$`)
      while (index < lines.length && !close.test(content(index))) index += 1
      if (index < lines.length) index += 1
    } else if (index + 1 < lines.length && first.includes('|') && isTableRule(content(index + 1))) {
      index += 2
      while (index < lines.length && content(index).trim() && content(index).includes('|')) index += 1
    } else if (/^ {0,3}>/.test(first)) {
      index += 1
      while (index < lines.length && /^ {0,3}>/.test(content(index))) index += 1
    } else if (isList(first)) {
      index += 1
      while (index < lines.length && (isList(content(index)) || /^ {2,}\S/.test(content(index)))) index += 1
    } else if (!isHeading(first) && index + 1 < lines.length && /^ {0,3}(?:=+|-+)[ \t]*$/.test(content(index + 1))) {
      index += 2
    } else if (isHeading(first) || /^ {0,3}(?:[-*_][ \t]*){3,}$/.test(first)) {
      index += 1
    } else {
      index += 1
      while (index < lines.length && content(index).trim() && !isHeading(content(index)) && !isFence(content(index)) &&
        !/^ {0,3}>/.test(content(index)) && !isList(content(index))) index += 1
    }
    const markdown = text.slice(lines[start].from, lines[index - 1].to)
    // Footnotes depend on document-wide numbering/backrefs. Keep them editable
    // until widgets can share that state without duplicating footnote sections.
    if (/\[\^[^\]\r\n]+\]/.test(markdown)) continue
    output.push({ from: lines[start].from, to: lines[index - 1].to,
      markdown: definitions.length ? `${definitions.join('\n\n')}\n\n${markdown}` : markdown })
  }
  return output
}

class PreviewWidget extends WidgetType {
  private root: Root | null = null
  private destroyed = false

  constructor(
    private readonly block: PreviewBlock,
    private readonly context: () => LivePreviewContext
  ) { super() }

  toDOM(view: EditorView): HTMLElement {
    const host = document.createElement('div')
    host.className = 'ts-live-preview-block'
    host.style.display = 'block'
    host.setAttribute('contenteditable', 'false')
    const reveal = (): void => {
      view.dispatch({ selection: { anchor: this.block.from }, scrollIntoView: true })
      view.focus()
    }
    host.addEventListener('pointerdown', event => {
      if (!event.ctrlKey && !event.metaKey) reveal()
    }, true)
    host.addEventListener('click', event => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null
      if (!anchor) return
      event.preventDefault()
      event.stopPropagation()
      if (!event.ctrlKey && !event.metaKey && event.detail !== 0) { reveal(); return }
      const href = anchor.getAttribute('href') ?? ''
      if (/^https?:\/\//i.test(href)) { void window.tsuzune.openExternal(href); return }
      const ctx = this.context()
      const wiki = href.startsWith('#/wiki/')
      let targetHref = href
      if (wiki) {
        try { targetHref = decodeURIComponent(href.slice('#/wiki/'.length)) }
        catch { return }
      }
      const target = resolveNoteNavigation(targetHref, wiki ? 'wiki' : 'markdown', ctx.notePath,
        ctx.notes, view.state.doc.toString(), ctx.pathAliases)
      if (ctx.onNavigate) ctx.onNavigate(target)
      else if (wiki) ctx.onWikiLink?.(targetHref)
    }, true)
    this.root = createRoot(host)
    const ctx = this.context()
    queueMicrotask(() => {
      if (this.destroyed || !this.root) return
      flushSync(() => this.root?.render(
        <MarkdownPreview content={this.block.markdown} notePath={ctx.notePath} attachments={ctx.attachments}
          notes={ctx.notes} pathAliases={ctx.pathAliases} onNavigate={() => {}} onWikiLink={() => {}} />
      ))
      host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => { input.disabled = true })
      view.requestMeasure()
    })
    return host
  }

  destroy(): void {
    this.destroyed = true
    const root = this.root
    this.root = null
    if (root) queueMicrotask(() => root.unmount())
  }
  ignoreEvent(): boolean { return true }
}

function decorations(view: EditorView, context: () => LivePreviewContext): DecorationSet {
  const ranges = []
  for (const block of blocks(view.state)) {
    if (view.state.selection.ranges.some(selection => selection.from <= block.to && selection.to >= block.from)) continue
    const firstLine = view.state.doc.lineAt(block.from)
    ranges.push(Decoration.replace({ widget: new PreviewWidget(block, context) }).range(firstLine.from, firstLine.to))
    for (let lineNumber = firstLine.number + 1; lineNumber <= view.state.doc.lineAt(block.to).number; lineNumber += 1) {
      const line = view.state.doc.line(lineNumber)
      if (line.from < line.to) ranges.push(Decoration.replace({}).range(line.from, line.to))
    }
  }
  return Decoration.set(ranges, true)
}

export function livePreviewExtension(context: () => LivePreviewContext): Extension {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = decorations(view, context) }
    update(update: ViewUpdate): void {
      if (!context().isComposing() && (update.docChanged || update.selectionSet || update.viewportChanged || update.transactions.length)) {
        this.decorations = decorations(update.view, context)
      }
    }
  }, { decorations: plugin => plugin.decorations }) as unknown as Extension
}
