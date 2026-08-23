import { createHash } from 'node:crypto'
import { buildContextBundle, type ContextBundle } from '../core/context'
import {
  buildNoteCreationPath,
  getBacklinks,
  getOutgoingLinks
} from '../core/links'
import {
  compilePathAliases,
  resolvePathAlias,
  type CompiledPathAliases
} from '../core/path-aliases'
import {
  basenameRelative,
  dirnameRelative,
  validateRelativePath
} from '../core/paths'
import { searchRendererRanked } from '../core/search'
import {
  assertOnlyLinkInserted,
  buildLinkInsertPlan,
  renderLinkAddRecord,
  suggestLinkCandidates,
  type LinkCandidate
} from './link-ops'
import type { TemporalPerspective } from '../core/temporal'
import { VaultError, VaultService } from '../main/vault'
import {
  isAiImmutablePath,
  isAiReviewPath
} from '../shared/ai-write-policy'
import { isExcludedFilePath } from '../shared/excluded-files'
import type {
  AiWriteReviewProposal,
  NoteDocument,
  VaultSnapshot
} from '../shared/types'
import {
  defaultSettingsPath,
  resolveVaultSource,
  type VaultSourceOptions
} from './vault-source'
import {
  AiWriteReviewStore
} from './review-proposals'

export interface SearchItem {
  id: string
  title: string
  text: string
  metadata: {
    path: string
    modified_at: string
  }
}

export interface SearchOutput {
  results: SearchItem[]
}

export interface FetchOutput {
  id: string
  title: string
  text: string
  metadata: {
    path: string
    modified_at: string
    revision: string
    size_bytes: number
    truncated: boolean
    editable: boolean
  }
}

export interface BacklinksOutput {
  note: {
    id: string
    title: string
  }
  backlinks: Array<{
    id: string
    title: string
  }>
  total: number
  next_after?: string
}

export interface ContextOutput {
  seed_id: string
  markdown: string
  character_count: number
  truncated: boolean
  as_of: string
  temporal_perspective: TemporalPerspective
  included: Array<{
    path: string
    name: string
    relation: ContextBundle['included'][number]['relation']
    truncated: boolean
    revision: string
    modified_at: string
    content_omitted?: boolean
    temporal_status?: ContextBundle['included'][number]['temporalStatus']
    selection_reasons: string[]
  }>
  omitted_ids: string[]
  warnings: ContextBundle['warnings']
}

export interface BuildContextOptions {
  asOf?: string
  includeHistory?: boolean
  query?: string
  temporalPerspective?: TemporalPerspective
}

export interface WriteOutput {
  id: string
  title: string
  metadata: {
    path: string
    modified_at: string
    revision: string
    size_bytes: number
  }
  pending_review?: true
  proposal?: {
    id: string
    path: string
    operation: 'create' | 'update'
    reason: string
    expected_revision: string | null
    created_at: string
  }
}
export type DirectoryListEntry =
  | {
      type: 'directory'
      path: string
      name: string
      counts: { directories: number; notes: number; attachments: number }
    }
  | {
      type: 'markdown' | 'attachment'
      path: string
      name: string
      size_bytes: number
      modified_at: string
    }

export interface DirectoryListOutput {
  path: string
  depth: number
  fingerprint: string
  entries: DirectoryListEntry[]
  truncated: boolean
  next_after?: string
}

function directoryFingerprint(
  rootPath: string,
  path: string,
  depth: number,
  entries: DirectoryListEntry[]
): string {
  const inventory = entries.map((entry) =>
    entry.type === 'directory'
      ? [entry.path, entry.type]
      : [entry.path, entry.type, entry.size_bytes, entry.modified_at]
  )
  const digest = createHash('sha256')
    .update(rootPath)
    .update('\0')
    .update(path)
    .update('\0')
    .update(String(depth))
    .update('\0')
    .update(JSON.stringify(inventory))
    .digest('hex')
  return `sha256:${digest}`
}
function pendingReviewOutput(
  proposal: AiWriteReviewProposal,
  note: Pick<NoteDocument, 'name' | 'modifiedAt' | 'size'> | null
): WriteOutput {
  return {
    id: proposal.path,
    title: note?.name ?? basenameRelative(proposal.path).replace(/\.md$/i, ''),
    metadata: {
      path: proposal.path,
      modified_at: note
        ? new Date(note.modifiedAt).toISOString()
        : proposal.createdAt,
      revision: proposal.expectedRevision ?? `pending:${proposal.id}`,
      size_bytes: note?.size ?? Buffer.byteLength(proposal.content, 'utf8')
    },
    pending_review: true,
    proposal: {
      id: proposal.id,
      path: proposal.path,
      operation: proposal.operation,
      reason: proposal.reason,
      expected_revision: proposal.expectedRevision,
      created_at: proposal.createdAt
    }
  }
}

export interface AutonomousUpdateOptions {
  expectedRevision?: string
  reason?: string
  sourceRefs?: string[]
}

export interface AutonomousUpdateOutput extends WriteOutput {
  unchanged?: true
  provenance: {
    actor: 'ai'
    reason: string
    source_refs: string[]
    previous_revision: string
    history_path?: string
  }
}


export interface PatchOperation {
  find: string
  replace: string
  replaceAll?: boolean
}

export interface PatchNoteOptions {
  reason?: string
  sourceRefs?: string[]
}

export interface PatchNoteOutput extends AutonomousUpdateOutput {
  patch: {
    operations: Array<{
      find: string
      replace: string
      match_count: number
    }>
  }
}

export interface SuggestLinksOptions {
  maxCandidates?: number
  minConfidence?: number
}

export interface SuggestLinksOutput {
  source: string
  candidates: LinkCandidate[]
  total_candidates: number
}

export interface AddLinkOptions {
  expectedRevision?: string
  reason?: string
  sourceRefs?: string[]
}

export interface AddLinkOutput {
  source: string
  target: string
  link: string
  strategy: string
  previous_revision: string
  new_revision?: string
  history_path?: string
  pending_review?: true
  proposal?: {
    id: string
    path: string
    operation: 'create' | 'update'
    reason: string
    expected_revision: string | null
    created_at: string
  }
}

export const MAX_EDITABLE_CHARACTERS = 100_000

function assertEditableLength(content: string): void {
  if (content.length > MAX_EDITABLE_CHARACTERS) {
    throw new Error('MCPで作成・更新できるノートは10万文字までです。')
  }
}

function assertAiWritable(path: string): void {
  if (isAiImmutablePath(path)) {
    throw new Error(`AIから変更できないノートです: ${path}`)
  }
}

function assertNotReviewProtected(
  path: string,
  reviewPaths: readonly string[]
): void {
  if (isAiReviewPath(path, reviewPaths)) {
    throw new Error('Review対象のノートは移動できません: ' + path)
  }
}

function revisionFor(rootPath: string, note: NoteDocument): string {
  const digest = createHash('sha256')
    .update(rootPath)
    .update('\0')
    .update(note.path)
    .update('\0')
    .update(String(note.modifiedAt))
    .update('\0')
    .update(String(note.size))
    .update('\0')
    .update(note.content)
    .digest('hex')
  return `sha256:${digest}`
}

function revisionRootSha256(rootPath: string): string {
  return createHash('sha256').update(rootPath).digest('hex')
}

function canonicalNote(
  snapshot: VaultSnapshot,
  rawId: string,
  aliases = compilePathAliases(snapshot.pathAliases ?? {})
): NoteDocument {
  const id = rawId.trim().replaceAll('\\', '/')
  const validation = validateRelativePath(id)
  if (
    !validation.valid ||
    !validation.normalized ||
    !validation.normalized.toLocaleLowerCase().endsWith('.md')
  ) {
    throw new Error('Vault内のMarkdownノートの相対パスを指定してください。')
  }

  const exact = snapshot.notes.find(
    (candidate) =>
      candidate.path.toLocaleLowerCase() ===
      validation.normalized?.toLocaleLowerCase()
  )
  if (exact) {
    return exact
  }

  const canonicalPath = resolvePathAlias(aliases, validation.normalized)
  const canonical = snapshot.notes.find(
    (candidate) =>
      candidate.path.toLocaleLowerCase() === canonicalPath.toLocaleLowerCase()
  )
  if (!canonical) {
    throw new Error(`ノートが見つかりません: ${validation.normalized}`)
  }
  return canonical
}

function resolveLinkTarget(
  snapshot: VaultSnapshot,
  sourcePath: string,
  rawTarget: string,
  aliases: CompiledPathAliases
): NoteDocument {
  const normalized = rawTarget.trim().replaceAll('\\', '/')
  const candidates = [
    normalized,
    buildNoteCreationPath(sourcePath, normalized)
  ].filter((candidate): candidate is string => Boolean(candidate))
  for (const candidate of candidates) {
    try {
      return canonicalNote(snapshot, candidate, aliases)
    } catch {
      // try the next path form (full path vs. a name relative to the source)
    }
  }
  throw new Error(`リンク対象のノートが見つかりません: ${rawTarget}`)
}

async function ensureDirectory(
  vault: VaultService,
  relativeDirectory: string
): Promise<void> {
  let current = ''
  for (const segment of relativeDirectory.split('/').filter(Boolean)) {
    current = current ? `${current}/${segment}` : segment
    try {
      await vault.createDirectory({
        parent: dirnameRelative(current),
        name: basenameRelative(current)
      })
    } catch (error) {
      if (
        !(error instanceof VaultError) ||
        error.appError.code !== 'ALREADY_EXISTS'
      ) {
        throw error
      }
    }
  }
}

function historyPathFor(targetPath: string, previousRevision: string): string {
  const timestamp = new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replaceAll('.', '-')
  const target = targetPath
    .replace(/\.md$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `50_履歴/AI更新/${timestamp}-${target || 'note'}-${previousRevision.slice(-12)}.md`
}

function renderAutonomousRevision(
  rootPath: string,
  targetPath: string,
  previousModifiedAt: number,
  previousSizeBytes: number,
  previousRevision: string,
  previousContent: string,
  reason: string,
  sourceRefs: string[]
): string {
  return [
    '---',
    'kind: ai_revision',
    `target: ${targetPath}`,
    'actor: ai',
    `reason: ${JSON.stringify(reason)}`,
    'source_refs:',
    ...(sourceRefs.length > 0
      ? sourceRefs.map((sourceRef) => `  - ${JSON.stringify(sourceRef)}`)
      : ['  - none']),
    `previous_revision: ${previousRevision}`,
    `previous_modified_at: ${previousModifiedAt}`,
    `previous_size_bytes: ${previousSizeBytes}`,
    `revision_root_sha256: ${revisionRootSha256(rootPath)}`,
    `recorded_at: ${new Date().toISOString()}`,
    '---',
    '',
    '# Previous content',
    '',
    previousContent
  ].join('\n')
}

/**
 * Folders excluded from MCP search results by default.
 * 50_履歴 is the audit trail (AI update history, status changes) and is not
 * searchable knowledge. Callers can opt back in with include_history.
 */
export const DEFAULT_SEARCH_EXCLUDED_PATHS = ['50_履歴']

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n')
}

function dominantNewlineStyle(value: string): '\r\n' | '\n' {
  const crlfCount = (value.match(/\r\n/g) ?? []).length
  const lfCount = (value.match(/(?<!\r)\n/g) ?? []).length
  return crlfCount > lfCount ? '\r\n' : '\n'
}

function restoreNewlines(value: string, style: '\r\n' | '\n'): string {
  return style === '\r\n' ? value.replace(/\n/g, '\r\n') : value
}

function countOccurrences(value: string, needle: string): number {
  let count = 0
  let index = value.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = value.indexOf(needle, index + needle.length)
  }
  return count
}

interface PatchApplication {
  content: string
  operations: Array<{ find: string; replace: string; match_count: number }>
}

function applyPatchOperations(
  content: string,
  operations: readonly PatchOperation[]
): PatchApplication {
  let current = content
  const applied: PatchApplication['operations'] = []
  for (const operation of operations) {
    if (!operation.find) {
      throw new Error('findは空にできません。')
    }
    const matchCount = countOccurrences(current, operation.find)
    if (operation.replaceAll) {
      if (matchCount === 0) {
        throw new Error(`findの一致が0件です: ${operation.find}`)
      }
      current = current.split(operation.find).join(operation.replace)
    } else {
      if (matchCount !== 1) {
        throw new Error(
          `findの一致が${matchCount}件です(既定はちょうど1件必要。replace_all: trueで全置換): ${operation.find}`
        )
      }
      current = current.replace(operation.find, operation.replace)
    }
    applied.push({
      find: operation.find,
      replace: operation.replace,
      match_count: matchCount
    })
  }
  return { content: current, operations: applied }
}

export class VaultMcpService {
  private readonly reviewStore: AiWriteReviewStore

  constructor(private readonly source: VaultSourceOptions = {}) {
    this.reviewStore = new AiWriteReviewStore(
      source.settingsPath || defaultSettingsPath()
    )
  }

  async vaultIdentity(): Promise<string> {
    const source = await resolveVaultSource(this.source)
    return `sha256:${revisionRootSha256(source.vaultPath)}`
  }

  private async snapshot(): Promise<{
    vault: VaultService
    snapshot: VaultSnapshot
    aiReviewPaths: string[]
  }> {
    const vault = new VaultService()
    const source = await resolveVaultSource(this.source)
    await vault.setRootPath(source.vaultPath)
    return {
      vault,
      snapshot: await vault.scan(source.userIgnoreFilters),
      aiReviewPaths: source.aiReviewPaths
    }
  }

  async listReviewProposals(): Promise<AiWriteReviewProposal[]> {
    return this.reviewStore.list()
  }

  async cancelReviewProposal(id: string): Promise<void> {
    if (!(await this.reviewStore.remove(id))) {
      throw new Error('AI変更案が見つかりません。')
    }
  }

  async approveReviewProposal(id: string): Promise<WriteOutput> {
    const proposal = await this.reviewStore.get(id)
    if (!proposal) throw new Error('AI変更案が見つかりません。')

    const { vault, snapshot } = await this.snapshot()
    assertAiWritable(proposal.path)

    if (proposal.operation === 'create') {
      if (
        snapshot.notes.some(
          (note) => note.path.toLowerCase() === proposal.path.toLowerCase()
        )
      ) {
        await this.reviewStore.remove(id)
        throw new VaultError({
          code: 'FILE_CHANGED',
          message:
            '承認待ちの間に同じノートが作成されました。変更案は失効しました。'
        })
      }
      const created = await vault.createNote({
        directory: dirnameRelative(proposal.path),
        name: basenameRelative(proposal.path),
        content: proposal.content
      })
      const note = await vault.readNote(created.path)
      await this.reviewStore.remove(id)
      return writeOutput(snapshot.rootPath, note)
    }

    const existing = snapshot.notes.find(
      (note) => note.path.toLowerCase() === proposal.path.toLowerCase()
    )
    if (!existing) {
      await this.reviewStore.remove(id)
      throw new VaultError({
        code: 'FILE_CHANGED',
        message: '承認待ちの間にノートが削除されました。変更案は失効しました。'
      })
    }
    const canonical = canonicalNote(snapshot, existing.path)
    const current = await vault.readNote(canonical.path)
    const currentRevision = revisionFor(snapshot.rootPath, current)
    if (currentRevision !== proposal.expectedRevision) {
      await this.reviewStore.remove(id)
      throw new VaultError({
        code: 'FILE_CHANGED',
        message: '承認待ちの間にノートが変更されました。変更案は失効しました。',
        currentModifiedAt: current.modifiedAt
      })
    }

    await applyUpdateWithHistory(
      vault,
      snapshot.rootPath,
      canonical.path,
      current,
      currentRevision,
      proposal.content,
      proposal.reason,
      proposal.sourceRefs
    )
    const note = await vault.readNote(canonical.path)
    await this.reviewStore.remove(id)
    return writeOutput(snapshot.rootPath, note)
  }

  async search(
    query: string,
    limit = 10,
    includeHistory = false
  ): Promise<SearchOutput> {
    const { snapshot } = await this.snapshot()
    const notes = includeHistory
      ? snapshot.notes
      : snapshot.notes.filter(
          (note) =>
            !isExcludedFilePath(note.path, DEFAULT_SEARCH_EXCLUDED_PATHS)
        )
    return {
      results: searchRendererRanked(notes, query)
        .slice(0, limit)
        .map((result) => ({
          id: result.path,
          title: result.name,
          text: result.excerpt,
          metadata: {
            path: result.path,
            modified_at: new Date(result.modifiedAt).toISOString()
          }
        }))
    }
  }

  async createNote(path: string, content = ''): Promise<WriteOutput> {
    assertEditableLength(content)
    const id = path.trim().replaceAll('\\', '/')
    const validation = validateRelativePath(id)
    if (
      !validation.valid ||
      !validation.normalized ||
      !validation.normalized.toLocaleLowerCase().endsWith('.md')
    ) {
      throw new Error(
        'Vault内の新しいMarkdownノートの相対パスを指定してください。'
      )
    }

    const { vault, snapshot, aiReviewPaths } = await this.snapshot()
    assertAiWritable(validation.normalized)

    if (
      snapshot.notes.some(
        (note) =>
          note.path.toLowerCase() === validation.normalized?.toLowerCase()
      )
    ) {
      throw new Error(`ノートは既に存在します: ${validation.normalized}`)
    }
    if (isAiReviewPath(validation.normalized, aiReviewPaths)) {
      const proposal = await this.reviewStore.add({
        path: validation.normalized,
        operation: 'create',
        content,
        expectedRevision: null,
        reason: 'AIによるノート作成',
        sourceRefs: []
      })
      return pendingReviewOutput(proposal, null)
    }

    const created = await vault.createNote({
      directory: dirnameRelative(validation.normalized),
      name: basenameRelative(validation.normalized),
      content
    })
    const note = await vault.readNote(created.path)

    return {
      id: note.path,
      title: note.name,
      metadata: {
        path: note.path,
        modified_at: new Date(note.modifiedAt).toISOString(),
        revision: revisionFor(snapshot.rootPath, note),
        size_bytes: note.size
      }
    }
  }

  async createDirectory(path: string): Promise<{ path: string }> {
    const id = path.trim().replaceAll('\\', '/')
    const validation = validateRelativePath(id)
    if (!validation.valid || !validation.normalized) {
      throw new Error('Vault内の新しいフォルダの相対パスを指定してください。')
    }

    const { vault, aiReviewPaths } = await this.snapshot()
    assertAiWritable(validation.normalized)
    if (isAiReviewPath(validation.normalized, aiReviewPaths)) {
      throw new Error(
        `Review対象のフォルダは作成できません: ${validation.normalized}`
      )
    }
    return vault.createDirectory({
      parent: dirnameRelative(validation.normalized),
      name: basenameRelative(validation.normalized)
    })
  }

  async listDirectory(
    path = '',
    depth = 1,
    after?: string,
    expectedFingerprint?: string
  ): Promise<DirectoryListOutput> {
    const validation = validateRelativePath(path.trim().replaceAll('\\', '/'))
    if (!validation.valid) {
      throw new Error('Vault内のフォルダの相対パスを指定してください。')
    }
    const normalized = validation.normalized ?? ''
    const { snapshot } = await this.snapshot()
    const canonical = snapshot.directories.find(
      (directory) =>
        directory.toLocaleLowerCase() === normalized.toLocaleLowerCase()
    )
    if (canonical === undefined) {
      throw new Error(`フォルダが見つかりません: ${normalized}`)
    }

    const boundedDepth = Math.min(3, Math.max(1, depth))
    const withinDepth = (candidate: string): boolean => {
      const relative = canonical
        ? candidate.slice(canonical.length + 1)
        : candidate
      return (
        candidate !== canonical &&
        (canonical ? candidate.startsWith(`${canonical}/`) : true) &&
        relative.split('/').length <= boundedDepth
      )
    }
    const entries: DirectoryListEntry[] = [
      ...snapshot.directories.filter(withinDepth).map((directory) => ({
        type: 'directory' as const,
        path: directory,
        name: basenameRelative(directory),
        counts: {
          directories: snapshot.directories.filter(
            (candidate) => candidate && dirnameRelative(candidate) === directory
          ).length,
          notes: snapshot.notes.filter(
            (candidate) => dirnameRelative(candidate.path) === directory
          ).length,
          attachments: (snapshot.attachments ?? []).filter(
            (candidate) => dirnameRelative(candidate.path) === directory
          ).length
        }
      })),
      ...snapshot.notes
        .filter((note) => withinDepth(note.path))
        .map((note) => ({
          type: 'markdown' as const,
          path: note.path,
          name: note.name,
          size_bytes: note.size,
          modified_at: new Date(note.modifiedAt).toISOString()
        })),
      ...(snapshot.attachments ?? [])
        .filter((attachment) => withinDepth(attachment.path))
        .map((attachment) => ({
          type: 'attachment' as const,
          path: attachment.path,
          name: attachment.name,
          size_bytes: attachment.size,
          modified_at: new Date(attachment.modifiedAt).toISOString()
        }))
    ].sort((left, right) => left.path.localeCompare(right.path, 'ja'))
    const fingerprint = directoryFingerprint(
      snapshot.rootPath,
      canonical,
      boundedDepth,
      entries
    )
    if (expectedFingerprint && expectedFingerprint !== fingerprint) {
      throw new VaultError({
        code: 'FILE_CHANGED',
        message:
          'フォルダ一覧が前のページ取得後に変更されました。先頭ページから再取得してください。'
      })
    }
    const remaining = after
      ? entries.filter((entry) => entry.path.localeCompare(after, 'ja') > 0)
      : entries
    const page = remaining.slice(0, 200)
    const truncated = remaining.length > page.length

    return {
      path: canonical,
      depth: boundedDepth,
      fingerprint,
      entries: page,
      truncated,
      ...(truncated ? { next_after: page.at(-1)?.path } : {})
    }
  }

  async fetch(id: string): Promise<FetchOutput> {
    const { vault, snapshot } = await this.snapshot()
    const canonical = canonicalNote(snapshot, id)
    const note = await vault.readNote(canonical.path)
    const truncated = note.content.length > MAX_EDITABLE_CHARACTERS

    return {
      id: note.path,
      title: note.name,
      text: note.content.slice(0, MAX_EDITABLE_CHARACTERS),
      metadata: {
        path: note.path,
        modified_at: new Date(note.modifiedAt).toISOString(),
        revision: revisionFor(snapshot.rootPath, note),
        size_bytes: note.size,
        truncated,
        editable: !truncated && !isAiImmutablePath(note.path)
      }
    }
  }

  async updateNote(
    id: string,
    content: string,
    expectedRevision: string
  ): Promise<WriteOutput> {
    assertEditableLength(content)
    const { vault, snapshot, aiReviewPaths } = await this.snapshot()
    const canonical = canonicalNote(snapshot, id)
    assertAiWritable(canonical.path)
    const current = await vault.readNote(canonical.path)
    assertEditableLength(current.content)
    if (revisionFor(snapshot.rootPath, current) !== expectedRevision) {
      throw new VaultError({
        code: 'FILE_CHANGED',
        message:
          'このノートは取得後に変更されたか、別のVaultへ切り替わりました。再取得してから更新してください。',
        currentModifiedAt: current.modifiedAt
      })
    }
    if (isAiReviewPath(canonical.path, aiReviewPaths)) {
      const proposal = await this.reviewStore.add({
        path: canonical.path,
        operation: 'update',
        content,
        expectedRevision,
        reason: 'AI変更案の承認',
        sourceRefs: []
      })
      return pendingReviewOutput(proposal, current)
    }
    await vault.saveNote({
      path: canonical.path,
      content,
      expectedModifiedAt: current.modifiedAt,
      expectedContent: current.content
    })
    const note = await vault.readNote(canonical.path)

    return {
      id: note.path,
      title: note.name,
      metadata: {
        path: note.path,
        modified_at: new Date(note.modifiedAt).toISOString(),
        revision: revisionFor(snapshot.rootPath, note),
        size_bytes: note.size
      }
    }
  }

  async autonomousUpdateNote(
    id: string,
    content: string,
    options: AutonomousUpdateOptions = {}
  ): Promise<AutonomousUpdateOutput> {
    assertEditableLength(content)
    const { vault, snapshot, aiReviewPaths } = await this.snapshot()
    const canonical = canonicalNote(snapshot, id)
    assertAiWritable(canonical.path)
    const current = await vault.readNote(canonical.path)
    assertEditableLength(current.content)
    const previousRevision = revisionFor(snapshot.rootPath, current)

    if (
      options.expectedRevision &&
      options.expectedRevision !== previousRevision
    ) {
      throw new VaultError({
        code: 'FILE_CHANGED',
        message:
          'このノートは取得後に変更されたか、別のVaultへ切り替わりました。再取得してから自動更新してください。',
        currentModifiedAt: current.modifiedAt
      })
    }

    const reason = options.reason?.trim() || 'AIによる自動更新'
    const sourceRefs = (options.sourceRefs ?? [])
      .map((sourceRef) => sourceRef.trim())
      .filter(Boolean)

    if (content === current.content) {
      return {
        id: current.path,
        title: current.name,
        metadata: {
          path: current.path,
          modified_at: new Date(current.modifiedAt).toISOString(),
          revision: previousRevision,
          size_bytes: current.size
        },
        unchanged: true,
        provenance: {
          actor: 'ai',
          reason,
          source_refs: sourceRefs,
          previous_revision: previousRevision
        }
      }
    }

    if (isAiReviewPath(canonical.path, aiReviewPaths)) {
      const proposal = await this.reviewStore.add({
        path: canonical.path,
        operation: 'update',
        content,
        expectedRevision: previousRevision,
        reason,
        sourceRefs
      })
      return {
        ...pendingReviewOutput(proposal, current),
        provenance: {
          actor: 'ai',
          reason,
          source_refs: sourceRefs,
          previous_revision: previousRevision
        }
      }
    }

    const historyPath = await applyUpdateWithHistory(
      vault,
      snapshot.rootPath,
      canonical.path,
      current,
      previousRevision,
      content,
      reason,
      sourceRefs
    )
    const note = await vault.readNote(canonical.path)

    return {
      id: note.path,
      title: note.name,
      metadata: {
        path: note.path,
        modified_at: new Date(note.modifiedAt).toISOString(),
        revision: revisionFor(snapshot.rootPath, note),
        size_bytes: note.size
      },
      provenance: {
        actor: 'ai',
        reason,
        source_refs: sourceRefs,
        previous_revision: previousRevision,
        history_path: historyPath
      }
    }
  }

  async patchNote(
    id: string,
    expectedRevision: string,
    operations: readonly PatchOperation[],
    options: PatchNoteOptions = {}
  ): Promise<PatchNoteOutput> {
    if (operations.length === 0 || operations.length > 20) {
      throw new Error('operationsは1〜20件で指定してください。')
    }
    const { vault, snapshot, aiReviewPaths } = await this.snapshot()
    const canonical = canonicalNote(snapshot, id)
    assertAiWritable(canonical.path)
    const current = await vault.readNote(canonical.path)
    assertEditableLength(current.content)
    const previousRevision = revisionFor(snapshot.rootPath, current)
    if (previousRevision !== expectedRevision) {
      throw new VaultError({
        code: 'FILE_CHANGED',
        message:
          'このノートは取得後に変更されたか、別のVaultへ切り替わりました。再取得してからパッチしてください。',
        currentModifiedAt: current.modifiedAt
      })
    }

    const reason = options.reason?.trim() || 'AIによる部分更新'
    const sourceRefs = (options.sourceRefs ?? [])
      .map((sourceRef) => sourceRef.trim())
      .filter(Boolean)

    const newlineStyle = dominantNewlineStyle(current.content)
    const normalized = normalizeNewlines(current.content)
    const patch = applyPatchOperations(normalized, operations)
    if (patch.content === normalized) {
      throw new Error('パッチ適用後も内容が変わりません(no-op)。')
    }
    const content = restoreNewlines(patch.content, newlineStyle)
    assertEditableLength(content)

    if (isAiReviewPath(canonical.path, aiReviewPaths)) {
      const proposal = await this.reviewStore.add({
        path: canonical.path,
        operation: 'update',
        content,
        expectedRevision: previousRevision,
        reason,
        sourceRefs
      })
      return {
        ...pendingReviewOutput(proposal, current),
        provenance: {
          actor: 'ai',
          reason,
          source_refs: sourceRefs,
          previous_revision: previousRevision
        },
        patch: { operations: patch.operations }
      }
    }

    const historyPath = await applyUpdateWithHistory(
      vault,
      snapshot.rootPath,
      canonical.path,
      current,
      previousRevision,
      content,
      reason,
      sourceRefs
    )
    const note = await vault.readNote(canonical.path)
    return {
      id: note.path,
      title: note.name,
      metadata: {
        path: note.path,
        modified_at: new Date(note.modifiedAt).toISOString(),
        revision: revisionFor(snapshot.rootPath, note),
        size_bytes: note.size
      },
      provenance: {
        actor: 'ai',
        reason,
        source_refs: sourceRefs,
        previous_revision: previousRevision,
        history_path: historyPath
      },
      patch: { operations: patch.operations }
    }
  }

  async backlinks(
    id: string,
    limit = 20,
    includeHistory = false,
    after?: string
  ): Promise<BacklinksOutput> {
    const { snapshot } = await this.snapshot()
    const aliases = compilePathAliases(snapshot.pathAliases ?? {})
    const note = canonicalNote(snapshot, id, aliases)
    const backlinks = getBacklinks(note.path, snapshot.notes, aliases)
      .filter(
        (item) =>
          includeHistory ||
          !isExcludedFilePath(item.path, DEFAULT_SEARCH_EXCLUDED_PATHS)
      )
      .sort((left, right) => left.path.localeCompare(right.path, 'ja'))
    const remaining = after
      ? backlinks.filter(
          (item) => item.path.localeCompare(after, 'ja') > 0
        )
      : backlinks
    const page = remaining.slice(0, limit)
    const hasMore = remaining.length > page.length

    return {
      note: {
        id: note.path,
        title: note.name
      },
      backlinks: page.map((item) => ({
        id: item.path,
        title: item.name
      })),
      total: backlinks.length,
      ...(hasMore ? { next_after: page.at(-1)?.path } : {})
    }
  }
  async suggestLinks(
    source: string,
    options: SuggestLinksOptions = {}
  ): Promise<SuggestLinksOutput> {
    const { snapshot } = await this.snapshot()
    const aliases = compilePathAliases(snapshot.pathAliases ?? {})
    const note = canonicalNote(snapshot, source, aliases)
    const candidates = suggestLinkCandidates(
      note,
      snapshot.notes,
      aliases,
      options
    )
    return {
      source: note.path,
      candidates,
      total_candidates: candidates.length
    }
  }

  async addLink(
    source: string,
    target: string,
    options: AddLinkOptions = {}
  ): Promise<AddLinkOutput> {
    const { vault, snapshot, aiReviewPaths } = await this.snapshot()
    const aliases = compilePathAliases(snapshot.pathAliases ?? {})
    const canonical = canonicalNote(snapshot, source, aliases)
    assertAiWritable(canonical.path)

    const targetNote = resolveLinkTarget(
      snapshot,
      canonical.path,
      target,
      aliases
    )
    if (
      targetNote.path.toLocaleLowerCase() === canonical.path.toLocaleLowerCase()
    ) {
      throw new Error('自分自身へのリンクは追加できません。')
    }
    const current = await vault.readNote(canonical.path)
    const outgoing = getOutgoingLinks(current.content, snapshot.notes, aliases)
    const alreadyLinked = outgoing.some(
      (link) =>
        link.status === 'resolved' &&
        link.resolvedPath?.toLocaleLowerCase() ===
          targetNote.path.toLocaleLowerCase()
    )
    if (alreadyLinked) {
      throw new Error(
        `既にリンクされています: ${canonical.path} -> ${targetNote.path}`
      )
    }
    const previousRevision = revisionFor(snapshot.rootPath, current)
    if (
      options.expectedRevision &&
      options.expectedRevision !== previousRevision
    ) {
      throw new VaultError({
        code: 'FILE_CHANGED',
        message:
          'このノートは取得後に変更されたか、別のVaultへ切り替わりました。再取得してからリンクを追加してください。',
        currentModifiedAt: current.modifiedAt
      })
    }

    const plan = buildLinkInsertPlan(current.content, targetNote.path)
    assertOnlyLinkInserted(
      current.content,
      plan.newContent,
      plan.insertedAt,
      plan.insertedText
    )
    assertEditableLength(plan.newContent)
    const reason = options.reason?.trim() || 'AIによるWikiリンク追加'
    const sourceRefs = (options.sourceRefs ?? [])
      .map((sourceRef) => sourceRef.trim())
      .filter(Boolean)

    if (isAiReviewPath(canonical.path, aiReviewPaths)) {
      const proposal = await this.reviewStore.add({
        path: canonical.path,
        operation: 'update',
        content: plan.newContent,
        expectedRevision: previousRevision,
        reason,
        sourceRefs
      })
      return {
        source: canonical.path,
        target: targetNote.path,
        link: plan.link,
        strategy: plan.strategy,
        previous_revision: previousRevision,
        pending_review: true,
        proposal: {
          id: proposal.id,
          path: proposal.path,
          operation: proposal.operation,
          reason: proposal.reason,
          expected_revision: proposal.expectedRevision,
          created_at: proposal.createdAt
        }
      }
    }

    await vault.saveNote({
      path: canonical.path,
      content: plan.newContent,
      expectedModifiedAt: current.modifiedAt,
      expectedContent: current.content
    })
    const saved = await vault.readNote(canonical.path)
    const newRevision = revisionFor(snapshot.rootPath, saved)
    const historyPath = await recordNoteLinkAdd(
      vault,
      canonical.path,
      targetNote.path,
      plan.link,
      previousRevision,
      newRevision,
      reason,
      sourceRefs
    )

    return {
      source: canonical.path,
      target: targetNote.path,
      link: plan.link,
      strategy: plan.strategy,
      previous_revision: previousRevision,
      new_revision: newRevision,
      history_path: historyPath
    }
  }

  async buildContext(
    id: string,
    maxCharacters = 15_000,
    options: BuildContextOptions = {}
  ): Promise<ContextOutput> {
    const { snapshot } = await this.snapshot()
    const aliases = compilePathAliases(snapshot.pathAliases ?? {})
    const note = canonicalNote(snapshot, id, aliases)
    const bundle = buildContextBundle(note.path, snapshot.notes, {
      maxCharacters,
      asOf: options.asOf,
      includeHistory: options.includeHistory,
      query: options.query,
      temporalPerspective: options.temporalPerspective,
      pathAliases: aliases
    })
    const notesByPath = new Map(
      snapshot.notes.map((source) => [source.path, source])
    )

    return {
      seed_id: note.path,
      markdown: bundle.markdown,
      character_count: bundle.characterCount,
      truncated: bundle.truncated,
      as_of: bundle.asOf,
      temporal_perspective: bundle.temporalPerspective,
      included: bundle.included.map(
        ({
          path,
          name,
          relation,
          truncated,
          contentOmitted,
          temporalStatus,
          selectionReasons
        }) => {
          const source = notesByPath.get(path)
          if (!source) {
            throw new Error(`Context source is missing from the snapshot: ${path}`)
          }
          return {
            path,
            name,
            relation,
            truncated,
            revision: revisionFor(snapshot.rootPath, source),
            modified_at: new Date(source.modifiedAt).toISOString(),
            ...(contentOmitted ? { content_omitted: true } : {}),
            ...(temporalStatus ? { temporal_status: temporalStatus } : {}),
            selection_reasons: selectionReasons
          }
        }
      ),
      omitted_ids: bundle.omittedPaths,
      warnings: bundle.warnings
    }
  }
}

function writeOutput(rootPath: string, note: NoteDocument): WriteOutput {
  return {
    id: note.path,
    title: note.name,
    metadata: {
      path: note.path,
      modified_at: new Date(note.modifiedAt).toISOString(),
      revision: revisionFor(rootPath, note),
      size_bytes: note.size
    }
  }
}

async function applyUpdateWithHistory(
  vault: VaultService,
  rootPath: string,
  path: string,
  current: NoteDocument,
  previousRevision: string,
  content: string,
  reason: string,
  sourceRefs: string[]
): Promise<string> {
  const historyPath = historyPathFor(path, previousRevision)
  await ensureDirectory(vault, '50_履歴/AI更新')
  await vault.createNote({
    directory: dirnameRelative(historyPath),
    name: basenameRelative(historyPath),
    content: renderAutonomousRevision(
      rootPath,
      path,
      current.modifiedAt,
      current.size,
      previousRevision,
      current.content,
      reason,
      sourceRefs
    )
  })
  await vault.saveNote({
    path,
    content,
    expectedModifiedAt: current.modifiedAt,
      expectedContent: current.content
  })
  return historyPath
}
async function recordNoteLinkAdd(
  vault: VaultService,
  sourcePath: string,
  targetPath: string,
  link: string,
  previousRevision: string,
  newRevision: string,
  reason: string,
  sourceRefs: string[]
): Promise<string> {
  const historyPath = historyPathFor(sourcePath, previousRevision)
  await ensureDirectory(vault, '50_履歴/AI更新')
  await vault.createNote({
    directory: dirnameRelative(historyPath),
    name: basenameRelative(historyPath),
    content: renderLinkAddRecord(
      sourcePath,
      targetPath,
      link,
      previousRevision,
      newRevision,
      reason,
      sourceRefs
    )
  })
  return historyPath
}
