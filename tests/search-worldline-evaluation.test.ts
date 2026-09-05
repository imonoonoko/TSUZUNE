import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// @ts-expect-error The evaluation is an executable JavaScript module tested at runtime.
import { evaluateWorldlineCorpus, summarizeWorldlineCases } from '../scripts/run-search-worldline-evaluation.mjs'

describe('Worldline-style search evaluation', () => {
  it('keeps target, wrong-branch, obsolete, unknown, and open-cost metrics separate', () => {
    const summary = summarizeWorldlineCases([
      { expectUnknown: false, targetFound: true, wrongBranch: false, obsoleteResurrection: false, honestUnknown: false, unnecessaryOpens: 0 },
      { expectUnknown: false, targetFound: false, wrongBranch: true, obsoleteResurrection: false, honestUnknown: false, unnecessaryOpens: 2 },
      { expectUnknown: false, targetFound: false, wrongBranch: false, obsoleteResurrection: true, honestUnknown: false, unnecessaryOpens: 1 },
      { expectUnknown: true, targetFound: false, wrongBranch: false, obsoleteResurrection: false, honestUnknown: true, unnecessaryOpens: 0 }
    ])

    expect(summary).toEqual({
      caseCount: 4,
      knownCaseCount: 3,
      unknownCaseCount: 1,
      correctTargetCount: 1,
      correctTargetRate: 1 / 3,
      wrongBranchCount: 1,
      obsoleteResurrectionCount: 1,
      honestUnknownCount: 1,
      honestUnknownRate: 1,
      unnecessaryOpenCount: 3
    })
  })

  it('runs the fixed counterexample corpus against the real ranked search', async () => {
    const fixturePath = fileURLToPath(new URL('./fixtures/search-worldline.json', import.meta.url))
    const corpus = JSON.parse(await readFile(fixturePath, 'utf8'))
    const result = await evaluateWorldlineCorpus(corpus)

    expect(result.summary).toEqual({
      caseCount: 5,
      knownCaseCount: 4,
      unknownCaseCount: 1,
      correctTargetCount: 3,
      correctTargetRate: 0.75,
      wrongBranchCount: 1,
      obsoleteResurrectionCount: 1,
      honestUnknownCount: 1,
      honestUnknownRate: 1,
      unnecessaryOpenCount: 3
    })
    expect(result.cases.map((item: { id: string }) => item.id)).toEqual(corpus.cases.map((item: { id: string }) => item.id))
  })
})
