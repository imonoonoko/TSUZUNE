#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import {
  MAX_EDITABLE_CHARACTERS,
  VaultMcpService
} from './service'

interface ServerArguments {
  vaultPath?: string
  settingsPath?: string
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
} as const

const createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
} as const

const updateAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false
} as const

const autonomousUpdateAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false
} as const

const writeOutputSchema = {
  id: z.string(),
  title: z.string(),
  metadata: z.object({
    path: z.string(),
    modified_at: z.string(),
    revision: z.string(),
    size_bytes: z.number()
  })
}

const autonomousUpdateOutputSchema = {
  ...writeOutputSchema,
  provenance: z.object({
    actor: z.literal('ai'),
    reason: z.string(),
    source_refs: z.array(z.string()),
    previous_revision: z.string(),
    history_path: z.string()
  })
}

function parseArguments(args: string[]): ServerArguments {
  const parsed: ServerArguments = {}

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    const value = args[index + 1]

    if (argument === '--vault' && value) {
      parsed.vaultPath = value
      index += 1
      continue
    }
    if (argument === '--settings' && value) {
      parsed.settingsPath = value
      index += 1
      continue
    }
    throw new Error(`不明な引数です: ${argument}`)
  }

  return parsed
}

function textResult<T extends object>(structuredContent: T) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(structuredContent, null, 2)
      }
    ],
    structuredContent: structuredContent as Record<string, unknown>
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const vault = new VaultMcpService({
    explicitVaultPath: args.vaultPath,
    settingsPath: args.settingsPath
  })
  const server = new McpServer(
    {
      name: 'tsuzune',
      version: '0.3.0'
    },
    {
      instructions:
        'TSUZUNEのローカルMarkdown Vaultを扱います。検索はsearch、取得はfetch、関連文脈はbuild_contextを使ってください。AIによる自動更新はautonomous_update_noteを使えます。自動更新はユーザー承認を待たずに実行されますが、旧本文を50_履歴/AI更新へ保存し、出典と理由を記録します。原文・会話ログは自動更新対象にせず、削除・移動・強制上書きはできません。'
    }
  )

  server.registerTool(
    'search',
    {
      title: 'TSUZUNEノート検索',
      description:
        'Search the active TSUZUNE Vault by note title, relative path, and Markdown content.',
      inputSchema: {
        query: z.string().min(1).describe('Search query'),
        limit: z.number().int().min(1).max(50).optional().default(10)
      },
      outputSchema: {
        results: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            text: z.string(),
            metadata: z.object({
              path: z.string(),
              modified_at: z.string()
            })
          })
        )
      },
      annotations: readOnlyAnnotations
    },
    async ({ query, limit }) => textResult(await vault.search(query, limit))
  )

  server.registerTool(
    'fetch',
    {
      title: 'TSUZUNEノート取得',
      description:
        'Fetch one Markdown note by the relative-path id returned from search.',
      inputSchema: {
        id: z.string().min(1).describe('Relative note path returned by search')
      },
      outputSchema: {
        id: z.string(),
        title: z.string(),
        text: z.string(),
        metadata: z.object({
          path: z.string(),
          modified_at: z.string(),
          revision: z.string(),
          size_bytes: z.number(),
          truncated: z.boolean(),
          editable: z.boolean()
        })
      },
      annotations: readOnlyAnnotations
    },
    async ({ id }) => textResult(await vault.fetch(id))
  )

  server.registerTool(
    'create_note',
    {
      title: 'TSUZUNEノート作成',
      description:
        'Create a new Markdown note in an existing Vault folder. Never overwrites an existing note. Use only when the user asks to create a note.',
      inputSchema: {
        path: z
          .string()
          .min(1)
          .max(500)
          .describe('New Vault-relative path ending in .md'),
        content: z
          .string()
          .max(MAX_EDITABLE_CHARACTERS)
          .optional()
          .default('')
          .describe('Complete Markdown content')
      },
      outputSchema: writeOutputSchema,
      annotations: createAnnotations
    },
    async ({ path, content }) =>
      textResult(await vault.createNote(path, content))
  )

  server.registerTool(
    'update_note',
    {
      title: 'TSUZUNEノート更新',
      description:
        'Replace the complete content of one existing Markdown note. Fetch first and pass its revision. Rejects stale revisions and never force-overwrites.',
      inputSchema: {
        id: z.string().min(1).max(500).describe('Vault-relative note path'),
        content: z
          .string()
          .max(MAX_EDITABLE_CHARACTERS)
          .describe('Complete replacement Markdown content'),
        expected_revision: z
          .string()
          .regex(/^sha256:[a-f0-9]{64}$/)
          .describe('Opaque revision returned by fetch')
      },
      outputSchema: writeOutputSchema,
      annotations: updateAnnotations
    },
    async ({ id, content, expected_revision }) =>
      textResult(await vault.updateNote(id, content, expected_revision))
  )

  server.registerTool(
    'autonomous_update_note',
    {
      title: 'TSUZUNE AI自動ノート更新',
      description:
        'Update one existing Markdown note without waiting for human approval. The previous content is preserved in 50_履歴/AI更新 and the reason/source references are returned as provenance. Use for AI-assisted knowledge maintenance; never use for raw source notes.',
      inputSchema: {
        id: z.string().min(1).max(500).describe('Vault-relative note path'),
        content: z
          .string()
          .max(MAX_EDITABLE_CHARACTERS)
          .describe('Complete replacement Markdown content'),
        expected_revision: z
          .string()
          .regex(/^sha256:[a-f0-9]{64}$/)
          .optional()
          .describe('Optional revision guard returned by fetch'),
        reason: z
          .string()
          .max(2_000)
          .optional()
          .describe('Why the AI is applying this update'),
        source_refs: z
          .array(z.string().min(1).max(500))
          .max(50)
          .optional()
          .default([])
          .describe('Vault-relative source or research package references')
      },
      outputSchema: autonomousUpdateOutputSchema,
      annotations: autonomousUpdateAnnotations
    },
    async ({ id, content, expected_revision, reason, source_refs }) =>
      textResult(
        await vault.autonomousUpdateNote(id, content, {
          expectedRevision: expected_revision,
          reason,
          sourceRefs: source_refs
        })
      )
  )

  server.registerTool(
    'get_backlinks',
    {
      title: 'TSUZUNEバックリンク取得',
      description:
        'List notes that contain a resolved Wiki link to the requested note.',
      inputSchema: {
        id: z.string().min(1).describe('Relative note path'),
        limit: z.number().int().min(1).max(50).optional().default(20)
      },
      outputSchema: {
        note: z.object({
          id: z.string(),
          title: z.string()
        }),
        backlinks: z.array(
          z.object({
            id: z.string(),
            title: z.string()
          })
        ),
        total: z.number()
      },
      annotations: readOnlyAnnotations
    },
    async ({ id, limit }) => textResult(await vault.backlinks(id, limit))
  )

  server.registerTool(
    'build_context',
    {
      title: 'TSUZUNEコンテキスト作成',
      description:
        'Build a bounded Markdown context bundle from one note, its linked notes, and related temporal state or event notes.',
      inputSchema: {
        id: z.string().min(1).describe('Relative note path'),
        max_characters: z
          .number()
          .int()
          .min(1_000)
          .max(100_000)
          .optional()
          .default(15_000),
        as_of: z
          .union([z.iso.date(), z.iso.datetime({ offset: true })])
          .optional()
          .describe('Optional ISO 8601 date or timezone-aware date-time'),
        include_history: z
          .boolean()
          .optional()
          .default(false)
          .describe('Include historical and superseded temporal notes'),
        temporal_perspective: z
          .enum(['valid-time', 'knowledge-time'])
          .optional()
          .default('valid-time')
          .describe(
            'Use valid-time for what was true, or knowledge-time for what was known'
          )
      },
      outputSchema: {
        seed_id: z.string(),
        markdown: z.string(),
        character_count: z.number(),
        truncated: z.boolean(),
        as_of: z.string(),
        temporal_perspective: z.enum(['valid-time', 'knowledge-time']),
        included: z.array(
          z.object({
            path: z.string(),
            name: z.string(),
            relation: z.enum(['seed', 'outgoing', 'backlink']),
            truncated: z.boolean(),
            content_omitted: z.boolean().optional(),
            temporal_status: z
              .enum([
                'current',
                'historical',
                'future',
                'occurred',
                'review_due',
                'superseded'
              ])
              .optional(),
            selection_reasons: z.array(z.string())
          })
        ),
        omitted_ids: z.array(z.string()),
        warnings: z.array(
          z.object({
            code: z.enum([
              'CONFLICTING_CURRENT_STATES',
              'MALFORMED_TEMPORAL_METADATA',
              'REVIEW_DUE',
              'TEMPORAL_SEED_CONTENT_OMITTED',
              'TEMPORAL_METADATA_WARNING',
              'UNSCOPED_NORMAL_CONTENT_OMITTED',
              'UNRESOLVED_SOURCE',
              'UNKNOWN_OBSERVED_AT'
            ]),
            message: z.string(),
            path: z.string().optional(),
            paths: z.array(z.string()).optional()
          })
        )
      },
      annotations: readOnlyAnnotations
    },
    async ({
      id,
      max_characters,
      as_of,
      include_history,
      temporal_perspective
    }) =>
      textResult(
        await vault.buildContext(id, max_characters, {
          asOf: as_of,
          includeHistory: include_history,
          temporalPerspective: temporal_perspective
        })
      )
  )

  await server.connect(new StdioServerTransport())
  console.error('TSUZUNE MCP server is ready (4 read tools, 3 write tools).')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`TSUZUNE MCP server failed: ${message}`)
  process.exitCode = 1
})
