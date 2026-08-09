import type { NoteDocument } from '../shared/types'
import { parseFrontmatter } from './frontmatter'

const DAY_MS = 24 * 60 * 60 * 1000
const REVIEW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type FreshnessLevel =
  | 'current'
  | 'aging'
  | 'stale'
  | 'review_due'
  | 'unknown'

export interface NoteFreshness {
  level: FreshnessLevel
  ageDays: number | null
  relativeLabel: string
  statusLabel: string
  reviewAfter: string | null
}

function localDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function relativeLabel(ageDays: number): string {
  if (ageDays === 0) {
    return '今日'
  }
  return `${ageDays}日前`
}

export function getNoteFreshness(
  note: Pick<NoteDocument, 'content' | 'modifiedAt'>,
  now = new Date()
): NoteFreshness {
  const reviewAfterValue = parseFrontmatter(note.content).attributes.review_after
  const reviewAfter =
    typeof reviewAfterValue === 'string' && REVIEW_DATE_PATTERN.test(reviewAfterValue)
      ? reviewAfterValue
      : null

  if (!Number.isFinite(note.modifiedAt) || note.modifiedAt <= 0) {
    return {
      level: 'unknown',
      ageDays: null,
      relativeLabel: '更新日時不明',
      statusLabel: '更新日時不明',
      reviewAfter
    }
  }

  const ageDays = Math.floor(Math.max(0, now.getTime() - note.modifiedAt) / DAY_MS)
  if (reviewAfter && localDate(now) > reviewAfter) {
    return {
      level: 'review_due',
      ageDays,
      relativeLabel: relativeLabel(ageDays),
      statusLabel: '再確認期限超過',
      reviewAfter
    }
  }
  if (ageDays >= 90) {
    return {
      level: 'stale',
      ageDays,
      relativeLabel: relativeLabel(ageDays),
      statusLabel: '古い可能性',
      reviewAfter
    }
  }
  if (ageDays >= 30) {
    return {
      level: 'aging',
      ageDays,
      relativeLabel: relativeLabel(ageDays),
      statusLabel: '要確認候補',
      reviewAfter
    }
  }
  return {
    level: 'current',
    ageDays,
    relativeLabel: relativeLabel(ageDays),
    statusLabel: '最近更新',
    reviewAfter
  }
}
