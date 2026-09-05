import { commonmarkLanguage } from '@codemirror/lang-markdown'
import { resolveIndexedWikiLink, type WikiLinkIndex } from './links'
import { dirnameRelative, withoutMarkdownExtension } from './paths'
import type { NoteDocument } from '../shared/types'

function localPath(base: string, target: string): string | null {
  const parts = target.startsWith('/') ? [] : base.split('/').filter(Boolean)
  for (const part of target.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (!parts.length) return null
      parts.pop()
    } else parts.push(part)
  }
  return parts.join('/')
}

function relativePath(base: string, target: string): string {
  const from = base.split('/').filter(Boolean)
  const to = target.split('/')
  while (from.length && to.length && from[0].toLowerCase() === to[0].toLowerCase()) {
    from.shift()
    to.shift()
  }
  return [...from.map(() => '..'), ...to].join('/')
}

/** Replace destination spans only; never serialize Markdown or frontmatter. */
export function rewriteMovedLinks(
  note: NoteDocument,
  index: WikiLinkIndex,
  source: string,
  destination: string,
): string {
  const content = note.content
  const ignored: Array<{ from: number; to: number }> = []
  const urls: Array<{ from: number; to: number }> = []
  const singleQuotedValues: Array<{ from: number; to: number }> = []
  commonmarkLanguage.parser.parse(content).iterate({
    enter(node) {
      if (['FencedCode', 'CodeBlock', 'InlineCode', 'CommentBlock', 'HTMLBlock', 'HTMLTag', 'LinkTitle'].includes(node.name)) {
        ignored.push({ from: node.from, to: node.to })
        return false
      }
      if (node.name === 'URL') urls.push({ from: node.from, to: node.to })
    }
  })
  // YAML comments are not link values. Quoted hashes remain part of the value.
  const frontmatter = content.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/)
  if (frontmatter) {
    let offset = 0
    let quote = ''
    let quoteStart = 0
    let blockIndent: number | null = null
    for (const line of frontmatter[0].split('\n')) {
      const indent = line.match(/^ */)![0].length
      if (blockIndent !== null && line.trim() && indent <= blockIndent) blockIndent = null
      if (blockIndent !== null) {
        // Block scalars are outside the supported property forms; do not leave a known link stale.
        for (const link of line.matchAll(/\[\[([^\]\r\n]+)\]\]/g)) {
          const target = link[1].split('|', 1)[0].split('#', 1)[0]
          const resolved = resolveIndexedWikiLink(target, index)
          if (resolved.status === 'resolved' && resolved.path === source) {
            throw new Error('YAMLの複数行値に参照リンクがあるため、名前変更・移動を停止しました。')
          }
        }
        ignored.push({ from: offset, to: offset + line.length })
        offset += line.length + 1
        continue
      }
      if (!quote && /(?:[:\-])\s+[|>](?:[1-9][+-]?|[+-][1-9]?)?\s*(?:#.*)?$/.test(line)) blockIndent = indent
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\' && quote === '"') { i++; continue }
        if (line[i] === quote) {
          if (quote === "'" && line[i + 1] === "'") { i++; continue }
          const span = { from: quoteStart, to: offset + i + 1 }
          if (/^\s*:/.test(line.slice(i + 1))) ignored.push(span)
          else if (quote === "'") singleQuotedValues.push(span)
          quote = ''
          continue
        }
        if (!quote && (line[i] === '"' || line[i] === "'") && /(?:^|[:\-,\[{])\s*$/.test(line.slice(0, i))) {
          quote = line[i]
          quoteStart = offset + i
          continue
        }
        if (!quote && line[i] === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
          ignored.push({ from: offset + i, to: offset + line.length })
          break
        }
      }
      offset += line.length + 1
    }
    if (quote) ignored.push({ from: quoteStart, to: frontmatter[0].length })
  }
  const isIgnored = (from: number, to: number) => ignored.some(range => from < range.to && to > range.from)
  const edits: Array<{ from: number; to: number; text: string }> = []
  for (const match of content.matchAll(/\[\[([^\]\r\n]+)\]\]/g)) {
    const from = match.index
    let slashes = 0
    for (let i = from - 1; i >= 0 && content[i] === '\\'; i--) slashes++
    if (slashes % 2 || isIgnored(from, from + match[0].length) ||
      urls.some(span => from < span.to && from + match[0].length > span.from)) continue
    const target = match[1].split('|', 1)[0].split('#', 1)[0]
    const resolution = resolveIndexedWikiLink(target, index)
    if (resolution.status !== 'resolved' || resolution.path !== source) continue
    if (/[#|\[\]]/.test(destination)) {
      throw new Error('Wikiリンクを保つため、移動先の名前には #・|・[・] を使用できません。')
    }
    if (destination.includes("'") && singleQuotedValues.some(span => from >= span.from && from < span.to)) {
      throw new Error('YAMLの引用符付きリンクを保つため、移動先の名前にはアポストロフィを使用できません。')
    }
    // Full Vault paths keep the new target unambiguous even after a same-name move.
    const replacement = /\.md$/i.test(target.trim()) ? destination : withoutMarkdownExtension(destination)
    const leading = target.length - target.trimStart().length
    edits.push({ from: from + 2 + leading, to: from + 2 + target.trimEnd().length, text: replacement })
  }
  for (const span of urls) {
    if (isIgnored(span.from, span.to) || edits.some(edit => edit.from < span.to && edit.to > span.from)) continue
    let from = span.from
    let to = span.to
    if (content[from] === '<' && content[to - 1] === '>') { from++; to-- }
    const raw = content.slice(from, to)
    const fragment = raw.indexOf('#')
    const path = fragment < 0 ? raw : raw.slice(0, fragment)
    if (!path || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path) || /[?\\]/.test(path)) continue
    let decoded: string
    try { decoded = decodeURIComponent(path) } catch { continue }
    const resolved = localPath(dirnameRelative(note.path), decoded)
    if (resolved?.toLowerCase() !== source.toLowerCase()) continue
    const base = dirnameRelative(note.path === source ? destination : note.path)
    const replacement = path.startsWith('/') ? `/${destination}` : relativePath(base, destination)
    const encoded = replacement.split('/').map(part =>
      encodeURIComponent(part).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    ).join('/')
    edits.push({ from, to: from + path.length, text: (path.startsWith('./') ? './' : '') + encoded })
  }
  return edits.sort((a, b) => b.from - a.from).reduce(
    (text, edit) => text.slice(0, edit.from) + edit.text + text.slice(edit.to), content
  )
}
