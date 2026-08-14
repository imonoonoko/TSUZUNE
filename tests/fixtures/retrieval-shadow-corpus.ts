import type { RetrievalShadowEvent, RetrievalShadowRequest } from '../../src/core/retrieval-shadow'

export interface RetrievalShadowCorpusCase {
  name: string
  request: RetrievalShadowRequest
  events: RetrievalShadowEvent[]
  expectedPriorityIds: string[]
}

export const retrievalShadowCorpus: RetrievalShadowCorpusCase[] = [
  {
    name: 'hooks bridge improves a separately labeled graph source',
    request: {
      seedId: 'TSUZUNE.md',
      query: 'Hooks',
      baselineCandidateIds: ['Context.md', 'Graph.md', 'BM25.md']
    },
    events: [
      {
        seedId: 'TSUZUNE.md',
        query: 'Hooks',
        baselineCandidateIds: ['Context.md', 'Graph.md'],
        includedIds: ['TSUZUNE.md', 'Graph.md']
      }
    ],
    expectedPriorityIds: ['Graph.md']
  },
  {
    name: 'popular context source regresses an already-first graph source',
    request: {
      seedId: 'TSUZUNE.md',
      query: 'Hooks',
      baselineCandidateIds: ['Graph.md', 'Context.md']
    },
    events: Array.from({ length: 3 }, () => ({
      seedId: 'TSUZUNE.md',
      query: 'Hooks',
      baselineCandidateIds: ['Graph.md', 'Context.md'],
      includedIds: ['TSUZUNE.md', 'Context.md']
    })),
    expectedPriorityIds: ['Graph.md']
  },
  {
    name: 'unrelated query remains unchanged',
    request: {
      seedId: 'Release.md',
      query: 'Installer',
      baselineCandidateIds: ['Policy.md', 'Checklist.md']
    },
    events: [
      {
        seedId: 'Release.md',
        query: 'Packaging',
        baselineCandidateIds: ['Policy.md', 'Checklist.md'],
        includedIds: ['Release.md', 'Checklist.md']
      }
    ],
    expectedPriorityIds: ['Policy.md']
  }
]
