import { createHash } from 'node:crypto'
import { basenameRelative, dirnameRelative, validateRelativePath } from '../core/paths'
import { parseBaseProfile } from '../core/base-profile'
import { evaluateBase } from '../core/base-evaluator'
import { baseValueEqual } from '../core/base-expression'
import { isAiImmutablePath, isAuditHistoryPath } from '../shared/ai-write-policy'
import { createExcludedFileMatcher } from '../shared/excluded-files'
import type { KanbanFolderMoveInput, KanbanFolderMoveApplyInput, KanbanFolderMovePreview } from '../shared/kanban-folder-move'
import type { PropertyChangeScope, PropertyDeclaredType } from '../shared/property-changes'
import { canonicalWorkspaceVaultKey } from './workspaces'
import { VaultError, type VaultService } from './vault'
import type { EntryMoveCoordinator } from './entry-move'

const hash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex')
const fail = (message: string, code: 'INVALID_PATH' | 'FILE_CHANGED' | 'ACCESS_DENIED' = 'INVALID_PATH'): never => {
  throw new VaultError({ code, message })
}

/** Trusted renderer only. File metadata is moved through the existing journal coordinator. */
export class KanbanFolderMoveService {
  constructor(private readonly vault: VaultService, private readonly moves: EntryMoveCoordinator,
    private readonly getFilters: () => Promise<readonly string[]>,
    private readonly getTypes: (scope: PropertyChangeScope) => Promise<Record<string, PropertyDeclaredType>>) {}

  private async inspect(input: KanbanFolderMoveInput) {
    const root = this.vault.getRootPath(), revision = this.vault.getRootRevision()
    const current = (): void => {
      if (!root || this.vault.getRootPath() !== root || this.vault.getRootRevision() !== revision)
        fail('Vaultが切り替わりました。再度プレビューしてください。', 'FILE_CHANGED')
    }
    if (!input?.scope || typeof input.scope.rootPath !== 'string' || !Number.isSafeInteger(input.scope.rootRevision) ||
        !root || revision !== input.scope.rootRevision || await canonicalWorkspaceVaultKey(root) !== input.scope.rootPath)
      fail('Vaultが切り替わりました。再度プレビューしてください。', 'FILE_CHANGED')
    current()
    const filters = await this.getFilters(); current()
    const propertyTypes = await this.getTypes(input.scope); current()
    const excluded = createExcludedFileMatcher(filters)
    const eligible = (path: unknown, extension?: string): path is string => {
      if (typeof path !== 'string') return false
      const checked = validateRelativePath(path)
      return checked.valid && checked.normalized === path && (!extension || path.toLowerCase().endsWith(extension)) &&
        !path.split('/').some(part => part.startsWith('.')) && !isAiImmutablePath(path) && !excluded(path)
    }
    if (!eligible(input.basePath, '.base') || !eligible(input.sourcePath, '.md') || !eligible(input.destinationDirectory))
      fail('このファイルまたはフォルダはKanban移動の対象外です。', 'ACCESS_DENIED')
    if (!Number.isSafeInteger(input.viewIndex) || input.viewIndex < 0 || typeof input.expectedBaseRevision !== 'string' ||
        typeof input.expectedSourceRevision !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedSourceRevision))
      fail('移動の確認情報が不正です。')
    const base = await this.vault.readBase(input.basePath); current()
    if (base.revision !== input.expectedBaseRevision) fail('.baseが変更されました。再読み込みしてください。', 'FILE_CHANGED')
    const parsed = parseBaseProfile(base.content)
    if (!parsed.ok) return fail('Bases設定を解析できません。')
    const profile = parsed.profile
    const view = (profile.views ?? [profile.view])[input.viewIndex]
    if (!view || view.type !== 'kanban' || view.groupBy?.property !== 'file.folder') fail('file.folderでグループ化したKanbanを指定してください。')
    const snapshot = await this.vault.scan(); current()
    const notes = snapshot.notes.filter(note => !isAuditHistoryPath(note.path) && !excluded(note.path))
    const source = notes.find(note => note.path === input.sourcePath) ?? fail('移動元が表示対象外です。', 'FILE_CHANGED')
    if (hash(source.content) !== input.expectedSourceRevision) fail('移動元が変更されたか表示対象外です。再読み込みしてください。', 'FILE_CHANGED')
    const deadline = Date.now() + 3_000
    const evaluation = evaluateBase(profile, notes, input.viewIndex, { propertyTypes, deadline,
      thisFile: { ...base, name: basenameRelative(base.path), size: Buffer.byteLength(base.content, 'utf8') } })
    if (Date.now() > deadline || evaluation.diagnostics.some(item => item.message === 'Expression execution limit exceeded.')) fail('Baseの評価が時間内に完了しませんでした。')
    // Root folders evaluate as an empty cell (null); establish root from actual row paths.
    const visibleGroups = (evaluation.groups ?? []).filter(group => !view.groupBy!.hidden?.some(key => baseValueEqual(key, group.key)))
    if (!visibleGroups.some(group => group.rows.some(row => row.path === source.path))) fail('移動元は表示中のカードではありません。')
    const target = visibleGroups.find(group => typeof group.key === 'string' ? group.key === input.destinationDirectory :
      group.key === null && input.destinationDirectory === '' && group.rows.some(row => dirnameRelative(row.path) === ''))
    if (!target || !snapshot.directories.includes(input.destinationDirectory) || dirnameRelative(source.path) === input.destinationDirectory)
      fail('表示中の既存の別フォルダへ移動してください。')
    const destination = [input.destinationDirectory, basenameRelative(source.path)].filter(Boolean).join('/')
    if (!eligible(destination, '.md')) fail('移動先は対象外です。', 'ACCESS_DENIED')
    const linkPolicy = { excludedLinkSources: filters }
    const plan = await this.moves.preflight(source.path, destination, 'human', linkPolicy); current()
    const fingerprint = hash(JSON.stringify({ scope: [input.scope.rootPath, input.scope.rootRevision],
      base: [input.basePath, input.expectedBaseRevision], viewIndex: input.viewIndex, source: [input.sourcePath, input.expectedSourceRevision],
      destinationDirectory: input.destinationDirectory, plan: plan.fingerprint, filters, propertyTypes,
      notes: snapshot.notes.map(note => [note.path, note.modifiedAt, note.size, note.content]),
      directories: snapshot.directories, aliases: snapshot.pathAliases,
      groups: visibleGroups.map(group => [group.key, group.rows.map(row => row.path)]) }))
    return { plan, fingerprint, current, linkPolicy }
  }

  async preview(input: KanbanFolderMoveInput): Promise<KanbanFolderMovePreview> {
    const { plan, fingerprint } = await this.inspect(input)
    return { source: plan.source, destination: plan.destination, fingerprint,
      linkImpact: { affectedCount: plan.link_impact.affected_count, sourcePaths: plan.link_impact.source_paths } }
  }

  async apply(input: KanbanFolderMoveApplyInput) {
    const { expectedFingerprint, ...request } = input ?? {}
    const { plan, fingerprint, current, linkPolicy } = await this.inspect(request)
    if (typeof expectedFingerprint !== 'string' || fingerprint !== expectedFingerprint)
      fail('プレビュー後に状態が変わりました。再度プレビューしてください。', 'FILE_CHANGED')
    current()
    const moved = await this.moves.apply({ source: plan.source, destination: plan.destination, expected_fingerprint: plan.fingerprint, actor: 'human' }, linkPolicy)
    return { oldPath: moved.old_path, path: moved.new_path }
  }
}
