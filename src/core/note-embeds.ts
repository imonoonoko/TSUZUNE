import { resolveMarkdownBlock } from './markdown-blocks'
import { parseFrontmatter } from './frontmatter'
import { extractMarkdownHeadings } from './markdown-headings'
import { resolveNoteNavigation, type NoteNavigationTarget } from './note-navigation'
import type { CompiledPathAliases } from './path-aliases'
import type { NoteDocument } from '../shared/types'
import { markdownLanguage } from '@codemirror/lang-markdown'
import { markdownExcludedRanges } from './links'

export type NoteEmbedResult = { status: 'resolved'; path: string; content: string; sourceContent: string; key: string; navigation: NoteNavigationTarget }
  | { status: 'missing' | 'ambiguous' | 'invalid'; reason: string }

export function resolveNoteEmbed(target: string, currentPath: string, currentContent: string,
  notes: readonly NoteDocument[], pathAliases?: CompiledPathAliases): NoteEmbedResult {
  const blockIndex = target.indexOf('#^')
  const blockId = blockIndex < 0 ? undefined : target.slice(blockIndex + 2)
  const navigation = resolveNoteNavigation(blockIndex < 0 ? target : target.slice(0, blockIndex), 'wiki', currentPath, notes, currentContent, pathAliases)
  if (navigation.status !== 'resolved') return navigation
  const sourceContent = navigation.path.toLocaleLowerCase() === currentPath.toLocaleLowerCase()
    ? currentContent : notes.find(note => note.path.toLocaleLowerCase() === navigation.path.toLocaleLowerCase())?.content
  if (sourceContent === undefined) return { status: 'missing', reason: 'リンク先の内容を確認できません。' }
  const frontmatter = parseFrontmatter(sourceContent)
  let content = frontmatter.found && frontmatter.warnings.length === 0 ? frontmatter.body : sourceContent
  if (navigation.headingId) {
    const headings = extractMarkdownHeadings(sourceContent)
    const index = headings.findIndex(heading => heading.id === navigation.headingId)
    const heading = headings[index]
    const next = headings.slice(index + 1).find(candidate => candidate.level <= heading.level)
    content = sourceContent.slice(heading.sourceOffset, next?.sourceOffset)
  }
  if (blockId !== undefined) {
    const block = resolveMarkdownBlock(sourceContent, blockId)
    if ('reason' in block) return { status: 'missing', reason: block.reason }
    content = block.content
  }
  // Excerpts still use definitions from the whole source document.
  if (navigation.headingId || blockId !== undefined) {
    const definitions: string[] = []
    const tree = markdownLanguage.parser.parse(sourceContent)
    const excluded = markdownExcludedRanges(sourceContent, tree)
    tree.iterate({ enter(node) {
      if (node.name === 'LinkReference' && !excluded.some(range => node.from < range.to && node.to > range.from)) {
        definitions.push(sourceContent.slice(node.from, node.to))
      }
    } })
    if (definitions.length) content = `${definitions.join('\n\n')}\n\n${content}`
  }
  return { status: 'resolved', path: navigation.path, sourceContent, content,
    key: `${navigation.path.toLocaleLowerCase()}#${blockId === undefined ? navigation.headingId ?? '' : `^${blockId}`}`, navigation }
}
