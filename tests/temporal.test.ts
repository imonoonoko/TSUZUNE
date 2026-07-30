import { describe, expect, it } from 'vitest'
import {
  buildTemporalTimeline,
  evaluateTemporal,
  parseTemporalNote,
  type StateMetadata
} from '../src/core/temporal'
import type { NoteDocument } from '../src/shared/types'

function note(path: string, content: string): NoteDocument {
  const fileName = path.split('/').at(-1) ?? path
  return {
    path,
    name: fileName.replace(/\.md$/i, ''),
    content,
    modifiedAt: 0,
    size: Buffer.byteLength(content)
  }
}

describe('temporal note parsing', () => {
  it('leaves an ordinary Markdown note outside the temporal model', () => {
    const input = note(
      '10_プロジェクト/TSUZUNE.md',
      '# TSUZUNE\n\n[[開発方針]]'
    )

    expect(parseTemporalNote(input)).toEqual({
      path: '10_プロジェクト/TSUZUNE.md',
      kind: 'normal',
      metadata: null,
      warnings: []
    })
  })

  it('reads a valid State Note from optional frontmatter', () => {
    const input = note(
      '50_履歴/TSUZUNE-開発中.md',
      [
        '---',
        'kind: state',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'status: active',
        'valid_from: 2026-07-30',
        'verified_at: 2026-07-30',
        'review_after: 2026-10-30',
        'source: "[[40_情報源/会話-新しいソフト作成希望]]"',
        '---',
        '# TSUZUNEは開発中'
      ].join('\n')
    )

    expect(parseTemporalNote(input)).toEqual({
      path: '50_履歴/TSUZUNE-開発中.md',
      kind: 'state',
      metadata: {
        kind: 'state',
        subject: '[[10_プロジェクト/TSUZUNE]]',
        status: 'active',
        validFrom: '2026-07-30',
        verifiedAt: '2026-07-30',
        reviewAfter: '2026-10-30',
        source: '[[40_情報源/会話-新しいソフト作成希望]]'
      },
      warnings: []
    })
  })

  it('reads a valid Event Note independently from a State Note', () => {
    const input = note(
      '50_履歴/TSUZUNE-再開.md',
      [
        '---',
        'kind: event',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'event: status_changed',
        'occurred_at: 2026-07-30',
        'observed_at: 2026-07-30',
        'source: "[[40_情報源/会話-新しいソフト作成希望]]"',
        '---',
        '# TSUZUNEを再開'
      ].join('\n')
    )

    expect(parseTemporalNote(input)).toEqual({
      path: '50_履歴/TSUZUNE-再開.md',
      kind: 'event',
      metadata: {
        kind: 'event',
        subject: '[[10_プロジェクト/TSUZUNE]]',
        event: 'status_changed',
        occurredAt: '2026-07-30',
        observedAt: '2026-07-30',
        source: '[[40_情報源/会話-新しいソフト作成希望]]'
      },
      warnings: []
    })
  })

  it.each([
    {
      kind: 'state',
      missing: 'subject',
      fields: [
        'kind: state',
        'status: active',
        'valid_from: 2026-07-30'
      ]
    },
    {
      kind: 'state',
      missing: 'status',
      fields: [
        'kind: state',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'valid_from: 2026-07-30'
      ]
    },
    {
      kind: 'state',
      missing: 'valid_from',
      fields: [
        'kind: state',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'status: active'
      ]
    },
    {
      kind: 'event',
      missing: 'subject',
      fields: [
        'kind: event',
        'event: status_changed',
        'occurred_at: 2026-07-30'
      ]
    },
    {
      kind: 'event',
      missing: 'event',
      fields: [
        'kind: event',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'occurred_at: 2026-07-30'
      ]
    },
    {
      kind: 'event',
      missing: 'occurred_at',
      fields: [
        'kind: event',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'event: status_changed'
      ]
    }
  ])(
    'rejects a $kind note when required field $missing is missing',
    ({ kind, missing, fields }) => {
      const input = note(
        `50_履歴/${kind}-${missing}.md`,
        ['---', ...fields, '---', '# 本文'].join('\n')
      )

      expect(parseTemporalNote(input)).toMatchObject({
        kind,
        metadata: null,
        warnings: [
          {
            code: 'MISSING_FIELD',
            field: missing,
            message: `Required field "${missing}" is missing.`
          }
        ]
      })
    }
  )

  it('leaves an unknown kind outside the temporal model', () => {
    const input = note(
      'メモ.md',
      ['---', 'kind: recipe', 'status: draft', '---', '# 料理メモ'].join(
        '\n'
      )
    )

    expect(parseTemporalNote(input)).toEqual({
      path: 'メモ.md',
      kind: 'normal',
      metadata: null,
      warnings: []
    })
  })

  it('reports malformed frontmatter without hiding the note from normal use', () => {
    const content = [
      '---',
      'kind: state',
      'subject: "[[10_プロジェクト/TSUZUNE]]"',
      'status: active',
      '# closing delimiter is missing'
    ].join('\n')
    const input = note('壊れたメタデータ.md', content)

    expect(parseTemporalNote(input)).toEqual({
      path: '壊れたメタデータ.md',
      kind: 'normal',
      metadata: null,
      warnings: [
        {
          code: 'MALFORMED_FRONTMATTER',
          message: 'Frontmatter closing delimiter is missing.'
        }
      ]
    })
    expect(input.content).toBe(content)
  })

  it('rejects an impossible calendar date without changing the note', () => {
    const input = note(
      '50_履歴/不正な状態.md',
      [
        '---',
        'kind: state',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'status: active',
        'valid_from: 2026-02-30',
        '---',
        '# 本文は編集できる'
      ].join('\n')
    )

    expect(parseTemporalNote(input)).toEqual({
      path: '50_履歴/不正な状態.md',
      kind: 'state',
      metadata: null,
      warnings: [
        {
          code: 'INVALID_FIELD',
          field: 'valid_from',
          message:
            'Field "valid_from" must be YYYY-MM-DD or timezone-aware ISO 8601.'
        }
      ]
    })
    expect(input.content).toContain('# 本文は編集できる')
  })

  it('rejects a State Note whose end is not after its start', () => {
    const input = note(
      '50_履歴/終了区間が不正.md',
      [
        '---',
        'kind: state',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'status: active',
        'valid_from: 2026-07-30',
        'valid_to: 2026-07-30',
        '---',
        '# 空の期間'
      ].join('\n')
    )

    expect(parseTemporalNote(input)).toEqual({
      path: '50_履歴/終了区間が不正.md',
      kind: 'state',
      metadata: null,
      warnings: [
        {
          code: 'INVALID_INTERVAL',
          field: 'valid_to',
          message: 'Field "valid_to" must be later than "valid_from".'
        }
      ]
    })
  })

  it('requires subject to be one complete Wiki link', () => {
    const input = note(
      '50_履歴/対象リンクが不正.md',
      [
        '---',
        'kind: state',
        'subject: TSUZUNE',
        'status: active',
        'valid_from: 2026-07-30',
        '---',
        '# 対象が不明'
      ].join('\n')
    )

    expect(parseTemporalNote(input)).toMatchObject({
      kind: 'state',
      metadata: null,
      warnings: [
        {
          code: 'INVALID_FIELD',
          field: 'subject',
          message: 'Field "subject" must contain one complete Wiki link.'
        }
      ]
    })
  })

  it('ignores an invalid optional date and keeps the usable State metadata', () => {
    const input = note(
      '50_履歴/再確認日が不正.md',
      [
        '---',
        'kind: state',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'status: active',
        'valid_from: 2026-07-30',
        'review_after: someday',
        '---',
        '# 現在状態'
      ].join('\n')
    )

    expect(parseTemporalNote(input)).toMatchObject({
      kind: 'state',
      metadata: {
        kind: 'state',
        status: 'active',
        validFrom: '2026-07-30'
      },
      warnings: [
        {
          code: 'INVALID_FIELD',
          field: 'review_after',
          message:
            'Field "review_after" must be YYYY-MM-DD or timezone-aware ISO 8601.'
        }
      ]
    })
    expect(parseTemporalNote(input).metadata).not.toHaveProperty('reviewAfter')
  })

  it('ignores an invalid optional source link and reports it', () => {
    const input = note(
      '50_履歴/出典リンクが不正.md',
      [
        '---',
        'kind: event',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'event: status_changed',
        'occurred_at: 2026-07-30',
        'source: 会話メモ',
        '---',
        '# 再開'
      ].join('\n')
    )

    expect(parseTemporalNote(input)).toMatchObject({
      kind: 'event',
      metadata: {
        kind: 'event',
        event: 'status_changed',
        occurredAt: '2026-07-30'
      },
      warnings: [
        {
          code: 'INVALID_FIELD',
          field: 'source',
          message: 'Field "source" must contain one complete Wiki link.'
        }
      ]
    })
    expect(parseTemporalNote(input).metadata).not.toHaveProperty('source')
  })
})

describe('temporal evaluation', () => {
  it('includes valid_from and excludes valid_to when resolving a State Note', () => {
    const metadata: StateMetadata = {
      kind: 'state',
      subject: '[[10_プロジェクト/TSUZUNE]]',
      status: 'active',
      validFrom: '2026-07-30',
      validTo: '2026-08-02'
    }

    expect(evaluateTemporal(metadata, '2026-07-29')).toMatchObject({
      kind: 'state',
      phase: 'future'
    })
    expect(evaluateTemporal(metadata, '2026-07-30')).toMatchObject({
      kind: 'state',
      phase: 'current'
    })
    expect(evaluateTemporal(metadata, '2026-08-01')).toMatchObject({
      kind: 'state',
      phase: 'current'
    })
    expect(evaluateTemporal(metadata, '2026-08-02')).toMatchObject({
      kind: 'state',
      phase: 'historical'
    })
  })

  it('marks review due only after the review date while the state is current', () => {
    const metadata: StateMetadata = {
      kind: 'state',
      subject: '[[10_プロジェクト/TSUZUNE]]',
      status: 'active',
      validFrom: '2026-07-30',
      validTo: '2026-11-01',
      reviewAfter: '2026-10-30'
    }

    expect(evaluateTemporal(metadata, '2026-10-30')).toMatchObject({
      phase: 'current',
      reviewDue: false
    })
    expect(
      evaluateTemporal(metadata, '2026-10-30T23:59:59+09:00')
    ).toMatchObject({
      phase: 'current',
      reviewDue: false
    })
    expect(evaluateTemporal(metadata, '2026-10-31')).toMatchObject({
      phase: 'current',
      reviewDue: true
    })
    expect(evaluateTemporal(metadata, '2026-11-01')).toMatchObject({
      phase: 'historical',
      reviewDue: false
    })
  })

  it('includes a same-day timestamp when asOf is a calendar date', () => {
    const metadata = {
      kind: 'event' as const,
      subject: '[[10_プロジェクト/TSUZUNE]]',
      event: 'status_changed',
      occurredAt: '2026-07-30T23:30:00+09:00'
    }

    expect(evaluateTemporal(metadata, '2026-07-29')).toMatchObject({
      kind: 'event',
      phase: 'future'
    })
    expect(evaluateTemporal(metadata, '2026-07-30')).toMatchObject({
      kind: 'event',
      phase: 'occurred'
    })
  })

  it('applies supersedes only after the replacing note becomes effective', () => {
    const notes = [
      note(
        '50_履歴/TSUZUNE-旧状態.md',
        [
          '---',
          'kind: state',
          'subject: "[[10_プロジェクト/TSUZUNE]]"',
          'status: planning',
          'valid_from: 2026-07-01',
          '---',
          '# 計画中'
        ].join('\n')
      ),
      note(
        '50_履歴/TSUZUNE-新状態.md',
        [
          '---',
          'kind: state',
          'subject: "[[10_プロジェクト/TSUZUNE]]"',
          'status: active',
          'valid_from: 2026-07-30',
          'supersedes: "[[50_履歴/TSUZUNE-旧状態]]"',
          '---',
          '# 開発中'
        ].join('\n')
      )
    ]

    const before = buildTemporalTimeline(
      '[[10_プロジェクト/TSUZUNE]]',
      notes,
      '2026-07-29'
    )
    const after = buildTemporalTimeline(
      '[[10_プロジェクト/TSUZUNE]]',
      notes,
      '2026-07-30'
    )

    expect(
      before.find((entry) => entry.path.endsWith('旧状態.md'))?.supersededBy
    ).toEqual([])
    expect(
      after.find((entry) => entry.path.endsWith('旧状態.md'))?.supersededBy
    ).toEqual(['50_履歴/TSUZUNE-新状態.md'])
  })

  it('builds a subject timeline from multiple states and events without changing input notes', () => {
    const notes = [
      note(
        '50_履歴/TSUZUNE-計画中.md',
        [
          '---',
          'kind: state',
          'subject: "[[10_プロジェクト/TSUZUNE|TSUZUNE]]"',
          'status: planning',
          'valid_from: 2026-07-01',
          'valid_to: 2026-07-30',
          '---',
          '# 計画中'
        ].join('\n')
      ),
      note(
        '50_履歴/TSUZUNE-開発中.md',
        [
          '---',
          'kind: state',
          'subject: "[[10_プロジェクト/TSUZUNE]]"',
          'status: active',
          'valid_from: 2026-07-30',
          '---',
          '# 開発中'
        ].join('\n')
      ),
      note(
        '50_履歴/TSUZUNE-再開.md',
        [
          '---',
          'kind: event',
          'subject: "[[10_プロジェクト/TSUZUNE]]"',
          'event: status_changed',
          'occurred_at: 2026-07-30',
          '---',
          '# 再開'
        ].join('\n')
      ),
      note(
        '50_履歴/別プロジェクト.md',
        [
          '---',
          'kind: state',
          'subject: "[[10_プロジェクト/ONOKO]]"',
          'status: active',
          'valid_from: 2026-07-30',
          '---',
          '# 別の対象'
        ].join('\n')
      )
    ]
    const before = structuredClone(notes)

    const timeline = buildTemporalTimeline(
      '[[10_プロジェクト/TSUZUNE]]',
      notes,
      '2026-07-30'
    )

    expect(
      timeline.map(({ path, evaluation }) => ({ path, evaluation }))
    ).toEqual([
      {
        path: '50_履歴/TSUZUNE-計画中.md',
        evaluation: {
          kind: 'state',
          phase: 'historical',
          reviewDue: false
        }
      },
      {
        path: '50_履歴/TSUZUNE-開発中.md',
        evaluation: {
          kind: 'state',
          phase: 'current',
          reviewDue: false
        }
      },
      {
        path: '50_履歴/TSUZUNE-再開.md',
        evaluation: {
          kind: 'event',
          phase: 'occurred'
        }
      }
    ])
    expect(notes).toEqual(before)
  })

  it('warns when an effective supersedes link cannot be resolved', () => {
    const notes = [
      note(
        '50_履歴/TSUZUNE-新状態.md',
        [
          '---',
          'kind: state',
          'subject: "[[10_プロジェクト/TSUZUNE]]"',
          'status: active',
          'valid_from: 2026-07-30',
          'supersedes: "[[50_履歴/存在しない状態]]"',
          '---',
          '# 開発中'
        ].join('\n')
      )
    ]

    expect(
      buildTemporalTimeline(
        '[[10_プロジェクト/TSUZUNE]]',
        notes,
        '2026-07-30'
      )[0].warnings
    ).toEqual([
      {
        code: 'UNRESOLVED_LINK',
        field: 'supersedes',
        message:
          'Field "supersedes" could not resolve "[[50_履歴/存在しない状態]]".'
      }
    ])
  })
})
