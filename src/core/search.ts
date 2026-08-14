import type { NoteDocument, SearchResult } from '../shared/types'
import { extractMarkdownTags } from './tags'

function normalized(value: string): string {
  return value.toLocaleLowerCase()
}

export interface RendererSearchClause {
  kind: 'term' | 'tag' | 'path' | 'file'
  value: string
  negated: boolean
}

function plainTokenEnd(query: string, start: number): number {
  let index = start
  while (index < query.length && !/\s/.test(query[index])) {
    index += 1
  }
  return index
}

export function parseRendererSearchQuery(rawQuery: string): RendererSearchClause[] {
  const clauses: RendererSearchClause[] = []
  let index = 0

  while (index < rawQuery.length) {
    while (index < rawQuery.length && /\s/.test(rawQuery[index])) {
      index += 1
    }
    if (index >= rawQuery.length) break

    const tokenStart = index
    const negated = rawQuery[index] === '-' && index + 1 < rawQuery.length && !/\s/.test(rawQuery[index + 1])
    const valueStart = negated ? index + 1 : index
    const field = /^(tag|path|file):/i.exec(rawQuery.slice(valueStart))

    if (field) {
      let fieldValueStart = valueStart + field[0].length
      while (fieldValueStart < rawQuery.length && /\s/.test(rawQuery[fieldValueStart])) {
        fieldValueStart += 1
      }
      if (fieldValueStart < rawQuery.length && !/\s/.test(rawQuery[fieldValueStart])) {
        if (rawQuery[fieldValueStart] === '"') {
          const closingQuote = rawQuery.indexOf('"', fieldValueStart + 1)
          if (
            closingQuote > fieldValueStart + 1 &&
            (closingQuote + 1 === rawQuery.length || /\s/.test(rawQuery[closingQuote + 1]))
          ) {
            clauses.push({
              kind: field[1].toLocaleLowerCase() as 'tag' | 'path' | 'file',
              value: rawQuery.slice(fieldValueStart + 1, closingQuote),
              negated
            })
            index = closingQuote + 1
            continue
          }
        } else {
          const end = plainTokenEnd(rawQuery, fieldValueStart)
          clauses.push({
            kind: field[1].toLocaleLowerCase() as 'tag' | 'path' | 'file',
            value: rawQuery.slice(fieldValueStart, end),
            negated
          })
          index = end
          continue
        }
      }
    } else if (rawQuery[valueStart] === '"') {
      const closingQuote = rawQuery.indexOf('"', valueStart + 1)
      if (
        closingQuote > valueStart + 1 &&
        (closingQuote + 1 === rawQuery.length || /\s/.test(rawQuery[closingQuote + 1]))
      ) {
        clauses.push({
          kind: 'term',
          value: rawQuery.slice(valueStart + 1, closingQuote),
          negated
        })
        index = closingQuote + 1
        continue
      }
      if (closingQuote < 0) {
        clauses.push({ kind: 'term', value: rawQuery.slice(tokenStart), negated: false })
        break
      }
    }

    const end = plainTokenEnd(rawQuery, tokenStart)
    const value = rawQuery.slice(tokenStart, end)
    clauses.push({
      kind: 'term',
      value: field || value === '-' ? value : rawQuery.slice(valueStart, end),
      negated: field || value === '-' ? false : negated
    })
    index = end
  }

  return clauses
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

function scoreTerm(note: NoteDocument, query: string): number {
  const lowerQuery = normalized(query)
  const lowerName = normalized(note.name)
  const lowerPath = normalized(note.path)
  const lowerContent = normalized(note.content)
  let score = 0

  if (lowerName === lowerQuery) {
    score += 100
  } else if (lowerName.startsWith(lowerQuery)) {
    score += 60
  } else if (lowerName.includes(lowerQuery)) {
    score += 40
  }
  if (lowerPath.includes(lowerQuery)) score += 20
  if (lowerContent.includes(lowerQuery)) score += 10

  return score
}

export function searchNotes(notes: NoteDocument[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim()
  if (!query) {
    return []
  }

  const tagQuery = /^tag:(#?[^\s]+)$/i.exec(query)?.[1]
  const normalizedTagQuery = tagQuery
    ? normalized(tagQuery.startsWith('#') ? tagQuery : `#${tagQuery}`)
    : null

  return notes
    .map((note): SearchResult | null => {
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
        score = scoreTerm(note, query)
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

function matchesRendererClause(note: NoteDocument, clause: RendererSearchClause): boolean {
  const value = normalized(clause.value)
  if (clause.kind === 'term') return clause.value !== '-' && scoreTerm(note, clause.value) > 0
  if (clause.kind === 'path') return normalized(note.path).includes(value)
  if (clause.kind === 'file') {
    return normalized(note.path.split('/').at(-1) ?? note.name).includes(value)
  }

  const tag = value.startsWith('#') ? value : `#${value}`
  return extractMarkdownTags(note.content).some((candidate) => {
    const normalizedCandidate = normalized(candidate)
    return normalizedCandidate === tag || normalizedCandidate.startsWith(`${tag}/`)
  })
}

export function searchRendererNotes(notes: NoteDocument[], rawQuery: string): SearchResult[] {
  const clauses = parseRendererSearchQuery(rawQuery)
  if (clauses.length === 0) return []

  const excerptQuery =
    clauses.find((clause) => clause.kind === 'term' && !clause.negated)?.value ?? rawQuery.trim()

  return notes
    .filter((note) =>
      clauses.every((clause) => {
        const matches = matchesRendererClause(note, clause)
        return clause.negated ? !matches : matches
      })
    )
    .map((note): SearchResult => ({
      path: note.path,
      name: note.name,
      excerpt: excerptFor(note.content, excerptQuery),
      modifiedAt: note.modifiedAt,
      score: clauses.reduce(
        (score, clause) =>
          score + (clause.kind === 'term' && !clause.negated ? scoreTerm(note, clause.value) : 0),
        0
      )
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.modifiedAt - left.modifiedAt ||
        left.path.localeCompare(right.path, 'ja')
    )
}
