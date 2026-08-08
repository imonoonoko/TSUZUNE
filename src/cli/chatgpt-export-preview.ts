import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { normalizeChatGptExport, type NormalizedChatGptMessage } from '../core/chatgpt-export'

interface SelectedSourceFile {
  selectedPath: string
  selectedSha256Before: string
  selectedSha256After: string
  sourceKind: 'zip' | 'json'
}

interface StagedConversationEntry {
  selectedPath: string
  selectedSha256: string
  entryPath: string
  entrySha256: string
  stagedPath: string
}

export interface IndexedAttachmentEntry {
  selectedPath: string
  selectedSha256: string
  entryPath: string
  entryBaseName: string
  entryIndex: number
  entrySize: number
  entrySha256: string
}

interface PreviewSourceMap {
  schemaVersion: 1
  selectedFiles: SelectedSourceFile[]
  conversationEntries: StagedConversationEntry[]
  attachmentEntries: IndexedAttachmentEntry[]
}

interface PreviewMessage extends NormalizedChatGptMessage {
  sourceId: string
  sourceSha256: string
  sourceEntryPath: string
}

export type AttachmentReferenceStatus =
  | 'resolved'
  | 'missing'
  | 'ambiguous'
  | 'unsupported'

export interface AttachmentReferenceResolution {
  reference: string
  expectedEntryBaseName: string | null
  status: AttachmentReferenceStatus
  occurrenceCount: number
  matchedEntryIds: string[]
}

export interface ManifestAttachmentEntry {
  entryId: string
  selectedSha256: string
  entryPath: string
  entryBaseName: string
  entryIndex: number
  entrySize: number
  entrySha256: string
}

export interface AttachmentIndexResult {
  attachmentEntries: ManifestAttachmentEntry[]
  attachmentReferences: AttachmentReferenceResolution[]
  resolvedAttachmentEntryIds: string[]
  unreferencedAttachmentEntryIds: string[]
  warnings: Array<{
    code: string
    path: 'attachmentReferences'
    message: string
  }>
  stats: {
    attachmentEntryCount: number
    attachmentReferenceCount: number
    resolvedAttachmentReferenceCount: number
    missingAttachmentReferenceCount: number
    ambiguousAttachmentReferenceCount: number
    unsupportedAttachmentReferenceCount: number
    resolvedAttachmentEntryCount: number
    unreferencedAttachmentEntryCount: number
  }
}

function parseArgument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value) throw new TypeError(`${name} is required.`)
  return resolve(value)
}

function sha256Bytes(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    )
  }
  return value
}

function stableDigest(value: unknown): string {
  return sha256Bytes(JSON.stringify(canonicalize(value)))
}

function duplicateIds(values: string[]): string[] {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

function isSelectedSourceFile(value: unknown): value is SelectedSourceFile {
  if (!isRecord(value)) return false
  return (
    typeof value.selectedPath === 'string' &&
    isSha256(value.selectedSha256Before) &&
    isSha256(value.selectedSha256After) &&
    (value.sourceKind === 'zip' || value.sourceKind === 'json')
  )
}

function isConversationEntry(value: unknown): value is StagedConversationEntry {
  if (!isRecord(value)) return false
  return (
    typeof value.selectedPath === 'string' &&
    isSha256(value.selectedSha256) &&
    typeof value.entryPath === 'string' &&
    isSha256(value.entrySha256) &&
    typeof value.stagedPath === 'string'
  )
}

function isAttachmentEntry(value: unknown): value is IndexedAttachmentEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.selectedPath === 'string' &&
    isSha256(entry.selectedSha256) &&
    typeof entry.entryPath === 'string' &&
    typeof entry.entryBaseName === 'string' &&
    Number.isInteger(entry.entryIndex) &&
    typeof entry.entryIndex === 'number' &&
    entry.entryIndex >= 0 &&
    Number.isSafeInteger(entry.entrySize) &&
    typeof entry.entrySize === 'number' &&
    entry.entrySize >= 0 &&
    isSha256(entry.entrySha256)
  )
}

function parseSourceMap(value: unknown): PreviewSourceMap {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new TypeError('Source map must use schemaVersion 1.')
  }
  if (!Array.isArray(value.selectedFiles) || !value.selectedFiles.every(isSelectedSourceFile)) {
    throw new TypeError('Source map selectedFiles are invalid.')
  }
  if (
    !Array.isArray(value.conversationEntries) ||
    !value.conversationEntries.every(isConversationEntry)
  ) {
    throw new TypeError('Source map conversationEntries are invalid.')
  }
  if (
    !Array.isArray(value.attachmentEntries) ||
    !value.attachmentEntries.every(isAttachmentEntry)
  ) {
    throw new TypeError('Source map attachmentEntries are invalid.')
  }
  return {
    schemaVersion: 1,
    selectedFiles: value.selectedFiles,
    conversationEntries: value.conversationEntries,
    attachmentEntries: value.attachmentEntries
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function expectedAttachmentEntryBaseName(reference: string): string | null {
  let providerId: string
  if (reference.startsWith('sediment://')) {
    providerId = reference.slice('sediment://'.length)
  } else if (reference.startsWith('file-service://')) {
    providerId = reference.slice('file-service://'.length)
  } else if (reference.includes('://')) {
    return null
  } else {
    providerId = reference
  }

  if (!/^(?:file_[0-9a-f]{32}|file-[A-Za-z0-9]{22})$/.test(providerId)) {
    return null
  }
  return `${providerId}.dat`
}

export function resolveAttachmentIndex(
  messages: readonly Pick<NormalizedChatGptMessage, 'attachmentRefs'>[],
  indexedEntries: readonly IndexedAttachmentEntry[]
): AttachmentIndexResult {
  const attachmentEntries = indexedEntries
    .map((entry) => ({
      entryId: `chatgpt_attachment_${stableDigest({
        selectedSha256: entry.selectedSha256,
        entryPath: entry.entryPath,
        entryIndex: entry.entryIndex
      }).slice(0, 32)}`,
      selectedSha256: entry.selectedSha256,
      entryPath: entry.entryPath,
      entryBaseName: entry.entryBaseName,
      entryIndex: entry.entryIndex,
      entrySize: entry.entrySize,
      entrySha256: entry.entrySha256
    }))
    .sort((left, right) =>
      compareText(
        `${left.selectedSha256}\0${left.entryPath}\0${left.entryIndex}`,
        `${right.selectedSha256}\0${right.entryPath}\0${right.entryIndex}`
      )
    )
  const entriesByBaseName = new Map<string, ManifestAttachmentEntry[]>()
  for (const entry of attachmentEntries) {
    entriesByBaseName.set(entry.entryBaseName, [
      ...(entriesByBaseName.get(entry.entryBaseName) ?? []),
      entry
    ])
  }

  const referenceCounts = new Map<string, number>()
  for (const message of messages) {
    for (const reference of message.attachmentRefs) {
      referenceCounts.set(reference, (referenceCounts.get(reference) ?? 0) + 1)
    }
  }

  const attachmentReferences: AttachmentReferenceResolution[] = []
  const warnings: AttachmentIndexResult['warnings'] = []
  const resolvedEntryIds = new Set<string>()
  for (const [reference, occurrenceCount] of [...referenceCounts].sort(([left], [right]) =>
    compareText(left, right)
  )) {
    const expectedEntryBaseName = expectedAttachmentEntryBaseName(reference)
    const matches = expectedEntryBaseName
      ? (entriesByBaseName.get(expectedEntryBaseName) ?? [])
      : []
    const status: AttachmentReferenceStatus = !expectedEntryBaseName
      ? 'unsupported'
      : matches.length === 0
        ? 'missing'
        : matches.length === 1
          ? 'resolved'
          : 'ambiguous'
    const matchedEntryIds = matches.map(({ entryId }) => entryId).sort(compareText)
    if (status === 'resolved') {
      resolvedEntryIds.add(matchedEntryIds[0])
    } else {
      warnings.push({
        code: `attachment_reference_${status}`,
        path: 'attachmentReferences',
        message:
          status === 'unsupported'
            ? `Unsupported attachment reference: ${reference}`
            : `${status === 'missing' ? 'Missing' : 'Ambiguous'} attachment entry for: ${reference}`
      })
    }
    attachmentReferences.push({
      reference,
      expectedEntryBaseName,
      status,
      occurrenceCount,
      matchedEntryIds
    })
  }

  const resolvedAttachmentEntryIds = [...resolvedEntryIds].sort(compareText)
  const unreferencedAttachmentEntryIds = attachmentEntries
    .map(({ entryId }) => entryId)
    .filter((entryId) => !resolvedEntryIds.has(entryId))
    .sort(compareText)
  const countStatus = (status: AttachmentReferenceStatus): number =>
    attachmentReferences.filter((reference) => reference.status === status).length

  return {
    attachmentEntries,
    attachmentReferences,
    resolvedAttachmentEntryIds,
    unreferencedAttachmentEntryIds,
    warnings,
    stats: {
      attachmentEntryCount: attachmentEntries.length,
      attachmentReferenceCount: attachmentReferences.length,
      resolvedAttachmentReferenceCount: countStatus('resolved'),
      missingAttachmentReferenceCount: countStatus('missing'),
      ambiguousAttachmentReferenceCount: countStatus('ambiguous'),
      unsupportedAttachmentReferenceCount: countStatus('unsupported'),
      resolvedAttachmentEntryCount: resolvedAttachmentEntryIds.length,
      unreferencedAttachmentEntryCount: unreferencedAttachmentEntryIds.length
    }
  }
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const temporaryPath = `${path}.tmp-${process.pid}`
  await writeFile(temporaryPath, content, 'utf8')
  await rename(temporaryPath, path)
}

async function main(): Promise<void> {
  const sourceMapPath = parseArgument('--sources')
  const outputDirectory = parseArgument('--output')
  const sourceMap = parseSourceMap(
    JSON.parse(await readFile(sourceMapPath, 'utf8')) as unknown
  )
  const selectedFiles = [...sourceMap.selectedFiles].sort((left, right) =>
    compareText(left.selectedPath, right.selectedPath)
  )
  const conversationEntries = [...sourceMap.conversationEntries].sort((left, right) =>
    compareText(
      `${left.selectedPath}\0${left.entryPath}`,
      `${right.selectedPath}\0${right.entryPath}`
    )
  )
  const selectedHashes = new Map<string, string>()
  for (const selectedFile of selectedFiles) {
    if (selectedFile.selectedSha256Before !== selectedFile.selectedSha256After) {
      throw new Error(`Source changed while reading: ${selectedFile.selectedPath}`)
    }
    selectedHashes.set(selectedFile.selectedPath, selectedFile.selectedSha256Before)
  }

  const normalized = []
  for (const source of conversationEntries) {
    if (selectedHashes.get(source.selectedPath) !== source.selectedSha256) {
      throw new Error(`Conversation entry source mismatch: ${source.entryPath}`)
    }
    const bytes = await readFile(source.stagedPath)
    if (sha256Bytes(bytes) !== source.entrySha256) {
      throw new Error(`Staged entry hash mismatch: ${source.entryPath}`)
    }
    const sourceId = `${source.selectedSha256}:${source.entryPath}`
    normalized.push(
      normalizeChatGptExport(JSON.parse(bytes.toString('utf8')) as unknown, {
        sourceId,
        sourceSha256: source.entrySha256,
        entryPath: source.entryPath
      })
    )
  }

  for (const entry of sourceMap.attachmentEntries) {
    if (selectedHashes.get(entry.selectedPath) !== entry.selectedSha256) {
      throw new Error(`Attachment entry source mismatch: ${entry.entryPath}`)
    }
  }

  const conversations = normalized.flatMap((item) =>
    item.conversations.map(({ messages: _messages, ...conversation }) => ({
      ...conversation,
      sourceId: item.source.sourceId,
      sourceSha256: item.source.sourceSha256,
      sourceEntryPath: item.source.entryPath
    }))
  )
  const messages: PreviewMessage[] = normalized.flatMap((item) =>
    item.messages.map((message) => ({
      ...message,
      sourceId: item.source.sourceId,
      sourceSha256: item.source.sourceSha256,
      sourceEntryPath: item.source.entryPath
    }))
  )
  const duplicateConversationIds = duplicateIds(
    conversations.map(({ conversationId }) => conversationId)
  )
  const duplicateMessageKeys = duplicateIds(
    messages.map(({ conversationId, messageId }) => `${conversationId}\0${messageId}`)
  )
  const normalizationWarnings = normalized.flatMap((item) =>
    item.warnings.map((warning) => ({ sourceId: item.source.sourceId, ...warning }))
  )
  const attachmentIndex = resolveAttachmentIndex(messages, sourceMap.attachmentEntries)
  const warnings = [...normalizationWarnings, ...attachmentIndex.warnings]
  const stats = {
    conversationCount: conversations.length,
    archivedConversationCount: conversations.filter(({ isArchived }) => isArchived).length,
    messageCount: messages.length,
    currentBranchMessageCount: messages.filter(({ branch }) => branch === 'current').length,
    oldBranchMessageCount: messages.filter(({ branch }) => branch === 'old').length,
    candidateEligibleMessageCount: messages.filter(({ candidateEligible }) => candidateEligible)
      .length,
    duplicateConversationIdCount: duplicateConversationIds.length,
    duplicateMessageKeyCount: duplicateMessageKeys.length,
    warningCount: warnings.length,
    ...attachmentIndex.stats
  }
  const digestInput = {
    schemaVersion: 1,
    sources: normalized.map(({ source, contentDigest }) => ({ source, contentDigest })),
    conversations: conversations.map(({ recordId, sha256 }) => ({ recordId, sha256 })),
    messages: messages.map(({ recordId, sha256 }) => ({ recordId, sha256 })),
    duplicateConversationIds,
    duplicateMessageKeys,
    attachmentEntries: attachmentIndex.attachmentEntries,
    attachmentReferences: attachmentIndex.attachmentReferences,
    resolvedAttachmentEntryIds: attachmentIndex.resolvedAttachmentEntryIds,
    unreferencedAttachmentEntryIds: attachmentIndex.unreferencedAttachmentEntryIds,
    warnings,
    stats
  }
  const manifest = {
    schemaVersion: 1,
    provider: 'openai_chatgpt_export',
    generatedAt: new Date().toISOString(),
    sourceUnchanged: true,
    containsPersonalData: true,
    intendedStorage: 'local_staging_only',
    contentDigest: stableDigest(digestInput),
    sources: {
      selectedFiles: selectedFiles.map((source) => ({
        selectedPath: source.selectedPath,
        selectedSha256: source.selectedSha256Before,
        sourceKind: source.sourceKind
      })),
      conversationEntries: conversationEntries.map((source) => ({
        selectedSha256: source.selectedSha256,
        entryPath: source.entryPath,
        entrySha256: source.entrySha256
      }))
    },
    attachmentEntries: attachmentIndex.attachmentEntries,
    attachmentReferences: attachmentIndex.attachmentReferences,
    resolvedAttachmentEntryIds: attachmentIndex.resolvedAttachmentEntryIds,
    unreferencedAttachmentEntryIds: attachmentIndex.unreferencedAttachmentEntryIds,
    outputs: {
      conversations: 'conversations.jsonl',
      messages: 'messages.jsonl'
    },
    stats,
    duplicateConversationIds,
    duplicateMessageKeys,
    warnings
  }

  await mkdir(outputDirectory, { recursive: true })
  await writeAtomic(
    join(outputDirectory, 'conversations.jsonl'),
    `${conversations.map((record) => JSON.stringify(record)).join('\n')}\n`
  )
  await writeAtomic(
    join(outputDirectory, 'messages.jsonl'),
    `${messages.map((record) => JSON.stringify(record)).join('\n')}\n`
  )
  await writeAtomic(join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  process.stdout.write(
    `${JSON.stringify({ outputDirectory, contentDigest: manifest.contentDigest, stats }, null, 2)}\n`
  )
}

const isEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false
if (isEntryPoint) {
  await main()
}
