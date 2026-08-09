import { describe, expect, it } from 'vitest'
import {
  CHATGPT_PROFILE_IDS,
  extractChatGptCandidates,
  type ChatGptCandidateInputMessage,
  type ChatGptCandidateProfileSource
} from '../src/core/chatgpt-candidates'

function message(
  text: string,
  overrides: Partial<ChatGptCandidateInputMessage> = {}
): ChatGptCandidateInputMessage {
  return {
    conversationId: 'conversation-1',
    messageId: 'message-1',
    recordId: 'record-1',
    sha256: 'message-sha',
    sourceId: 'source-1',
    sourceSha256: 'source-sha',
    sourceEntryPath: 'conversations-000.json',
    branch: 'current',
    role: 'user',
    contentKind: 'text',
    text,
    createdAtUnixSeconds: 1_700_000_000.25,
    privacyReviewRequired: false,
    candidateEligible: true,
    ...overrides
  }
}

function profiles(overrides: Partial<Record<(typeof CHATGPT_PROFILE_IDS)[number], string>> = {}): ChatGptCandidateProfileSource[] {
  return CHATGPT_PROFILE_IDS.map((profileId) => ({
    profileId,
    content: overrides[profileId] ?? `# ${profileId}`,
    sha256: `sha-${profileId}`
  }))
}

describe('ChatGPT candidate extraction', () => {
  it('extracts multi-label candidates only from eligible current user text', () => {
    const preview = extractChatGptCandidates([
      message('私は個人用Windowsソフトを開発している。'),
      message('旧分岐のTSUZUNE開発。', { messageId: 'old', branch: 'old' }),
      message('assistantがTSUZUNEを開発する。', { messageId: 'assistant', role: 'assistant' }),
      message('候補外のTSUZUNE。', { messageId: 'blocked', candidateEligible: false })
    ], profiles())

    expect(preview.stats.eligibleMessageCount).toBe(1)
    expect(preview.candidates).toHaveLength(1)
    expect(preview.candidates[0].labels).toEqual(['current_profile', 'project'])
    expect(preview.candidates[0].temporalStatus).toBe('current_candidate')
  })

  it('aggregates identical claims while preserving every source reference', () => {
    const preview = extractChatGptCandidates([
      message('TSUZUNEを最優先で開発する。', { messageId: 'm1', recordId: 'r1' }),
      message(' TSUZUNEを最優先で開発する。 ', { messageId: 'm2', recordId: 'r2' })
    ], profiles())

    expect(preview.candidates).toHaveLength(1)
    expect(preview.candidates[0].sourceReferences.map(({ messageId }) => messageId)).toEqual(['m1', 'm2'])
    expect(preview.candidates[0].labels).toEqual(['decision', 'project'])
  })

  it('keeps past, correction, and uncertain claims away from current status', () => {
    const preview = extractChatGptCandidates([
      message('以前はONOKOを凍結した。', { messageId: 'past' }),
      message('やっぱり同期は後回しにする。', { messageId: 'correction' }),
      message('この機能が必要かもしれない。', { messageId: 'uncertain' })
    ], profiles())

    const past = preview.candidates.find(({ claimText }) => claimText.includes('以前'))
    const correction = preview.candidates.find(({ claimText }) => claimText.includes('やっぱり'))
    const uncertain = preview.candidates.find(({ claimText }) => claimText.includes('かもしれない'))
    expect(past?.temporalStatus).toBe('past')
    expect(correction?.correctionSignal).toBe(true)
    expect(correction?.temporalStatus).toBe('unconfirmed')
    expect(uncertain?.temporalStatus).toBe('unconfirmed')
  })

  it('separates privacy review and reports profile differences without applying them', () => {
    const existing = '私は個人用Windowsソフトを開発している。'
    const preview = extractChatGptCandidates([
      message(existing, { messageId: 'existing' }),
      message('私はTSUZUNEをAIと連携させたい。', {
        messageId: 'private',
        privacyReviewRequired: true
      })
    ], profiles({ 本人プロフィール: existing }))

    const existingCandidate = preview.candidates.find(({ claimText }) => claimText === existing)
    const privateCandidate = preview.candidates.find(({ privacyReviewRequired }) => privacyReviewRequired)
    expect(existingCandidate?.profileDiff.status).toBe('already_present')
    expect(privateCandidate?.profileDiff.status).toBe('privacy_review_required')
    expect(preview.stats.privacyReviewRequiredCandidateCount).toBe(1)
  })

  it('produces the same IDs and digest for the same logical input order', () => {
    const first = message('TSUZUNEを最優先で開発する。', { messageId: 'a', recordId: 'a' })
    const second = message('私は個人用Windowsソフトを開発している。', { messageId: 'b', recordId: 'b' })
    const left = extractChatGptCandidates([first, second], profiles())
    const right = extractChatGptCandidates([second, first], profiles())

    expect(right.contentDigest).toBe(left.contentDigest)
    expect(right.candidates.map(({ candidateId }) => candidateId)).toEqual(
      left.candidates.map(({ candidateId }) => candidateId)
    )
  })

  it('excludes pasted AI voice, code, questions, one-off requests, and creative prompts from profile auto-apply', () => {
    const preview = extractChatGptCandidates([
      message('私はAIとして、あなたのプロジェクトに合わせて提案できます。', { messageId: 'ai' }),
      message('<Button onClick={() => startApp()}>開始</Button>', { messageId: 'jsx' }),
      message('TSUZUNEでONOKOを検索して。', { messageId: 'request' }),
      message('Googleログインでもっと出来る事は？', { messageId: 'question' }),
      message('アニメキャラの全身画像をかわいい衣装で作りたい。', { messageId: 'creative' }),
      message('スーパーで買える情報が欲しい！', { messageId: 'information-request' })
    ], profiles())

    expect(preview.candidates).not.toHaveLength(0)
    expect(preview.candidates.every(({ eligibility }) => eligibility === 'excluded_from_profile')).toBe(true)
    expect(preview.stats.autoApplyCandidateCount).toBe(0)
  })

  it('routes semantic health, access, finance, and relationship claims to privacy review', () => {
    const preview = extractChatGptCandidates([
      message('私は貧血があり車椅子で店舗に行けない。', { messageId: 'health' }),
      message('私の収入と家族関係について整理したい。', { messageId: 'finance' })
    ], profiles())

    expect(preview.candidates).toHaveLength(2)
    expect(preview.candidates.every(({ privacyReviewRequired }) => privacyReviewRequired)).toBe(true)
    expect(preview.candidates.every(({ eligibility }) => eligibility === 'human_review')).toBe(true)
  })

  it('keeps explicit durable self preferences eligible while ephemeral state stays review-only', () => {
    const preview = extractChatGptCandidates([
      message('私は個人用Windowsソフトではローカル保存を好む。', { messageId: 'durable' }),
      message('今日は疲れているので今は開発したくない。', { messageId: 'ephemeral' })
    ], profiles())

    const durable = preview.candidates.find(({ claimText }) => claimText.includes('ローカル保存'))
    const ephemeral = preview.candidates.find(({ claimText }) => claimText.includes('今日は'))
    expect(durable?.eligibility).toBe('auto_apply_candidate')
    expect(ephemeral?.eligibility).toBe('human_review')
    expect(ephemeral?.eligibilityReasons).toContain('temporal.ephemeral_state')
  })
})
