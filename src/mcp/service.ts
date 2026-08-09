import { createHash } from 'node:crypto'
import { buildContextBundle, type ContextBundle } from '../core/context'
import { getBacklinks } from '../core/links'
import {
  compilePathAliases,
  resolvePathAlias
} from '../core/path-aliases'
import {
  basenameRelative,
  dirnameRelative,
  validateRelativePath
} from '../core/paths'
import { searchNotes } from '../core/search'
import type { TemporalPerspective } from '../core/temporal'
import { VaultError, VaultService } from '../main/vault'
import type { NoteDocument, VaultSnapshot } from '../shared/types'
import {
  resolveVaultPath,
  type VaultSourceOptions
} from './vault-source'

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
}

export interface AutonomousUpdateOptions {
  expectedRevision?: string
  reason?: string
  sourceRefs?: string[]
}

export interface AutonomousUpdateOutput extends WriteOutput {
  provenance: {
    actor: 'ai'
    reason: string
    source_refs: string[]
    previous_revision: string
    history_path: string
  }
}

export const MAX_EDITABLE_CHARACTERS = 100_000

function assertEditableLength(content: string): void {
  if (content.length > MAX_EDITABLE_CHARACTERS) {
    throw new Error('MCPで作成・更新できるノートは10万文字までです。')
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
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const target = targetPath
    .replace(/\.md$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `50_履歴/AI更新/${timestamp}-${target || 'note'}-${previousRevision.slice(-12)}.md`
}

function renderAutonomousRevision(
  targetPath: string,
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
    `recorded_at: ${new Date().toISOString()}`,
    '---',
    '',
    '# Previous content',
    '',
    previousContent
  ].join('\n')
}

export class VaultMcpService {
  constructor(private readonly source: VaultSourceOptions = {}) {}

  private async snapshot(): Promise<{
    vault: VaultService
    snapshot: VaultSnapshot
  }> {
    const vault = new VaultService()
    await vault.setRootPath(await resolveVaultPath(this.source))
    return {
      vault,
      snapshot: await vault.scan()
    }
  }

  async search(query: string, limit = 10): Promise<SearchOutput> {
    const { snapshot } = await this.snapshot()
    return {
      results: searchNotes(snapshot.notes, query)
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
      throw new Error('Vault内の新しいMarkdownノートの相対パスを指定してください。')
    }

    const { vault, snapshot } = await this.snapshot()
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
        editable: !truncated
      }
    }
  }

  async updateNote(
    id: string,
    content: string,
    expectedRevision: string
  ): Promise<WriteOutput> {
    assertEditableLength(content)
    const { vault, snapshot } = await this.snapshot()
    const canonical = canonicalNote(snapshot, id)
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
    await vault.saveNote({
      path: canonical.path,
      content,
      expectedModifiedAt: current.modifiedAt
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
    const { vault, snapshot } = await this.snapshot()
    const canonical = canonicalNote(snapshot, id)
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
    const historyPath = historyPathFor(canonical.path, previousRevision)
    await ensureDirectory(vault, '50_履歴/AI更新')
    await vault.createNote({
      directory: dirnameRelative(historyPath),
      name: basenameRelative(historyPath),
      content: renderAutonomousRevision(
        canonical.path,
        previousRevision,
        current.content,
        reason,
        sourceRefs
      )
    })

    await vault.saveNote({
      path: canonical.path,
      content,
      expectedModifiedAt: current.modifiedAt
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
        previous_revision: previousRevision,
        history_path: historyPath
      }
    }
  }

  async backlinks(id: string, limit = 20): Promise<BacklinksOutput> {
    const { snapshot } = await this.snapshot()
    const aliases = compilePathAliases(snapshot.pathAliases ?? {})
    const note = canonicalNote(snapshot, id, aliases)
    const backlinks = getBacklinks(note.path, snapshot.notes, aliases)

    return {
      note: {
        id: note.path,
        title: note.name
      },
      backlinks: backlinks.slice(0, limit).map((item) => ({
        id: item.path,
        title: item.name
      })),
      total: backlinks.length
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
      temporalPerspective: options.temporalPerspective,
      pathAliases: aliases
    })

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
        }) => ({
          path,
          name,
          relation,
          truncated,
          ...(contentOmitted ? { content_omitted: true } : {}),
          ...(temporalStatus
            ? { temporal_status: temporalStatus }
            : {}),
          selection_reasons: selectionReasons
        })
      ),
      omitted_ids: bundle.omittedPaths,
      warnings: bundle.warnings
    }
  }
}
