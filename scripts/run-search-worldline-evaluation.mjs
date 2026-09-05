import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadSearchModule, selectSearch } from './run-search-evaluation.mjs'

function firstRank(rankedIds, candidates) {
  const ranks = candidates
    .map((candidate) => rankedIds.indexOf(candidate))
    .filter((rank) => rank >= 0)
  return ranks.length === 0 ? -1 : Math.min(...ranks)
}

function evaluateCase(item, rankedIds, k) {
  const topIds = rankedIds.slice(0, k)
  const expectedIds = item.expectedIds ?? []
  const targetRank = firstRank(topIds, expectedIds)
  const wrongBranchRank = firstRank(topIds, item.forbiddenIds ?? [])
  const obsoleteRank = firstRank(topIds, item.obsoleteIds ?? [])
  const beforeTarget = (rank) => rank >= 0 && (targetRank < 0 || rank < targetRank)

  return {
    id: item.id,
    query: item.query,
    topIds,
    expectUnknown: item.expectUnknown === true,
    targetFound: expectedIds.length > 0 && targetRank >= 0,
    wrongBranch: beforeTarget(wrongBranchRank),
    obsoleteResurrection: beforeTarget(obsoleteRank),
    honestUnknown: item.expectUnknown === true && topIds.length === 0,
    unnecessaryOpens: item.expectUnknown === true
      ? topIds.length
      : targetRank >= 0 ? targetRank : topIds.length
  }
}

export function summarizeWorldlineCases(cases) {
  const knownCases = cases.filter((item) => !item.expectUnknown)
  const unknownCases = cases.filter((item) => item.expectUnknown)
  const correctTargetCount = knownCases.filter((item) => item.targetFound).length
  const honestUnknownCount = unknownCases.filter((item) => item.honestUnknown).length

  return {
    caseCount: cases.length,
    knownCaseCount: knownCases.length,
    unknownCaseCount: unknownCases.length,
    correctTargetCount,
    correctTargetRate: knownCases.length === 0 ? 1 : correctTargetCount / knownCases.length,
    wrongBranchCount: cases.filter((item) => item.wrongBranch).length,
    obsoleteResurrectionCount: cases.filter((item) => item.obsoleteResurrection).length,
    honestUnknownCount,
    honestUnknownRate: unknownCases.length === 0 ? 1 : honestUnknownCount / unknownCases.length,
    unnecessaryOpenCount: cases.reduce((sum, item) => sum + item.unnecessaryOpens, 0)
  }
}

export async function evaluateWorldlineCorpus(corpus) {
  if (corpus.schemaVersion !== 1) throw new Error(`Unsupported schema version: ${corpus.schemaVersion}`)
  if (!Array.isArray(corpus.notes) || corpus.notes.length === 0) throw new Error('Corpus has no notes')
  if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) throw new Error('Corpus has no cases')

  const searchModule = await loadSearchModule()
  const candidate = corpus.candidate ?? 'ranked'
  const searchNotes = selectSearch(searchModule, candidate, 'dev')
  const k = corpus.k ?? 10
  const cases = corpus.cases.map((item) =>
    evaluateCase(item, searchNotes(corpus.notes, item.query).map((result) => result.path), k)
  )

  return {
    schemaVersion: 1,
    candidate,
    k,
    noteCount: corpus.notes.length,
    definitions: {
      correctTarget: 'An expected note appears within top-k.',
      wrongBranch: 'A forbidden note appears before the first expected note.',
      obsoleteResurrection: 'An obsolete note appears before the first expected note.',
      honestUnknown: 'An unknown case returns no notes.',
      unnecessaryOpens: 'Notes before the first expected note, or all returned notes when no answer is available.'
    },
    summary: summarizeWorldlineCases(cases),
    cases
  }
}

async function main() {
  const fixturePath = process.argv[2]
  if (!fixturePath) {
    throw new Error('Usage: node scripts/run-search-worldline-evaluation.mjs <corpus.json>')
  }
  const bytes = await readFile(resolve(fixturePath))
  const corpus = JSON.parse(bytes.toString('utf8'))
  const result = await evaluateWorldlineCorpus(corpus)
  process.stdout.write(`${JSON.stringify({
    ...result,
    corpusSha256: createHash('sha256').update(bytes).digest('hex')
  }, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
