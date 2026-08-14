#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { DriveSyncMcpClient, defaultDriveSyncStatePath } from './drive-sync'
import {
  MAX_EDITABLE_CHARACTERS,
  VaultMcpService
} from './service'

interface ServerArguments {
  vaultPath?: string
  settingsPath?: string
  driveSyncStatePath?: string
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

const drivePreviewAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
} as const

const driveApplyAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true
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
  unchanged: z.literal(true).optional(),
  provenance: z.object({
    actor: z.literal('ai'),
    reason: z.string(),
    source_refs: z.array(z.string()),
    previous_revision: z.string(),
    history_path: z.string().optional()
  })
}

const moveOutputSchema = {
  preflight: z.boolean().optional(),
  old_path: z.string(),
  new_path: z.string(),
  metadata: z
    .object({
      path: z.string(),
      modified_at: z.string(),
      revision: z.string(),
      size_bytes: z.number()
    })
    .optional(),
  history_path: z.string().nullable().optional(),
  provenance: z
    .object({
      actor: z.literal('ai'),
      reason: z.string(),
      source_refs: z.array(z.string()),
      previous_revision: z.string()
    })
    .optional(),
  backlinks: z.object({
    total: z.number(),
    ids: z.array(z.string())
  }),
  link_impact: z.object({
    affected_count: z.number(),
    source_paths: z.array(z.string())
  }),
  manifest: z
    .object({
      source: z.string(),
      destination: z.string(),
      source_exists: z.boolean(),
      destination_exists: z.boolean(),
      markdown_only: z.boolean(),
      protected_source: z.boolean(),
      protected_destination: z.boolean(),
      source_revision: z.string(),
      backlink_count: z.number(),
      backlink_paths: z.array(z.string()),
      link_impact_count: z.number(),
      link_impact_paths: z.array(z.string()),
      notes_referencing_old_path: z.array(z.string()),
      would_move: z.boolean()
    })
    .optional()
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
    if (argument === '--drive-sync-state' && value) {
      parsed.driveSyncStatePath = value
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

function structuredOnlyResult<T extends object>(structuredContent: T) {
  return {
    content: [],
    structuredContent: structuredContent as Record<string, unknown>
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const vault = new VaultMcpService({
    explicitVaultPath: args.vaultPath,
    settingsPath: args.settingsPath
  })
  const driveSync = new DriveSyncMcpClient(
    args.driveSyncStatePath ?? defaultDriveSyncStatePath(args.settingsPath)
  )
  const server = new McpServer(
    {
      name: 'tsuzune',
      version: '0.3.0'
    },
    {
      instructions:
        'TSUZUNEのローカルMarkdown Vaultを扱います。検索はsearch、取得はfetch、関連文脈はbuild_context、リンク候補はsuggest_linksを使ってください。Drive同期は起動中のTSUZUNE本体に対してpreview_drive_syncで確認し、返されたplanIdをapply_drive_syncのplan_idへ渡した時だけ適用します。searchは50_履歴(監査履歴)を既定で除外します。履歴を検索に含めたい場合はinclude_history: trueを指定してください。1行の修正はpatch_note、全文置換はupdate_noteを使ってください。AIによる自動更新はautonomous_update_noteを使えます。自動更新はユーザー承認を待たずに実行されますが、旧本文を50_履歴/AI更新へ保存し、出典と理由を記録します。原文・会話ログは自動更新対象にせず、削除・強制上書きはできません。ノートの移動はmove_noteで行い、監査記録を50_履歴/AI更新へ残し、同名上書き・Vault外・内部管理フォルダ・AI変更不可ノートを拒否します。move_noteはpreflight_onlyで移動せずに安全性を確認できます。Wikiリンクの追加はadd_linkで行い、重複・保護ノート・revision競合を拒否し、note_link_addの監査記録を50_履歴/AI更新へ残します。suggest_linksとadd_linkは、フォルダ移動と知識リンクを別判断として扱えます。'
    }
  )

  server.registerTool(
    'search',
    {
      title: 'TSUZUNEノート検索',
      description:
        'Search the active TSUZUNE Vault by note title, relative path, and Markdown content. 50_履歴 (audit history) notes are excluded by default; pass include_history: true to include them.',
      inputSchema: {
        query: z.string().min(1).describe('Search query'),
        limit: z.number().int().min(1).max(50).optional().default(10),
        include_history: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'Include 50_履歴 audit-history notes in results. Defaults to false.'
          )
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
    async ({ query, limit, include_history }) =>
      textResult(await vault.search(query, limit, include_history))
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
    'patch_note',
    {
      title: 'TSUZUNEノート部分更新',
      description:
        'Apply find/replace patches to an existing Markdown note without replacing its full content. Fetch first and pass its revision. Each find must match exactly once by default (replace_all: true replaces every occurrence); all operations apply atomically or the note is left unchanged. The previous content is preserved in 50_履歴/AI更新 with the given reason and source references. Never use for raw source notes.',
      inputSchema: {
        id: z.string().min(1).max(500).describe('Vault-relative note path'),
        expected_revision: z
          .string()
          .regex(/^sha256:[a-f0-9]{64}$/)
          .describe('Opaque revision returned by fetch'),
        operations: z
          .array(
            z.object({
              find: z
                .string()
                .min(1)
                .max(1_000)
                .describe('Exact substring to find (newlines are normalized to LF)'),
              replace: z
                .string()
                .max(10_000)
                .describe('Replacement substring (may be empty to delete)'),
              replace_all: z
                .boolean()
                .optional()
                .default(false)
                .describe(
                  'Replace every occurrence; default requires exactly one match'
                )
            })
          )
          .min(1)
          .max(20)
          .describe('Patch operations applied in order, atomically'),
        reason: z
          .string()
          .max(2_000)
          .optional()
          .describe('Why the AI is applying this patch'),
        source_refs: z
          .array(z.string().min(1).max(500))
          .max(50)
          .optional()
          .default([])
          .describe('Vault-relative source or research package references')
      },
      outputSchema: {
        ...autonomousUpdateOutputSchema,
        patch: z.object({
          operations: z.array(
            z.object({
              find: z.string(),
              replace: z.string(),
              match_count: z.number()
            })
          )
        })
      },
      annotations: updateAnnotations
    },
    async ({ id, expected_revision, operations, reason, source_refs }) =>
      textResult(
        await vault.patchNote(
          id,
          expected_revision,
          operations.map(({ find, replace, replace_all }) => ({
            find,
            replace,
            replaceAll: replace_all
          })),
          {
            reason,
            sourceRefs: source_refs
          }
        )
      )
  )

  server.registerTool(
    'preview_drive_sync',
    {
      title: 'TSUZUNE Drive同期内容の確認',
      description:
        'Preview the active Vault Drive sync through the running TSUZUNE app. This does not apply uploads, downloads, moves, or conflicts. Return planId to the user before applying.',
      inputSchema: {},
      outputSchema: {
        planId: z.string(),
        createdAt: z.string(),
        items: z.array(
          z.object({
            path: z.string(),
            oldPath: z.string().optional(),
            action: z.enum(['upload', 'download', 'move', 'conflict', 'preserve']),
            reason: z.enum([
              'new_local',
              'new_remote',
              'local_changed',
              'remote_changed',
              'local_moved',
              'remote_moved',
              'both_changed',
              'both_new_different',
              'local_deleted',
              'remote_deleted'
            ])
          })
        ),
        counts: z.object({
          upload: z.number(),
          download: z.number(),
          move: z.number(),
          conflict: z.number(),
          preserve: z.number()
        })
      },
      annotations: drivePreviewAnnotations
    },
    async () => textResult(await driveSync.preview())
  )

  server.registerTool(
    'apply_drive_sync',
    {
      title: 'TSUZUNE Drive同期の適用',
      description:
        'Apply exactly one Drive sync plan returned by preview_drive_sync through the running TSUZUNE app. The app rechecks local and remote state and rejects stale plans.',
      inputSchema: {
        plan_id: z.string().min(1).describe('plan_id returned by preview_drive_sync')
      },
      outputSchema: {
        uploaded: z.number(),
        downloaded: z.number(),
        moved: z.number(),
        conflicts: z.number(),
        preserved: z.number(),
        conflictPaths: z.array(z.string()),
        completedAt: z.string()
      },
      annotations: driveApplyAnnotations
    },
    async ({ plan_id }) => textResult(await driveSync.apply(plan_id))
  )

  server.registerTool(
    'move_note',
    {
      title: 'TSUZUNEノート移動',
      description:
        'Move one existing Markdown note to another Vault-relative path. Refuses missing sources, existing destinations, moves outside the Vault, internal folders (.trash, .tsuzune), and notes protected from AI changes. Records an audit entry in 50_履歴/AI更新 and returns the old and new paths.',
      inputSchema: {
        source: z
          .string()
          .min(1)
          .max(500)
          .describe('Vault-relative source note path ending in .md'),
        destination: z
          .string()
          .min(1)
          .max(500)
          .describe('Vault-relative destination note path ending in .md'),
        reason: z
          .string()
          .max(2_000)
          .optional()
          .describe('Why the AI is moving this note'),
        source_refs: z
          .array(z.string().min(1).max(500))
          .max(50)
          .optional()
          .default([])
          .describe('Vault-relative source or research package references'),
        preflight_only: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'Check move safety (backlinks, link impact, manifest) without moving'
          )
      },
      outputSchema: moveOutputSchema,
      annotations: updateAnnotations
    },
    async ({ source, destination, reason, source_refs, preflight_only }) =>
      textResult(
        preflight_only
          ? await vault.preflightMove(source, destination)
          : await vault.moveNote(source, destination, {
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
    'suggest_links',
    {
      title: 'TSUZUNEリンク候補提案',
      description:
        'Suggest useful Wiki-link candidates for one note by combining direct mentions, shared project/folder, context-bundle relations, tags, and frontmatter. Read-only; never modifies notes. Already-linked targets and history notes are excluded.',
      inputSchema: {
        source: z
          .string()
          .min(1)
          .describe('Vault-relative source note path'),
        max_candidates: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe('Maximum number of candidates to return'),
        min_confidence: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .default(0.55)
          .describe('Minimum confidence (0-1) for a candidate')
      },
      outputSchema: {
        source: z.string(),
        total_candidates: z.number(),
        candidates: z.array(
          z.object({
            source: z.string(),
            target: z.string(),
            target_title: z.string(),
            reason: z.string(),
            confidence: z.number(),
            relationship_type: z.enum([
              'project',
              'concept',
              'implementation',
              'source',
              'related_knowledge',
              'historical_context',
              'area',
              'moc'
            ]),
            already_linked: z.boolean(),
            evidence: z.array(z.string())
          })
        )
      },
      annotations: readOnlyAnnotations
    },
    async ({ source, max_candidates, min_confidence }) =>
      textResult(
        await vault.suggestLinks(source, {
          maxCandidates: max_candidates,
          minConfidence: min_confidence
        })
      )
  )

  server.registerTool(
    'add_link',
    {
      title: 'TSUZUNE Wikiリンク追加',
      description:
        'Safely add one Wiki link from an existing note to an existing note. TSUZUNE decides the insertion position, refuses duplicates, immutable/review-protected sources, missing targets, and stale revisions, and records a note_link_add audit entry in 50_履歴/AI更新.',
      inputSchema: {
        source: z
          .string()
          .min(1)
          .max(500)
          .describe('Vault-relative source note path ending in .md'),
        target: z
          .string()
          .min(1)
          .max(500)
          .describe(
            'Vault-relative target note path, an old path alias, or a note name'
          ),
        expected_revision: z
          .string()
          .regex(/^sha256:[a-f0-9]{64}$/)
          .optional()
          .describe('Optional revision guard returned by fetch'),
        reason: z
          .string()
          .max(2_000)
          .optional()
          .describe('Why the AI is adding this link'),
        source_refs: z
          .array(z.string().min(1).max(500))
          .max(50)
          .optional()
          .default([])
          .describe('Vault-relative source or research package references')
      },
      outputSchema: {
        source: z.string(),
        target: z.string(),
        link: z.string(),
        strategy: z.string(),
        previous_revision: z.string(),
        new_revision: z.string().optional(),
        history_path: z.string().optional(),
        pending_review: z.boolean().optional(),
        proposal: z
          .object({
            id: z.string(),
            path: z.string(),
            operation: z.enum(['create', 'update']),
            reason: z.string(),
            expected_revision: z.string().nullable(),
            created_at: z.string()
          })
          .optional()
      },
      annotations: updateAnnotations
    },
    async ({ source, target, expected_revision, reason, source_refs }) =>
      textResult(
        await vault.addLink(source, target, {
          expectedRevision: expected_revision,
          reason,
          sourceRefs: source_refs
        })
      )
  )

  server.registerTool(
    'build_context',
    {
      title: 'TSUZUNEコンテキスト作成',
      description:
        'Build a bounded Markdown context bundle from one note, its linked notes, and related temporal state or event notes.',
      inputSchema: {
        id: z.string().min(1).describe('Relative note path'),
        query: z
          .string()
          .trim()
          .max(500)
          .optional()
          .describe(
            'Optional question used to prioritize related note bodies; MOC titles are not filtered'
          ),
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
      query,
      max_characters,
      as_of,
      include_history,
      temporal_perspective
    }) =>
      structuredOnlyResult(
        await vault.buildContext(id, max_characters, {
          asOf: as_of,
          includeHistory: include_history,
          query,
          temporalPerspective: temporal_perspective
        })
      )
  )

  await server.connect(new StdioServerTransport())
  console.error('TSUZUNE MCP server is ready (6 read tools, 7 write tools).')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`TSUZUNE MCP server failed: ${message}`)
  process.exitCode = 1
})
