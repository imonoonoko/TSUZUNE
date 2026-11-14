import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { EditorState, StateEffect, type Extension } from '@codemirror/state'
import { commonmarkLanguage } from '@codemirror/lang-markdown'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { parseFrontmatter } from '../../core/frontmatter'
import { resolveNoteNavigation, type NoteNavigationTarget } from '../../core/note-navigation'
import type { CompiledPathAliases } from '../../core/path-aliases'
import type { NoteDocument, VaultAttachment } from '../../shared/types'
import { markdownTables } from '../../core/markdown-table'
import MarkdownPreview from './MarkdownPreview'
import { markdownMathRanges } from '../markdown-math'
import type { VaultEmbedContext } from './VaultEmbed'

export interface LivePreviewContext {
  vaultPath?: string
  notePath: string
  attachments: readonly VaultAttachment[]
  notes: readonly NoteDocument[]
  pathAliases?: CompiledPathAliases
  onNavigate?: (target: NoteNavigationTarget) => void
  onWikiLink?: (target: string) => void
  embedContext?: VaultEmbedContext
  onEditTable?: (offset: number) => void
  isComposing: () => boolean
  editorLinkHover?: boolean
}

interface PreviewBlock { from: number; to: number; markdown: string; table: boolean }

export const refreshLivePreview = StateEffect.define<void>()

function blocks(state: EditorState): PreviewBlock[] {
  const text = state.doc.toString()
  const frontmatter = parseFrontmatter(text)
  const bodyStart = frontmatter.found && frontmatter.warnings.length === 0 ? text.length - frontmatter.body.length : 0
  const lines = Array.from({ length: state.doc.lines }, (_, index) => state.doc.line(index + 1))
  const output: PreviewBlock[] = []
  const isList = (line: string): boolean => /^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/.test(line)
  const isHeading = (line: string): boolean => /^ {0,3}#{1,6}(?:[ \t]+|$)/.test(line)
  const isFence = (line: string): RegExpExecArray | null => /^ {0,3}(`{3,}|~{3,})/.exec(line)
  const content = (index: number): string => lines[index] ? text.slice(lines[index].from, lines[index].to) : ''
  const tableEnds = new Map(markdownTables(text).map(table => [state.doc.lineAt(table.from).number - 1, state.doc.lineAt(table.to).number]))
  const mathEnds = new Map(markdownMathRanges(text.slice(bodyStart)).filter(range => range.display).map(range => [
    state.doc.lineAt(bodyStart + range.from).number - 1,
    state.doc.lineAt(bodyStart + range.to).number
  ]))
  const definitions: string[] = []
  const quoteEnds = new Map<number, number>()
  commonmarkLanguage.parser.parse(text).iterate({ enter(node) {
    if (node.name === 'LinkReference' && node.from >= bodyStart) definitions.push(text.slice(node.from, node.to))
    if (node.name === 'Blockquote' && node.from >= bodyStart) {
      const start = state.doc.lineAt(node.from).number - 1
      quoteEnds.set(start, Math.max(quoteEnds.get(start) ?? 0, state.doc.lineAt(node.to).number))
    }
  } })

  for (let index = 0; index < lines.length;) {
    if (lines[index].from < bodyStart || !content(index).trim()) { index += 1; continue }
    const start = index
    const first = content(index)
    const fence = isFence(first)
    const mathEnd = mathEnds.get(index)
    if (mathEnd !== undefined) {
      index = mathEnd
    } else if (fence) {
      index += 1
      const marker = fence[1][0]
      const close = new RegExp(`^ {0,3}${marker === '`' ? '`' : '~'}{${fence[1].length},}[ \\t]*$`)
      while (index < lines.length && !close.test(content(index))) index += 1
      if (index < lines.length) index += 1
    } else if (tableEnds.has(index)) {
      index = tableEnds.get(index)!
    } else if (/^ {0,3}>/.test(first)) {
      index = quoteEnds.get(index) ?? index + 1
    } else if (isList(first)) {
      index += 1
      while (index < lines.length) {
        const nestedMathEnd = mathEnds.get(index)
        if (nestedMathEnd !== undefined) { index = nestedMathEnd; continue }
        if (!isList(content(index)) && !/^ {2,}\S/.test(content(index))) break
        index += 1
      }
    } else if (!isHeading(first) && index + 1 < lines.length && /^ {0,3}(?:=+|-+)[ \t]*$/.test(content(index + 1))) {
      index += 2
    } else if (isHeading(first) || /^ {0,3}(?:[-*_][ \t]*){3,}$/.test(first)) {
      index += 1
    } else {
      index += 1
      while (index < lines.length && !tableEnds.has(index) && !mathEnds.has(index) && content(index).trim() && !isHeading(content(index)) && !isFence(content(index)) &&
        !/^ {0,3}>/.test(content(index)) && !isList(content(index))) index += 1
    }
    const markdown = text.slice(lines[start].from, lines[index - 1].to)
    // Footnotes depend on document-wide numbering/backrefs. Keep them editable
    // until widgets can share that state without duplicating footnote sections.
    if (/\[\^[^\]\r\n]+\]/.test(markdown)) continue
    output.push({ table: tableEnds.has(start), from: lines[start].from, to: lines[index - 1].to,
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
      view.dispatch({ selection: { anchor: view.posAtDOM(host) }, scrollIntoView: true })
      view.focus()
    }
    host.addEventListener('pointerdown', event => {
      if (event.target instanceof Element && event.target.closest('summary.callout-title, .mermaid-diagram, .note-embed, .media-player, .media-link-content, .ts-table-edit')) return
      if (!event.ctrlKey && !event.metaKey) reveal()
    }, true)
    host.addEventListener('click', event => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null
      if (!anchor) return
      if (anchor.closest('.note-embed')) return
      if (anchor.matches('[data-media-link], [data-pdf-link]') && (event.ctrlKey || event.metaKey || event.detail === 0)) return
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
    this.render(host, view)
    return host
  }

  updateDOM(host: HTMLElement, view: EditorView, previous: PreviewWidget): boolean {
    if (this.block.markdown !== previous.block.markdown || !previous.root || previous.destroyed) return false
    // Keep the native media element when edits move an otherwise unchanged block.
    this.root = previous.root
    previous.root = null
    this.render(host, view)
    return true
  }

  private render(host: HTMLElement, view: EditorView): void {
    queueMicrotask(() => {
      if (this.destroyed || !this.root) return
      const ctx = this.context()
      flushSync(() => this.root?.render(
        <><MarkdownPreview content={this.block.markdown} notePath={ctx.notePath} attachments={ctx.attachments}
          sourceContent={view.state.doc.toString()} notes={ctx.notes} pathAliases={ctx.pathAliases}
          embedContext={ctx.embedContext} onNavigate={() => {}} onWikiLink={() => {}} editorLinkHover={ctx.editorLinkHover} />
        {this.block.table && ctx.onEditTable && !view.state.readOnly && <button type="button" className="ts-table-edit"
          onClick={() => this.context().onEditTable?.(view.posAtDOM(host))}>この表を編集</button>}</>
      ))
      host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => { input.disabled = true })
      view.requestMeasure()
    })
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
      const refresh = update.transactions.some(transaction => transaction.effects.some(effect => effect.is(refreshLivePreview)))
      if (!context().isComposing() && (update.docChanged || update.selectionSet || update.startState.readOnly !== update.state.readOnly || refresh)) {
        this.decorations = decorations(update.view, context)
      }
    }
  }, { decorations: plugin => plugin.decorations }) as unknown as Extension
}
