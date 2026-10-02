import type { NoteDocument, VaultAttachment } from '../shared/types'
import type { VaultBookmark } from '../shared/bookmarks'
import type { CompiledPathAliases } from './path-aliases'
import { resolvePathAlias } from './path-aliases'
import { listHeadingSlugs, resolveHeadingSlug } from './note-navigation'

export type BookmarkTarget =
  | { status: 'resolved'; type: 'file'; path: string }
  | { status: 'resolved'; type: 'heading'; path: string; headingId: string }
  | { status: 'resolved'; type: 'search'; query: string }
  | { status: 'stale'; reason: string; rootPath?: string }

export function headingBookmarkChoices(content: string): { slug: string; title: string }[] {
  return listHeadingSlugs(content).map(({ heading, slug }) => ({ slug, title: heading.title }))
}

export function resolveBookmarkTarget(
  bookmark: VaultBookmark,
  notes: readonly NoteDocument[],
  attachments: readonly VaultAttachment[] = [],
  aliases?: CompiledPathAliases
): BookmarkTarget {
  if (bookmark.type === 'search') return { status: 'resolved', type: 'search', query: bookmark.query }
  const requested = aliases && /\.md$/i.test(bookmark.path)
    ? resolvePathAlias(aliases, bookmark.path) : bookmark.path
  const path = [...notes, ...attachments].find(item => item.path.toLocaleLowerCase() === requested.toLocaleLowerCase())?.path
  if (!path) return { status: 'stale', reason: `ブックマーク先「${bookmark.path}」が見つかりません。` }
  if (bookmark.type === 'file') return { status: 'resolved', type: 'file', path }
  const note = notes.find(item => item.path === path)
  if (!note) return { status: 'stale', reason: '見出しのノートを読み取れません。', rootPath: path }
  const heading = resolveHeadingSlug(note.content, bookmark.slug)
  if (!heading || heading.title !== bookmark.headingTitle) {
    return { status: 'stale', reason: `見出し「${bookmark.headingTitle}」が見つかりません。`, rootPath: path }
  }
  return { status: 'resolved', type: 'heading', path, headingId: heading.id }
}
