export type ChatGptMessageBranch = 'current' | 'old'
export type ChatGptIdSource = 'official' | 'synthetic'

export interface ChatGptExportWarning {
  code: string
  path: string
  message: string
}

export interface ChatGptExportSource {
  sourceId: string
  sourceSha256: string
  entryPath: string
}

export interface ChatGptExportStats {
  conversationCount: number
  archivedConversationCount: number
  messageCount: number
  currentBranchMessageCount: number
  oldBranchMessageCount: number
  candidateEligibleMessageCount: number
  duplicateConversationIdCount: number
  duplicateMessageKeyCount: number
  warningCount: number
}

export interface NormalizedChatGptMessage {
  conversationId: string
  messageId: string
  messageIdSource: ChatGptIdSource
  nodeId: string
  parentNodeId: string | null
  branch: ChatGptMessageBranch
  role: string
  createdAtUnixSeconds: number | null
  updatedAtUnixSeconds: number | null
  contentKind: string
  text: string | null
  attachmentRefs: string[]
  privacyReviewRequired: boolean
  candidateBlockReasons: string[]
  candidateEligible: boolean
  recordId: string
  sha256: string
}

export interface NormalizedChatGptConversation {
  conversationId: string
  conversationIdSource: ChatGptIdSource
  title: string | null
  isArchived: boolean
  doNotRemember: boolean | null
  memoryScope: string | null
  starred: boolean | null
  createdAtUnixSeconds: number | null
  updatedAtUnixSeconds: number | null
  currentNodeId: string | null
  recordId: string
  sha256: string
  messages: NormalizedChatGptMessage[]
}

export interface NormalizedChatGptExport {
  schemaVersion: 1
  provider: 'openai_chatgpt_export'
  source: ChatGptExportSource
  conversations: NormalizedChatGptConversation[]
  messages: NormalizedChatGptMessage[]
  duplicateConversationIds: string[]
  duplicateMessageKeys: string[]
  warnings: ChatGptExportWarning[]
  stats: ChatGptExportStats
  contentDigest: string
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    )
  }
  return value
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? 'null'
}

const sha256Constants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
  0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
  0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
  0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

export function sha256(value: unknown): string {
  const bytes = new TextEncoder().encode(stableJson(value))
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  const bitLength = bytes.length * 8
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  const state = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19
  ])
  const words = new Uint32Array(64)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4)
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15]
      const previous2 = words[index - 2]
      const sigma0 =
        rotateRight(previous15, 7) ^
        rotateRight(previous15, 18) ^
        (previous15 >>> 3)
      const sigma1 =
        rotateRight(previous2, 17) ^
        rotateRight(previous2, 19) ^
        (previous2 >>> 10)
      words[index] =
        (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = state
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temporary1 =
        (h + sum1 + choice + sha256Constants[index] + words[index]) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (sum0 + majority) >>> 0

      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }

    state[0] = (state[0] + a) >>> 0
    state[1] = (state[1] + b) >>> 0
    state[2] = (state[2] + c) >>> 0
    state[3] = (state[3] + d) >>> 0
    state[4] = (state[4] + e) >>> 0
    state[5] = (state[5] + f) >>> 0
    state[6] = (state[6] + g) >>> 0
    state[7] = (state[7] + h) >>> 0
  }

  return [...state].map((word) => word.toString(16).padStart(8, '0')).join('')
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function unixSeconds(
  value: unknown,
  path: string,
  warnings: ChatGptExportWarning[]
): number | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  warnings.push({
    code: 'invalid_unix_time',
    path,
    message: 'Expected a finite Unix timestamp in seconds.'
  })
  return null
}

function attachmentRefs(message: UnknownRecord, content: UnknownRecord): string[] {
  const refs = new Set<string>()
  const addRef = (value: unknown): void => {
    if (typeof value === 'string' && value.length > 0) {
      refs.add(value)
    }
  }
  const addContentObject = (value: unknown): void => {
    if (!isRecord(value)) {
      return
    }
    addRef(value.asset_pointer)
    addRef(value.attachment_id)
    addRef(value.file_id)
    addRef(value.upload_id)
  }

  addContentObject(content)
  if (Array.isArray(content.parts)) {
    content.parts.forEach(addContentObject)
  }

  const metadata = isRecord(message.metadata) ? message.metadata : null
  if (metadata && Array.isArray(metadata.attachments)) {
    for (const attachment of metadata.attachments) {
      if (!isRecord(attachment)) {
        continue
      }
      addRef(attachment.id)
      addContentObject(attachment)
    }
  }

  return [...refs].sort()
}

function contentText(content: UnknownRecord): string | null {
  const parts = Array.isArray(content.parts)
    ? content.parts.filter((part): part is string => typeof part === 'string')
    : []
  if (parts.length > 0) {
    return parts.join('\n')
  }
  return optionalText(content.text)
}

function currentBranch(
  mapping: UnknownRecord,
  currentNodeId: string | null,
  conversationPath: string,
  warnings: ChatGptExportWarning[]
): string[] {
  if (!currentNodeId) {
    warnings.push({
      code: 'missing_current_node',
      path: `${conversationPath}.current_node`,
      message: 'No current branch can be reconstructed.'
    })
    return []
  }

  const reversed: string[] = []
  const visited = new Set<string>()
  let nodeId: string | null = currentNodeId

  while (nodeId) {
    if (visited.has(nodeId)) {
      warnings.push({
        code: 'parent_cycle',
        path: `${conversationPath}.mapping.${nodeId}`,
        message: 'Stopped current-branch reconstruction at a parent cycle.'
      })
      return []
    }
    visited.add(nodeId)

    const node: unknown = mapping[nodeId]
    if (!isRecord(node)) {
      warnings.push({
        code: 'missing_branch_node',
        path: `${conversationPath}.mapping.${nodeId}`,
        message: 'Stopped current-branch reconstruction at a missing node.'
      })
      return []
    }

    reversed.push(nodeId)
    if (node.parent === null || node.parent === undefined) {
      nodeId = null
    } else if (typeof node.parent === 'string') {
      nodeId = node.parent
    } else {
      warnings.push({
        code: 'invalid_parent_id',
        path: `${conversationPath}.mapping.${nodeId}.parent`,
        message: 'Stopped current-branch reconstruction at an invalid parent ID.'
      })
      return []
    }
  }

  return reversed.reverse()
}

function normalizedId(
  officialValue: unknown,
  prefix: 'conversation' | 'message',
  seed: unknown,
  path: string,
  warnings: ChatGptExportWarning[]
): { id: string; source: ChatGptIdSource } {
  const official = optionalText(officialValue)
  if (official) {
    return { id: official, source: 'official' }
  }

  const id = `${prefix}_synthetic_${sha256(seed).slice(0, 32)}`
  warnings.push({
    code: `missing_${prefix}_id`,
    path,
    message: `Generated deterministic synthetic ${prefix} ID ${id}.`
  })
  return { id, source: 'synthetic' }
}

function normalizeConversation(
  value: unknown,
  index: number,
  warnings: ChatGptExportWarning[]
): NormalizedChatGptConversation {
  const path = `conversations[${index}]`
  if (!isRecord(value)) {
    throw new TypeError(`${path} must be an object.`)
  }
  if (!isRecord(value.mapping)) {
    throw new TypeError(`${path}.mapping must be an object.`)
  }

  const mapping = value.mapping
  const conversationIdentity = normalizedId(
    value.id,
    'conversation',
    {
      index,
      title: value.title ?? null,
      createTime: value.create_time ?? null,
      updateTime: value.update_time ?? null,
      nodeIds: Object.keys(mapping).sort()
    },
    `${path}.id`,
    warnings
  )
  const currentNodeId = optionalText(value.current_node)
  const doNotRemember = optionalBoolean(value.is_do_not_remember)
  const memoryScope = optionalText(value.memory_scope)
  const starred = optionalBoolean(value.is_starred)
  const branchNodeIds = currentBranch(mapping, currentNodeId, path, warnings)
  const branchOrder = new Map(branchNodeIds.map((nodeId, order) => [nodeId, order]))
  const branchSet = new Set(branchNodeIds)
  const messages: NormalizedChatGptMessage[] = []

  for (const [nodeId, rawNode] of Object.entries(mapping).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const nodePath = `${path}.mapping.${nodeId}`
    if (!isRecord(rawNode)) {
      warnings.push({
        code: 'invalid_mapping_node',
        path: nodePath,
        message: 'Skipped a mapping node that is not an object.'
      })
      continue
    }
    if (rawNode.message === null || rawNode.message === undefined) {
      continue
    }
    if (!isRecord(rawNode.message)) {
      warnings.push({
        code: 'invalid_message',
        path: `${nodePath}.message`,
        message: 'Skipped a message that is not an object.'
      })
      continue
    }

    const rawMessage = rawNode.message
    const messageIdentity = normalizedId(
      rawMessage.id,
      'message',
      {
        conversationId: conversationIdentity.id,
        nodeId,
        message: rawMessage
      },
      `${nodePath}.message.id`,
      warnings
    )
    const author = isRecord(rawMessage.author) ? rawMessage.author : null
    const role = optionalText(author?.role) ?? 'unknown'
    if (role === 'unknown') {
      warnings.push({
        code: 'missing_message_role',
        path: `${nodePath}.message.author.role`,
        message: 'Preserved the message with role "unknown".'
      })
    }
    const content = isRecord(rawMessage.content) ? rawMessage.content : {}
    const contentKind = optionalText(content.content_type) ?? 'unknown'
    if (contentKind === 'unknown') {
      warnings.push({
        code: 'missing_content_kind',
        path: `${nodePath}.message.content.content_type`,
        message: 'Preserved the message with content kind "unknown".'
      })
    }
    const text = contentText(content)
    const branch: ChatGptMessageBranch = branchSet.has(nodeId) ? 'current' : 'old'
    const parentNodeId = optionalText(rawNode.parent)
    const createdAtUnixSeconds = unixSeconds(
      rawMessage.create_time,
      `${nodePath}.message.create_time`,
      warnings
    )
    const updatedAtUnixSeconds = unixSeconds(
      rawMessage.update_time,
      `${nodePath}.message.update_time`,
      warnings
    )
    const refs = attachmentRefs(rawMessage, content)
    const candidateBlockReasons: string[] = []
    if (role !== 'user') candidateBlockReasons.push('message_not_user')
    if (branch !== 'current') candidateBlockReasons.push('message_old_branch')
    if (contentKind !== 'text') candidateBlockReasons.push('message_not_plain_text')
    if (text === null || text.trim().length === 0) {
      candidateBlockReasons.push('message_empty_text')
    }
    if (doNotRemember === true) {
      candidateBlockReasons.push('conversation_do_not_remember')
    }
    const candidateEligible =
      role === 'user' &&
      branch === 'current' &&
      contentKind === 'text' &&
      text !== null &&
      text.trim().length > 0 &&
      doNotRemember !== true
    const messageBody = {
      conversationId: conversationIdentity.id,
      messageId: messageIdentity.id,
      messageIdSource: messageIdentity.source,
      nodeId,
      parentNodeId,
      branch,
      role,
      createdAtUnixSeconds,
      updatedAtUnixSeconds,
      contentKind,
      text,
      attachmentRefs: refs,
      privacyReviewRequired: doNotRemember === null,
      candidateBlockReasons,
      candidateEligible
    }

    messages.push({
      ...messageBody,
      recordId: `chatgpt_message_${sha256({
        conversationId: conversationIdentity.id,
        messageId: messageIdentity.id
      }).slice(0, 32)}`,
      sha256: sha256(messageBody)
    })
  }

  messages.sort((a, b) => {
    if (a.branch !== b.branch) {
      return a.branch === 'current' ? -1 : 1
    }
    if (a.branch === 'current') {
      return (branchOrder.get(a.nodeId) ?? 0) - (branchOrder.get(b.nodeId) ?? 0)
    }
    return a.nodeId.localeCompare(b.nodeId)
  })

  const conversationBody = {
    conversationId: conversationIdentity.id,
    conversationIdSource: conversationIdentity.source,
    title: optionalText(value.title),
    isArchived: value.is_archived === true,
    doNotRemember,
    memoryScope,
    starred,
    createdAtUnixSeconds: unixSeconds(
      value.create_time,
      `${path}.create_time`,
      warnings
    ),
    updatedAtUnixSeconds: unixSeconds(
      value.update_time,
      `${path}.update_time`,
      warnings
    ),
    currentNodeId,
    messages
  }

  return {
    ...conversationBody,
    recordId: `chatgpt_conversation_${sha256({
      conversationId: conversationIdentity.id
    }).slice(0, 32)}`,
    sha256: sha256(conversationBody)
  }
}

function duplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id)
    }
    seen.add(id)
  }
  return [...duplicates].sort()
}

function normalizeSource(source: ChatGptExportSource): ChatGptExportSource {
  const requiredText = (value: string, field: string): string => {
    const normalized = value?.trim()
    if (!normalized) {
      throw new TypeError(`ChatGPT export source ${field} is required.`)
    }
    return normalized
  }
  const sourceSha256 = requiredText(source.sourceSha256, 'sourceSha256')
  if (!/^[0-9a-f]{64}$/i.test(sourceSha256)) {
    throw new TypeError('ChatGPT export sourceSha256 must be a SHA-256 digest.')
  }
  return {
    sourceId: requiredText(source.sourceId, 'sourceId'),
    sourceSha256: sourceSha256.toLowerCase(),
    entryPath: requiredText(source.entryPath, 'entryPath')
  }
}

export function normalizeChatGptExport(
  input: unknown,
  source: ChatGptExportSource
): NormalizedChatGptExport {
  if (!Array.isArray(input)) {
    throw new TypeError('ChatGPT export conversations must be an array.')
  }

  const normalizedSource = normalizeSource(source)
  const warnings: ChatGptExportWarning[] = []
  const conversations = input.map((value, index) =>
    normalizeConversation(value, index, warnings)
  )
  const messages = conversations.flatMap((conversation) => conversation.messages)
  const duplicateConversationIds = duplicateIds(
    conversations.map((conversation) => conversation.conversationId)
  )
  const duplicateMessageKeys = duplicateIds(
    messages.map(
      (message) => `${message.conversationId}\0${message.messageId}`
    )
  )

  for (const id of duplicateConversationIds) {
    warnings.push({
      code: 'duplicate_conversation_id',
      path: 'conversations',
      message: `Duplicate conversation ID: ${id}`
    })
  }
  for (const key of duplicateMessageKeys) {
    warnings.push({
      code: 'duplicate_message_key',
      path: 'conversations[].mapping[].message.id',
      message: `Duplicate conversation/message key: ${key.replace('\0', '/')}`
    })
  }

  const stats: ChatGptExportStats = {
    conversationCount: conversations.length,
    archivedConversationCount: conversations.filter(
      ({ isArchived }) => isArchived
    ).length,
    messageCount: messages.length,
    currentBranchMessageCount: messages.filter(({ branch }) => branch === 'current')
      .length,
    oldBranchMessageCount: messages.filter(({ branch }) => branch === 'old').length,
    candidateEligibleMessageCount: messages.filter(
      ({ candidateEligible }) => candidateEligible
    ).length,
    duplicateConversationIdCount: duplicateConversationIds.length,
    duplicateMessageKeyCount: duplicateMessageKeys.length,
    warningCount: warnings.length
  }
  const body = {
    schemaVersion: 1 as const,
    provider: 'openai_chatgpt_export' as const,
    source: normalizedSource,
    conversations,
    messages,
    duplicateConversationIds,
    duplicateMessageKeys,
    warnings,
    stats
  }
  return { ...body, contentDigest: sha256(body) }
}
