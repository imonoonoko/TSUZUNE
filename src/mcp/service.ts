import { createHash } from 'node:crypto'
import { buildContextBundle, type ContextBundle } from '../core/context'
import { getBacklinks } from '../core/links'
import {
  basenameRelative,
  dirnameRelative,
  validateRelativePath
} from '../core/paths'
import { searchNotes } from '../core/search'
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
  included: Array<{
    path: string
    name: string
    relation: ContextBundle['included'][number]['relation']
    truncated: boolean
    temporal_status?: ContextBundle['included'][number]['temporalStatus']
    selection_reasons: string[]
  }>
  omitted_ids: string[]
  warnings: ContextBundle['warnings']
}

export interface BuildContextOptions {
  asOf?: string
  includeHistory?: boolean
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

function canonicalNote(snapshot: VaultSnapshot, rawId: string): NoteDocument {
  const id = rawId.trim().replaceAll('\\', '/')
  const validation = validateRelativePath(id)
  if (
    !validation.valid ||
    !validation.normalized ||
    !validation.normalized.toLocaleLowerCase().endsWith('.md')
  ) {
    throw new Error('Vault内のMarkdownノートの相対パスを指定してください。')
  }

  const note = snapshot.notes.find(
    (candidate) =>
      candidate.path.toLocaleLowerCase() ===
      validation.normalized?.toLocaleLowerCase()
  )
  if (!note) {
    throw new Error(`ノートが見つかりません: ${validation.normalized}`)
  }
  return note
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

  async backlinks(id: string, limit = 20): Promise<BacklinksOutput> {
    const { snapshot } = await this.snapshot()
    const note = canonicalNote(snapshot, id)
    const backlinks = getBacklinks(note.path, snapshot.notes)

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
    const note = canonicalNote(snapshot, id)
    const bundle = buildContextBundle(note.path, snapshot.notes, {
      maxCharacters,
      asOf: options.asOf,
      includeHistory: options.includeHistory
    })

    return {
      seed_id: note.path,
      markdown: bundle.markdown,
      character_count: bundle.characterCount,
      truncated: bundle.truncated,
      as_of: bundle.asOf,
      included: bundle.included.map(
        ({
          path,
          name,
          relation,
          truncated,
          temporalStatus,
          selectionReasons
        }) => ({
          path,
          name,
          relation,
          truncated,
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
