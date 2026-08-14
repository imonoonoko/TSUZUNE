import { sha256 } from './chatgpt-export'

export const CHATGPT_CANDIDATE_RULE_VERSION = 'c1a-2026-08-09.1'
export const CHATGPT_CANDIDATE_ELIGIBILITY_VERSION = 'c1c-2026-08-09.1'

export const CHATGPT_PROFILE_IDS = [
  '本人プロフィール',
  '本人の関心とAI協働',
  '本人の健康と生活上の配慮',
  '本人の嗜好と日常',
  '本人の活動と技術環境'
] as const

export type ChatGptProfileId = (typeof CHATGPT_PROFILE_IDS)[number]
export type ChatGptCandidateLabel =
  | 'current_profile'
  | 'past_state'
  | 'decision'
  | 'project'
  | 'preference'
  | 'life_consideration'
  | 'unconfirmed'
export type ChatGptCandidateTemporalStatus =
  | 'current_candidate'
  | 'past'
  | 'unconfirmed'
export type ChatGptCandidateEligibility =
  | 'auto_apply_candidate'
  | 'human_review'
  | 'excluded_from_profile'
export type ChatGptProfileDiffStatus =
  | 'already_present'
  | 'new_candidate'
  | 'privacy_review_required'
  | 'unassigned'

export interface ChatGptCandidateInputMessage {
  conversationId: string
  messageId: string
  recordId: string
  sha256: string
  sourceId: string
  sourceSha256: string
  sourceEntryPath: string
  branch: string
  role: string
  contentKind: string
  text: string | null
  createdAtUnixSeconds: number | null
  privacyReviewRequired: boolean
  candidateEligible: boolean
}

export interface ChatGptCandidateProfileSource {
  profileId: ChatGptProfileId
  content: string
  sha256: string
}

export interface ChatGptCandidateSourceReference {
  conversationId: string
  messageId: string
  messageRecordId: string
  messageSha256: string
  sourceId: string
  sourceSha256: string
  sourceEntryPath: string
  createdAtUnixSeconds: number | null
}

export interface ChatGptCandidate {
  candidateId: string
  ruleVersion: string
  eligibilityVersion: string
  claimText: string
  claimSha256: string
  labels: ChatGptCandidateLabel[]
  temporalStatus: ChatGptCandidateTemporalStatus
  privacyReviewRequired: boolean
  correctionSignal: boolean
  eligibility: ChatGptCandidateEligibility
  eligibilityReasons: string[]
  extractionRules: string[]
  sourceReferences: ChatGptCandidateSourceReference[]
  profileDiff: {
    status: ChatGptProfileDiffStatus
    targetProfileIds: ChatGptProfileId[]
    matchingProfileIds: ChatGptProfileId[]
  }
}

export interface ChatGptCandidatePreview {
  schemaVersion: 1
  ruleVersion: string
  eligibilityVersion: string
  candidates: ChatGptCandidate[]
  stats: {
    inputMessageCount: number
    eligibleMessageCount: number
    candidateCount: number
    sourceReferenceCount: number
    privacyReviewRequiredCandidateCount: number
    correctionSignalCandidateCount: number
    autoApplyCandidateCount: number
    humanReviewCandidateCount: number
    excludedFromProfileCandidateCount: number
    labelCounts: Record<ChatGptCandidateLabel, number>
    profileDiffCounts: Record<ChatGptProfileDiffStatus, number>
  }
  contentDigest: string
}

interface ClassifiedSegment {
  labels: ChatGptCandidateLabel[]
  rules: string[]
  correctionSignal: boolean
  eligibility: ChatGptCandidateEligibility
  eligibilityReasons: string[]
  semanticPrivacyReviewRequired: boolean
}

interface PendingCandidate {
  claimText: string
  normalizedClaim: string
  privacyReviewRequired: boolean
  sourcePrivacyReviewRequired: boolean
  classified: ClassifiedSegment
  source: ChatGptCandidateSourceReference
}

const labelOrder: ChatGptCandidateLabel[] = [
  'current_profile',
  'past_state',
  'decision',
  'project',
  'preference',
  'life_consideration',
  'unconfirmed'
]

const profileDiffOrder: ChatGptProfileDiffStatus[] = [
  'already_present',
  'new_candidate',
  'privacy_review_required',
  'unassigned'
]

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizeClaim(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/\s+/gu, '')
}

function normalizeComparable(value: string): string {
  return normalizeClaim(value).replace(/[#>*_`\[\](){}「」『』]/gu, '')
}

function splitCandidateSegments(text: string): string[] {
  const segments: string[] = []
  let inFence = false
  let inAmbientContext = false

  for (const rawLine of text.replace(/\r\n?/gu, '\n').split('\n')) {
    const trimmed = rawLine.trim()
    if (trimmed.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (trimmed.startsWith('<in-app-browser-context')) {
      inAmbientContext = true
      continue
    }
    if (trimmed.startsWith('</in-app-browser-context')) {
      inAmbientContext = false
      continue
    }
    if (inFence || inAmbientContext || !trimmed) continue
    if (/^## Referenced ChatGPT conversation:/u.test(trimmed)) continue
    if (/^https?:\/\/\S+$/u.test(trimmed)) continue
    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length > 300) continue

    for (const piece of trimmed.match(/[^。！？!?]+[。！？!?]?/gu) ?? []) {
      const cleaned = piece
        .replace(/^\s*(?:[-*+>]\s+|#{1,6}\s+|\d+[.)]\s+)/u, '')
        .trim()
      if (cleaned.length < 4 || cleaned.length > 800) continue
      if (/^(?:import|export|const|let|function|class|interface|type)\b/u.test(cleaned)) continue
      segments.push(cleaned)
    }
  }
  return segments
}

function classifySegment(text: string): ClassifiedSegment | null {
  const labels = new Set<ChatGptCandidateLabel>()
  const rules = new Set<string>()
  const past = /以前|昔|当時|過去|かつて|だった|していた|やめた|終了した|凍結した/u.test(text)
  const uncertain = /[?？]|かも|かな|と思う|仮に|もし|だろう|でしょう|未確認|わからない|分からない|不明|検討|ないよね$/u.test(text)
  const correctionSignal = /^(?:いや|違う)|訂正|ではなく|やっぱり|正しくは|むしろ|方針変更/u.test(text)
  const self = /私|俺|僕|自分|本人|ユーザー/u.test(text)
  const profilePredicate = /です|だ|している|使っている|持っている|住んで|働いて|興味|関心|好み|好む|好き|嫌い/u.test(text)

  if (past) {
    labels.add('past_state')
    rules.add('temporal.past_marker')
  } else if (self && profilePredicate) {
    labels.add('current_profile')
    rules.add('profile.explicit_self_statement')
  }

  if (/決め|にする|採用|優先|開始|進めて|やって|実装|追加して|変更|撤廃|作って|作りたい/u.test(text)) {
    labels.add('decision')
    rules.add('decision.explicit_intent')
  }
  if (/TSUZUNE|ONOKO|Yoitomoshi|BloodLedger|Bit-TTT|BMR Shelf|Codex|ChatGPT|ソフト|アプリ|プロジェクト|開発|実装|機能|リポジトリ|PLAN\.md/u.test(text)) {
    labels.add('project')
    rules.add('project.named_or_development_term')
  }
  if (/好き|嫌い|好み|好む|気に入|望む|使いたくない|ほしい|欲しい|したい/u.test(text)) {
    labels.add('preference')
    rules.add('preference.explicit_expression')
  }
  if (/健康|体調|病気|貧血|睡眠|食事|生活|障害|配慮|疲れ|不安|仕事|収入|家族/u.test(text)) {
    labels.add('life_consideration')
    rules.add('life.explicit_consideration')
  }
  if (uncertain || correctionSignal) {
    labels.add('unconfirmed')
    rules.add(correctionSignal ? 'confidence.correction_signal' : 'confidence.uncertain_expression')
  }

  if (labels.size === 0) return null

  const eligibilityReasons = new Set<string>()
  const semanticPrivacyReviewRequired = /健康|体調|病気|症状|貧血|坐骨|睡眠|食事|障害|車椅子|移動制約|店舗に行けない|救急|意識を失|収入|給与|配当|請求|支払|借金|家族|夫婦|恋人|人間関係|人物と.{0,30}コミュニケーション|俺の事を(?:男|女)|違う国に住|(?:X|Google|YouTube)アカウント.{0,10}(?:です|だ)|https?:\/\/\S+.{0,20}(?:アカウント|プロフィール)/u.test(text)
  const codeLike = /<[A-Z][A-Za-z0-9]*(?:\s|>|\/)|<\/[A-Z][A-Za-z0-9]*>|=>|\b(?:const|let|function|import|export|return)\b|\.(?:tsx?|jsx?|rs|py|json|md)\b|(?:resource|path|file|src)\s*[:=]/u.test(text)
  const aiVoice = /私は(?:AI|人工知能|ChatGPT|Gemini|Claude)として|私たちAI|(?:AI|ChatGPT|Gemini|Claude)として.{0,40}(?:提案|回答|支援|できます)|ChatGPTちゃんが|あなたの(?:質問|問いかけ|プロジェクト|要望)に.{0,30}(?:答え|合わせて)|あなたの.{0,40}拾い上げる|こうしてあなたが|知性そのもの|誰かの役に立ちたいという意志|入力（?プロンプト）?|あなたと私の間にだけ|と彼女（?彼）?は言いました/u.test(text)
  const question = /[?？]/u.test(text)
  const oneOffRequest = /(?:検索|確認|調査|開始|再開|追加|変更|実装|作成|作って|見て|読んで|教えて|進めて|やって|お願い|書き出して|集めて)(?:して)?(?:ください|ほしい|くれる|[。！!])?$|集めてほしい内容|(?:ください|てほしい|情報が欲しい)[。！!]?$/u.test(text)
  const creativePrompt = /Prompt.*(?:考えて|ほしい)|描いてほしい|(?:画像|イラスト|絵|アニメキャラ|キャラクター|コスプレ).*(?:生成|作って|描いて|全身|衣装|ポーズ|構図|かわいい|似合う)|似合う.*(?:アニメキャラ|キャラクター|コスプレ)|(?:全身|衣装|ポーズ|構図|女性的|かわいすぎず|仕事できる感じ).*(?:画像|イラスト|キャラ|してほしい|感じ)?/u.test(text)
  const ephemeral = /今日|今は|今この|今の所|最近|さっき|先ほど|とりあえず|一旦|現在体調|食事した後|昼頃|今夜/u.test(text)
  const contextDependent = /^(?:でも、?)?私は、?それに|こうしてあなたが|このような感じ$|(?:私|僕|俺)(?:ひとり|一人)だと/u.test(text)

  if (codeLike) eligibilityReasons.add('content.code_or_resource')
  if (aiVoice) eligibilityReasons.add('content.pasted_ai_voice')
  if (question) eligibilityReasons.add('content.question')
  if (oneOffRequest) eligibilityReasons.add('content.one_off_request')
  if (creativePrompt) eligibilityReasons.add('content.creative_prompt')
  if (ephemeral) eligibilityReasons.add('temporal.ephemeral_state')
  if (contextDependent) eligibilityReasons.add('content.context_dependent')
  if (semanticPrivacyReviewRequired) eligibilityReasons.add('privacy.semantic_sensitive')

  const excluded = codeLike || aiVoice || question || oneOffRequest || creativePrompt
  const hasAutoRule = rules.has('profile.explicit_self_statement')
    || rules.has('preference.explicit_expression')
    || rules.has('life.explicit_consideration')
  const explicitFirstPersonProfile = labels.has('current_profile')
    && /(?:私は|私が|私の|俺は|俺が|俺の|僕は|僕が|僕の|自分は|自分が|自分の)/u.test(text)
  const durablePreference = labels.has('preference')
    && /好きな事|好きじゃない|嫌い|好み|好む|よくする|いつも|毎日|最終的|将来|したいんだよね|がいいんだよね|強く関心/u.test(text)
  const durableEvidence = explicitFirstPersonProfile || durablePreference
  if (hasAutoRule && !durableEvidence) eligibilityReasons.add('evidence.not_durable_enough')
  const reviewOnly = semanticPrivacyReviewRequired || ephemeral || contextDependent || past || uncertain || correctionSignal || !hasAutoRule || !durableEvidence
  const eligibility: ChatGptCandidateEligibility = excluded
    ? 'excluded_from_profile'
    : reviewOnly
      ? 'human_review'
      : 'auto_apply_candidate'

  return {
    labels: labelOrder.filter((label) => labels.has(label)),
    rules: [...rules].sort(compareText),
    correctionSignal,
    eligibility,
    eligibilityReasons: [...eligibilityReasons].sort(compareText),
    semanticPrivacyReviewRequired
  }
}

function targetProfiles(candidate: Pick<ChatGptCandidate, 'claimText' | 'labels'>): ChatGptProfileId[] {
  const targets = new Set<ChatGptProfileId>()
  if (candidate.labels.includes('current_profile')) targets.add('本人プロフィール')
  if (candidate.labels.includes('preference')) targets.add('本人の嗜好と日常')
  if (candidate.labels.includes('life_consideration')) targets.add('本人の健康と生活上の配慮')
  if (candidate.labels.includes('project')) {
    if (/AI|TSUZUNE|ONOKO|Codex|ChatGPT|BMR Shelf/u.test(candidate.claimText)) {
      targets.add('本人の関心とAI協働')
    } else {
      targets.add('本人の活動と技術環境')
    }
  }
  if (candidate.labels.includes('decision') && targets.size === 0) {
    targets.add('本人の活動と技術環境')
  }
  return CHATGPT_PROFILE_IDS.filter((profileId) => targets.has(profileId))
}

function profileContainsClaim(profileContent: string, claimText: string): boolean {
  const claim = normalizeComparable(claimText)
  if (!claim) return false
  const profile = normalizeComparable(profileContent)
  if (claim.length >= 12) return profile.includes(claim)
  return profileContent
    .split(/\r?\n/gu)
    .some((line) => normalizeComparable(line) === claim)
}

function sourceKey(source: ChatGptCandidateSourceReference): string {
  return `${source.conversationId}\0${source.messageId}\0${source.messageRecordId}`
}

function emptyLabelCounts(): Record<ChatGptCandidateLabel, number> {
  return Object.fromEntries(labelOrder.map((label) => [label, 0])) as Record<ChatGptCandidateLabel, number>
}

function emptyProfileDiffCounts(): Record<ChatGptProfileDiffStatus, number> {
  return Object.fromEntries(profileDiffOrder.map((status) => [status, 0])) as Record<ChatGptProfileDiffStatus, number>
}

export function extractChatGptCandidates(
  messages: ChatGptCandidateInputMessage[],
  profiles: ChatGptCandidateProfileSource[]
): ChatGptCandidatePreview {
  const profileById = new Map(profiles.map((profile) => [profile.profileId, profile]))
  const pending: PendingCandidate[] = []
  const eligibleMessages = messages.filter((message) =>
    message.candidateEligible &&
    message.branch === 'current' &&
    message.role === 'user' &&
    message.contentKind === 'text' &&
    typeof message.text === 'string'
  )

  for (const message of eligibleMessages) {
    for (const claimText of splitCandidateSegments(message.text ?? '')) {
      const classified = classifySegment(claimText)
      if (!classified) continue
      pending.push({
        claimText,
        normalizedClaim: normalizeClaim(claimText),
        privacyReviewRequired: message.privacyReviewRequired || classified.semanticPrivacyReviewRequired,
        sourcePrivacyReviewRequired: message.privacyReviewRequired,
        classified,
        source: {
          conversationId: message.conversationId,
          messageId: message.messageId,
          messageRecordId: message.recordId,
          messageSha256: message.sha256,
          sourceId: message.sourceId,
          sourceSha256: message.sourceSha256,
          sourceEntryPath: message.sourceEntryPath,
          createdAtUnixSeconds: message.createdAtUnixSeconds
        }
      })
    }
  }

  pending.sort((left, right) => compareText(sourceKey(left.source), sourceKey(right.source)))
  const grouped = new Map<string, PendingCandidate[]>()
  for (const item of pending) {
    const key = `${item.normalizedClaim}\0${item.sourcePrivacyReviewRequired ? 'review' : 'normal'}`
    const group = grouped.get(key) ?? []
    group.push(item)
    grouped.set(key, group)
  }

  const candidates: ChatGptCandidate[] = []
  for (const [groupKey, group] of grouped) {
    const first = group[0]
    const labels = labelOrder.filter((label) =>
      group.some((item) => item.classified.labels.includes(label))
    )
    const extractionRules = [...new Set(group.flatMap((item) => item.classified.rules))].sort(compareText)
    const sourceReferences = [...new Map(group.map((item) => [sourceKey(item.source), item.source])).values()]
      .sort((left, right) => compareText(sourceKey(left), sourceKey(right)))
    const privacyReviewRequired = group.some((item) => item.privacyReviewRequired)
    const eligibility = group.some((item) => item.classified.eligibility === 'excluded_from_profile')
      ? 'excluded_from_profile'
      : group.some((item) => item.classified.eligibility === 'human_review') || privacyReviewRequired
        ? 'human_review'
        : 'auto_apply_candidate'
    const eligibilityReasons = [...new Set(group.flatMap((item) => item.classified.eligibilityReasons))].sort(compareText)
    const temporalStatus: ChatGptCandidateTemporalStatus = labels.includes('past_state')
      ? 'past'
      : labels.includes('unconfirmed')
        ? 'unconfirmed'
        : 'current_candidate'
    const base = {
      claimText: first.claimText,
      labels
    }
    const targetProfileIds = targetProfiles(base)
    const matchingProfileIds = targetProfileIds.filter((profileId) => {
      const profile = profileById.get(profileId)
      return profile ? profileContainsClaim(profile.content, first.claimText) : false
    })
    const status: ChatGptProfileDiffStatus = privacyReviewRequired
      ? 'privacy_review_required'
      : matchingProfileIds.length > 0
        ? 'already_present'
        : targetProfileIds.length > 0
          ? 'new_candidate'
          : 'unassigned'

    candidates.push({
      candidateId: `c1a_${sha256({ ruleVersion: CHATGPT_CANDIDATE_RULE_VERSION, groupKey }).slice(0, 32)}`,
      ruleVersion: CHATGPT_CANDIDATE_RULE_VERSION,
      eligibilityVersion: CHATGPT_CANDIDATE_ELIGIBILITY_VERSION,
      claimText: first.claimText,
      claimSha256: sha256(first.normalizedClaim),
      labels,
      temporalStatus,
      privacyReviewRequired,
      correctionSignal: group.some((item) => item.classified.correctionSignal),
      eligibility,
      eligibilityReasons,
      extractionRules,
      sourceReferences,
      profileDiff: { status, targetProfileIds, matchingProfileIds }
    })
  }

  candidates.sort((left, right) => compareText(left.candidateId, right.candidateId))
  const labelCounts = emptyLabelCounts()
  const profileDiffCounts = emptyProfileDiffCounts()
  for (const candidate of candidates) {
    for (const label of candidate.labels) labelCounts[label] += 1
    profileDiffCounts[candidate.profileDiff.status] += 1
  }
  const stats = {
    inputMessageCount: messages.length,
    eligibleMessageCount: eligibleMessages.length,
    candidateCount: candidates.length,
    sourceReferenceCount: candidates.reduce((total, candidate) => total + candidate.sourceReferences.length, 0),
    privacyReviewRequiredCandidateCount: candidates.filter((candidate) => candidate.privacyReviewRequired).length,
    correctionSignalCandidateCount: candidates.filter((candidate) => candidate.correctionSignal).length,
    autoApplyCandidateCount: candidates.filter((candidate) => candidate.eligibility === 'auto_apply_candidate').length,
    humanReviewCandidateCount: candidates.filter((candidate) => candidate.eligibility === 'human_review').length,
    excludedFromProfileCandidateCount: candidates.filter((candidate) => candidate.eligibility === 'excluded_from_profile').length,
    labelCounts,
    profileDiffCounts
  }
  const contentDigest = sha256({
    schemaVersion: 1,
    ruleVersion: CHATGPT_CANDIDATE_RULE_VERSION,
    eligibilityVersion: CHATGPT_CANDIDATE_ELIGIBILITY_VERSION,
    profileSources: profiles
      .map(({ profileId, sha256: profileSha256 }) => ({ profileId, sha256: profileSha256 }))
      .sort((left, right) => compareText(left.profileId, right.profileId)),
    candidates,
    stats
  })

  return {
    schemaVersion: 1,
    ruleVersion: CHATGPT_CANDIDATE_RULE_VERSION,
    eligibilityVersion: CHATGPT_CANDIDATE_ELIGIBILITY_VERSION,
    candidates,
    stats,
    contentDigest
  }
}
