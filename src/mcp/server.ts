#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as z from 'zod/v4'
// @ts-expect-error The shared runtime helper is exercised by the MCP fixture.
import { deliveryStatus as readDeliveryStatus } from '../../scripts/source-fingerprint.mjs'
import { DriveSyncMcpClient, defaultDriveSyncStatePath } from './drive-sync'
import {
  MAX_EDITABLE_CHARACTERS,
  VaultMcpService
} from './service'

interface ServerArguments {
  vaultPath?: string
  settingsPath?: string
  driveSyncStatePath?: string
  profile?: 'freebuff'
}

declare const __TSUZUNE_VERSION__: string

const processStartedAt = new Date(Date.now() - process.uptime() * 1_000)
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const deliveryStatus = readDeliveryStatus as (
  repositoryRoot: string
) => Promise<'match' | 'mismatch' | 'unknown'>

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

const movePlanOutputSchema = {
  source_type: z.literal('markdown'),
  source: z.string(),
  destination: z.string(),
  fingerprint: z.string(),
  source_revision: z.string(),
  content_revision: z.string(),
  counts: z.object({
    markdown: z.literal(1),
    directories: z.literal(0),
    attachments: z.literal(0)
  }),
  mappings: z.array(
    z.object({ old_path: z.string(), new_path: z.string() })
  ),
  mapping_truncated: z.literal(false),
  collision: z.literal(false),
  protected_source: z.boolean(),
  protected_destination: z.boolean(),
  link_impact: z.object({
    affected_count: z.number(),
    source_paths: z.array(z.string())
  }),
  drive: z.object({
    tracked_moves: z.number(),
    untracked_uploads: z.number()
  })
}

const moveResultOutputSchema = {
  old_path: z.string(),
  new_path: z.string(),
  fingerprint: z.string(),
  history_path: z.string().nullable()
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
    if (argument === '--profile' && value === 'freebuff') {
      parsed.profile = value
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

async function runtimeFreshness(): Promise<{
  buildUpdatedAt: Date
  packageVersion: string | null
  stale: boolean
}> {
  const build = await stat(fileURLToPath(import.meta.url))
  let packageVersion: string | null = null
  try {
    const packageJson = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8')
    ) as { version?: unknown }
    if (typeof packageJson.version === 'string') {
      packageVersion = packageJson.version
    }
  } catch {
    // The embedded server version remains authoritative when package.json is unavailable.
  }

  return {
    buildUpdatedAt: build.mtime,
    packageVersion,
    stale:
      build.mtimeMs > processStartedAt.getTime() ||
      (packageVersion !== null && packageVersion !== __TSUZUNE_VERSION__)
  }
}

async function assertFreshRuntime(): Promise<void> {
  let freshness
  try {
    freshness = await runtimeFreshness()
  } catch {
    throw new Error('RUNTIME_FRESHNESS_UNAVAILABLE')
  }
  if (freshness.stale) throw new Error('STALE_RUNTIME_WRITE_BLOCKED')
}

async function runtimeInfo(
  vault: VaultMcpService,
  profile: ServerArguments['profile']
) {
  const freshness = await runtimeFreshness()

  let vaultId: string | null = null
  try {
    vaultId = await vault.vaultIdentity()
  } catch {
    // Keep runtime diagnostics available before a Vault has been configured.
  }

  return {
    server_version: __TSUZUNE_VERSION__,
    package_version: freshness.packageVersion,
    profile: profile ?? 'direct',
    process_started_at: processStartedAt.toISOString(),
    build_updated_at: freshness.buildUpdatedAt.toISOString(),
    stale_runtime: freshness.stale,
    vault_id: vaultId
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
      version: __TSUZUNE_VERSION__
    },
    {
      instructions:
        'TSUZUNEのローカルMarkdown Vaultです。検索・取得・関連文脈はsearch/fetch/build_contextを使い、各ツールの説明に従ってください。40_情報源・50_履歴の保護と、削除・強制上書き・Vault外操作の禁止はMCPが強制します。'
    }
  )
  const directTools = args.profile === 'freebuff' ? undefined : server

  server.registerTool(
    'runtime_info',
    {
      title: 'TSUZUNE MCP実行状態',
      description:
        'Report the active MCP build, process start time, profile, stale-runtime status, and anonymized Vault identity without exposing local paths.',
      inputSchema: {},
      outputSchema: {
        server_version: z.string(),
        package_version: z.string().nullable(),
        profile: z.enum(['direct', 'freebuff']),
        process_started_at: z.string(),
        build_updated_at: z.string(),
        stale_runtime: z.boolean(),
        vault_id: z.string().nullable()
      },
      annotations: readOnlyAnnotations
    },
    async () => textResult(await runtimeInfo(vault, args.profile))
  )

  server.registerTool(
    'delivery_info',
    {
      title: 'TSUZUNE本番反映状態',
      description:
        'Compare working source with the latest verified production receipt. Returns only match, mismatch, or unknown.',
      inputSchema: {},
      outputSchema: {
        status: z.enum(['match', 'mismatch', 'unknown'])
      },
      annotations: readOnlyAnnotations
    },
    async () => textResult({ status: await deliveryStatus(repositoryRoot) })
  )

  server.registerTool(
    'search',
    {
      title: 'TSUZUNEノート検索',
      description:
        'Search the active TSUZUNE Vault by note title, relative path, and Markdown content. Space-separated terms use implicit AND; natural Japanese sentences are split on particles/punctuation and ranked by how many segmented terms match (not all terms are required); quoted phrases, -negation, tag:, path:, and file: filters are supported. 50_履歴 (audit history) notes are excluded by default; pass include_history: true to include them.',
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
    'list_directory',
    {
      title: 'TSUZUNEフォルダ一覧',
      description:
        'List bounded folder, Markdown, and attachment metadata without note content. Returns at most 200 entries with next_after pagination. Pass the first page fingerprint as expected_fingerprint on later pages to reject concurrent scope changes.',
      inputSchema: {
        path: z.string().max(500).optional().default(''),
        depth: z.number().int().min(1).max(3).optional().default(1),
        after: z.string().max(500).optional(),
        expected_fingerprint: z
          .string()
          .regex(/^sha256:[a-f0-9]{64}$/)
          .optional()
      },
      outputSchema: {
        path: z.string(),
        depth: z.number(),
        fingerprint: z.string(),
        entries: z.array(
          z.union([
            z.object({
              type: z.literal('directory'),
              path: z.string(),
              name: z.string(),
              counts: z.object({
                directories: z.number(),
                notes: z.number(),
                attachments: z.number()
              })
            }),
            z.object({
              type: z.enum(['markdown', 'attachment']),
              path: z.string(),
              name: z.string(),
              size_bytes: z.number(),
              modified_at: z.string()
            })
          ])
        ),
        truncated: z.boolean(),
        next_after: z.string().optional()
      },
      annotations: readOnlyAnnotations
    },
    async ({ path, depth, after, expected_fingerprint }) =>
      textResult(
        await vault.listDirectory(path, depth, after, expected_fingerprint)
      )
  )

  server.registerTool(
    'create_directory',
    {
      title: 'TSUZUNEフォルダ作成',
      description:
        'Create one new folder inside an existing Vault folder. Never overwrites an existing file or folder and never creates missing parent folders. Use only when the user asks to add a folder.',
      inputSchema: {
        path: z
          .string()
          .min(1)
          .max(500)
          .describe('New Vault-relative folder path')
      },
      outputSchema: {
        path: z.string()
      },
      annotations: createAnnotations
    },
    async ({ path }) => {
      await assertFreshRuntime()
      return textResult(await vault.createDirectory(path))
    }
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
    async ({ path, content }) => {
      await assertFreshRuntime()
      return textResult(await vault.createNote(path, content))
    }
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
    async ({ id, content, expected_revision }) => {
      await assertFreshRuntime()
      return textResult(await vault.updateNote(id, content, expected_revision))
    }
  )

  server.registerTool(
    'autonomous_update_note',
    {
      title: 'TSUZUNE AI自動ノート更新',
      description:
        'Update one existing Markdown note without waiting for human approval. A supplied revision guard is checked first. Identical content is a no-op with no history; changed content preserves the previous version in 50_履歴/AI更新 and returns reason/source references as provenance. Use for AI-assisted knowledge maintenance; never use for raw source notes.',
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
    async ({ id, content, expected_revision, reason, source_refs }) => {
      await assertFreshRuntime()
      return textResult(
        await vault.autonomousUpdateNote(id, content, {
          expectedRevision: expected_revision,
          reason,
          sourceRefs: source_refs
        })
      )
    }
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
    async ({ id, expected_revision, operations, reason, source_refs }) => {
      await assertFreshRuntime()
      return textResult(
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
    }
  )

  server.registerTool(
    'preview_drive_sync',
    {
      title: 'TSUZUNE Drive同期内容の確認',
      description:
        'Preview the active Vault Drive sync through the running TSUZUNE app. This does not apply uploads, downloads, moves, or conflicts. Return planId to the user before applying.',
      inputSchema: {
        propagate_local_deletion: z.boolean().optional(),
        propagate_remote_deletion: z.boolean().optional(),
        force_full: z.boolean().optional()
      },
      outputSchema: {
        planId: z.string(),
        createdAt: z.string(),
        items: z.array(
          z.object({
            path: z.string(),
            oldPath: z.string().optional(),
            action: z.enum(['upload', 'download', 'move', 'conflict', 'preserve', 'trash_local', 'trash_remote']),
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
          , trashLocal: z.number(), trashRemote: z.number()
        })
      },
      annotations: drivePreviewAnnotations
    },
    async (input) => textResult(await driveSync.preview({
      propagateLocalDeletion: input.propagate_local_deletion,
      propagateRemoteDeletion: input.propagate_remote_deletion,
      forceFull: input.force_full
    }))
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
    async ({ plan_id }) => {
      await assertFreshRuntime()
      return textResult(await driveSync.apply(plan_id))
    }
  )

  server.registerTool(
    'preflight_move_entry',
    {
      title: 'TSUZUNEノート移動の事前確認',
      description:
        'Preflight one Markdown note move through the running TSUZUNE app. Returns a state fingerprint and impact summary without changing the Vault.',
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
      },
      outputSchema: movePlanOutputSchema,
      annotations: readOnlyAnnotations
    },
    async ({ source, destination }) =>
      textResult(await driveSync.preflightMoveEntry(source, destination))
  )

  server.registerTool(
    'move_entry',
    {
      title: 'TSUZUNEノート移動の適用',
      description:
        'Apply one preflighted Markdown note move through the running TSUZUNE app. Rejects stale fingerprints and records one AI success audit.',
      inputSchema: {
        source: z.string().min(1).max(500),
        destination: z.string().min(1).max(500),
        expected_fingerprint: z.string().min(1).max(100),
        reason: z.string().min(1).max(2_000),
        source_refs: z
          .array(z.string().min(1).max(500))
          .max(50)
          .optional()
          .default([])
      },
      outputSchema: moveResultOutputSchema,
      annotations: updateAnnotations
    },
    async ({ source, destination, expected_fingerprint, reason, source_refs }) => {
      await assertFreshRuntime()
      return textResult(
        await driveSync.moveEntry({
          source,
          destination,
          expected_fingerprint,
          reason,
          source_refs
        })
      )
    }
  )

  server.registerTool(
    'get_backlinks',
    {
      title: 'TSUZUNEバックリンク取得',
      description:
        'List resolved Wiki-link sources. Excludes 50_履歴 by default; use include_history to opt in and next_after as after to continue.',
      inputSchema: {
        id: z.string().min(1).describe('Relative note path'),
        limit: z.number().int().min(1).max(50).optional().default(20),
        include_history: z.boolean().optional().default(false),
        after: z.string().max(500).optional()
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
        total: z.number(),
        next_after: z.string().optional()
      },
      annotations: readOnlyAnnotations
    },
    async ({ id, limit, include_history, after }) =>
      textResult(await vault.backlinks(id, limit, include_history, after))
  )

  directTools?.registerTool(
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

  directTools?.registerTool(
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
    async ({ source, target, expected_revision, reason, source_refs }) => {
      await assertFreshRuntime()
      return textResult(
        await vault.addLink(source, target, {
          expectedRevision: expected_revision,
          reason,
          sourceRefs: source_refs
        })
      )
    }
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
            'Optional question used when the full context would exceed the bundle budget: preserve every intent delimited by commas, periods, semicolons, question marks, exclamation marks, colons, or newlines; project matching heading branches including bodyless parents and descendants without duplication; share compact seed budget across selected branches; reserve the projected ordinary seed before related source bodies; and prioritize remaining related note bodies. MOC titles are not filtered'
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
            revision: z.string(),
            modified_at: z.string(),
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
      textResult(
        await vault.buildContext(id, max_characters, {
          asOf: as_of,
          includeHistory: include_history,
          query,
          temporalPerspective: temporal_perspective
        })
      )
  )

  await server.connect(new StdioServerTransport())
  console.error('TSUZUNE MCP server is ready.')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`TSUZUNE MCP server failed: ${message}`)
  process.exitCode = 1
})
