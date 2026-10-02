import { validateRelativePath } from '../core/paths'

interface BookmarkDetails {
  id: string
  title?: string
  group?: string
  ctime: number
}

export type VaultBookmark = BookmarkDetails & (
  | { type: 'file'; path: string }
  | { type: 'heading'; path: string; slug: string; headingTitle: string }
  | { type: 'search'; query: string }
)

type SaveDetails = { title?: string; group?: string }
export type SaveBookmarkInput = SaveDetails & (
  | { type?: 'file'; path: string }
  | { type: 'heading'; path: string; slug: string; headingTitle: string }
  | { type: 'search'; query: string }
)

export function bookmarkId(target: SaveBookmarkInput): string {
  if (target.type === 'search') return `search:${encodeURIComponent(target.query)}`
  const path = encodeURIComponent(target.path.toLocaleLowerCase())
  return target.type === 'heading'
    ? `heading:${path}#${encodeURIComponent(target.slug.toLocaleLowerCase())}`
    : `file:${path}`
}

/** Read-only migration: legacy file rows gain IDs in memory, never on disk during load. */
export function normalizeBookmarks(value: unknown): VaultBookmark[] {
  if (!Array.isArray(value)) return []
  const normalized = new Map<string, VaultBookmark>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Record<string, unknown>
    if (typeof candidate.ctime !== 'number' || !Number.isFinite(candidate.ctime) || candidate.ctime < 0) continue
    const details = {
      ctime: candidate.ctime,
      ...(typeof candidate.title === 'string' && candidate.title.trim() ? { title: candidate.title.trim() } : {}),
      ...(typeof candidate.group === 'string' && candidate.group.trim() ? { group: candidate.group.trim() } : {})
    }
    let bookmark: VaultBookmark
    if (candidate.type === 'search') {
      if (typeof candidate.query !== 'string' || !candidate.query.trim()) continue
      const target = { type: 'search' as const, query: candidate.query }
      bookmark = { ...details, ...target, id: bookmarkId(target) }
    } else if (candidate.type === 'file' || candidate.type === 'heading' || candidate.type === undefined) {
      const path = typeof candidate.path === 'string' ? validateRelativePath(candidate.path) : { valid: false }
      if (!path.valid || !path.normalized) continue
      if (candidate.type === 'heading') {
        if (!/\.md$/i.test(path.normalized) || typeof candidate.slug !== 'string' || !candidate.slug.trim() ||
            typeof candidate.headingTitle !== 'string' || !candidate.headingTitle.trim()) continue
        const target = { type: 'heading' as const, path: path.normalized, slug: candidate.slug.trim(), headingTitle: candidate.headingTitle.trim() }
        bookmark = { ...details, ...target, id: bookmarkId(target) }
      } else {
        const target = { type: 'file' as const, path: path.normalized }
        bookmark = { ...details, ...target, id: bookmarkId(target) }
      }
    } else continue
    normalized.set(bookmark.id, bookmark)
  }
  return [...normalized.values()].sort((a, b) => a.ctime - b.ctime)
}
