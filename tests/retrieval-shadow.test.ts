import { describe, expect, it } from 'vitest'
import {
  compareRetrievalShadow,
  rankRetrievalShadow
} from '../src/core/retrieval-shadow'
import { retrievalShadowCorpus } from './fixtures/retrieval-shadow-corpus'

describe('retrieval shadow ranking', () => {
  const hooksFixture = {
    current: {
      seedId: 'TSUZUNE.md',
      query: 'Hooks',
      baselineCandidateIds: ['Context.md', 'Graph.md', 'BM25.md']
    },
    expectedPriorityIds: ['Graph.md']
  }
  const { current } = hooksFixture

  it('reorders only the existing candidate set from matching fixed included events', () => {
    const result = rankRetrievalShadow(current, [
      {
        seedId: 'TSUZUNE.md',
        query: 'Hooks',
        baselineCandidateIds: ['Context.md', 'Graph.md'],
        includedIds: ['TSUZUNE.md', 'Graph.md']
      },
      {
        seedId: 'TSUZUNE.md',
        query: 'Hooks',
        baselineCandidateIds: ['Context.md', 'Graph.md'],
        includedIds: ['TSUZUNE.md', 'Graph.md']
      }
    ])

    expect(result.shadowCandidateIds).toEqual([
      'Graph.md',
      'Context.md',
      'BM25.md'
    ])
    expect(result.affinityById).toEqual({
      'Context.md': 0,
      'Graph.md': 2,
      'BM25.md': 0
    })
    expect([...result.shadowCandidateIds].sort()).toEqual(
      [...current.baselineCandidateIds].sort()
    )
  })

  it('ignores unmatched events and IDs outside the current baseline', () => {
    const result = rankRetrievalShadow(current, [
      {
        seedId: 'Other.md',
        query: 'Hooks',
        baselineCandidateIds: ['Context.md'],
        includedIds: ['Context.md']
      },
      {
        seedId: 'TSUZUNE.md',
        query: 'BM25',
        baselineCandidateIds: ['Context.md'],
        includedIds: ['Context.md', 'Outside.md']
      }
    ])

    expect(result.shadowCandidateIds).toEqual(current.baselineCandidateIds)
    expect(result.affinityById).toEqual({
      'Context.md': 0,
      'Graph.md': 0,
      'BM25.md': 0
    })
  })

  it('compares shadow order with a separately fixed priority label', () => {
    const result = rankRetrievalShadow(current, [
      {
        seedId: 'TSUZUNE.md',
        query: 'Hooks',
        baselineCandidateIds: ['Context.md', 'Graph.md'],
        includedIds: ['TSUZUNE.md', 'Graph.md']
      }
    ])
    const firstExpectedRank = (ids: string[]): number =>
      Math.min(...hooksFixture.expectedPriorityIds.map((id) => ids.indexOf(id)))

    expect(firstExpectedRank(result.shadowCandidateIds)).toBeLessThan(
      firstExpectedRank(current.baselineCandidateIds)
    )
  })

  it('exposes a popularity trap instead of treating frequent inclusion as success', () => {
    const popularityTrap = {
      seedId: 'TSUZUNE.md',
      query: 'Hooks',
      baselineCandidateIds: ['Graph.md', 'Context.md']
    }
    const result = rankRetrievalShadow(popularityTrap, [
      ...Array.from({ length: 3 }, () => ({
        seedId: 'TSUZUNE.md',
        query: 'Hooks',
        baselineCandidateIds: ['Graph.md', 'Context.md'],
        includedIds: ['TSUZUNE.md', 'Context.md']
      }))
    ])

    expect(result.shadowCandidateIds).toEqual(['Context.md', 'Graph.md'])
    expect(result.shadowCandidateIds.indexOf('Graph.md')).toBeGreaterThan(
      popularityTrap.baselineCandidateIds.indexOf('Graph.md')
    )
  })

  it('can prioritize a separately labeled lexical bridge without expanding candidates', () => {
    const lexicalBridge = {
      seedId: 'TSUZUNE.md',
      query: 'Hooks',
      baselineCandidateIds: ['Context.md', 'Policy.md'],
      expectedPriorityIds: ['Policy.md']
    }
    const result = rankRetrievalShadow(lexicalBridge, [
      {
        seedId: 'TSUZUNE.md',
        query: 'Hooks',
        baselineCandidateIds: ['Context.md', 'Policy.md'],
        includedIds: ['TSUZUNE.md', 'Policy.md']
      }
    ])

    expect(result.shadowCandidateIds).toEqual(['Policy.md', 'Context.md'])
    expect([...result.shadowCandidateIds].sort()).toEqual(
      [...lexicalBridge.baselineCandidateIds].sort()
    )
    expect(result.shadowCandidateIds.indexOf('Policy.md')).toBeLessThan(
      lexicalBridge.baselineCandidateIds.indexOf('Policy.md')
    )
  })

  it('counts independent fixed cases without treating a regression as success', () => {
    const outcomes = retrievalShadowCorpus.map((fixture) =>
      compareRetrievalShadow(
        fixture.request.baselineCandidateIds,
        rankRetrievalShadow(fixture.request, fixture.events).shadowCandidateIds,
        fixture.expectedPriorityIds
      )
    )

    expect(outcomes).toEqual(['improved', 'regressed', 'unchanged'])
    expect(outcomes.reduce<Record<string, number>>((counts, outcome) => {
      counts[outcome] = (counts[outcome] ?? 0) + 1
      return counts
    }, {})).toEqual({
      improved: 1,
      regressed: 1,
      unchanged: 1
    })
  })
})
