import { createHash } from 'node:crypto'
import { isAiImmutablePath } from '../shared/ai-write-policy'
import { createExcludedFileMatcher } from '../shared/excluded-files'
import { validateRelativePath } from '../core/paths'
import { transformProperty } from '../core/property-changes'
import { canonicalWorkspaceVaultKey } from './workspaces'
import { VaultError, type VaultService } from './vault'
import type { NoteDocument } from '../shared/types'
import type {
  PropertyApplyInput,
  PropertyApplyResult,
  PropertyChangeIssue,
  PropertyChangeScope,
  PropertyPreviewInput,
  PropertyPreviewItem,
  PropertyPreviewResult
} from '../shared/property-changes'

const SHA256 = /^[a-f0-9]{64}$/

function revision(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function changed(): VaultError {
  return new VaultError({ code: 'FILE_CHANGED', message: 'Vaultが切り替わりました。再度プレビューしてください。' })
}

function issueFrom(error: unknown): PropertyChangeIssue {
  return error instanceof VaultError
    ? { code: error.appError.code, message: error.appError.message }
    : { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Propertyの処理に失敗しました。' }
}

export class PropertyChangesService {
  constructor(
    private readonly vault: VaultService,
    private readonly getUserIgnoreFilters: () => readonly string[] | Promise<readonly string[]>
  ) {}

  private async assertScope(scope: PropertyChangeScope): Promise<{ rootPath: string; rootRevision: number }> {
    if (!scope || typeof scope.rootPath !== 'string' || !Number.isSafeInteger(scope.rootRevision)) {
      throw new VaultError({ code: 'INVALID_PATH', message: 'PropertyのVault範囲が不正です。' })
    }
    const rootPath = this.vault.getRootPath()
    const rootRevision = this.vault.getRootRevision()
    if (!rootPath || rootRevision !== scope.rootRevision) throw changed()
    let canonical: string
    try {
      canonical = await canonicalWorkspaceVaultKey(rootPath)
    } catch (error) {
      throw new VaultError({ code: 'INVALID_PATH', message: 'Vaultの場所を確認できません。' }, { cause: error })
    }
    if (this.vault.getRootPath() !== rootPath || this.vault.getRootRevision() !== rootRevision || canonical !== scope.rootPath) {
      throw changed()
    }
    return { rootPath, rootRevision }
  }

  private current(root: { rootPath: string; rootRevision: number }): void {
    if (this.vault.getRootPath() !== root.rootPath || this.vault.getRootRevision() !== root.rootRevision) throw changed()
  }

  private async filters(root: { rootPath: string; rootRevision: number }): Promise<(path: string) => boolean> {
    this.current(root)
    const filters = await this.getUserIgnoreFilters()
    this.current(root)
    return createExcludedFileMatcher(filters)
  }

  private pathIssue(path: unknown, excluded: (path: string) => boolean): PropertyChangeIssue | null {
    if (typeof path !== 'string') return { code: 'INVALID_PATH', message: 'ノートの場所が不正です。' }
    const checked = validateRelativePath(path)
    if (!checked.valid || !checked.normalized || checked.normalized !== path || !path.toLowerCase().endsWith('.md')) {
      return { code: 'INVALID_PATH', message: 'Vault内のMarkdownノートを指定してください。' }
    }
    if (path.split('/').some((segment) => segment.startsWith('.')) || isAiImmutablePath(path) || excluded(path)) {
      return { code: 'ACCESS_DENIED', message: 'このノートはProperty変更の対象外です。' }
    }
    return null
  }

  private async read(root: { rootPath: string; rootRevision: number }, path: string): Promise<NoteDocument> {
    this.current(root)
    const note = await this.vault.readNote(path)
    this.current(root)
    if (note.path !== path) throw new VaultError({ code: 'INVALID_PATH', message: 'ノートの場所が一致しません。' })
    return note
  }

  async preview(input: PropertyPreviewInput): Promise<PropertyPreviewResult> {
    const root = await this.assertScope(input?.scope)
    if (!Array.isArray(input.paths)) {
      throw new VaultError({ code: 'INVALID_PATH', message: 'Propertyの対象一覧が不正です。' })
    }
    const excluded = await this.filters(root)
    const items: PropertyPreviewItem[] = []
    const seen = new Set<string>()
    for (const path of input.paths) {
      this.current(root)
      const pathIssue = this.pathIssue(path, excluded)
      const repeated = typeof path === 'string' && seen.has(path.toLocaleLowerCase('en-US'))
      if (typeof path === 'string') seen.add(path.toLocaleLowerCase('en-US'))
      if (pathIssue || repeated) {
        items.push({ path: String(path), expectedRevision: null, before: null, after: null, changed: false,
          issue: pathIssue ?? { code: 'DUPLICATE_PATH', message: '同じノートが複数回選択されています。' } })
        continue
      }
      try {
        const note = await this.read(root, path)
        const transformed = transformProperty(note.content, input.operation)
        if (!transformed.ok) {
          items.push({ path, expectedRevision: revision(note.content), before: null, after: null, changed: false, issue: transformed.issue })
        } else {
          items.push({ path, expectedRevision: revision(note.content), before: transformed.before,
            after: transformed.after, changed: transformed.markdown !== note.content })
        }
      } catch (error) {
        this.current(root)
        items.push({ path, expectedRevision: null, before: null, after: null, changed: false, issue: issueFrom(error) })
      }
    }
    return { items }
  }

  async apply(input: PropertyApplyInput): Promise<PropertyApplyResult> {
    const root = await this.assertScope(input?.scope)
    if (!Array.isArray(input.targets)) {
      throw new VaultError({ code: 'INVALID_PATH', message: 'Propertyの対象一覧が不正です。' })
    }
    const excluded = await this.filters(root)
    const result: PropertyApplyResult = { saved: [], unchanged: [], failed: [], notAttempted: [] }
    const seen = new Set<string>()
    const ready: { path: string; note: NoteDocument; markdown: string }[] = []
    for (const target of input.targets) {
      this.current(root)
      const path = target?.path
      const pathIssue = this.pathIssue(path, excluded)
      const expectedRevision = target?.expectedRevision
      const repeated = typeof path === 'string' && seen.has(path.toLocaleLowerCase('en-US'))
      if (typeof path === 'string') seen.add(path.toLocaleLowerCase('en-US'))
      const invalid = pathIssue ?? (repeated
        ? { code: 'DUPLICATE_PATH', message: '同じノートが複数回選択されています。' }
        : typeof expectedRevision !== 'string' || !SHA256.test(expectedRevision)
          ? { code: 'INVALID_REVISION', message: 'ノートの変更確認情報が不正です。' }
          : null)
      if (invalid) {
        result.failed.push({ path: String(path), ...invalid })
        continue
      }
      try {
        const note = await this.read(root, path)
        if (revision(note.content) !== expectedRevision) {
          result.failed.push({ path, code: 'FILE_CHANGED', message: 'ノートがプレビュー後に変更されました。' })
          continue
        }
        const transformed = transformProperty(note.content, input.operation)
        if (!transformed.ok) {
          result.failed.push({ path, ...transformed.issue })
        } else {
          ready.push({ path, note, markdown: transformed.markdown })
        }
      } catch (error) {
        this.current(root)
        result.failed.push({ path, ...issueFrom(error) })
      }
    }
    // Every selected revision and transform is checked before the first write.
    if (result.failed.length > 0) {
      result.notAttempted = ready.map((item) => item.path)
      return result
    }
    for (const [index, item] of ready.entries()) {
      try {
        this.current(root)
        if (item.markdown === item.note.content) {
          result.unchanged.push(item.path)
          continue
        }
        await this.vault.saveNote({
          path: item.path,
          content: item.markdown,
          expectedModifiedAt: item.note.modifiedAt,
          expectedContent: item.note.content
        })
        result.saved.push(item.path)
        this.current(root)
      } catch (error) {
        // A root switch immediately after save can coexist with a confirmed save.
        result.failed.push({ path: item.path, ...issueFrom(error) })
        result.notAttempted = ready.slice(index + 1).map((remaining) => remaining.path)
        return result
      }
    }
    return result
  }
}
