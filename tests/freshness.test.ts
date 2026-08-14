import { describe, expect, it } from 'vitest'
import { getNoteFreshness } from '../src/core/freshness'

const now = new Date(2026, 7, 9, 12, 0)

describe('note freshness', () => {
  it.each([
    [0, 'current', '最近更新'],
    [30, 'aging', '要確認候補'],
    [90, 'stale', '古い可能性']
  ] as const)('classifies a note updated %i days ago', (days, level, label) => {
    const freshness = getNoteFreshness(
      { content: '', modifiedAt: now.getTime() - days * 86_400_000 },
      now
    )

    expect(freshness).toMatchObject({ level, statusLabel: label, ageDays: days })
  })

  it('gives an overdue review_after priority over modification age', () => {
    const freshness = getNoteFreshness(
      {
        content: '---\nreview_after: 2026-08-08\n---\n本文',
        modifiedAt: now.getTime()
      },
      now
    )

    expect(freshness).toMatchObject({
      level: 'review_due',
      statusLabel: '再確認期限超過',
      reviewAfter: '2026-08-08'
    })
  })

  it('does not call a note false merely because it is old', () => {
    const freshness = getNoteFreshness(
      { content: '', modifiedAt: now.getTime() - 365 * 86_400_000 },
      now
    )

    expect(freshness.statusLabel).toBe('古い可能性')
  })
})
