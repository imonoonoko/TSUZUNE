import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { parseDocument, visit } from 'yaml'
import { parseBaseProfile } from '../core/base-profile'
import { findUnlinkedMentions } from '../core/unlinked-mentions'
import { withoutMarkdownExtension } from '../core/paths'
import { isAiImmutablePath } from '../shared/ai-write-policy'
import { createExcludedFileMatcher } from '../shared/excluded-files'
import { canonicalWorkspaceVaultKey } from './workspaces'
import { VaultError, type VaultService } from './vault'
import type { PropertyChangeScope } from '../shared/property-changes'
import type { BaseChangeInput, BaseChangePreview } from '../shared/base-changes'
import type { MentionChangeInput } from '../shared/mention-changes'

const hash = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex')
const editableBaseKeys = new Set(['filters', 'views', 'formulas', 'properties', 'summaries'])
const editableViewKeys = new Set(['type', 'name', 'filters', 'order', 'sort', 'groupBy', 'summaries', 'limit'])
const extras = (value: Record<string, unknown>, supported: ReadonlySet<string>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !supported.has(key)))

function yamlComments(document: ReturnType<typeof parseDocument>): Map<string, number> {
  const comments = new Map<string, number>()
  const collect = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    for (const field of ['commentBefore', 'comment'] as const) {
      const value = (node as { commentBefore?: string; comment?: string })[field]
      if (typeof value === 'string') for (const line of value.split(/\r?\n/)) comments.set(line, (comments.get(line) ?? 0) + 1)
    }
  }
  collect(document)
  visit(document, (_key, node) => { collect(node) })
  return comments
}

/** Compare ignored settings separately from editable fields, allowing view reorder/rename. */
function nestedBaseSettings(value: Record<string, unknown>): { properties: Record<string, unknown>; views: Record<string, unknown>[] } {
  const properties = Object.fromEntries(Object.entries((value.properties ?? {}) as Record<string, Record<string, unknown>>)
    .map(([key, item]) => [key, extras(item, new Set(['displayName', 'type']))] as const).filter(([, item]) => Object.keys(item).length))
  const sortSettings = (raw: unknown): unknown[] => (raw == null ? [] : Array.isArray(raw) ? raw : [raw])
    .map(item => { const extra = extras(item as Record<string, unknown>, new Set(['property', 'direction'])); return Object.keys(extra).length ? { property: (item as Record<string, unknown>).property, extra } : null })
    .filter(item => item !== null)
  const views = (value.views as Record<string, unknown>[]).map(view => {
    const extra = extras(view, editableViewKeys)
    const sort = sortSettings(view.sort); const groupBy = sortSettings(view.groupBy)
    return { ...extra, ...(sort.length ? { sort } : {}), ...(groupBy.length ? { groupBy } : {}) }
  }).filter(item => Object.keys(item).length)
  return { properties, views }
}

/** Human renderer operations only; these methods are never registered with MCP. */
export class HumanChangesService {
  constructor(private readonly vault: VaultService, private readonly getFilters: () => Promise<readonly string[]>) {}

  private async guard(scope: PropertyChangeScope): Promise<() => void> {
    const root = this.vault.getRootPath()
    const revision = this.vault.getRootRevision()
    if (!scope || !root || revision !== scope.rootRevision || await canonicalWorkspaceVaultKey(root) !== scope.rootPath)
      throw new VaultError({ code: 'FILE_CHANGED', message: 'Vaultが切り替わりました。再度プレビューしてください。' })
    const current = (): void => {
      if (this.vault.getRootPath() !== root || this.vault.getRootRevision() !== revision)
        throw new VaultError({ code: 'FILE_CHANGED', message: 'Vaultが切り替わりました。' })
    }
    current()
    return current
  }

  private async eligible(path: string): Promise<boolean> {
    return typeof path === 'string' && !path.split('/').some(part => part.startsWith('.')) &&
      !isAiImmutablePath(path) && !createExcludedFileMatcher(await this.getFilters())(path)
  }

  async previewBase(input: BaseChangeInput): Promise<BaseChangePreview> {
    const current = await this.guard(input?.scope)
    if (!await this.eligible(input.path) || typeof input.content !== 'string')
      throw new VaultError({ code: 'ACCESS_DENIED', message: 'このファイルはBases設定変更の対象外です。' })
    const before = await this.vault.readBase(input.path)
    current()
    if (before.revision !== input.expectedRevision)
      throw new VaultError({ code: 'FILE_CHANGED', message: '.baseが変更されました。再読み込みしてください。' })
    const documents = [before.content, input.content].map(content => parseDocument(content.replace(/^\uFEFF/, ''), { keepSourceTokens: true, uniqueKeys: true }))
    if (documents.some(document => document.errors.length))
      throw new VaultError({ code: 'INVALID_PATH', message: '重複キーまたは解析できないYAMLがあります。ソースを確認してください。' })
    const parsed = [before.content, input.content].map(parseBaseProfile)
    const invalid = parsed.find(result => !result.ok)
    if (invalid && !invalid.ok) throw new VaultError({ code: 'INVALID_PATH', message: invalid.diagnostics.map(item => item.message).join(' ') })
    const [oldValue, newValue] = documents.map(document => document.toJS({ maxAliasCount: 50 })) as Record<string, unknown>[]
    if (!oldValue || !newValue || typeof oldValue !== 'object' || typeof newValue !== 'object' || Array.isArray(oldValue) || Array.isArray(newValue))
      throw new VaultError({ code: 'INVALID_PATH', message: 'Bases設定はマッピングである必要があります。' })
    for (const key of new Set([...Object.keys(oldValue), ...Object.keys(newValue)])) {
      if (!editableBaseKeys.has(key) && !isDeepStrictEqual(oldValue[key], newValue[key]))
        throw new VaultError({ code: 'INVALID_PATH', message: `未知の設定「${key}」は変更できません。` })
    }
    const oldSettings = nestedBaseSettings(oldValue); const newSettings = nestedBaseSettings(newValue)
    const unmatchedViews = [...newSettings.views]
    const viewsPreserved = oldSettings.views.every(view => {
      const index = unmatchedViews.findIndex(item => isDeepStrictEqual(item, view))
      if (index < 0) return false
      unmatchedViews.splice(index, 1)
      return true
    })
    if (!isDeepStrictEqual(oldSettings.properties, newSettings.properties) || !viewsPreserved || unmatchedViews.length)
      throw new VaultError({ code: 'INVALID_PATH', message: '未対応のビュー・プロパティ設定は変更できません。' })
    const oldComments = yamlComments(documents[0]); const newComments = yamlComments(documents[1])
    if ([...oldComments].some(([comment, count]) => (newComments.get(comment) ?? 0) < count))
      throw new VaultError({ code: 'INVALID_PATH', message: '既存のYAMLコメントを保持してください。' })
    if (before.content.startsWith('\uFEFF') !== input.content.startsWith('\uFEFF') ||
        (before.content.includes('\r\n') && /(?<!\r)\n/.test(input.content)))
      throw new VaultError({ code: 'INVALID_PATH', message: 'BOMと改行形式を保持してください。' })
    return { path: before.path, expectedRevision: before.revision!, before: before.content, after: input.content, changed: before.content !== input.content }
  }

  async applyBase(input: BaseChangeInput) {
    await this.previewBase(input)
    const current = await this.guard(input.scope)
    const result = await this.vault.saveBase(input.path, input.expectedRevision, input.content)
    current()
    return result
  }

  async linkMention(input: MentionChangeInput) {
    const current = await this.guard(input?.scope)
    if (!await this.eligible(input.sourcePath) || !await this.eligible(input.targetPath))
      throw new VaultError({ code: 'ACCESS_DENIED', message: 'このノートはリンク化の対象外です。本文を確認してください。' })
    const snapshot = await this.vault.scan()
    current()
    const note = await this.vault.readNote(input.sourcePath)
    current()
    if (hash(note.content) !== input.expectedRevision)
      throw new VaultError({ code: 'FILE_CHANGED', message: 'ノートが変更されました。言及を再検索してください。' })
    const excluded = createExcludedFileMatcher(await this.getFilters())
    const notes = snapshot.notes.filter(item => !excluded(item.path) && !isAiImmutablePath(item.path) && !item.path.split('/').some(part => part.startsWith('.')))
      .map(item => item.path === note.path ? note : item)
    const candidate = findUnlinkedMentions(input.targetPath, notes).find(item => item.sourcePath === input.sourcePath &&
      item.range.from === input.range?.from && item.range.to === input.range?.to && item.text === input.text)
    if (!candidate || /[\[\]|\r\n]/.test(input.targetPath + input.text) || input.targetPath.includes('#'))
      throw new VaultError({ code: 'INVALID_PATH', message: '一致箇所またはリンク先を確認できません。言及を再検索してください。' })
    const link = `[[${withoutMarkdownExtension(input.targetPath)}|${input.text}]]`
    current()
    return this.vault.saveNote({ path: note.path, content: note.content.slice(0, candidate.range.from) + link + note.content.slice(candidate.range.to),
      expectedModifiedAt: note.modifiedAt, expectedContent: note.content })
  }
}
