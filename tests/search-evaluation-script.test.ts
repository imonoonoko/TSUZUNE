import { describe, expect, it } from 'vitest'
// @ts-expect-error The benchmark is an executable JavaScript module tested at runtime.
import { selectSearch, summarizeCases } from '../scripts/run-search-evaluation.mjs'

describe('search evaluation summary', () => {
  it('fails the hard gate when any required source is missing', () => {
    const summary = summarizeCases([
      {
        latencyMs: 3,
        metrics: {
          recallAtK: 1,
          precisionAtK: 0.1,
          mrrAtK: 1,
          ndcgAtK: 1,
          requiredPass: true
        }
      },
      {
        latencyMs: 1,
        metrics: {
          recallAtK: 0,
          precisionAtK: 0,
          mrrAtK: 0,
          ndcgAtK: 0,
          requiredPass: false
        }
      }
    ])

    expect(summary).toEqual({
      caseCount: 2,
      hardGatePass: false,
      recallAtK: 0.5,
      precisionAtK: 0.05,
      mrrAtK: 0.5,
      ndcgAtK: 0.5,
      medianLatencyMs: 2
    })
  })

  it('hash-gates the token AND candidate outside the development corpus', () => {
    const baseline = () => []
    const tokenAnd = () => []
    const searchModule = { searchNotes: baseline, searchRendererNotes: tokenAnd }

    expect(selectSearch(searchModule, 'baseline', 'holdout')).toBe(baseline)
    expect(selectSearch(searchModule, 'token-and', 'dev')).toBe(tokenAnd)
    expect(selectSearch(searchModule, 'token-and', 'holdout', true)).toBe(tokenAnd)
    expect(selectSearch(searchModule, 'token-and', 'representative', true)).toBe(tokenAnd)
    expect(() => selectSearch(searchModule, 'token-and', 'holdout')).toThrow(
      'Candidate token-and requires an exact SHA-256 outside the development corpus'
    )
    expect(() => selectSearch(searchModule, 'token-and', 'representative')).toThrow(
      'Candidate token-and requires an exact SHA-256 outside the development corpus'
    )
  })

  it('hash-gates the ranked candidate outside the development corpus', () => {
    const ranked = () => []
    const searchModule = { searchRendererRanked: ranked }

    expect(selectSearch(searchModule, 'ranked', 'dev')).toBe(ranked)
    expect(selectSearch(searchModule, 'ranked', 'holdout', true)).toBe(ranked)
    expect(() => selectSearch(searchModule, 'ranked', 'holdout')).toThrow(
      'Candidate ranked requires an exact SHA-256 outside the development corpus'
    )
    expect(() => selectSearch(searchModule, 'ranked', 'representative')).toThrow(
      'Candidate ranked requires an exact SHA-256 outside the development corpus'
    )
  })
})
