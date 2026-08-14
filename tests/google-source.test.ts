import { describe, expect, it } from 'vitest'
import { planGoogleSourceImport } from '../src/core/google-source'
import type { NoteDocument } from '../src/shared/types'

function note(path: string, content: string): NoteDocument {
  return {
    path,
    name: path.split('/').at(-1) ?? path,
    content,
    modifiedAt: 0,
    size: content.length
  }
}

describe('Google source provenance', () => {
  it('skips a Google observation already stored in Markdown', () => {
    const contentHash = 'a'.repeat(64)
    const existing = note(
      '40_情報源/Google/calendar/event-a.md',
      [
        '---',
        'kind: source',
        'source_provider: google',
        'source_kind: calendar_event',
        'source_account_sub: account-1',
        'source_container_id: primary',
        'source_resource_id: event-a',
        'source_updated_at: 2026-07-31T10:00:00+09:00',
        'imported_at: 2026-07-31T12:00:00+09:00',
        `content_sha256: ${contentHash}`,
        '---',
        '# Calendar event'
      ].join('\n')
    )

    expect(
      planGoogleSourceImport([existing], [
        {
          accountSub: 'account-1',
          sourceKind: 'calendar_event',
          containerId: 'primary',
          resourceId: 'event-a',
          sourceUpdatedAt: '2026-07-31T10:00:00+09:00',
          importedAt: '2026-07-31T13:00:00+09:00',
          contentHash
        }
      ])
    ).toEqual([
      {
        action: 'skip',
        reason: 'same_observation',
        existingPath: existing.path
      }
    ])
  })

  it('creates a new observation when the same Google resource changed', () => {
    const existing = note(
      '40_情報源/Google/calendar/event-a-old.md',
      [
        '---',
        'kind: source',
        'source_provider: google',
        'source_kind: calendar_event',
        'source_account_sub: account-1',
        'source_container_id: primary',
        'source_resource_id: event-a',
        'imported_at: 2026-07-31T12:00:00+09:00',
        `content_sha256: ${'a'.repeat(64)}`,
        '---',
        '# Old calendar event'
      ].join('\n')
    )

    expect(
      planGoogleSourceImport([existing], [
        {
          accountSub: 'account-1',
          sourceKind: 'calendar_event',
          containerId: 'primary',
          resourceId: 'event-a',
          importedAt: '2026-07-31T13:00:00+09:00',
          contentHash: 'b'.repeat(64)
        }
      ])
    ).toEqual([
      {
        action: 'create',
        reason: 'changed_observation',
        existingPaths: [existing.path]
      }
    ])
  })

  it('rejects malformed Google provenance instead of guessing missing identity', () => {
    const malformed = note(
      '40_情報源/Google/calendar/malformed.md',
      [
        '---',
        'kind: source',
        'source_provider: google',
        'source_kind: calendar_event',
        'source_account_sub: account-1',
        'source_resource_id: event-a',
        'imported_at: 2026-07-31T12:00:00+09:00',
        'content_sha256: not-a-sha256',
        '---',
        '# Malformed source'
      ].join('\n')
    )

    expect(() => planGoogleSourceImport([malformed], [])).toThrow(
      /content_sha256/
    )
  })

  it('rejects malformed incoming provenance before planning an import', () => {
    expect(() =>
      planGoogleSourceImport([], [
        {
          accountSub: 'account-1',
          sourceKind: 'calendar_event',
          resourceId: 'event-a',
          importedAt: '2026-07-31T12:00:00+09:00',
          contentHash: 'not-a-sha256'
        }
      ])
    ).toThrow(/contentHash/)
  })
})
