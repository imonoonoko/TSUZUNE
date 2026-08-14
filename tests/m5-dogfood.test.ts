import { describe, expect, it } from 'vitest'
import {
  benchmarkM5Notes,
  evaluateM5Notes,
  parseM5Arguments
} from '../scripts/m5-dogfood'
import type { NoteDocument } from '../src/shared/types'

function note(path: string, content: string): NoteDocument {
  const fileName = path.split('/').at(-1) ?? path
  return {
    path,
    name: fileName.replace(/\.md$/i, ''),
    content,
    modifiedAt: Date.parse('2026-07-31T03:00:00+09:00'),
    size: Buffer.byteLength(content)
  }
}

const sourcePath = '40_情報源/検証根拠.md'
const tsuzuneSeed = '10_プロジェクト/TSUZUNE.md'
const onokoSeed = '10_プロジェクト/ONOKO.md'
const frozenSeed = '10_プロジェクト/宵灯工房.md'
const tsuzuneCurrent = '50_履歴/TSUZUNE-現在.md'
const tsuzuneFuture = '50_履歴/TSUZUNE-未来.md'
const onokoReviewDue = '50_履歴/ONOKO-要再確認.md'
const frozenReviewDue = '50_履歴/宵灯工房-凍結中.md'

const notes = [
  note(tsuzuneSeed, '# TSUZUNE'),
  note(onokoSeed, '# ONOKO'),
  note(frozenSeed, '# 宵灯工房'),
  note(sourcePath, '# 検証根拠'),
  note(
    tsuzuneCurrent,
    [
      '---',
      'kind: state',
      `subject: "[[${tsuzuneSeed.replace(/\.md$/, '')}]]"`,
      'status: active',
      'valid_from: 2026-07-30',
      'observed_at: 2026-07-30',
      `source: "[[${sourcePath.replace(/\.md$/, '')}]]"`,
      '---',
      '# 開発中'
    ].join('\n')
  ),
  note(
    tsuzuneFuture,
    [
      '---',
      'kind: state',
      `subject: "[[${tsuzuneSeed.replace(/\.md$/, '')}]]"`,
      'status: released',
      'valid_from: 2026-08-01',
      'observed_at: 2026-08-01',
      `source: "[[${sourcePath.replace(/\.md$/, '')}]]"`,
      '---',
      '# FUTURE_SENTINEL'
    ].join('\n')
  ),
  note(
    onokoReviewDue,
    [
      '---',
      'kind: state',
      `subject: "[[${onokoSeed.replace(/\.md$/, '')}]]"`,
      'status: active_name_unconfirmed',
      'valid_from: 2026-07-22',
      'observed_at: 2026-07-22',
      'review_after: 2026-07-30',
      `source: "[[${sourcePath.replace(/\.md$/, '')}]]"`,
      '---',
      '# 開発中と報告されたが名称は未確認'
    ].join('\n')
  ),
  note(
    frozenReviewDue,
    [
      '---',
      'kind: state',
      `subject: "[[${frozenSeed.replace(/\.md$/, '')}]]"`,
      'status: frozen',
      'valid_from: 2026-07-22',
      'observed_at: 2026-07-22',
      'review_after: 2026-07-30',
      `source: "[[${sourcePath.replace(/\.md$/, '')}]]"`,
      '---',
      '# 凍結中'
    ].join('\n')
  )
]

describe('M5 dogfood evaluator', () => {
  it('accepts npm-safe positional CLI arguments', () => {
    expect(
      parseM5Arguments([
        'C:\\Vault',
        '2026-07-31',
        '2026-07-22',
        'work/custom-m5'
      ])
    ).toMatchObject({
      vault: 'C:\\Vault',
      currentAsOf: '2026-07-31',
      pastAsOf: '2026-07-22'
    })
  })

  it('shows that temporal context blocks future leakage and exposes review/provenance evidence', () => {
    const result = evaluateM5Notes(notes, {
      seedPaths: [tsuzuneSeed, onokoSeed, frozenSeed],
      currentAsOf: '2026-07-31',
      pastAsOf: '2026-07-22',
      generatedAt: '2026-07-31T03:00:00+09:00'
    })

    expect(result.arms.temporal.past.futureLeakPaths).toEqual([])
    expect(result.arms.temporal.past.unscopedNormalBodyPaths).toEqual([])
    expect(
      result.arms.legacyOneHop.past.unscopedNormalBodyPaths
    ).toEqual(
      expect.arrayContaining([tsuzuneSeed, onokoSeed, frozenSeed])
    )
    expect(result.arms.legacyOneHop.past.futureLeakPaths).toContain(
      tsuzuneCurrent
    )
    expect(result.arms.temporal.current.reviewWarningPaths).toEqual([
      onokoReviewDue,
      frozenReviewDue
    ])
    expect(result.arms.temporal.current.resolvedProvenancePairs).toEqual(
      expect.arrayContaining([
        `${tsuzuneCurrent} -> ${sourcePath}`,
        `${onokoReviewDue} -> ${sourcePath}`,
        `${frozenReviewDue} -> ${sourcePath}`
      ])
    )
    expect(result.arms.temporal.current.includedPaths).not.toContain(
      tsuzuneFuture
    )
  })

  it('keeps conflicting states and refuses unknown knowledge-time evidence', () => {
    const result = evaluateM5Notes(notes, {
      seedPaths: [tsuzuneSeed, onokoSeed, frozenSeed],
      currentAsOf: '2026-07-31',
      pastAsOf: '2026-07-22',
      generatedAt: '2026-07-31T03:00:00+09:00'
    })

    expect(result.safetyProbes).toEqual({
      conflictPreserved: true,
      conflictWarningPresent: true,
      unknownObservedAtOmitted: true,
      unknownObservedAtWarningPresent: true
    })
  })

  it('compares seed-only and temporal context without exposing note bodies', () => {
    const result = benchmarkM5Notes(
      notes,
      {
        seedPaths: [tsuzuneSeed, onokoSeed, frozenSeed],
        currentAsOf: '2026-07-31',
        pastAsOf: '2026-07-22',
        generatedAt: '2026-07-31T03:00:00+09:00'
      },
      { warmupRuns: 0, measuredRuns: 2 }
    )

    expect(result.scope).toBe('context-build-and-analysis-only')
    expect(result.arms.withoutTsuzune.measuredRuns).toBe(2)
    expect(result.arms.withoutTsuzune.current.includedNoteCount).toBe(3)
    expect(result.arms.withTsuzune.current.includedNoteCount).toBeGreaterThan(3)
    expect(result.arms.withTsuzune.past.futureLeakCount).toBe(0)
    expect(result.arms.withTsuzune.current.resolvedProvenanceCount).toBe(3)
    expect(result.arms.withTsuzune.latencyMs.median).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(result)).not.toContain('FUTURE_SENTINEL')
  })

  it('rejects invalid benchmark run counts', () => {
    expect(() =>
      benchmarkM5Notes(
        notes,
        {
          seedPaths: [tsuzuneSeed, onokoSeed, frozenSeed],
          currentAsOf: '2026-07-31',
          pastAsOf: '2026-07-22',
          generatedAt: '2026-07-31T03:00:00+09:00'
        },
        { warmupRuns: 0, measuredRuns: 0 }
      )
    ).toThrow('measuredRuns must be a positive integer.')
  })
})
