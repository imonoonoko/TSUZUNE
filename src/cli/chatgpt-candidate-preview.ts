import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  CHATGPT_PROFILE_IDS,
  extractChatGptCandidates,
  type ChatGptCandidateInputMessage,
  type ChatGptCandidateProfileSource,
  type ChatGptProfileId
} from '../core/chatgpt-candidates'

interface CandidatePreviewOptions {
  inputDirectory: string
  outputDirectory: string
  vaultRoot: string
  profiles: Array<{ profileId: ChatGptProfileId; path: string }>
}

interface C0Manifest {
  schemaVersion: 1
  provider: 'openai_chatgpt_export'
  contentDigest: string
  stats: {
    candidateEligibleMessageCount: number
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseArgument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value) throw new TypeError(`Missing required argument: ${name}`)
  return value
}

function parseRepeatedArguments(name: string): string[] {
  const values: string[] = []
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1])
      index += 1
    }
  }
  return values
}

function parseProfileArgument(value: string): { profileId: ChatGptProfileId; path: string } {
  const separatorIndex = value.indexOf('=')
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new TypeError(`Invalid --profile value: ${value}`)
  }
  const profileId = value.slice(0, separatorIndex)
  if (!CHATGPT_PROFILE_IDS.includes(profileId as ChatGptProfileId)) {
    throw new TypeError(`Unknown profile id: ${profileId}`)
  }
  return { profileId: profileId as ChatGptProfileId, path: value.slice(separatorIndex + 1) }
}

function parseC0Manifest(value: unknown): C0Manifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.provider !== 'openai_chatgpt_export') {
    throw new TypeError('C0-A manifest has an unsupported schema.')
  }
  if (typeof value.contentDigest !== 'string' || !isRecord(value.stats)) {
    throw new TypeError('C0-A manifest is missing its digest or stats.')
  }
  const eligible = value.stats.candidateEligibleMessageCount
  if (typeof eligible !== 'number' || !Number.isInteger(eligible) || eligible < 0) {
    throw new TypeError('C0-A manifest has invalid candidate stats.')
  }
  return {
    schemaVersion: 1,
    provider: 'openai_chatgpt_export',
    contentDigest: value.contentDigest,
    stats: { candidateEligibleMessageCount: eligible }
  }
}

function stringField(record: Record<string, unknown>, name: string): string {
  const value = record[name]
  if (typeof value !== 'string') throw new TypeError(`Message field ${name} must be a string.`)
  return value
}

function parseMessage(value: unknown): ChatGptCandidateInputMessage {
  if (!isRecord(value)) throw new TypeError('Message JSONL record must be an object.')
  const text = value.text
  const createdAt = value.createdAtUnixSeconds
  if (text !== null && typeof text !== 'string') throw new TypeError('Message text must be string or null.')
  if (createdAt !== null && typeof createdAt !== 'number') throw new TypeError('Message time must be number or null.')
  if (typeof value.privacyReviewRequired !== 'boolean' || typeof value.candidateEligible !== 'boolean') {
    throw new TypeError('Message privacy and eligibility fields must be boolean.')
  }
  return {
    conversationId: stringField(value, 'conversationId'),
    messageId: stringField(value, 'messageId'),
    recordId: stringField(value, 'recordId'),
    sha256: stringField(value, 'sha256'),
    sourceId: stringField(value, 'sourceId'),
    sourceSha256: stringField(value, 'sourceSha256'),
    sourceEntryPath: stringField(value, 'sourceEntryPath'),
    branch: stringField(value, 'branch'),
    role: stringField(value, 'role'),
    contentKind: stringField(value, 'contentKind'),
    text,
    createdAtUnixSeconds: createdAt,
    privacyReviewRequired: value.privacyReviewRequired,
    candidateEligible: value.candidateEligible
  }
}

function parseMessagesJsonl(content: string): ChatGptCandidateInputMessage[] {
  return content
    .split(/\r?\n/gu)
    .filter((line) => line.trim().length > 0)
    .map((line) => parseMessage(JSON.parse(line) as unknown))
}

function sha256Bytes(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

async function fileSha256(path: string): Promise<string> {
  return sha256Bytes(await readFile(path))
}

function isWithin(root: string, target: string): boolean {
  const pathFromRoot = relative(resolve(root), resolve(target))
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot))
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const temporaryPath = `${path}.tmp-${process.pid}`
  await writeFile(temporaryPath, content, 'utf8')
  await rename(temporaryPath, path)
}

function renderReport(preview: ReturnType<typeof extractChatGptCandidates>, sourceDigest: string): string {
  const normal = preview.candidates.filter((candidate) => !candidate.privacyReviewRequired).slice(0, 100)
  const privacy = preview.candidates.filter((candidate) => candidate.privacyReviewRequired).slice(0, 100)
  const renderCandidate = (candidate: (typeof preview.candidates)[number]): string =>
    `- \`${candidate.candidateId}\` ${candidate.claimText}  \n  labels: ${candidate.labels.join(', ')} / eligibility: ${candidate.eligibility} / sources: ${candidate.sourceReferences.length} / diff: ${candidate.profileDiff.status}`

  return [
    '# ChatGPT Export Candidate Preview',
    '',
    '> ローカル確認専用。TSUZUNE Vaultへの適用は行っていません。',
    '',
    `- C0-A digest: \`${sourceDigest}\``,
    `- Candidate digest: \`${preview.contentDigest}\``,
    `- Eligible messages: ${preview.stats.eligibleMessageCount}`,
    `- Candidates: ${preview.stats.candidateCount}`,
    `- Privacy review required: ${preview.stats.privacyReviewRequiredCandidateCount}`,
    `- Correction signals: ${preview.stats.correctionSignalCandidateCount}`,
    `- Auto-apply candidates: ${preview.stats.autoApplyCandidateCount}`,
    `- Human review: ${preview.stats.humanReviewCandidateCount}`,
    `- Profile exclusions: ${preview.stats.excludedFromProfileCandidateCount}`,
    '',
    '## 通常候補（先頭100件）',
    '',
    ...(normal.length > 0 ? normal.map(renderCandidate) : ['- なし']),
    '',
    '## Privacy確認対象（先頭100件）',
    '',
    ...(privacy.length > 0 ? privacy.map(renderCandidate) : ['- なし']),
    ''
  ].join('\n')
}

export async function runCandidatePreview(options: CandidatePreviewOptions): Promise<{
  contentDigest: string
  stats: ReturnType<typeof extractChatGptCandidates>['stats']
}> {
  const inputDirectory = resolve(options.inputDirectory)
  const outputDirectory = resolve(options.outputDirectory)
  const vaultRoot = resolve(options.vaultRoot)
  if (isWithin(inputDirectory, outputDirectory)) {
    throw new Error('Output directory must be outside the C0-A input directory.')
  }
  if (isWithin(vaultRoot, outputDirectory)) {
    throw new Error('Output directory must be outside the TSUZUNE Vault.')
  }

  const profileMap = new Map(options.profiles.map((profile) => [profile.profileId, profile]))
  if (profileMap.size !== CHATGPT_PROFILE_IDS.length || CHATGPT_PROFILE_IDS.some((id) => !profileMap.has(id))) {
    throw new Error('All five TSUZUNE profile notes are required for C1-A comparison.')
  }
  for (const profile of profileMap.values()) {
    if (!isWithin(vaultRoot, profile.path)) {
      throw new Error(`Profile note is outside the Vault: ${profile.profileId}`)
    }
  }

  const manifestPath = join(inputDirectory, 'manifest.json')
  const messagesPath = join(inputDirectory, 'messages.jsonl')
  const inputHashesBefore = {
    manifest: await fileSha256(manifestPath),
    messages: await fileSha256(messagesPath)
  }
  const manifest = parseC0Manifest(JSON.parse(await readFile(manifestPath, 'utf8')) as unknown)
  const messages = parseMessagesJsonl(await readFile(messagesPath, 'utf8'))
  const profiles: ChatGptCandidateProfileSource[] = []
  const profileHashesBefore = new Map<ChatGptProfileId, string>()
  for (const profileId of CHATGPT_PROFILE_IDS) {
    const profile = profileMap.get(profileId)
    if (!profile) throw new Error(`Missing profile: ${profileId}`)
    const content = await readFile(profile.path, 'utf8')
    const profileSha256 = sha256Bytes(content)
    profileHashesBefore.set(profileId, profileSha256)
    profiles.push({ profileId, content, sha256: profileSha256 })
  }

  const preview = extractChatGptCandidates(messages, profiles)
  if (preview.stats.eligibleMessageCount !== manifest.stats.candidateEligibleMessageCount) {
    throw new Error('Eligible message count does not match the C0-A manifest.')
  }

  const inputHashesAfter = {
    manifest: await fileSha256(manifestPath),
    messages: await fileSha256(messagesPath)
  }
  if (inputHashesBefore.manifest !== inputHashesAfter.manifest || inputHashesBefore.messages !== inputHashesAfter.messages) {
    throw new Error('C0-A input changed while building the candidate preview.')
  }
  const profileSources = []
  for (const profileId of CHATGPT_PROFILE_IDS) {
    const profile = profileMap.get(profileId)
    if (!profile) throw new Error(`Missing profile: ${profileId}`)
    const before = profileHashesBefore.get(profileId)
    const after = await fileSha256(profile.path)
    if (before !== after) throw new Error(`Profile changed while comparing: ${profileId}`)
    profileSources.push({ profileId, sha256: before, unchanged: true })
  }

  const profileDiff = preview.candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    status: candidate.profileDiff.status,
    targetProfileIds: candidate.profileDiff.targetProfileIds,
    matchingProfileIds: candidate.profileDiff.matchingProfileIds,
    privacyReviewRequired: candidate.privacyReviewRequired
  }))
  const summary = {
    schemaVersion: 1,
    provider: 'openai_chatgpt_export_candidate_preview',
    intendedStorage: 'local_staging_only',
    vaultWriteCount: 0,
    sourceUnchanged: true,
    profileSourcesUnchanged: true,
    source: {
      c0ContentDigest: manifest.contentDigest,
      manifestSha256: inputHashesBefore.manifest,
      messagesSha256: inputHashesBefore.messages
    },
    profileSources,
    outputs: {
      candidates: 'candidates.jsonl',
      profileDiff: 'profile-diff.json',
      report: 'candidate-preview.md'
    },
    ruleVersion: preview.ruleVersion,
    eligibilityVersion: preview.eligibilityVersion,
    contentDigest: preview.contentDigest,
    stats: preview.stats
  }

  await mkdir(outputDirectory, { recursive: true })
  await writeAtomic(
    join(outputDirectory, 'candidates.jsonl'),
    `${preview.candidates.map((candidate) => JSON.stringify(candidate)).join('\n')}\n`
  )
  await writeAtomic(join(outputDirectory, 'profile-diff.json'), `${JSON.stringify(profileDiff, null, 2)}\n`)
  await writeAtomic(join(outputDirectory, 'candidate-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  await writeAtomic(join(outputDirectory, 'candidate-preview.md'), renderReport(preview, manifest.contentDigest))
  return { contentDigest: preview.contentDigest, stats: preview.stats }
}

async function main(): Promise<void> {
  const result = await runCandidatePreview({
    inputDirectory: parseArgument('--input'),
    outputDirectory: parseArgument('--output'),
    vaultRoot: parseArgument('--vault-root'),
    profiles: parseRepeatedArguments('--profile').map(parseProfileArgument)
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

const isEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false
if (isEntryPoint) {
  await main()
}
