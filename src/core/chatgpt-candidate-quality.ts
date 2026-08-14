import { sha256, stableJson } from './chatgpt-export'
import type {
  ChatGptCandidate,
  ChatGptCandidateInputMessage,
  ChatGptCandidateLabel
} from './chatgpt-candidates'

export const CHATGPT_CANDIDATE_QUALITY_VERSION = 'c1c-2026-08-09.1'

const labels: ChatGptCandidateLabel[] = [
  'current_profile',
  'past_state',
  'decision',
  'project',
  'preference',
  'life_consideration',
  'unconfirmed'
]

const autoApplyRules = [
  'profile.explicit_self_statement',
  'preference.explicit_expression',
  'life.explicit_consideration'
] as const

export type ChatGptCandidateReviewVerdict = 'correct_candidate' | 'false_positive' | 'needs_context'

export interface ChatGptCandidateReview {
  candidateId: string
  verdict: ChatGptCandidateReviewVerdict
  activeMemorySafe: boolean
  reason: string
}

export interface ChatGptCandidateQualitySampleItem extends ChatGptCandidate {
  strata: string[]
  autoApplyRuleCandidates: string[]
}

export interface ChatGptCandidateQualityResult {
  schemaVersion: 1
  qualityVersion: string
  sample: ChatGptCandidateQualitySampleItem[]
  audit: {
    candidateCount: number
    sampleCount: number
    sourceReferenceCount: number
    tracedSourceReferenceCount: number
    sourceTraceRate: number
    contaminationCount: number
    sensitiveAutoActiveCount: number
    stratumCounts: Record<string, number>
  }
  review: {
    reviewedCount: number
    missingReviewCount: number
    ruleResults: Array<{
      rule: string
      reviewedCount: number
      activeMemorySafeCount: number
      precision: number | null
      passed: boolean
    }>
    passedRules: string[]
  }
  contentDigest: string
}

function sourceKey(source: {
  conversationId: string
  messageId: string
  messageRecordId: string
}): string {
  return `${source.conversationId}\0${source.messageId}\0${source.messageRecordId}`
}

function messageKey(message: ChatGptCandidateInputMessage): string {
  return `${message.conversationId}\0${message.messageId}\0${message.recordId}`
}

function eligibleForAutoRule(candidate: ChatGptCandidate, rule: string): boolean {
  return candidate.eligibility === 'auto_apply_candidate'
    && candidate.temporalStatus === 'current_candidate'
    && !candidate.privacyReviewRequired
    && !candidate.correctionSignal
    && !candidate.labels.includes('past_state')
    && !candidate.labels.includes('unconfirmed')
    && candidate.extractionRules.includes(rule)
}

function addStratum(
  selected: Map<string, ChatGptCandidateQualitySampleItem>,
  candidates: ChatGptCandidate[],
  stratum: string,
  limit: number
): void {
  for (const candidate of candidates.slice(0, limit)) {
    const existing = selected.get(candidate.candidateId)
    if (existing) {
      if (!existing.strata.includes(stratum)) existing.strata.push(stratum)
      continue
    }
    selected.set(candidate.candidateId, {
      ...candidate,
      strata: [stratum],
      autoApplyRuleCandidates: autoApplyRules.filter((rule) => eligibleForAutoRule(candidate, rule))
    })
  }
}

export function buildChatGptCandidateQualitySample(
  candidates: ChatGptCandidate[],
  messages: ChatGptCandidateInputMessage[],
  reviews: ChatGptCandidateReview[] = [],
  perLabel = 5,
  perSafetyStratum = 5,
  perAutoRule = 10
): ChatGptCandidateQualityResult {
  const ordered = [...candidates].sort((left, right) => left.candidateId.localeCompare(right.candidateId))
  const selected = new Map<string, ChatGptCandidateQualitySampleItem>()

  for (const label of labels) {
    addStratum(selected, ordered.filter((candidate) => candidate.labels.includes(label)), `label:${label}`, perLabel)
  }
  addStratum(selected, ordered.filter((candidate) => candidate.privacyReviewRequired), 'safety:privacy', perSafetyStratum)
  addStratum(selected, ordered.filter((candidate) => candidate.temporalStatus === 'past'), 'safety:past', perSafetyStratum)
  addStratum(selected, ordered.filter((candidate) => candidate.correctionSignal), 'safety:correction', perSafetyStratum)
  addStratum(selected, ordered.filter((candidate) => candidate.temporalStatus === 'unconfirmed'), 'safety:unconfirmed', perSafetyStratum)
  for (const rule of autoApplyRules) {
    addStratum(selected, ordered.filter((candidate) => eligibleForAutoRule(candidate, rule)), `auto-rule:${rule}`, perAutoRule)
  }

  const sample = [...selected.values()]
    .map((item) => ({ ...item, strata: [...item.strata].sort() }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId))
  const messageKeys = new Map(messages.map((message) => [messageKey(message), message]))
  let sourceReferenceCount = 0
  let tracedSourceReferenceCount = 0
  let contaminationCount = 0
  for (const candidate of candidates) {
    for (const source of candidate.sourceReferences) {
      sourceReferenceCount += 1
      const message = messageKeys.get(sourceKey(source))
      if (message) tracedSourceReferenceCount += 1
      if (!message || message.branch !== 'current' || message.role !== 'user' || message.contentKind !== 'text' || !message.candidateEligible) {
        contaminationCount += 1
      }
    }
  }

  const stratumCounts: Record<string, number> = {}
  for (const item of sample) {
    for (const stratum of item.strata) stratumCounts[stratum] = (stratumCounts[stratum] ?? 0) + 1
  }
  const reviewByCandidate = new Map(reviews.map((review) => [review.candidateId, review]))
  const ruleResults = autoApplyRules.map((rule) => {
    const ruleSample = sample.filter((item) => item.autoApplyRuleCandidates.includes(rule))
    const reviewed = ruleSample
      .map((item) => reviewByCandidate.get(item.candidateId))
      .filter((review): review is ChatGptCandidateReview => Boolean(review))
    const activeMemorySafeCount = reviewed.filter((review) => review.verdict === 'correct_candidate' && review.activeMemorySafe).length
    const precision = reviewed.length > 0 ? activeMemorySafeCount / reviewed.length : null
    return {
      rule,
      reviewedCount: reviewed.length,
      activeMemorySafeCount,
      precision,
      passed: reviewed.length >= perAutoRule && precision !== null && precision >= 0.9
    }
  })
  const reviewedCount = sample.filter((item) => reviewByCandidate.has(item.candidateId)).length
  const sensitiveAutoActiveCount = sample.filter((item) =>
    item.autoApplyRuleCandidates.length > 0 && (
      item.eligibility !== 'auto_apply_candidate'
      || item.eligibilityReasons.length > 0
      ||
      item.privacyReviewRequired
      || item.temporalStatus !== 'current_candidate'
      || item.correctionSignal
      || item.labels.includes('unconfirmed')
    )
  ).length
  const payload = {
    schemaVersion: 1 as const,
    qualityVersion: CHATGPT_CANDIDATE_QUALITY_VERSION,
    sample,
    audit: {
      candidateCount: candidates.length,
      sampleCount: sample.length,
      sourceReferenceCount,
      tracedSourceReferenceCount,
      sourceTraceRate: sourceReferenceCount === 0 ? 1 : tracedSourceReferenceCount / sourceReferenceCount,
      contaminationCount,
      sensitiveAutoActiveCount,
      stratumCounts
    },
    review: {
      reviewedCount,
      missingReviewCount: sample.length - reviewedCount,
      ruleResults,
      passedRules: ruleResults.filter(({ passed }) => passed).map(({ rule }) => rule)
    }
  }
  return { ...payload, contentDigest: sha256(stableJson(payload)) }
}
