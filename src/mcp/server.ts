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
  fetchPageCharacters?: number
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

const sourceReferenceSchema = z.object({
  note_id:z.string(), revision:z.string(), section_id:z.string(), heading:z.string(), slug:z.string(),
  start_character:z.number().int().min(0), end_character:z.number().int().min(0),
  start_line:z.number().int().min(1), end_line:z.number().int().min(1), heading_omitted:z.boolean().optional()
})
const sectionSchema = sourceReferenceSchema.extend({level:z.number().int().min(0).max(6),parent_section_id:z.string().optional()})
const contextReferencesSchema = z.object({representation:z.literal('source_locators'),sections:z.array(sectionSchema),omitted_references:z.number().int().min(0),instruction:z.string()})

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
    previous_revision: z.string()
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
}

const trashResultOutputSchema = {
  old_path: z.string(),
  new_path: z.string(),
  source_revision: z.string(),
  operation_id: z.string().optional()
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
    if (argument === '--fetch-page-characters' && value) {
      const count = Number(value)
      if (!Number.isInteger(count) || count < 2 || count > MAX_EDITABLE_CHARACTERS) {
        throw new Error('--fetch-page-characters must be an integer from 2 to 100000')
      }
      parsed.fetchPageCharacters = count
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
    throw new Error(
      'RUNTIME_FRESHNESS_UNAVAILABLE: Cannot verify the active MCP build. Rebuild the MCP server (Codex: run npm run mcp:register), then restart the MCP client before retrying writes.'
    )
  }
  if (freshness.stale) {
    throw new Error(
      'STALE_RUNTIME_WRITE_BLOCKED: The registered MCP server is stale. Rebuild the MCP server (Codex: run npm run mcp:register), then restart the MCP client before retrying writes.'
    )
  }
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
        '保存済みMarkdown。対象不明search→パスと内容で識別（曖昧なら確認）→単独本文fetch、比較build_context_set、関連・時間build_context。表list_bases/query_base、関係get_local_graph。不足節list_note_sections→fetch_note_section。検索0件は不存在の証明ではなく、抜粋・辺だけで結論を出さない。Contextは整形表示。根拠を引用する回答には原文確認済みのnote_id・完全revision・section_id・文字範囲を添え、事実・解釈・未確認を分ける。範囲不明なら節取得で確認する。AI更新はautonomous_update_noteで完全本文・未変更部分を保持しrevision検査・保存後再取得。patch_note/update_noteは人の確認。40_情報源・50_履歴の保護、永久削除・強制上書き・Vault外操作の禁止はMCPが強制。'
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
        'Use first when the note id is unknown. Search the active TSUZUNE Vault by title, relative path, and Markdown content, then use fetch for one note or build_context for linked or temporal context. Space-separated terms use implicit AND; natural Japanese sentences are segmented and ranked; quoted phrases, -negation, tag:, path:, file:, category:, topic:, type:, role:, and lifecycle: filters are supported. Legacy 50_履歴 is always excluded.',
      inputSchema: {
        query: z.string().min(1).describe('Search query'),
        limit: z.number().int().min(1).max(50).optional().default(10),
        max_characters: z.number().int().min(1000).max(100000).default(15000),
      },
      outputSchema: {
        results: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            text: z.string(),
            raw_excerpt: z.string(),
            excerpt_kind: z.enum(['body_match','fallback_preview']),
            source_reference: sourceReferenceSchema,
            metadata: z.object({
              path: z.string(),
              modified_at: z.string(),
              revision: z.string()
            })
          })
        ),
        omitted_results: z.number()
      },
      annotations: readOnlyAnnotations
    },
    async ({ query, limit, max_characters }) => textResult(await vault.search(query, limit, max_characters))
  )

  server.registerTool(
    'fetch',
    {
      title: 'TSUZUNEノート取得',
      description:
        'Fetch one Markdown chunk and revision by the relative-path id returned from search. Large notes return next_after; repeat with the same id and next_after as after until it is absent. Use build_context instead for linked or temporal context.',
      inputSchema: {
        id: z.string().min(1).describe('Relative note path returned by search'),
        after: z.number().int().min(0).optional().default(0).describe('Character cursor returned as next_after')
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
          editable: z.boolean(),
          start_character: z.number(),
          end_character: z.number(),
          total_characters: z.number()
        }),
        next_after: z.number().optional()
      },
      annotations: readOnlyAnnotations
    },
    async ({ id, after }) => textResult(await vault.fetch(id, after, args.fetchPageCharacters))
  )

  server.registerTool('list_note_sections', {
    title: 'TSUZUNE節一覧',
    description: 'List saved source sections with unique position IDs, revision, duplicate-safe slugs, hierarchy and UTF-16/line ranges. Includes preamble. Page with next_after; on source/Vault changes restart listing. Use to locate omitted Context sections or distinguish duplicate headings; labels may be omitted while IDs/ranges remain.',
    inputSchema: {id:z.string().min(1),limit:z.number().int().min(1).max(200).default(50),after:z.string().max(2048).optional(),max_characters:z.number().int().min(1000).max(100000).default(15000)},
    outputSchema:{id:z.string(),revision:z.string(),sections:z.array(sectionSchema),total:z.number(),omitted_sections:z.number(),omitted_heading_labels:z.number(),next_after:z.string().optional()},
    annotations:readOnlyAnnotations
  },async ({id,...input})=>textResult(await vault.listNoteSections(id,input)))
  server.registerTool('fetch_note_section', {
    title: 'TSUZUNE節原文取得',
    description: 'Fetch exact saved Markdown for a section ID from list_note_sections/source_references, with expected_revision required. A section includes its child headings; preamble covers the prefix or a headingless note. Returns exact quote coordinates and revision-bound next_after. Cite note_id, full revision, section_id and UTF-16 [start_character,end_character) with the quotation. Stale revisions return no body: list again. Do not use partial section text to replace a complete note; fetch full text before updating.',
    inputSchema: {id:z.string().min(1),section_id:z.string().min(1),expected_revision:z.string().min(1),after:z.string().max(2048).optional(),max_characters:z.number().int().min(1000).max(100000).default(15000)},
    outputSchema:{id:z.string(),revision:z.string(),section:sectionSchema,text:z.string(),source_reference:sourceReferenceSchema,total_characters:z.number(),omitted_characters:z.number(),truncated:z.boolean(),next_after:z.string().optional()},
    annotations:readOnlyAnnotations
  },async ({id,section_id,expected_revision,...input})=>textResult(await vault.fetchNoteSection(id,section_id,expected_revision,input)))

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
        'Create a new Markdown note in an existing Vault folder. Never overwrites an existing note. Use only when the user directly asks or the active project contract explicitly requires a durable note.',
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
    'create_derived_note',
    {
      title: 'TSUZUNE派生知識ノート作成',
      description:
        'Create one concept-keyed, category- and topic-tagged derived knowledge note under 30_知識 from an immutable 01_受信箱 or 40_情報源 source. Fetch first and pass the exact source revision. The source remains unchanged. Use for routine low-risk Inbox organization after checking existing knowledge; multiple distinct concept keys may be created from one source revision. Legacy review proposals do not block this direct write or get applied implicitly.',
      inputSchema: {
        destination: z
          .string()
          .min(1)
          .max(500)
          .describe('New 30_知識-relative Markdown path'),
        content: z
          .string()
          .min(1)
          .max(MAX_EDITABLE_CHARACTERS)
          .describe('Markdown body without frontmatter'),
        category: z
          .string()
          .min(1)
          .max(80)
          .describe('Exactly one quote-free category from the live canonical note 30_知識/TSUZUNE分類と保存基準.md; fetch it before creating'),
        topics: z
          .array(z.string().min(1).max(80))
          .min(1)
          .max(3)
          .describe('One to three precise topics without double quotes'),
        derivation_key: z
          .string()
          .min(1)
          .max(80)
          .describe('Stable concept key unique within this exact source revision'),
        source_id: z
          .string()
          .min(1)
          .max(500)
          .describe('Existing Wiki-link-safe 01_受信箱 or 40_情報源 Markdown path, excluding knowledge.md'),
        source_revision: z
          .string()
          .regex(/^sha256:[a-f0-9]{64}$/)
          .describe('Exact opaque revision returned by fetch')
      },
      outputSchema: writeOutputSchema,
      annotations: createAnnotations
    },
    async ({
      destination,
      content,
      category,
      topics,
      derivation_key,
      source_id,
      source_revision
    }) => {
      await assertFreshRuntime()
      return textResult(
        await vault.createDerivedNote({
          destination,
          content,
          category,
          topics,
          derivationKey: derivation_key,
          sourceId: source_id,
          sourceRevision: source_revision
        })
      )
    }
  )

  server.registerTool(
    'propose_derived_note',
    {
      title: 'TSUZUNE派生知識ノート作成（互換名）',
      description:
        'Compatibility alias for create_derived_note. Immediately create one concept-keyed, category- and topic-tagged derived knowledge note under 30_知識 from an immutable 01_受信箱 or 40_情報源 source. Fetch first and pass the exact source revision. The source remains unchanged. Human approval and pending proposals are no longer used; the validated note is written immediately.',
      inputSchema: {
        destination: z
          .string()
          .min(1)
          .max(500)
          .describe('New 30_知識-relative Markdown path'),
        content: z
          .string()
          .min(1)
          .max(MAX_EDITABLE_CHARACTERS)
          .describe('Markdown body without frontmatter'),
        category: z
          .string()
          .min(1)
          .max(80)
          .describe('Exactly one quote-free category from the live canonical note 30_知識/TSUZUNE分類と保存基準.md; fetch it before proposing'),
        topics: z
          .array(z.string().min(1).max(80))
          .min(1)
          .max(3)
          .describe('One to three precise topics without double quotes'),
        derivation_key: z
          .string()
          .min(1)
          .max(80)
          .describe('Stable concept key unique within this exact source revision'),
        source_id: z
          .string()
          .min(1)
          .max(500)
          .describe('Existing Wiki-link-safe 01_受信箱 or 40_情報源 Markdown path, excluding knowledge.md'),
        source_revision: z
          .string()
          .regex(/^sha256:[a-f0-9]{64}$/)
          .describe('Exact opaque revision returned by fetch')
      },
      outputSchema: writeOutputSchema,
      annotations: createAnnotations
    },
    async ({
      destination,
      content,
      category,
      topics,
      derivation_key,
      source_id,
      source_revision
    }) => {
      await assertFreshRuntime()
      return textResult(
        await vault.proposeDerivedNote({
          destination,
          content,
          category,
          topics,
          derivationKey: derivation_key,
          sourceId: source_id,
          sourceRevision: source_revision
        })
      )
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
        'Save a user-requested AI update to an ordinary note without a separate approval prompt. Fetch full content and revision first; preserve all unrequested text, BOM and line endings in the replacement. On conflict, refetch and reconcile before retrying. Refetch after saving. No history is created. Never update raw sources. patch_note/update_note require human confirmation.',
      inputSchema: {
        id: z.string().min(1).max(500).describe('Vault-relative note path'),
        content: z
          .string()
          .max(MAX_EDITABLE_CHARACTERS)
          .describe('Complete replacement Markdown content'),
        expected_revision: z
          .string()
          .regex(/^sha256:[a-f0-9]{64}$/)
          .describe('Required revision guard returned by fetch'),
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
        'Apply revision-checked find/replace patches; requires human confirmation under the existing Codex catalog. For user-requested AI maintenance without a separate prompt, use autonomous_update_note with the full fetched content preserved. Each find matches once by default; operations are atomic. Never use for raw sources.',
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
        'Apply one preflighted Markdown note move through the running TSUZUNE app. Rejects stale fingerprints.',
      inputSchema: {
        source: z.string().min(1).max(500),
        destination: z.string().min(1).max(500),
        expected_fingerprint: z.string().min(1).max(100)
      },
      outputSchema: moveResultOutputSchema,
      annotations: updateAnnotations
    },
    async ({ source, destination, expected_fingerprint }) => {
      await assertFreshRuntime()
      return textResult(
        await driveSync.moveEntry({
          source,
          destination,
          expected_fingerprint
        })
      )
    }
  )

  server.registerTool(
    'trash_entry',
    {
      title: 'TSUZUNE受信箱原典をごみ箱へ移動',
      description:
        'Move one unlinked 01_受信箱 Markdown source directly to the Vault .trash. Requires the exact revision returned by fetch and explicit user authorization. Supply operation_id to retry the exact move after a lost response; legacy calls may omit it. Permanent deletion is not exposed.',
      inputSchema: {
        source: z.string().min(1).max(500),
        expected_revision: z.string().regex(/^sha256:[a-f0-9]{64}$/),
        operation_id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/).optional()
      },
      outputSchema: trashResultOutputSchema,
      annotations: updateAnnotations
    },
    async ({ source, expected_revision, operation_id }) => {
      await assertFreshRuntime()
      return textResult(
        await vault.trashInboxSource(source, expected_revision, operation_id)
      )
    }
  )

  server.registerTool(
    'get_backlinks',
    {
      title: 'TSUZUNEバックリンク取得',
      description:
        'List resolved Wiki-link and Markdown note-link sources. Excludes 50_履歴; use next_after as after to continue.',
      inputSchema: {
        id: z.string().min(1).describe('Relative note path'),
        limit: z.number().int().min(1).max(50).optional().default(20),
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
    async ({ id, limit, after }) =>
      textResult(await vault.backlinks(id, limit, after))
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
        'Safely add one Wiki link from an existing note to an existing note. TSUZUNE decides the insertion position and refuses duplicates, immutable sources, missing targets, and stale revisions. No history note is created.',
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
        new_revision: z.string()
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
        'Build a bounded Markdown bundle from one note and linked or temporal sources. Use after search for linked or temporal evidence; use fetch for one note. Returns content_mode, revisions, omissions, a read-only usage receipt, and state_lineage. section_projection can omit requested sections even when truncated is false; full_note can still be truncated. Empty warnings do not establish current validity. Use list_note_sections and fetch_note_section for missing source text and exact quotations; source_references are locators, not exact quote spans in formatted Context. If the complete sources are already present, do not call build_context or fetch again just to resolve unknown lineage or conflicting claims; report what remains unresolved.',
      inputSchema: {
        id: z.string().min(1).describe('Relative note path'),
        query: z
          .string()
          .trim()
          .max(500)
          .optional()
          .describe(
            'Optional question for heading-based selection when the full context exceeds the budget. Punctuation and newlines separate matching groups; matching does not guarantee coverage of every semantic intent. Selected branches preserve parent headings and descendants and share the compact seed budget before related bodies. MOC titles and candidate selection are unchanged. Check the returned text for missing evidence.'
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
        temporal_perspective: z
          .enum(['valid-time', 'knowledge-time'])
          .optional()
          .default('valid-time')
          .describe(
            'Use valid-time for what was true, or knowledge-time for what was known'
          )
      },
      outputSchema: {
        source_references: contextReferencesSchema,
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
            content_mode: z.enum([
              'full_note',
              'section_projection',
              'moc_index',
              'body_omitted'
            ]),
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
        ),
        state_lineage: z.object({
          schema_version: z.literal(1),
          subject: z.object({
            note_id: z.string(),
            revision: z.string(),
            modified_at: z.string()
          }),
          current_states: z.union([
            z.object({
              status: z.literal('observed'),
              states: z.array(
                z.object({
                  note_id: z.string(),
                  state: z.string(),
                  valid_from: z.string(),
                  valid_to: z.string().optional(),
                  observed_at: z.string().optional(),
                  verified_at: z.string().optional(),
                  review_after: z.string().optional(),
                  revision: z.string(),
                  modified_at: z.string()
                })
              )
            }),
            z.object({ status: z.literal('unknown') })
          ]),
          explicit_sources: z.union([
            z.object({
              status: z.literal('observed'),
              relations: z.array(
                z.object({
                  from_note_id: z.string(),
                  source_ref: z.string(),
                  resolution: z.enum([
                    'resolved',
                    'missing',
                    'ambiguous',
                    'invalid'
                  ]),
                  source_note_id: z.string().optional(),
                  source_revision: z.string().optional()
                })
              )
            }),
            z.object({ status: z.literal('unknown') })
          ]),
          supersession: z.union([
            z.object({
              status: z.literal('observed'),
              relations: z.array(
                z.object({
                  successor_note_id: z.string(),
                  superseded_ref: z.string(),
                  resolution: z.literal('resolved'),
                  superseded_note_id: z.string(),
                  successor_revision: z.string(),
                  superseded_revision: z.string()
                })
              )
            }),
            z.object({ status: z.literal('unknown') })
          ]),
          conflicts: z.union([
            z.object({
              status: z.literal('observed'),
              current_state_note_ids: z.array(z.string())
            }),
            z.object({ status: z.literal('unknown') })
          ]),
          freshness: z.union([
            z.object({
              status: z.literal('observed'),
              value: z.enum(['current', 'review_due']),
              as_of: z.string(),
              review_due_note_ids: z.array(z.string())
            }),
            z.object({
              status: z.literal('unknown'),
              as_of: z.string()
            })
          ]),
          decision_records: z.object({
            status: z.literal('not_observable')
          })
        }),
        usage_receipt: z.object({
          schema_version: z.literal(1),
          search_candidates: z.object({
            status: z.literal('not_observable')
          }),
          context_candidates: z.object({
            status: z.literal('observed'),
            note_ids: z.array(z.string())
          }),
          context_included: z.object({
            status: z.literal('observed'),
            note_ids: z.array(z.string())
          }),
          evidence_cited: z.object({
            status: z.literal('not_observable')
          }),
          decision_or_action: z.object({
            status: z.literal('not_observable')
          }),
          outcome_verified: z.object({
            status: z.literal('not_observable')
          })
        })
      },
      annotations: readOnlyAnnotations
    },
    async ({
      id,
      query,
      max_characters,
      as_of,
      temporal_perspective
    }) =>
      textResult(
        await vault.buildContext(id, max_characters, {
          asOf: as_of,
          query,
          temporalPerspective: temporal_perspective
        })
      )
  )

  server.registerTool('build_context_set', {
    title: 'TSUZUNE複数ノートの文脈',
    description: 'Compare 1–8 saved notes from one snapshot. Search for IDs first when unknown. Seeds receive a fair text budget before related sources; duplicate bodies are included once. Missing seeds stop the entire comparison. Each seed has separate state lineage, revisions and omissions. Check omitted sections with list_note_sections/fetch_note_section and fetch only missing evidence; source_references are locators for exact saved quotes; cite note IDs/headings/short quotations and distinguish fact, interpretation and unknown.',
    inputSchema: {
      ids: z.array(z.string().min(1)).min(1).max(8),
      query: z.string().trim().max(500).optional(),
      max_characters: z.number().int().min(1_000).max(100_000).default(15_000),
      as_of: z.union([z.iso.date(), z.iso.datetime({offset:true})]).optional(),
      temporal_perspective: z.enum(['valid-time','knowledge-time']).default('valid-time')
    },
    annotations: readOnlyAnnotations
  }, async input => textResult(await vault.buildContextSet(input.ids, input.max_characters, {
    query: input.query, asOf: input.as_of, temporalPerspective: input.temporal_perspective
  })))

  server.registerTool('get_local_graph', {
    title: 'TSUZUNE局所Graph読取',
    description: 'Explore explicit Wiki/Markdown links between visible saved notes, depth 1–3. Use search to find the seed ID, then fetch/build_context_set for actual evidence: a link is not a semantic claim. Returns note revisions, distances and omitted node/edge counts. No inferred relations, unlinked mentions, missing notes or legacy history. Nearest nodes are retained first when capped.',
    inputSchema: {
      id: z.string().min(1), depth: z.union([z.literal(1),z.literal(2),z.literal(3)]).default(1),
      direction: z.enum(['incoming','outgoing','both']).default('both'),
      neighbor_links: z.boolean().default(false), max_nodes: z.number().int().min(1).max(500).default(100)
    },
    outputSchema: {
      seed_id: z.string(), depth: z.number(), direction: z.string(), neighbor_links: z.boolean(),
      nodes: z.array(z.object({id:z.string(),title:z.string(),distance:z.number(),revision:z.string(),modified_at:z.string()})),
      edges: z.array(z.object({source:z.string(),target:z.string()})),
      omitted_nodes: z.number(), omitted_edges: z.number(), truncated: z.boolean(), evidence_notice: z.string()
    },
    annotations: readOnlyAnnotations
  }, async ({id,...input}) => textResult(await vault.getLocalGraph(id,input)))

  server.registerTool('list_bases', {
    title: 'TSUZUNE Bases一覧',
    description: 'Find visible saved .base files by name/path before query_base. Returns Base IDs, revisions, saved table view names/indexes and parsing diagnostics. Defaults to 50, maximum 100. Follow next_after with identical inputs; if the Vault/Base source changes restart from the first page. Reading never writes Vault/settings.',
    inputSchema: {
      query: z.string().trim().max(500).optional(),
      limit: z.number().int().min(1).max(100).default(50), after: z.string().max(2048).optional(),
      max_characters: z.number().int().min(1_000).max(100_000).default(15_000)
    },
    annotations: readOnlyAnnotations
  }, async input => textResult(await vault.listBases(input)))

  server.registerTool('query_base', {
    title: 'TSUZUNE Basesの保存済みビュー読取',
    description: 'Read rows of a saved table view (default first view). Use list_bases to find IDs/views. Applies the same filters, multiple sorts, formulas, view limit, groups and summaries as the app, then paginates. Provide context_note_id when expressions use this; never infer an unsaved/current UI note. Returns typed saved/file/computed cells and source revisions; HTML/images/links remain inert data. Inspect omissions and fetch needed note bodies before comparing. Default 50 rows, maximum 200; evaluation terminates after 3 seconds. Continuation binds source, types, view/context and evaluation time; changed inputs require restarting.',
    inputSchema: {
      id: z.string().min(1), view_index: z.number().int().min(0).default(0),
      context_note_id: z.string().min(1).optional(),
      limit: z.number().int().min(1).max(200).default(50), after: z.string().max(2048).optional(),
      max_characters: z.number().int().min(1_000).max(100_000).default(15_000)
    },
    annotations: readOnlyAnnotations
  }, async (input, extra) => textResult(await vault.queryBase(input, extra.signal)))

  await server.connect(new StdioServerTransport())
  console.error('TSUZUNE MCP server is ready.')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`TSUZUNE MCP server failed: ${message}`)
  process.exitCode = 1
})
