import type { NoteDocument } from '../shared/types'
import type { CompiledPathAliases } from './path-aliases'
import { extractMarkdownHeadings, type MarkdownHeading } from './markdown-headings'
import { parseFrontmatter } from './frontmatter'
import { buildWikiLinkIndex, resolveIndexedNoteLink, resolveWikiLink } from './links'

export type NoteNavigationTarget =
  | { kind: 'wiki' | 'markdown'; status: 'resolved'; path: string; headingId?: string; fragment?: string }
  | { kind: 'wiki' | 'markdown'; status: 'missing' | 'ambiguous' | 'invalid'; reason: string; fragment?: string }

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function slug(title: string): string {
  return title.toLocaleLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').trim().replace(/\s+/g, '-')
}

export function resolveHeadingFragment(content: string, fragment: string): MarkdownHeading | null {
  const headings = extractMarkdownHeadings(content)
  const exact = headings.find((heading) => heading.title === fragment)
  if (exact) return exact

  return resolveHeadingSlug(content, fragment)
}

/** Resolve generated slugs without the human-readable title shortcut. */
export function resolveHeadingSlug(content: string, fragment: string): MarkdownHeading | null {
  return listHeadingSlugs(content).find(item => item.slug === fragment.toLocaleLowerCase())?.heading ?? null
}

export function listHeadingSlugs(content: string): Array<{ heading: MarkdownHeading; slug: string }> {
  const headings = extractMarkdownHeadings(content)
  const result: Array<{ heading: MarkdownHeading; slug: string }> = []
  const seen = new Map<string, number>()
  const used = new Set<string>()
  for (const heading of headings) {
    const base = slug(heading.title)
    let duplicate = seen.get(base) ?? 0
    let generated = `${base}${duplicate ? `-${duplicate}` : ''}`
    while (used.has(generated)) {
      duplicate += 1
      generated = `${base}-${duplicate}`
    }
    seen.set(base, duplicate + 1)
    used.add(generated)
    result.push({ heading, slug: generated })
  }
  return result
}

export function resolveNoteNavigation(
  href: string,
  kind: 'wiki' | 'markdown',
  currentPath: string,
  notes: readonly NoteDocument[],
  currentContent: string,
  pathAliases?: CompiledPathAliases
): NoteNavigationTarget {
  const hashIndex = href.indexOf('#')
  const pathPart = hashIndex < 0 ? href : href.slice(0, hashIndex)
  const rawFragment = hashIndex < 0 ? undefined : href.slice(hashIndex + 1)
  const fragment = rawFragment === undefined ? undefined : kind === 'wiki' ? rawFragment : decode(rawFragment)
  if (fragment === null) return { kind, status: 'invalid', reason: '見出しの文字コードが無効です。' }

  let path: string | undefined
  if (kind === 'wiki') {
    if (!pathPart) {
      path = currentPath
    } else {
      const resolved = resolveWikiLink(pathPart, [...notes], pathAliases)
      if (resolved.status !== 'resolved' || !resolved.resolvedPath) {
        const status = resolved.status === 'resolved' ? 'missing' : resolved.status
        return {
          kind,
          status,
          reason: resolved.reason ?? (resolved.status === 'ambiguous' ? '同名ノートが複数あります。' : 'ノートが見つかりません。'),
          fragment
        }
      }
      path = resolved.resolvedPath
    }
  } else {
    const resolved = resolveIndexedNoteLink({ kind, target: href, sourcePath: currentPath }, buildWikiLinkIndex([...notes], pathAliases))
    if (resolved.status !== 'resolved') return { kind, status: resolved.status, reason: resolved.status === 'invalid' ? resolved.reason : 'ノートが見つかりません。', fragment }
    path = resolved.path
  }

  if (fragment) {
    const noteContent = path.toLocaleLowerCase() === currentPath.toLocaleLowerCase()
      ? currentContent
      : notes.find((note) => note.path.toLocaleLowerCase() === path!.toLocaleLowerCase())?.content
    if (noteContent === undefined) return { kind, status: 'missing', reason: 'リンク先の内容を確認できません。', fragment }
    const heading = resolveHeadingFragment(noteContent, fragment)
    if (!heading) return { kind, status: 'missing', reason: `見出し「${fragment}」が見つかりません。`, fragment }
    return { kind, status: 'resolved', path, headingId: heading.id, fragment }
  }
  return { kind, status: 'resolved', path }
}

export function notePreviewText(
  target: NoteNavigationTarget,
  currentPath: string,
  currentContent: string,
  notes: readonly NoteDocument[]
): string {
  if (target.status !== 'resolved') return target.reason
  const content = target.path.toLocaleLowerCase() === currentPath.toLocaleLowerCase()
    ? currentContent
    : notes.find((note) => note.path.toLocaleLowerCase() === target.path.toLocaleLowerCase())?.content
  if (content === undefined) return 'リンク先の内容を確認できません。'
  const headings = extractMarkdownHeadings(content)
  const frontmatter = parseFrontmatter(content)
  let body = frontmatter.found && frontmatter.warnings.length === 0 ? frontmatter.body : content
  if (target.headingId) {
    const index = headings.findIndex((heading) => heading.id === target.headingId)
    if (index < 0) return '見出しが見つかりません。'
    const heading = headings[index]
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level)
    body = content.slice(heading.sourceOffset, next?.sourceOffset ?? content.length)
    const headingLine = /^[^\r\n]*(?:\r?\n|$)/.exec(body)?.[0] ?? ''
    body = body.slice(headingLine.length)
    if (!/^ {0,3}#{1,6}(?:[ \t]+|$)/.test(headingLine.trimEnd())) {
      body = body.replace(/^ {0,3}(?:=+|-+)[ \t]*(?:\r?\n|$)/, '')
    }
  }
  return body.replace(/\r/g, '').replace(/```[\s\S]*?```/g, '').replace(/[#>*_`\[\]]/g, '').trim().slice(0, 400) || '本文はありません。'
}
