import { describe, expect, it } from 'vitest'
import type { ChatGptCandidate, ChatGptCandidateInputMessage } from '../src/core/chatgpt-candidates'
import { buildChatGptCandidateQualitySample } from '../src/core/chatgpt-candidate-quality'

function message(id: string): ChatGptCandidateInputMessage {
  return {
    conversationId: 'conversation',
    messageId: id,
    recordId: `record-${id}`,
    sha256: `sha-${id}`,
    sourceId: 'source',
    sourceSha256: 'source-sha',
    sourceEntryPath: 'conversations.json',
    branch: 'current',
    role: 'user',
    contentKind: 'text',
    text: `claim-${id}`,
    createdAtUnixSeconds: 1,
    privacyReviewRequired: false,
    candidateEligible: true
  }
}

function candidate(id: string, overrides: Partial<ChatGptCandidate> = {}): ChatGptCandidate {
  return {
    candidateId: id,
    ruleVersion: 'rule',
    eligibilityVersion: 'eligibility',
    claimText: `claim-${id}`,
    claimSha256: `claim-sha-${id}`,
    labels: ['current_profile'],
    temporalStatus: 'current_candidate',
    privacyReviewRequired: false,
    correctionSignal: false,
    eligibility: 'auto_apply_candidate',
    eligibilityReasons: [],
    extractionRules: ['profile.explicit_self_statement'],
    sourceReferences: [{
      conversationId: 'conversation',
      messageId: id,
      messageRecordId: `record-${id}`,
      messageSha256: `sha-${id}`,
      sourceId: 'source',
      sourceSha256: 'source-sha',
      sourceEntryPath: 'conversations.json',
      createdAtUnixSeconds: 1
    }],
    profileDiff: { status: 'new_candidate', targetProfileIds: ['本人プロフィール'], matchingProfileIds: [] },
    ...overrides
  }
}

describe('ChatGPT candidate quality calibration', () => {
  it('creates a deterministic sample with label and safety strata', () => {
    const candidates = [
      candidate('a'),
      candidate('b', { labels: ['past_state'], temporalStatus: 'past', extractionRules: ['temporal.past_marker'] }),
      candidate('c', { privacyReviewRequired: true }),
      candidate('d', { labels: ['unconfirmed'], temporalStatus: 'unconfirmed', correctionSignal: true, extractionRules: ['confidence.correction_signal'] })
    ]
    const messages = ['a', 'b', 'c', 'd'].map(message)
    const left = buildChatGptCandidateQualitySample(candidates, messages, [], 2, 2, 2)
    const right = buildChatGptCandidateQualitySample([...candidates].reverse(), [...messages].reverse(), [], 2, 2, 2)

    expect(right.contentDigest).toBe(left.contentDigest)
    expect(left.audit.stratumCounts['safety:privacy']).toBe(1)
    expect(left.audit.stratumCounts['safety:past']).toBe(1)
    expect(left.audit.stratumCounts['safety:correction']).toBe(1)
    expect(left.audit.sourceTraceRate).toBe(1)
    expect(left.audit.contaminationCount).toBe(0)
    expect(left.audit.sensitiveAutoActiveCount).toBe(0)
  })

  it('fails the auto-apply rule gate below 90 percent precision', () => {
    const candidates = Array.from({ length: 10 }, (_, index) => candidate(`c${index}`))
    const messages = candidates.map(({ candidateId }) => message(candidateId))
    const reviews = candidates.map(({ candidateId }, index) => ({
      candidateId,
      verdict: index === 0 ? 'false_positive' as const : 'correct_candidate' as const,
      activeMemorySafe: index !== 0,
      reason: index === 0 ? 'episodic_only' : 'durable'
    }))
    const result = buildChatGptCandidateQualitySample(candidates, messages, reviews, 1, 1, 10)
    const profileRule = result.review.ruleResults.find(({ rule }) => rule === 'profile.explicit_self_statement')

    expect(profileRule?.precision).toBe(0.9)
    expect(profileRule?.passed).toBe(true)
    const failed = buildChatGptCandidateQualitySample(candidates, messages, [
      ...reviews.slice(0, 1),
      { ...reviews[1], verdict: 'false_positive' as const, activeMemorySafe: false },
      ...reviews.slice(2)
    ], 1, 1, 10)
    expect(failed.review.ruleResults.find(({ rule }) => rule === 'profile.explicit_self_statement')?.passed).toBe(false)
  })

  it('counts missing or ineligible source records as contamination', () => {
    const result = buildChatGptCandidateQualitySample([candidate('a'), candidate('missing')], [message('a')])
    expect(result.audit.sourceReferenceCount).toBe(2)
    expect(result.audit.tracedSourceReferenceCount).toBe(1)
    expect(result.audit.contaminationCount).toBe(1)
  })

  it('never samples review-only or excluded candidates as auto-apply rules', () => {
    const candidates = [
      candidate('auto'),
      candidate('review', { eligibility: 'human_review', eligibilityReasons: ['privacy.semantic_sensitive'] }),
      candidate('excluded', { eligibility: 'excluded_from_profile', eligibilityReasons: ['content.one_off_request'] })
    ]
    const result = buildChatGptCandidateQualitySample(candidates, candidates.map(({ candidateId }) => message(candidateId)), [], 1, 1, 10)

    const autoItems = result.sample.filter(({ autoApplyRuleCandidates }) => autoApplyRuleCandidates.length > 0)
    expect(autoItems.map(({ candidateId }) => candidateId)).toEqual(['auto'])
    expect(result.audit.sensitiveAutoActiveCount).toBe(0)
  })
})
