import { listHeadingSlugs } from './note-navigation'
import { commonmarkLanguage } from '@codemirror/lang-markdown'
import { parseDocument, isAlias, isMap, isScalar, isNode, visit } from 'yaml'
import { compilePathAliases } from './path-aliases'
import { buildWikiLinkIndex } from './links'
import { rewriteMovedLinks } from './move-links'
import { renderTemplate } from './templates'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Nodes } from 'mdast'
import type { NoteDocument } from '../shared/types'
import type { NoteComposeInput, NoteComposeChange } from '../shared/note-composer'

function frontmatter(content: string) {
  const match = content.match(/^\uFEFF?---\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)(?:\r?\n|$)/)
  if (!match && /^\uFEFF?---(?:\r?\n|$)/.test(content)) throw new Error('Frontmatterの終端を確認してください。')
  return { raw: match?.[0] ?? '', yaml: match?.[1] ?? '', body: content.slice(match?.[0].length ?? 0) }
}
function metadata(source: string, target: string): string {
  if (!source) return target
  const read = (raw: string) => {
    const doc = parseDocument(raw, { uniqueKeys: true })
    if (doc.errors.length || (doc.contents && !isMap(doc.contents))) throw new Error('安全に統合できないYAMLです。')
    visit(doc, (_key, node) => { if (isAlias(node) || (isNode(node) && (node.tag || node.anchor)) || (isScalar(node) && node.anchor)) throw new Error('YAMLのalias・tag・anchorは統合できません。') })
    return doc
  }
  const src = read(source), dst = read(target)
  if (!target) return source
  for (const pair of (isMap(src.contents) ? src.contents.items : [])) {
    if (!isScalar(pair.key) || typeof pair.key.value !== 'string' || pair.key.value === '<<') throw new Error('YAMLのキーを安全に統合できません。')
    const key = pair.key.value
    if (dst.has(key)) {
      if (JSON.stringify((dst.toJS() as Record<string, unknown>)[key]) !== JSON.stringify((src.toJS() as Record<string, unknown>)[key])) throw new Error(`Property「${key}」が競合しています。`)
      // Keep source comments even when the compatible value is already present.
      const existing = (dst.contents as import('yaml').YAMLMap).items.find(item => isScalar(item.key) && item.key.value === key)!
      const comments: string[] = []
      for (const text of [pair.key.commentBefore, pair.key.comment]) if (text) comments.push(text)
      if (isNode(pair.value)) visit(pair.value, (_key, node) => {
        if (isNode(node)) for (const text of [node.commentBefore, node.comment]) if (text) comments.push(text)
      })
      if (comments.length && isScalar(existing.key)) existing.key.commentBefore = [existing.key.commentBefore, ...comments].filter(Boolean).join('\n')
    } else {
      if (!isMap(dst.contents)) dst.contents = parseDocument('{}').contents
      ;(dst.contents as import('yaml').YAMLMap).items.push(pair)
    }
  }
  if (src.commentBefore) dst.commentBefore = [dst.commentBefore, src.commentBefore].filter(Boolean).join('\n')
  if (src.comment) dst.comment = [dst.comment, src.comment].filter(Boolean).join('\n')
  return dst.toString().trimEnd()
}
function anchors(content: string) {
  const result: Array<{ id: string; slug: string; from: number; to: number; level: number }> = []
  const ignored: Array<{ from: number; to: number }> = []
  const tree = commonmarkLanguage.parser.parse(content)
  tree.iterate({ enter(node) {
    if (['FencedCode', 'CodeBlock', 'Comment', 'CommentBlock', 'HTMLBlock', 'InlineCode'].includes(node.name)) { ignored.push({ from: node.from, to: node.to }); return false }
  } })
  for (const { heading, slug } of listHeadingSlugs(content)) {
    let end = content.indexOf('\n', heading.sourceOffset)
    if (end < 0) end = content.length
    if (!/^ {0,3}#/.test(content.slice(heading.sourceOffset, end))) {
      const secondEnd = content.indexOf('\n', end + 1)
      end = secondEnd < 0 ? content.length : secondEnd
    }
    result.push({ id: heading.title.toLocaleLowerCase(), slug, from: heading.sourceOffset, to: end, level: heading.level })
  }
  for (const match of content.matchAll(/(?:^|\n)[^\n]*?\^([A-Za-z0-9-]+)[ \t]*(?=\r?$)/gm)) {
    const marker = match.index + match[0].lastIndexOf('^')
    if (ignored.some(span => marker >= span.from && marker < span.to)) continue
    let node = tree.resolveInner(marker + 1)
    while (node.parent && node.name !== 'Paragraph') node = node.parent
    if (node.name !== 'Paragraph') continue
    let start = node.from
    const standalone = content.slice(node.from, node.to).trim() === `^${match[1]}`
    if (standalone) {
      const previous = node.prevSibling
      if (node.parent?.name !== 'Document' || !previous) throw new Error('block anchorの対象を確認できません。')
      start = previous.from
    } else if (node.parent?.name === 'ListItem') start = node.parent.from
    result.push({ id: `^${match[1]}`.toLowerCase(), slug: `^${match[1]}`.toLowerCase(), from: start, to: node.to, level: 0 })
  }
  return result
}
function joinBody(first: string, second: string) { return !first ? second : !second ? first : `${first}${first.endsWith('\n\n') ? '' : first.endsWith('\n') ? '\n' : '\n\n'}${second}` }

function referenceLinks(content: string, from = 0, to = content.length): string[] {
  const tree = commonmarkLanguage.parser.parse(content)
  const definitions = new Set<string>()
  const normalize = (label: string) => label.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  tree.iterate({ enter(node) {
    if (node.name === 'LinkReference') definitions.add(normalize(content.slice(node.from, node.to).match(/^\s*\[([^\]]+)\]:/)?.[1] ?? ''))
  } })
  const result: string[] = []
  tree.iterate({ enter(node) {
    if (['Link', 'Image'].includes(node.name) && node.from >= from && node.to <= to && !(content[node.from - 1] === '[' && content[node.to] === ']')) {
      const raw = content.slice(node.from, node.to)
      if (/\]\s*\(/.test(raw)) return
      const labels = [...raw.matchAll(/\[([^\]]*)\]/g)].map(match => match[1])
      const label = normalize(labels.at(-1) || labels[0] || '')
      if (definitions.has(label)) result.push(raw)
    }
  } })
  return result.sort()
}
function assertClosedContexts(content: string): void {
  commonmarkLanguage.parser.parse(content).iterate({ enter(node) {
    const raw = content.slice(node.from, node.to)
    if (node.name === 'FencedCode' && (node.node.lastChild?.name !== 'CodeMark' || node.node.lastChild?.from === node.node.firstChild?.from)) throw new Error('閉じていないコードフェンスは統合できません。')
    if (['HTMLBlock', 'CommentBlock', 'Comment'].includes(node.name) && ((/^<!--/.test(raw) && !raw.includes('-->')) || (/^<(script|pre|style|textarea)(?:\s|>)/i.test(raw) && !/<\/(script|pre|style|textarea)>/i.test(raw)))) throw new Error('閉じていないHTML・コメントは統合できません。')
  } })
}

function extractionTemplate(input: NoteComposeInput, markdown: string) {
  const title = (path: string) => path.split('/').at(-1)!.replace(/\.md$/i, '')
  // Replace only the template, never inserted body text or variables contained in a filename.
  const render = (text: string) => text.replace(/\{\{([\s\S]*?)\}\}/g, (placeholder, expression: string) => expression === 'title' ? title(input.targetPath) : expression === 'source_title' ? title(input.sourcePath) : renderTemplate(placeholder, { title: '', now: new Date(input.targetTemplate!.now) }))
  const rendered = render(markdown)
  const parts = frontmatter(rendered)
  if (parts.yaml) metadata(parts.yaml, '')
  assertClosedContexts(parts.body)
  const markers = [...markdown.matchAll(/\{\{content\}\}/g)]
  if (markers.length > 1) throw new Error('テンプレートの{{content}}は本文の独立した行に一つだけ指定してください。')
  if (!markers.length) return { ...parts, prefix: parts.body, suffix: '' }
  const offset = render(markdown.slice(0, markers[0].index)).length - parts.raw.length
  const lineStart = parts.body.lastIndexOf('\n', offset - 1) + 1
  const nextLine = parts.body.indexOf('\n', offset)
  const lineEnd = nextLine < 0 ? parts.body.length : nextLine + 1
  const markerNode = commonmarkLanguage.parser.parse(parts.body).resolveInner(offset + 2)
  const safe = markerNode.name === 'Paragraph' && markerNode.parent?.name === 'Document'
  if (offset < 0 || !safe || !/^\s*\{\{content\}\}\s*$/.test(parts.body.slice(lineStart, lineEnd))) throw new Error('テンプレートの{{content}}は本文の独立した行に指定してください。')
  return { ...parts, prefix: parts.body.slice(0, lineStart), suffix: parts.body.slice(lineEnd).replace(/^(?:\r?\n)+/, '') }
}
const renderedMarkdown = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
function syntax(content: string, from = 0, to = content.length) {
  const nodes: string[] = []
  function visitNode(node: Nodes) {
    const start = node.position?.start.offset, end = node.position?.end.offset
    if (node.type !== 'root' && start !== undefined && end !== undefined && start >= from && end <= to) {
      const { position: _position, ...properties } = node
      if ('children' in properties) delete (properties as Partial<typeof properties>).children
      nodes.push(JSON.stringify({ ...properties, from: start - from, to: end - from }))
    }
    if ('children' in node) for (const child of node.children) visitNode(child)
  }
  visitNode(renderedMarkdown.parse(content))
  return nodes
}

export function composeNotes(input: NoteComposeInput, notes: NoteDocument[], aliases: Record<string, string> = {}, resolvedTemplate?: string): { changes: NoteComposeChange[]; updatedLinkCount: number } {
  const source = notes.find(note => note.path === input.sourcePath)
  const target = notes.find(note => note.path.toLowerCase() === input.targetPath.toLowerCase())
  if (!source || source.content !== input.expectedSourceContent) throw new Error('移動元が変更されています。再度プレビューしてください。')
  if (input.sourcePath.toLowerCase() === input.targetPath.toLowerCase()) throw new Error('移動元と統合先は別のノートを指定してください。')
  if (input.targetMode === 'existing' ? !target : !!target) throw new Error('統合先の存在状態が変わりました。')
  if (target && target.path !== input.targetPath) throw new Error('移動先のパスを実際の表記で指定してください。')
  if (input.mode === 'merge' && input.targetMode !== 'existing') throw new Error('統合先には既存ノートを指定してください。')
  if (input.targetTemplate && (input.mode !== 'extract' || input.targetMode !== 'new' || resolvedTemplate === undefined)) throw new Error('テンプレートは新規ノートへの抽出だけで使用できます。')
  if (/[#|\[\]]/.test(input.targetPath)) throw new Error('統合先の名前には #・|・[・] を使用できません。')
  const template = input.targetTemplate ? extractionTemplate(input, resolvedTemplate!) : undefined
  const sf = frontmatter(source.content), tf = template ?? frontmatter(target?.content ?? '')
  assertClosedContexts(sf.body); assertClosedContexts(tf.body)
  let from = sf.raw.length, to = source.content.length
  if (input.mode === 'extract') {
    from = input.range?.from ?? -1; to = input.range?.to ?? -1
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < sf.raw.length || to <= from || to > source.content.length || !source.content.slice(from, to).trim()) throw new Error('空でない本文を選択してください。Frontmatterは抽出できません。')
    if ([from, to].some(offset => offset > 0 && /[\uD800-\uDBFF]/.test(source.content[offset - 1]) && /[\uDC00-\uDFFF]/.test(source.content[offset]))) throw new Error('文字の途中は抽出できません。')
    commonmarkLanguage.parser.parse(source.content).iterate({ enter(node) {
      if (['FencedCode', 'CodeBlock', 'InlineCode', 'Link', 'Image', 'Comment', 'HTMLBlock', 'BulletList', 'OrderedList', 'Blockquote', 'Emphasis', 'StrongEmphasis', 'HTMLTag', 'LinkReference'].includes(node.name) || /Heading/.test(node.name)) {
        if (from < node.to && to > node.from && !(from <= node.from && to >= node.to)) throw new Error('リンク・見出し・コードの途中は抽出できません。')
        return false
      }
    } })
    for (const match of source.content.matchAll(/!?\[\[[^\]\r\n]+\]\]/g)) if (from < match.index + match[0].length && to > match.index && !(from <= match.index && to >= match.index + match[0].length)) throw new Error('Wikiリンクの途中は抽出できません。')
  }
  const allAnchors = anchors(sf.body).map(anchor => ({ ...anchor, from: anchor.from + sf.raw.length, to: anchor.to + sf.raw.length }))
  const moved = allAnchors.filter(anchor => anchor.from >= from && anchor.to <= to)
  for (const anchor of allAnchors) {
    if (from < anchor.to && to > anchor.from && !moved.includes(anchor)) throw new Error('見出し・block anchorの宣言と対象全体を選択してください。')
    if (input.mode === 'extract' && moved.includes(anchor) && anchor.level) {
      const end = allAnchors.find(other => other.from > anchor.from && other.level > 0 && other.level <= anchor.level)?.from ?? source.content.length
      if (to < end && source.content.slice(to, end).trim()) throw new Error('見出しの本文全体を選択してください。')
    }
  }
  const movedIds = new Set(moved.flatMap(anchor => [anchor.id, anchor.slug]))
  const targetIds = anchors(tf.body).flatMap(anchor => [anchor.id, anchor.slug])
  if (moved.some(anchor => [anchor.id, anchor.slug].some(id => targetIds.includes(id)) || allAnchors.some(other => other !== anchor && (other.id === anchor.id || other.slug === anchor.id || other.id === anchor.slug)))) throw new Error('見出し・block anchorが重複しています。')
  const index = buildWikiLinkIndex(notes, compilePathAliases(aliases))
  let updatedLinkCount = 0
  const onRewrite = (count: number) => { updatedLinkCount += count }
  const selected = source.content.slice(from, to)
  const definitions: Array<{ from: number; to: number; text: string; label: string }> = []
  commonmarkLanguage.parser.parse(source.content).iterate({ enter(node) {
    if (node.name === 'LinkReference') definitions.push({ from: node.from, to: node.to, text: source.content.slice(node.from, node.to), label: source.content.slice(node.from, node.to).match(/^\s*\[([^\]]+)\]:/)?.[1].trim().replace(/\s+/g, ' ').toLocaleLowerCase() ?? '' })
  } })
  const targetDefinitions = new Set<string>()
  commonmarkLanguage.parser.parse(tf.body).iterate({ enter(node) {
    if (node.name === 'LinkReference') targetDefinitions.add(tf.body.slice(node.from, node.to).match(/^\s*\[([^\]]+)\]:/)?.[1].trim().replace(/\s+/g, ' ').toLocaleLowerCase() ?? '')
  } })
  let selectedBody = selected
  if (input.mode === 'extract' && definitions.length) {
    if (definitions.some(definition => from < definition.to && to > definition.from)) throw new Error('参照リンク定義は元ノートに残してください。')
    let usesReferences = false
    commonmarkLanguage.parser.parse(source.content).iterate({ enter(node) {
      if (['Link', 'Image'].includes(node.name) && node.from >= from && node.to <= to && !/\]\(/.test(source.content.slice(node.from, node.to))) usesReferences = true
    } })
    if (usesReferences) selectedBody = joinBody(selected, definitions.map(definition => definition.text).join('\n'))
  }
  if ((input.mode === 'merge' || selectedBody !== selected) && definitions.some(definition => targetDefinitions.has(definition.label))) throw new Error('参照リンク定義の名前が統合先と競合しています。')
  const movedNote = { ...source, content: selectedBody }
  let body = rewriteMovedLinks(movedNote, index, source.path, input.targetPath, { fragments: input.mode === 'extract' ? movedIds : undefined, onRewrite })
  // Empty self anchors are relative to the original note; retained anchors stay there.
  body = rewriteMovedLinks({ ...source, content: body }, index, source.path, input.targetPath, { selfAnchors: true, fragments: movedIds, rebaseOnly: true, onRewrite })
  // Generated heading slugs must stay stable for both retained and moved headings.
  const originalTargetBody = target ? rewriteMovedLinks({ ...target, content: tf.body }, index, source.path, input.targetPath, { fragments: input.mode === 'extract' ? movedIds : undefined, rebaseOnly: true, onRewrite }) : tf.body
  const combinedBody = template ? joinBody(joinBody(template.prefix, body), template.suffix) : input.placement === 'prepend' ? joinBody(body, originalTargetBody) : joinBody(originalTargetBody, body)
  if (template) {
    assertClosedContexts(combinedBody)
    const seen = new Set<string>()
    for (const anchor of anchors(combinedBody)) {
      const ids = [anchor.id, anchor.slug]
      if (ids.some(id => seen.has(id))) throw new Error('テンプレートの見出し・block anchorが重複しています。')
      for (const id of ids) seen.add(id)
    }
  }
  const targetStart = input.placement === 'prepend' ? combinedBody.length - originalTargetBody.length : 0
  const movedStart = template ? joinBody(template.prefix, body).length - body.length : input.placement === 'prepend' ? 0 : combinedBody.length - body.length
  const targetReferences = template ? [...referenceLinks(combinedBody, 0, movedStart), ...referenceLinks(combinedBody, movedStart + body.length)].sort() : referenceLinks(combinedBody, targetStart, targetStart + originalTargetBody.length)
  if (JSON.stringify(referenceLinks(originalTargetBody)) !== JSON.stringify(targetReferences) ||
      JSON.stringify(referenceLinks(source.content, from, to)) !== JSON.stringify(referenceLinks(combinedBody, movedStart, movedStart + body.length))) throw new Error('統合により参照リンクの解決先が変わるため停止しました。')
  if (template && JSON.stringify(syntax(body)) !== JSON.stringify(syntax(combinedBody, movedStart, movedStart + body.length))) throw new Error('テンプレートにより抽出本文の解釈が変わるため停止しました。')
  if (template && (JSON.stringify(syntax(template.prefix)) !== JSON.stringify(syntax(combinedBody, 0, template.prefix.length)) || JSON.stringify(syntax(template.suffix)) !== JSON.stringify(syntax(combinedBody, combinedBody.length - template.suffix.length)))) throw new Error('抽出によりテンプレート本文の解釈が変わるため停止しました。')

  for (const anchor of [...moved, ...anchors(tf.body)]) {
    if (anchor.level && listHeadingSlugs(combinedBody).find(item => item.heading.title.toLocaleLowerCase() === anchor.id)?.slug !== anchor.slug) throw new Error('統合により見出しの識別子が変わるため停止しました。')
  }
  if (input.mode === 'extract') for (const anchor of allAnchors.filter(anchor => !moved.includes(anchor) && anchor.level)) {
    const remaining = source.content.slice(0, from) + source.content.slice(to)
    if (listHeadingSlugs(remaining).find(item => item.heading.title.toLocaleLowerCase() === anchor.id)?.slug !== anchor.slug) throw new Error('抽出により残る見出しの識別子が変わるため停止しました。')
  }
  const sourceYaml = input.mode === 'merge' ? frontmatter(rewriteMovedLinks({ ...source, content: sf.raw }, index, source.path, input.targetPath, { onRewrite })).yaml : ''
  const targetRaw = target ? rewriteMovedLinks({ ...target, content: tf.raw }, index, source.path, input.targetPath, { fragments: input.mode === 'extract' ? movedIds : undefined, rebaseOnly: true, onRewrite }) : template?.raw ?? ''
  const yaml = input.mode === 'merge' ? metadata(sourceYaml, frontmatter(targetRaw).yaml) : frontmatter(targetRaw).yaml
  const header = sourceYaml && yaml ? `---\n${yaml}\n---\n` : targetRaw
  const separator = header && combinedBody && !header.endsWith('\n') ? (header.includes('\r\n') ? '\r\n' : '\n') : ''
  const afterTarget = header + separator + combinedBody
  const changes: NoteComposeChange[] = [{ path: input.targetPath, kind: target ? 'update' : 'create', before: target?.content ?? null, after: afterTarget }]
  for (const note of notes) {
    if (note.path === input.targetPath) continue
    if (note.path === source.path && input.mode === 'merge') { changes.push({ path: note.path, kind: 'trash', before: note.content, after: null }); continue }
    const replacement = input.sourceReplacement === 'none' ? '' : `${input.sourceReplacement === 'embed' ? '!' : ''}[[${input.targetPath.replace(/\.md$/i, '')}]]${selected.endsWith('\n') ? '\n' : ''}`
    const content = note.path === source.path ? note.content.slice(0, from) + replacement + note.content.slice(to) : note.content
    const after = rewriteMovedLinks({ ...note, content }, index, source.path, input.targetPath, { fragments: input.mode === 'extract' ? movedIds : undefined, rebaseOnly: note.path === source.path, onRewrite })
    if (after !== note.content) changes.push({ path: note.path, kind: 'update', before: note.content, after })
  }
  return { changes, updatedLinkCount }
}
