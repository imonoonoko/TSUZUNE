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
import { parseFrontmatter } from '../core/frontmatter'
import { searchRendererRanked } from '../core/search'
import {
  assertOnlyLinkInserted,
  buildLinkInsertPlan,
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
  LinkStatus,
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
    start_character: number
    end_character: number
    total_characters: number
  }
  next_after?: number
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

export interface ContextUsageReceipt {
  schema_version: 1
  search_candidates: { status: 'not_observable' }
  context_candidates: { status: 'observed'; note_ids: string[] }
  context_included: { status: 'observed'; note_ids: string[] }
  evidence_cited: { status: 'not_observable' }
  decision_or_action: { status: 'not_observable' }
  outcome_verified: { status: 'not_observable' }
}

export interface ContextStateLineageReceipt {
  schema_version: 1
  subject: {
    note_id: string
    revision: string
    modified_at: string
  }
  current_states:
    | {
        status: 'observed'
        states: Array<{
          note_id: string
          state: string
          valid_from: string
          valid_to?: string
          observed_at?: string
          verified_at?: string
          review_after?: string
          revision: string
          modified_at: string
        }>
      }
    | { status: 'unknown' }
  explicit_sources:
    | {
        status: 'observed'
        relations: Array<{
          from_note_id: string
          source_ref: string
          resolution: LinkStatus
          source_note_id?: string
          source_revision?: string
        }>
      }
    | { status: 'unknown' }
  supersession:
    | {
        status: 'observed'
        relations: Array<{
          successor_note_id: string
          superseded_ref: string
          resolution: 'resolved'
          superseded_note_id: string
          successor_revision: string
          superseded_revision: string
        }>
      }
    | { status: 'unknown' }
  conflicts:
    | { status: 'observed'; current_state_note_ids: string[] }
    | { status: 'unknown' }
  freshness:
    | {
        status: 'observed'
        value: 'current' | 'review_due'
        as_of: string
        review_due_note_ids: string[]
      }
    | { status: 'unknown'; as_of: string }
  decision_records: { status: 'not_observable' }
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
  usage_receipt: ContextUsageReceipt
  state_lineage: ContextStateLineageReceipt
}

export interface BuildContextOptions {
  asOf?: string
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

export interface TrashInboxSourceOutput {
  old_path: string
  new_path: string
  source_revision: string
}

export interface DerivedNoteInput {
  destination: string
  content: string
  category: string
  topics: string[]
  sourceId: string
  sourceRevision: string
  derivationKey?: string
}
export interface AutonomousUpdateOutput extends WriteOutput {
  unchanged?: true
  provenance: {
    actor: 'ai'
    reason: string
    source_refs: string[]
    previous_revision: string
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

function normalizeDerivedLabel(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 80 || /[\r\n]/.test(normalized)) {
    throw new Error(`${field}は1〜80文字の単一行で指定してください。`)
  }
  if (normalized.includes('"')) {
    throw new Error(`${field}にダブルクォートは指定できません。`)
  }
  return normalized
}

function canonicalCategories(snapshot: VaultSnapshot): string[] {
  const note = snapshot.notes.find((item) => item.path === '30_知識/TSUZUNE分類と保存基準.md')
  const matches = note
    ? [...note.content.matchAll(/^- 30_知識:\s*([^\r\n]+)$/gm)]
    : []
  const rawCategories =
    matches.length === 1
      ? matches[0][1].split(/\s*\/\s*/)
      : []
  const categories = rawCategories.map((value) => value.trim())
  const foldedCategories = categories.map((value) => value.toLocaleLowerCase())
  if (
    !note ||
    matches.length !== 1 ||
    categories.length === 0 ||
    categories.some(
      (value) =>
        value.length === 0 ||
        value.length > 80 ||
        /[\r\n"]/.test(value)
    ) ||
    new Set(foldedCategories).size !== categories.length
  ) {
    throw new Error('TSUZUNE主カテゴリ正本を検証できません。')
  }
  return categories
}

function assertDerivedCategory(value: string, snapshot: VaultSnapshot): string {
  const normalized = normalizeDerivedLabel(value, 'category')
  if (!canonicalCategories(snapshot).includes(normalized)) {
    throw new Error('categoryはTSUZUNEの既存主カテゴリから指定してください。')
  }
  return normalized
}

function derivedSourceLink(path: string): string {
  if (path.includes(']]') || /[#|]/.test(path)) {
    throw new Error('Wikiリンクにできない原典パスです。')
  }
  return `[[${path.replace(/\.md$/i, '')}]]`
}

function hasDerivedSource(
  content: string,
  sourceLink: string,
  sourceRevision: string,
  derivationKey?: string
): boolean {
  const frontmatter = parseFrontmatter(content)
  return (
    frontmatter.attributes.derived_from === sourceLink &&
    frontmatter.attributes.source_revision === sourceRevision &&
    (derivationKey === undefined ||
      frontmatter.attributes.derivation_key === derivationKey)
  )
}

function derivedNoteContent(input: {
  destination: string
  content: string
  category: string
  topics: string[]
  sourcePath: string
  sourceRevision: string
  derivationKey?: string
}): string {
  const sourceLink = derivedSourceLink(input.sourcePath)
  return [
    '---',
    'type: knowledge',
    'role: knowledge',
    `category: ${JSON.stringify(input.category)}`,
    `topics: [${input.topics.map((topic) => JSON.stringify(topic)).join(', ')}]`,
    ...(input.derivationKey
      ? [`derivation_key: ${JSON.stringify(input.derivationKey)}`]
      : []),
    `derived_from: ${JSON.stringify(sourceLink)}`,
    `source_revision: ${JSON.stringify(input.sourceRevision)}`,
    'source_refs:',
    `  - ${JSON.stringify(input.sourcePath)}`,
    '---',
    '',
    `# ${basenameRelative(input.destination).replace(/\.md$/i, '')}`,
    '',
    input.content.trim(),
    '',
    `原典: ${sourceLink}`,
    ''
  ].join('\n')
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

/**
 * Folders excluded from MCP search results by default.
 * 50_履歴 is the audit trail (AI update history, status changes) and is not
 * searchable knowledge. Legacy history remains excluded and protected.
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

  private async snapshot(
    { persistCreationTimes = true }: { persistCreationTimes?: boolean } = {}
  ): Promise<{
    vault: VaultService
    snapshot: VaultSnapshot
    aiReviewPaths: string[]
  }> {
    const vault = new VaultService()
    const source = await resolveVaultSource(this.source)
    await vault.setRootPath(source.vaultPath)
    return {
      vault,
      snapshot: await vault.scan(source.userIgnoreFilters, { persistCreationTimes }),
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
    if (proposal.derivedGuard) {
      const guard = proposal.derivedGuard
      const invalidate = async (message: string): Promise<never> => {
        await this.reviewStore.remove(id)
        throw new VaultError({ code: 'FILE_CHANGED', message })
      }
      const source = snapshot.notes.find(
        (note) => note.path.toLowerCase() === guard.sourcePath.toLowerCase()
      )
      if (!source) {
        return invalidate('原典またはカテゴリが変更されたため変更案は失効しました。')
      }
      const root = source.path.split('/')[0].toLowerCase()
      let categoryIsCurrent = false
      try {
        categoryIsCurrent = canonicalCategories(snapshot).includes(guard.category)
      } catch {
        categoryIsCurrent = false
      }
      if (
        (root !== '01_受信箱' && root !== '40_情報源') ||
        basenameRelative(source.path).toLowerCase() === 'knowledge.md' ||
        revisionFor(snapshot.rootPath, source) !== guard.sourceRevision ||
        !categoryIsCurrent
      ) {
        await invalidate('原典またはカテゴリが変更されたため変更案は失効しました。')
      }
      let link = ''
      try {
        link = derivedSourceLink(source.path)
        const resolved = resolveLinkTarget(
          snapshot,
          proposal.path,
          source.path.replace(/\.md$/i, ''),
          compilePathAliases(snapshot.pathAliases ?? {})
        )
        if (resolved.path.toLowerCase() !== source.path.toLowerCase()) {
          throw new Error('原典以外へ解決されました。')
        }
      } catch {
        await invalidate('原典リンクを解決できないため変更案は失効しました。')
      }
      if (
        snapshot.notes.some(
          (note) =>
            note.path.startsWith('30_知識/') &&
            hasDerivedSource(
              note.content,
              link,
              guard.sourceRevision,
              guard.derivationKey
            )
        )
      ) {
        await invalidate('同じ原典revisionの派生ノートが既に存在します。')
      }
    }

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

    await vault.saveNote({
      path: canonical.path,
      content: proposal.content,
      expectedModifiedAt: current.modifiedAt,
      expectedContent: current.content
    })
    const note = await vault.readNote(canonical.path)
    await this.reviewStore.remove(id)
    return writeOutput(snapshot.rootPath, note)
  }

  async search(query: string, limit = 10): Promise<SearchOutput> {
    const { snapshot } = await this.snapshot({ persistCreationTimes: false })
    const notes = snapshot.notes.filter(
      (note) => !isExcludedFilePath(note.path, DEFAULT_SEARCH_EXCLUDED_PATHS)
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

  async proposeDerivedNote(input: DerivedNoteInput): Promise<WriteOutput> {
    assertEditableLength(input.content)
    if (!input.content.trim()) {
      throw new Error('派生ノートの本文を指定してください。')
    }

    const destination = input.destination.trim().replaceAll('\\', '/')
    const validation = validateRelativePath(destination)
    if (
      !validation.valid ||
      !validation.normalized ||
      !validation.normalized.startsWith('30_知識/') ||
      !validation.normalized.toLowerCase().endsWith('.md')
    ) {
      throw new Error('派生ノートの作成先は30_知識配下のMarkdownに限定されます。')
    }

    if (/^\s*---(?:\r?\n|$)/.test(input.content)) {
      throw new Error('本文にfrontmatterを指定できません。')
    }

    const normalizedCategory = normalizeDerivedLabel(input.category, 'category')
    const topics = input.topics.map((topic) =>
      normalizeDerivedLabel(topic, 'topic')
    )
    const derivationKey = input.derivationKey
      ? normalizeDerivedLabel(input.derivationKey, 'derivation_key')
      : undefined
    if (
      topics.length < 1 ||
      topics.length > 3 ||
      new Set(topics.map((topic) => topic.toLocaleLowerCase())).size !==
        topics.length
    ) {
      throw new Error('categoryは必須、topicsは重複しない1〜3件で指定してください。')
    }
    const sourceId = input.sourceId.trim().replaceAll('\\', '/')
    const sourceValidation = validateRelativePath(sourceId)
    if (
      !sourceValidation.valid ||
      !sourceValidation.normalized ||
      !sourceValidation.normalized.toLowerCase().endsWith('.md') ||
      !(
        sourceValidation.normalized.startsWith('01_受信箱/') ||
        sourceValidation.normalized.startsWith('40_情報源/')
      )
    ) {
      throw new Error('原典は01_受信箱または40_情報源配下のMarkdownに限定されます。')
    }
    if (
      basenameRelative(sourceValidation.normalized).toLowerCase() ===
      'knowledge.md'
    ) {
      throw new Error('knowledge.mdは原典として利用できません。')
    }
    derivedSourceLink(sourceValidation.normalized)

    const { snapshot } = await this.snapshot()
    const category = assertDerivedCategory(normalizedCategory, snapshot)

    if (
      snapshot.notes.some(
        (note) =>
          note.path.toLowerCase() === validation.normalized!.toLowerCase()
      )
    ) {
      throw new Error(`ノートは既に存在します: ${validation.normalized}`)
    }

    const source = snapshot.notes.find(
      (note) =>
        note.path.toLowerCase() === sourceValidation.normalized!.toLowerCase()
    )
    if (!source) {
      throw new VaultError({
        code: 'NOT_FOUND',
        message: '原典ノートが見つかりません。'
      })
    }
    if (isAiImmutablePath(source.path) && !source.path.startsWith('40_情報源/')) {
      throw new Error('保護された原典です。')
    }
    if (revisionFor(snapshot.rootPath, source) !== input.sourceRevision) {
      throw new VaultError({
        code: 'FILE_CHANGED',
        message: '原典が変更されています。'
      })
    }

    const sourceLink = derivedSourceLink(source.path)
    if (
      snapshot.notes.some(
        (note) =>
          note.path.startsWith('30_知識/') &&
          hasDerivedSource(
            note.content,
            sourceLink,
            input.sourceRevision,
            derivationKey
          )
      )
    ) {
      throw new Error('同じ原典revisionから派生ノートが既に存在します。')
    }
    if (
      (await this.reviewStore.list()).some(
        (proposal) =>
          proposal.operation === 'create' &&
          proposal.path.startsWith('30_知識/') &&
          hasDerivedSource(
            proposal.content,
            sourceLink,
            input.sourceRevision,
            derivationKey
          )
      )
    ) {
      throw new Error('同じ原典revisionの派生ノート提案が既に存在します。')
    }

    const derivedContent = derivedNoteContent({
      destination: validation.normalized,
      content: input.content,
      category,
      topics,
      sourcePath: source.path,
      sourceRevision: input.sourceRevision,
      derivationKey
    })
    assertEditableLength(derivedContent)

    const proposal = await this.reviewStore.add({
      path: validation.normalized,
      operation: 'create',
      content: derivedContent,
      expectedRevision: null,
      reason: `カテゴリ付き派生知識ノート作成（${category}）`,
      sourceRefs: [source.path],
      derivedGuard: {
        sourcePath: source.path,
        sourceRevision: input.sourceRevision,
        category,
        ...(derivationKey ? { derivationKey } : {})
      }
    })
    return pendingReviewOutput(proposal, null)
  }

  async createDerivedNote(input: DerivedNoteInput): Promise<WriteOutput> {
    const sourcePath = input.sourceId.trim().replaceAll('\\', '/')
    const derivationKey = input.derivationKey
      ? normalizeDerivedLabel(input.derivationKey, 'derivation_key')
      : undefined
    const sameRevision = (await this.reviewStore.list()).filter(
      (proposal) =>
        proposal.derivedGuard?.sourcePath.toLowerCase() ===
          sourcePath.toLowerCase() &&
        proposal.derivedGuard.sourceRevision === input.sourceRevision
    )
    const existing = sameRevision.find(
      (proposal) => proposal.derivedGuard?.derivationKey === derivationKey
    )
    if (existing) {
      const destination = input.destination.trim().replaceAll('\\', '/')
      const category = normalizeDerivedLabel(input.category, 'category')
      const topics = input.topics.map((topic) =>
        normalizeDerivedLabel(topic, 'topic')
      )
      const expectedContent = derivedNoteContent({
        destination,
        content: input.content,
        category,
        topics,
        sourcePath: existing.derivedGuard!.sourcePath,
        sourceRevision: input.sourceRevision,
        derivationKey
      })
      if (
        existing.path.toLowerCase() === destination.toLowerCase() &&
        existing.content === expectedContent
      ) {
        return this.approveReviewProposal(existing.id)
      }
      await this.reviewStore.remove(existing.id)
    }
    if (derivationKey) {
      for (const legacy of sameRevision.filter(
        (proposal) => proposal.derivedGuard?.derivationKey === undefined
      )) {
        await this.reviewStore.remove(legacy.id)
      }
    }

    const staged = await this.proposeDerivedNote(input)
    if (!staged.proposal) {
      throw new Error('派生ノートの内部検証に失敗しました。')
    }
    return this.approveReviewProposal(staged.proposal.id)
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
    const { snapshot } = await this.snapshot({ persistCreationTimes: false })
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

  async fetch(id: string, after = 0): Promise<FetchOutput> {
    const { vault, snapshot } = await this.snapshot({ persistCreationTimes: false })
    const canonical = canonicalNote(snapshot, id)
    const note = await vault.readNote(canonical.path)
    const start = Math.min(Math.max(0, after), note.content.length)
    let end = Math.min(start + MAX_EDITABLE_CHARACTERS, note.content.length)
    if (end < note.content.length && /[\uD800-\uDBFF]/.test(note.content[end - 1] ?? '')) end -= 1
    const truncated = end < note.content.length

    return {
      id: note.path,
      title: note.name,
      text: note.content.slice(start, end),
      metadata: {
        path: note.path,
        modified_at: new Date(note.modifiedAt).toISOString(),
        revision: revisionFor(snapshot.rootPath, note),
        size_bytes: note.size,
        truncated,
        editable: note.content.length <= MAX_EDITABLE_CHARACTERS && !isAiImmutablePath(note.path),
        start_character: start,
        end_character: end,
        total_characters: note.content.length
      },
      ...(truncated ? { next_after: end } : {})
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
      },
      provenance: {
        actor: 'ai',
        reason,
        source_refs: sourceRefs,
        previous_revision: previousRevision
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
      },
      provenance: {
        actor: 'ai',
        reason,
        source_refs: sourceRefs,
        previous_revision: previousRevision
      },
      patch: { operations: patch.operations }
    }
  }

  async backlinks(
    id: string,
    limit = 20,
    after?: string
  ): Promise<BacklinksOutput> {
    const { snapshot } = await this.snapshot({ persistCreationTimes: false })
    const aliases = compilePathAliases(snapshot.pathAliases ?? {})
    const note = canonicalNote(snapshot, id, aliases)
    const backlinks = getBacklinks(note.path, snapshot.notes, aliases)
      .filter(
        (item) =>
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

  async trashInboxSource(
    id: string,
    expectedRevision: string
  ): Promise<TrashInboxSourceOutput> {
    const inspect = (snapshot: VaultSnapshot) => {
      const aliases = compilePathAliases(snapshot.pathAliases ?? {})
      const note = canonicalNote(snapshot, id, aliases)
      if (!note.path.startsWith('01_受信箱/')) {
        throw new Error('AIは01_受信箱のMarkdown原典だけをごみ箱へ移動できます。')
      }
      const revision = revisionFor(snapshot.rootPath, note)
      if (revision !== expectedRevision) {
        throw new Error('削除元のrevisionが変わりました。もう一度fetchしてください。')
      }
      const backlinks = getBacklinks(note.path, snapshot.notes, aliases)
      if (backlinks.length > 0) {
        throw new Error(
          `リンク元が${backlinks.length}件残っています。先に出典表示を更新してください。`
        )
      }
      return { note, revision }
    }

    const initial = await this.snapshot()
    const ready = inspect(initial.snapshot)
    const moved = await initial.vault.trashEntry(ready.note.path, async () => {
      const current = await this.snapshot({ persistCreationTimes: false })
      inspect(current.snapshot)
    })
    if (!moved.path) {
      throw new Error('ごみ箱の移動先を確認できませんでした。')
    }
    return {
      old_path: ready.note.path,
      new_path: moved.path,
      source_revision: ready.revision
    }
  }

  async suggestLinks(
    source: string,
    options: SuggestLinksOptions = {}
  ): Promise<SuggestLinksOutput> {
    const { snapshot } = await this.snapshot({ persistCreationTimes: false })
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

    return {
      source: canonical.path,
      target: targetNote.path,
      link: plan.link,
      strategy: plan.strategy,
      previous_revision: previousRevision,
      new_revision: newRevision
    }
  }

  async buildContext(
    id: string,
    maxCharacters = 15_000,
    options: BuildContextOptions = {}
  ): Promise<ContextOutput> {
    const { snapshot } = await this.snapshot({ persistCreationTimes: false })
    const aliases = compilePathAliases(snapshot.pathAliases ?? {})
    const note = canonicalNote(snapshot, id, aliases)
    const bundle = buildContextBundle(note.path, snapshot.notes, {
      maxCharacters,
      asOf: options.asOf,
      query: options.query,
      temporalPerspective: options.temporalPerspective,
      pathAliases: aliases
    })
    const notesByPath = new Map(
      snapshot.notes.map((source) => [source.path, source])
    )

    const included = bundle.included.map(
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
    )
    const includedNoteIds = included.map(({ path }) => path)

    return {
      seed_id: note.path,
      markdown: bundle.markdown,
      character_count: bundle.characterCount,
      truncated: bundle.truncated,
      as_of: bundle.asOf,
      temporal_perspective: bundle.temporalPerspective,
      included,
      omitted_ids: bundle.omittedPaths,
      warnings: bundle.warnings,
      state_lineage: stateLineageReceipt(
        snapshot.rootPath,
        note,
        bundle,
        notesByPath
      ),
      usage_receipt: {
        schema_version: 1,
        search_candidates: { status: 'not_observable' },
        context_candidates: {
          status: 'observed',
          note_ids: [...new Set([...includedNoteIds, ...bundle.omittedPaths])]
        },
        context_included: {
          status: 'observed',
          note_ids: includedNoteIds
        },
        evidence_cited: { status: 'not_observable' },
        decision_or_action: { status: 'not_observable' },
        outcome_verified: { status: 'not_observable' }
      }
    }
  }
}

function stateLineageReceipt(
  rootPath: string,
  subject: NoteDocument,
  bundle: ContextBundle,
  notesByPath: ReadonlyMap<string, NoteDocument>
): ContextStateLineageReceipt {
  const currentStates = bundle.stateLineage.currentStates.map((state) => {
    const note = requiredLineageNote(notesByPath, state.path)
    return {
      note_id: state.path,
      state: state.state,
      valid_from: state.validFrom,
      ...(state.validTo ? { valid_to: state.validTo } : {}),
      ...(state.observedAt ? { observed_at: state.observedAt } : {}),
      ...(state.verifiedAt ? { verified_at: state.verifiedAt } : {}),
      ...(state.reviewAfter ? { review_after: state.reviewAfter } : {}),
      revision: revisionFor(rootPath, note),
      modified_at: new Date(note.modifiedAt).toISOString()
    }
  })
  const explicitSources = bundle.stateLineage.sourceRelations.map(
    ({ fromPath, sourceRef, resolution }) => {
      const source = resolution.resolvedPath
        ? notesByPath.get(resolution.resolvedPath)
        : undefined
      return {
        from_note_id: fromPath,
        source_ref: sourceRef,
        resolution: resolution.status,
        ...(source
          ? {
              source_note_id: source.path,
              source_revision: revisionFor(rootPath, source)
            }
          : {})
      }
    }
  )
  const supersession = bundle.stateLineage.supersessionRelations.map(
    ({ successorPath, supersededPath, supersededRef }) => ({
      successor_note_id: successorPath,
      superseded_ref: supersededRef,
      resolution: 'resolved' as const,
      superseded_note_id: supersededPath,
      successor_revision: revisionFor(
        rootPath,
        requiredLineageNote(notesByPath, successorPath)
      ),
      superseded_revision: revisionFor(
        rootPath,
        requiredLineageNote(notesByPath, supersededPath)
      )
    })
  )
  const reviewDueNoteIds = bundle.stateLineage.currentStates
    .filter((state) => state.reviewDue)
    .map((state) => state.path)

  return {
    schema_version: 1,
    subject: {
      note_id: subject.path,
      revision: revisionFor(rootPath, subject),
      modified_at: new Date(subject.modifiedAt).toISOString()
    },
    current_states:
      currentStates.length > 0
        ? { status: 'observed', states: currentStates }
        : { status: 'unknown' },
    explicit_sources:
      explicitSources.length > 0
        ? { status: 'observed', relations: explicitSources }
        : { status: 'unknown' },
    supersession:
      supersession.length > 0
        ? { status: 'observed', relations: supersession }
        : { status: 'unknown' },
    conflicts:
      currentStates.length > 0
        ? {
            status: 'observed',
            current_state_note_ids: bundle.stateLineage.conflictPaths
          }
        : { status: 'unknown' },
    freshness:
      currentStates.length > 0
        ? {
            status: 'observed',
            value: reviewDueNoteIds.length > 0 ? 'review_due' : 'current',
            as_of: bundle.asOf,
            review_due_note_ids: reviewDueNoteIds
          }
        : { status: 'unknown', as_of: bundle.asOf },
    decision_records: { status: 'not_observable' }
  }
}

function requiredLineageNote(
  notesByPath: ReadonlyMap<string, NoteDocument>,
  path: string
): NoteDocument {
  const note = notesByPath.get(path)
  if (!note) {
    throw new Error(`State lineage note is missing from the snapshot: ${path}`)
  }
  return note
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
