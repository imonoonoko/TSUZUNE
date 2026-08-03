import type { NoteDocument, SearchResult } from '../shared/types'
import { extractMarkdownTags } from './tags'

function normalized(value: string): string {
  return value.toLocaleLowerCase()
}
function excerptFor(content: string, query: string): string {
  const lowerContent = normalized(content)
  const index = lowerContent.indexOf(normalized(query))
  if (index < 0) {
    return content.replace(/\s+/g, ' ').trim().slice(0, 120)
  }

  const start = Math.max(0, index - 45)
  const end = Math.min(content.length, index + query.length + 75)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  return `${prefix}${content.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`
}

export function searchNotes(notes: NoteDocument[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim()
  if (!query) {
    return []
  }

  const lowerQuery = normalized(query)
  const tagQuery = /^tag:(#?[^\s]+)$/i.exec(query)?.[1]
  const normalizedTagQuery = tagQuery
    ? normalized(tagQuery.startsWith('#') ? tagQuery : `#${tagQuery}`)
    : null

  return notes
    .map((note): SearchResult | null => {
      const lowerName = normalized(note.name)
      const lowerPath = normalized(note.path)
      const lowerContent = normalized(note.content)
      let score = 0

      if (normalizedTagQuery) {
        if (
          extractMarkdownTags(note.content).some(
            (tag) => normalized(tag) === normalizedTagQuery
          )
        ) {
          score = 80
        }
      } else {
        if (lowerName === lowerQuery) {
          score += 100
        } else if (lowerName.startsWith(lowerQuery)) {
          score += 60
        } else if (lowerName.includes(lowerQuery)) {
          score += 40
        }

        if (lowerPath.includes(lowerQuery)) {
          score += 20
        }

        if (lowerContent.includes(lowerQuery)) {
          score += 10
        }
      }

      if (score === 0) {
        return null
      }

      return {
        path: note.path,
        name: note.name,
        excerpt: excerptFor(note.content, query),
        modifiedAt: note.modifiedAt,
        score
      }
    })
    .filter((result): result is SearchResult => result !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.modifiedAt - left.modifiedAt ||
        left.path.localeCompare(right.path, 'ja')
    )
}
