export interface RetrievalShadowRequest {
  seedId: string
  query: string
  baselineCandidateIds: string[]
}

export interface RetrievalShadowEvent extends RetrievalShadowRequest {
  includedIds: string[]
}

export interface RetrievalShadowResult {
  shadowCandidateIds: string[]
  affinityById: Record<string, number>
}

export type RetrievalShadowOutcome = 'improved' | 'regressed' | 'unchanged'

export function compareRetrievalShadow(
  baselineCandidateIds: string[],
  shadowCandidateIds: string[],
  expectedPriorityIds: string[]
): RetrievalShadowOutcome {
  const bestRank = (candidateIds: string[]): number =>
    Math.min(...expectedPriorityIds.map((id) => candidateIds.indexOf(id)))
  const baselineRank = bestRank(baselineCandidateIds)
  const shadowRank = bestRank(shadowCandidateIds)

  if (shadowRank < baselineRank) {
    return 'improved'
  }
  if (shadowRank > baselineRank) {
    return 'regressed'
  }
  return 'unchanged'
}

export function rankRetrievalShadow(
  request: RetrievalShadowRequest,
  events: RetrievalShadowEvent[]
): RetrievalShadowResult {
  const affinityById = Object.fromEntries(
    request.baselineCandidateIds.map((id) => [id, 0])
  ) as Record<string, number>

  for (const event of events) {
    if (event.seedId !== request.seedId || event.query !== request.query) {
      continue
    }
    for (const id of event.includedIds) {
      if (id in affinityById) {
        affinityById[id] += 1
      }
    }
  }

  const shadowCandidateIds = request.baselineCandidateIds
    .map((id, index) => ({ id, index, affinity: affinityById[id] }))
    .sort((left, right) => right.affinity - left.affinity || left.index - right.index)
    .map(({ id }) => id)

  return { shadowCandidateIds, affinityById }
}
