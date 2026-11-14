import { acceptCompletion, autocompletion, type Completion, type CompletionSource } from '@codemirror/autocomplete'
import { isolateHistory } from '@codemirror/commands'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState, Prec, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { buildWikiLinkIndex, resolveIndexedWikiLink } from '../core/links'
import { listHeadingSlugs } from '../core/note-navigation'
import { listMarkdownBlocks } from '../core/markdown-blocks'
import { inspectFrontmatterProperty } from '../core/frontmatter'
import type { CompiledPathAliases } from '../core/path-aliases'
import type { NoteDocument } from '../shared/types'
import { normalizeSuggestionText as normalize } from '../shared/search-normalize'

export interface WikiCompletionContext {
  notes: readonly NoteDocument[]
  notePath: string
  vaultPath?: string
  pathAliases?: CompiledPathAliases
}

const MAX_NOTES = 10_000, MAX_BODY = 1_000_000, MAX_OPTIONS = 100
const safeTarget = (value: string) => !/[#|\[\]\r\n]/.test(value)
const message = (label: string): Completion => ({ label, detail: '文字を追加して絞り込んでください', apply() {} })

function readYamlAliases(notes: readonly NoteDocument[]) {
  const byPath = new Map<string, string[]>()
  let remaining = MAX_BODY, limited = false
  for (const note of notes) {
    if (!/^\uFEFF?---\r?\n/.test(note.content)) continue
    if (!remaining) { limited = true; break }
    const prefix = note.content.slice(0, Math.min(65_536, remaining))
    const closing = /\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/g
    closing.lastIndex = prefix.indexOf('\n')
    const end = closing.exec(prefix)
    remaining -= end ? end.index + end[0].length : prefix.length
    if (!end || (prefix.length < note.content.length && end.index + end[0].length === prefix.length && !end[0].endsWith('\n'))) {
      limited ||= prefix.length < note.content.length
      continue
    }
    const inspected = inspectFrontmatterProperty(prefix.slice(0, end.index + end[0].length), 'aliases')
    const property = inspected.ok ? inspected.property : null
    const values = property?.type === 'list' ? property.value.filter(atom => atom.type === 'text').map(atom => atom.value)
      : property?.type === 'text' ? [property.value] : []
    const aliases = [...new Set(values.filter(value => !/[\r\n]/.test(value)).map(value => value.trim()).filter(value => value && safeTarget(value)))]
    if (aliases.length > MAX_OPTIONS) limited = true
    byPath.set(note.path, aliases.slice(0, MAX_OPTIONS))
  }
  return { byPath, limited }
}

function trigger(state: EditorState, pos: number) {
  if (state.readOnly || state.selection.ranges.length !== 1 || !state.selection.main.empty || state.selection.main.head !== pos) return null
  const line = state.doc.lineAt(pos)
  if (line.length > 4096) return null
  const before = state.sliceDoc(line.from, pos), open = before.lastIndexOf('[[')
  if (open < 0 || /[\[\]\r\n|]/.test(before.slice(open + 2))) return null
  if ((/\\*$/.exec(before.slice(0, open))![0].length % 2) !== 0) return null
  const from = line.from + open
  const tree = ensureSyntaxTree(state, pos, 50)
  if (!tree) return null
  for (let node = tree.resolveInner(from, 1); node; node = node.parent!) {
    if (/^(FencedCode|CodeBlock|InlineCode|HTMLBlock|Comment|CommentBlock|HTMLTag)$/.test(node.name)) return null
  }
  const text = state.sliceDoc(0, Math.min(state.doc.length, MAX_BODY))
  if (/^\uFEFF?---\r?\n/.test(text)) {
    const closing = /\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/g
    closing.lastIndex = text.indexOf('\n')
    const end = closing.exec(text)
    if (!end || from < end.index + end[0].length) return null
  }
  const nextOpen = line.text.indexOf('[', pos - line.from)
  const close = (nextOpen < 0 ? line.text : line.text.slice(0, nextOpen)).indexOf(']]', open + 2)
  const pipe = line.text.indexOf('|', open + 2)
  const hasAlias = pipe >= pos - line.from && (close < 0 || pipe < close) && (close >= 0 || nextOpen < 0)
  const to = close >= 0 ? line.from + close + 2 : hasAlias ? line.to : pos + (state.sliceDoc(pos, pos + 1) === ']' ? 1 : 0)
  const alias = hasAlias ? line.text.slice(pipe, close < 0 ? undefined : close) : ''
  return { from, to, alias, query: before.slice(open + 2) }
}

export function wikiLinkCompletionSource(getContext: () => WikiCompletionContext, isComposing: () => boolean = () => false): CompletionSource {
  let cached: { notes: readonly NoteDocument[]; aliases?: CompiledPathAliases; index: ReturnType<typeof buildWikiLinkIndex>; yaml?: ReturnType<typeof readYamlAliases> } | undefined
  return context => {
    if (isComposing() || context.view?.composing) return null
    const current = trigger(context.state, context.pos)
    if (!current) return null
    const snapshot = getContext(), doc = context.state.doc
    const result = (options: Completion[]) => ({ from: current.from, to: context.pos, filter: false, options })
    if (snapshot.notes.length > MAX_NOTES || (snapshot.pathAliases?.flattened.size ?? 0) > MAX_NOTES || doc.length > MAX_BODY) {
      return result([message('補完を中止しました（ノート/本文の上限超過）')])
    }
    if (cached?.notes !== snapshot.notes || cached.aliases !== snapshot.pathAliases) {
      cached = { notes: snapshot.notes, aliases: snapshot.pathAliases, index: buildWikiLinkIndex(snapshot.notes, snapshot.pathAliases) }
    }
    const { index } = cached
    const query = normalize(current.query), hash = current.query.indexOf('#')
    const choices: Array<{ label: string; detail: string; target: string; displayAlias?: string }> = []
    const canonical = (note: NoteDocument) => {
      const short = note.path.replace(/\.md$/i, '')
      if (!safeTarget(short)) return null
      const resolution = resolveIndexedWikiLink(short, index)
      if (resolution.status === 'resolved' && resolution.path === note.path) return short
      const explicit = resolveIndexedWikiLink(note.path, index)
      return explicit.status === 'resolved' && explicit.path === note.path ? note.path : null
    }
    let stopped = false
    let aliasesLimited = false
    if (current.query.startsWith('##') || current.query.startsWith('^^')) {
      const blocks = current.query.startsWith('^^'), fragment = normalize(current.query.slice(2).trim())
      let remaining = MAX_BODY
      for (const note of snapshot.notes) {
        const body = note.path === snapshot.notePath ? doc.toString() : note.content
        if (body.length > remaining) { stopped = true; break }
        remaining -= body.length
        const target = canonical(note)
        if (!target) continue
        if (blocks) {
          for (const block of listMarkdownBlocks(body)) {
            if (!normalize(block.blockId).includes(fragment) && !normalize(block.content).includes(fragment)) continue
            choices.push({ label: `^${block.blockId}`, detail: `${note.path} · ${block.content.replace(/\s+/g, ' ').slice(0, 100)}`, target: `${target}#^${block.blockId}` })
            if (choices.length === MAX_OPTIONS) { stopped = true; break }
          }
        } else {
          const headings = listHeadingSlugs(body), first = new Map<string, number>()
          for (const { heading } of headings) if (!first.has(heading.title)) first.set(heading.title, heading.sourceOffset)
          for (const { heading, slug } of headings) {
            if (!normalize(heading.title).includes(fragment)) continue
            const anchor = first.get(heading.title) === heading.sourceOffset && safeTarget(heading.title) && !heading.title.startsWith('^') ? heading.title : slug
            if (!anchor || (first.has(anchor) && first.get(anchor) !== heading.sourceOffset)) continue
            choices.push({ label: heading.title, detail: `${note.path} · ${heading.line}行目`, target: `${target}#${anchor}` })
            if (choices.length === MAX_OPTIONS) { stopped = true; break }
          }
        }
        if (stopped) break
      }
    } else if (hash < 0) {
      if (query) cached.yaml ??= readYamlAliases(snapshot.notes)
      aliasesLimited = Boolean(query && cached.yaml?.limited)
      const matchedAliases = new Set<string>()
      for (const [alias, path] of snapshot.pathAliases?.flattened ?? []) {
        if (normalize(alias).includes(query)) {
          const resolution = resolveIndexedWikiLink(alias, index)
          if (resolution.status === 'resolved' && resolution.path === path) matchedAliases.add(path)
        }
      }
      for (const note of snapshot.notes) {
        const matchesNote = normalize(note.path).includes(query) || normalize(note.name).includes(query) || matchedAliases.has(note.path)
        const aliases = query ? (cached.yaml?.byPath.get(note.path) ?? []).filter(alias => normalize(alias).includes(query)) : []
        if (!matchesNote && !aliases.length) continue
        const target = canonical(note)
        if (!target) continue
        if (matchesNote) choices.push({ label: note.name, detail: note.path, target })
        if (choices.length === MAX_OPTIONS) { stopped = true; break }
        for (const alias of aliases) {
          choices.push({ label: alias, detail: `${note.name} · ${note.path}`, target, displayAlias: alias })
          if (choices.length === MAX_OPTIONS) { stopped = true; break }
        }
        if (stopped) break
      }
    } else {
      const pathPart = current.query.slice(0, hash), fragment = current.query.slice(hash + 1)
      const resolution = pathPart ? resolveIndexedWikiLink(pathPart, index) : null
      if (pathPart && resolution?.status !== 'resolved') return result([message('リンク先が見つからないか、同名候補が複数あります')])
      const path = resolution?.status === 'resolved' ? resolution.path : snapshot.notePath
      const note = snapshot.notes.find(note => note.path === path)
      const body = path === snapshot.notePath ? doc.toString() : note?.content
      const targetPath = pathPart && note ? canonical(note) : ''
      if (body === undefined || targetPath === null) return result([message('リンク先が見つかりません')])
      if (body.length > MAX_BODY) return result([message('補完を中止しました（対象本文の上限超過）')])
      if (fragment.startsWith('^')) {
        for (const block of listMarkdownBlocks(body)) {
          if (block.blockId.toLocaleLowerCase().includes(fragment.slice(1).toLocaleLowerCase())) {
            choices.push({ label: `^${block.blockId}`, detail: block.content.replace(/\s+/g, ' ').slice(0, 100), target: `${targetPath}#^${block.blockId}` })
          }
          if (choices.length === MAX_OPTIONS) { stopped = true; break }
        }
      } else {
        const headings = listHeadingSlugs(body)
        const firstTitle = new Map<string, number>()
        for (const { heading } of headings) if (!firstTitle.has(heading.title)) firstTitle.set(heading.title, heading.sourceOffset)
        for (const { heading, slug } of headings) {
          if (!normalize(heading.title).includes(normalize(fragment))) continue
          const anchor = firstTitle.get(heading.title) === heading.sourceOffset && safeTarget(heading.title) && !heading.title.startsWith('^') ? heading.title : slug
          if (!anchor || (firstTitle.has(anchor) && firstTitle.get(anchor) !== heading.sourceOffset)) continue
          choices.push({ label: heading.title, detail: `${path} · ${heading.line}行目`, target: `${targetPath}#${anchor}` })
          if (choices.length === MAX_OPTIONS) { stopped = true; break }
        }
      }
    }
    const options: Completion[] = choices.map(choice => ({
      label: choice.label, detail: choice.detail, apply(view) {
        const latest = getContext()
        if (!view.dom.isConnected || isComposing() || view.composing || view.state.doc !== doc || latest.notes !== snapshot.notes ||
          latest.notePath !== snapshot.notePath || latest.vaultPath !== snapshot.vaultPath || latest.pathAliases !== snapshot.pathAliases) return
        const active = trigger(view.state, context.pos)
        if (!active || active.from !== current.from || active.to !== current.to) return
        const insert = `[[${choice.target}${current.alias || (choice.displayAlias ? `|${choice.displayAlias}` : '')}]]`
        view.dispatch({ changes: { from: current.from, to: current.to, insert }, selection: { anchor: current.from + insert.length },
          userEvent: 'input.complete', annotations: isolateHistory.of('full') })
      }
    }))
    if (stopped) options.splice(MAX_OPTIONS - 1, 1, message('候補表示を制限しました（最大100件）'))
    else if (aliasesLimited) options.push(message('別名候補を制限しました（読取上限）'))
    if (!options.length) options.push(message('候補がありません'))
    return result(options)
  }
}

export function wikiLinkCompletionExtension(getContext: () => WikiCompletionContext, isComposing: () => boolean): Extension {
  const source = wikiLinkCompletionSource(getContext, isComposing)
  return [autocompletion({ activateOnTypingDelay: 0, interactionDelay: 0 }),
    EditorState.languageData.of(() => [{ autocomplete: source }]),
    Prec.high(keymap.of([
      { key: 'Enter', run: view => isComposing() || view.composing },
      { key: 'Tab', run: view => !isComposing() && !view.composing &&
        Boolean(trigger(view.state, view.state.selection.main.head)) && acceptCompletion(view) }
    ]))]
}
