import { describe, expect, it } from 'vitest'
import { normalizeChatGptExport } from '../src/core/chatgpt-export'

const source = {
  sourceId: 'anonymous-export-part',
  sourceSha256: 'a'.repeat(64),
  entryPath: 'conversations-000.json'
}

function conversationFixture() {
  return {
    id: 'conversation-1',
    title: '匿名テスト',
    is_archived: true,
    is_do_not_remember: false,
    memory_scope: 'global_enabled',
    is_starred: false,
    create_time: 1_700_000_000.125,
    update_time: 1_700_000_100.875,
    current_node: 'assistant-current-node',
    mapping: {
      'root-node': {
        id: 'root-node',
        parent: null,
        message: null
      },
      'user-current-node': {
        id: 'user-current-node',
        parent: 'root-node',
        message: {
          id: 'message-user-current',
          author: { role: 'user' },
          create_time: 1_700_000_001.25,
          update_time: 1_700_000_002.5,
          content: {
            content_type: 'text',
            parts: ['現在の質問']
          },
          metadata: {
            attachments: [{ id: 'file-metadata-1' }]
          }
        }
      },
      'assistant-current-node': {
        id: 'assistant-current-node',
        parent: 'user-current-node',
        message: {
          id: 'message-assistant-current',
          author: { role: 'assistant' },
          create_time: 1_700_000_003.75,
          content: {
            content_type: 'text',
            parts: [
              '現在の回答',
              { asset_pointer: 'file-service://current-image' }
            ]
          }
        }
      },
      'user-old-node': {
        id: 'user-old-node',
        parent: 'root-node',
        message: {
          id: 'message-user-old',
          author: { role: 'user' },
          create_time: 1_700_000_004.125,
          content: {
            content_type: 'text',
            parts: ['分岐前の古い質問']
          }
        }
      },
      'user-thought-node': {
        id: 'user-thought-node',
        parent: 'root-node',
        message: {
          id: 'message-user-thought',
          author: { role: 'user' },
          content: {
            content_type: 'thoughts',
            parts: ['候補にしてはいけない内部情報']
          }
        }
      }
    }
  }
}

describe('ChatGPT export normalization', () => {
  it('validates the conversations array and required mapping', () => {
    expect(() => normalizeChatGptExport({}, source)).toThrow(/must be an array/)
    expect(() => normalizeChatGptExport([{}], source)).toThrow(
      /mapping must be an object/
    )
  })

  it('restores the current branch and retains all current and old messages', () => {
    const result = normalizeChatGptExport([conversationFixture()], source)
    const conversation = result.conversations[0]

    expect(conversation.createdAtUnixSeconds).toBe(1_700_000_000.125)
    expect(conversation.updatedAtUnixSeconds).toBe(1_700_000_100.875)
    expect(conversation.isArchived).toBe(true)
    expect(conversation.doNotRemember).toBe(false)
    expect(conversation.memoryScope).toBe('global_enabled')
    expect(conversation.starred).toBe(false)
    expect(conversation.messages).toHaveLength(4)
    expect(
      conversation.messages.map(({ messageId, branch, candidateEligible }) => ({
        messageId,
        branch,
        candidateEligible
      }))
    ).toEqual([
      {
        messageId: 'message-user-current',
        branch: 'current',
        candidateEligible: true
      },
      {
        messageId: 'message-assistant-current',
        branch: 'current',
        candidateEligible: false
      },
      {
        messageId: 'message-user-old',
        branch: 'old',
        candidateEligible: false
      },
      {
        messageId: 'message-user-thought',
        branch: 'old',
        candidateEligible: false
      }
    ])

    const currentUser = conversation.messages[0]
    expect(currentUser.createdAtUnixSeconds).toBe(1_700_000_001.25)
    expect(currentUser.updatedAtUnixSeconds).toBe(1_700_000_002.5)
    expect(currentUser.attachmentRefs).toEqual(['file-metadata-1'])
    expect(currentUser.privacyReviewRequired).toBe(false)
    expect(currentUser.candidateBlockReasons).toEqual([])
    expect(currentUser.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(currentUser.recordId).toMatch(/^chatgpt_message_[0-9a-f]{32}$/)

    const assistant = conversation.messages[1]
    expect(assistant.attachmentRefs).toEqual([
      'file-service://current-image'
    ])
    expect(result.messages).toEqual(conversation.messages)
    expect(result.stats).toEqual({
      conversationCount: 1,
      archivedConversationCount: 1,
      messageCount: 4,
      currentBranchMessageCount: 2,
      oldBranchMessageCount: 2,
      candidateEligibleMessageCount: 1,
      duplicateConversationIdCount: 0,
      duplicateMessageKeyCount: 0,
      warningCount: 0
    })
  })

  it('defaults missing is_archived to false and counts archived conversations', () => {
    const active = conversationFixture()
    delete (active as { is_archived?: boolean }).is_archived
    active.id = 'conversation-active'

    const result = normalizeChatGptExport(
      [conversationFixture(), active],
      source
    )

    expect(result.conversations.map(({ isArchived }) => isArchived)).toEqual([
      true,
      false
    ])
    expect(result.stats.archivedConversationCount).toBe(1)
  })

  it('blocks do-not-remember candidates and flags unknown privacy for review', () => {
    const blocked = conversationFixture()
    blocked.id = 'conversation-blocked'
    blocked.is_do_not_remember = true
    const unknown = conversationFixture()
    unknown.id = 'conversation-unknown'
    delete (unknown as { is_do_not_remember?: boolean }).is_do_not_remember

    const result = normalizeChatGptExport([blocked, unknown], source)
    const blockedUser = result.conversations[0].messages.find(
      ({ messageId }) => messageId === 'message-user-current'
    )
    const unknownUser = result.conversations[1].messages.find(
      ({ messageId }) => messageId === 'message-user-current'
    )

    expect(blockedUser?.candidateEligible).toBe(false)
    expect(blockedUser?.privacyReviewRequired).toBe(false)
    expect(blockedUser?.candidateBlockReasons).toContain(
      'conversation_do_not_remember'
    )
    expect(unknownUser?.candidateEligible).toBe(true)
    expect(unknownUser?.privacyReviewRequired).toBe(true)
    expect(unknownUser?.candidateBlockReasons).toEqual([])
  })

  it('preserves opaque attachment references without trimming', () => {
    const fixture = conversationFixture()
    fixture.mapping['user-current-node'].message.metadata.attachments.push(
      { id: ' file-spaced ' },
      { id: '   ' },
      { id: '' }
    )

    const result = normalizeChatGptExport([fixture], source)
    const currentUser = result.messages.find(
      ({ messageId }) => messageId === 'message-user-current'
    )

    expect(currentUser?.attachmentRefs).toEqual([
      '   ',
      ' file-spaced ',
      'file-metadata-1'
    ])
    expect(currentUser?.attachmentRefs).not.toContain('file-spaced')
    expect(currentUser?.attachmentRefs).not.toContain('')
  })

  it('creates deterministic synthetic IDs and produces identical output twice', () => {
    const fixture = conversationFixture()
    delete (fixture as { id?: string }).id
    delete (
      fixture.mapping['user-current-node'].message as { id?: string }
    ).id

    const first = normalizeChatGptExport([fixture], source)
    const second = normalizeChatGptExport([fixture], source)
    const conversation = first.conversations[0]
    const message = conversation.messages.find(
      ({ nodeId }) => nodeId === 'user-current-node'
    )

    expect(second).toEqual(first)
    expect(conversation.conversationIdSource).toBe('synthetic')
    expect(conversation.conversationId).toMatch(
      /^conversation_synthetic_[0-9a-f]{32}$/
    )
    expect(message?.messageIdSource).toBe('synthetic')
    expect(message?.messageId).toMatch(/^message_synthetic_[0-9a-f]{32}$/)
    expect(first.warnings.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['missing_conversation_id', 'missing_message_id'])
    )
    expect(first.contentDigest).toMatch(/^[0-9a-f]{64}$/)
  })

  it('warns and preserves records when the current branch points to a missing node', () => {
    const fixture = conversationFixture()
    fixture.current_node = 'missing-current-node'

    const result = normalizeChatGptExport([fixture], source)

    expect(result.warnings.map(({ code }) => code)).toContain('missing_branch_node')
    expect(result.messages).toHaveLength(4)
    expect(result.messages.every(({ branch }) => branch === 'old')).toBe(true)
    expect(result.stats.candidateEligibleMessageCount).toBe(0)
  })

  it('fails closed when a parent is missing partway through the current branch', () => {
    const fixture = conversationFixture()
    fixture.mapping['user-current-node'].parent = 'missing-parent-node'

    const result = normalizeChatGptExport([fixture], source)

    expect(result.warnings.map(({ code }) => code)).toContain('missing_branch_node')
    expect(result.messages.every(({ branch }) => branch === 'old')).toBe(true)
    expect(result.stats.currentBranchMessageCount).toBe(0)
    expect(result.stats.candidateEligibleMessageCount).toBe(0)
  })

  it('fails closed when the current branch parent chain has a cycle', () => {
    const fixture = conversationFixture()
    ;(fixture.mapping['root-node'] as { parent: unknown }).parent =
      'assistant-current-node'

    const result = normalizeChatGptExport([fixture], source)

    expect(result.warnings.map(({ code }) => code)).toContain('parent_cycle')
    expect(result.messages.every(({ branch }) => branch === 'old')).toBe(true)
    expect(result.stats.currentBranchMessageCount).toBe(0)
    expect(result.stats.candidateEligibleMessageCount).toBe(0)
  })

  it('fails closed when a current branch parent ID has an invalid type', () => {
    const fixture = conversationFixture()
    ;(fixture.mapping['user-current-node'] as { parent: unknown }).parent = 42

    const result = normalizeChatGptExport([fixture], source)

    expect(result.warnings.map(({ code }) => code)).toContain('invalid_parent_id')
    expect(result.messages.every(({ branch }) => branch === 'old')).toBe(true)
    expect(result.stats.currentBranchMessageCount).toBe(0)
    expect(result.stats.candidateEligibleMessageCount).toBe(0)
  })

  it('reports duplicate conversation/message keys within one conversation ID', () => {
    const first = conversationFixture()
    const second = conversationFixture()
    second.title = '同じ公式IDを持つ別レコード'

    const result = normalizeChatGptExport([first, second], source)

    expect(result.duplicateConversationIds).toEqual(['conversation-1'])
    expect(result.duplicateMessageKeys).toEqual([
      'conversation-1\0message-assistant-current',
      'conversation-1\0message-user-current',
      'conversation-1\0message-user-old',
      'conversation-1\0message-user-thought'
    ])
    expect(result.warnings.map(({ code }) => code)).toContain(
      'duplicate_conversation_id'
    )
    expect(result.warnings.map(({ code }) => code)).toContain(
      'duplicate_message_key'
    )
  })

  it('allows the same official message ID in different conversations', () => {
    const first = conversationFixture()
    const second = conversationFixture()
    second.id = 'conversation-2'

    const result = normalizeChatGptExport([first, second], source)

    expect(result.duplicateConversationIds).toEqual([])
    expect(result.duplicateMessageKeys).toEqual([])
  })
})
