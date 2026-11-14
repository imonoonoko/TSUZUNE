import { createHash, randomUUID } from 'node:crypto'
import { link, lstat, mkdir, open, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { composeNotes } from '../core/note-composer'
import { listTemplates, TEMPLATE_DIRECTORY } from '../core/templates'
import { dirnameRelative, validateRelativePath } from '../core/paths'
import { isAiImmutablePath } from '../shared/ai-write-policy'
import { createExcludedFileMatcher } from '../shared/excluded-files'
import type { NoteComposeInput, NoteComposeApplyInput, NoteComposePreview, NoteComposeResult, NoteComposeChange } from '../shared/note-composer'
import { canonicalWorkspaceVaultKey } from './workspaces'
import { VaultError, type VaultService } from './vault'

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const fail = (message: string): never => { throw new VaultError({ code: 'FILE_CHANGED', message }) }
export function parseNoteComposeInput(value: unknown): NoteComposeInput {
  if (!value || typeof value !== 'object') throw new Error('ノート操作の入力が不正です。')
  const input = value as NoteComposeInput
  if (!input.scope || typeof input.scope.rootPath !== 'string' || !Number.isSafeInteger(input.scope.rootRevision) || input.scope.rootRevision < 0 ||
      !['extract', 'merge'].includes(input.mode) || !['new', 'existing'].includes(input.targetMode) || !['append', 'prepend'].includes(input.placement) ||
      (input.sourceReplacement !== undefined && !['link', 'embed', 'none'].includes(input.sourceReplacement)) ||
      typeof input.sourcePath !== 'string' || typeof input.targetPath !== 'string' || typeof input.expectedSourceContent !== 'string' ||
      (input.mode === 'extract' && (!input.range || !Number.isSafeInteger(input.range.from) || !Number.isSafeInteger(input.range.to)))) throw new Error('ノート操作の入力が不正です。')
  if (input.targetTemplate !== undefined) {
    const template = input.targetTemplate
    if (!template || typeof template !== 'object' || input.mode !== 'extract' || input.targetMode !== 'new' ||
        typeof template.path !== 'string' || typeof template.now !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(template.now) ||
        !Number.isFinite(Date.parse(template.now)) || new Date(template.now).toISOString() !== template.now) throw new Error('テンプレートの入力が不正です。')
  }
  // Copy accepted fields; renderer objects are never a write manifest.
  return { scope: { ...input.scope }, mode: input.mode, sourcePath: input.sourcePath, expectedSourceContent: input.expectedSourceContent,
    targetPath: input.targetPath, targetMode: input.targetMode, placement: input.placement,
    ...(input.sourceReplacement !== undefined ? { sourceReplacement: input.sourceReplacement } : {}),
    ...(input.targetTemplate ? { targetTemplate: { path: input.targetTemplate.path, now: input.targetTemplate.now } } : {}),
    ...(input.range ? { range: { from: input.range.from, to: input.range.to } } : {}) }
}
interface Journal { version: 1; id: string; input: NoteComposeInput; preview: NoteComposePreview; revisions: Record<string, number>; templateBinding?: unknown }
export class NoteComposerService {
  constructor(private readonly vault: VaultService, private readonly getFilters: () => readonly string[] | Promise<readonly string[]>, private readonly afterWrite?: (path: string) => Promise<void>, private readonly getTemplateOptions?: () => { directory?: string; includeBuiltIns?: boolean } | Promise<{ directory?: string; includeBuiltIns?: boolean }>) {}
  private async scope(input: NoteComposeInput) {
    const root = this.vault.getRootPath(), revision = this.vault.getRootRevision()
    if (!root || input.scope.rootRevision !== revision || await canonicalWorkspaceVaultKey(root) !== input.scope.rootPath || root !== this.vault.getRootPath() || revision !== this.vault.getRootRevision()) fail('Vaultが切り替わりました。再度プレビューしてください。')
    return root as string
  }
  private async policy(path: string) {
    const check = validateRelativePath(path)
    if (!check.valid || check.normalized !== path || !path.toLowerCase().endsWith('.md') || path.split('/').some(part => part.startsWith('.')) || isAiImmutablePath(path) || createExcludedFileMatcher(await this.getFilters())(path)) throw new Error(`保護領域・除外・不正な場所は操作できません: ${path}`)
  }
  private async journalPath(root: string, create = false) {
    const directory = join(root, '.tsuzune')
    for (const path of [root, directory]) {
      try { const info = await lstat(path); if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('journalの保存場所が安全ではありません。') }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || path === root) throw error; if (create) await mkdir(directory) }
    }
    const path = join(directory, 'pending-note-compose.json')
    try { const info = await lstat(path); if (info.isSymbolicLink() || !info.isFile()) throw new Error('journalが安全ではありません。') }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    return path
  }
  private async inspect(input: NoteComposeInput) {
    const root = await this.scope(input)
    await this.policy(input.sourcePath); await this.policy(input.targetPath)
    const snapshot = await this.vault.scan([], { persistCreationTimes: false })
    await this.scope(input)
    if (!snapshot.directories.includes(dirnameRelative(input.targetPath))) throw new Error('統合先フォルダが見つかりません。')
    let templateBinding: unknown, resolvedTemplate: string | undefined
    if (input.targetTemplate) {
      await this.policy(input.targetTemplate.path)
      const configured = await this.getTemplateOptions?.()
      const options = { directory: configured?.directory ?? TEMPLATE_DIRECTORY, includeBuiltIns: configured?.includeBuiltIns ?? true }
      const template = listTemplates(snapshot.notes, options).find(note => note.path === input.targetTemplate!.path)
      if (!template) throw new Error('選択したテンプレートが見つかりません。再度選択してください。')
      const actual = snapshot.notes.some(note => note.path === template.path)
      if (actual) {
        const bytes = await readFile(await this.vault.resolveFileForOpen(template.path))
        if (!bytes.equals(Buffer.from(template.content, 'utf8'))) fail(`テンプレートのUTF-8を安全に確認できません: ${template.path}`)
      }
      resolvedTemplate = template.content
      templateBinding = { path: template.path, content: template.content, modifiedAt: template.modifiedAt, actual, options }
    }
    const transformed = composeNotes(input, snapshot.notes, snapshot.pathAliases, resolvedTemplate)
    const revisions: Record<string, number> = {}
    for (const change of transformed.changes) {
      await this.policy(change.path)
      if (change.before !== null) {
        const note = snapshot.notes.find(note => note.path === change.path)!
        revisions[change.path] = note.modifiedAt
        const bytes = await readFile(await this.vault.resolveFileForOpen(change.path))
        if (!bytes.equals(Buffer.from(change.before, 'utf8'))) fail(`内容またはUTF-8を安全に確認できません: ${change.path}`)
      }
    }
    await this.scope(input)
    const fingerprint = digest({ input, transformed, revisions, ...(templateBinding !== undefined ? { templateBinding } : {}) })
    const preview: NoteComposePreview = { fingerprint, sourcePath: input.sourcePath, targetPath: input.targetPath, ...transformed }
    return { preview, revisions, root, templateBinding }
  }
  private async assertNoPending(input: NoteComposeInput) {
    const root = await this.scope(input)
    try { await lstat(await this.journalPath(root)); throw new Error('RECOVERY_REQUIRED: 未完了のノート操作があります。') }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  async preview(value: NoteComposeInput): Promise<NoteComposePreview> {
    const input = parseNoteComposeInput(value)
    await this.assertNoPending(input)
    return (await this.inspect(input)).preview
  }
  async apply(value: NoteComposeApplyInput): Promise<NoteComposeResult> {
    if (!value || typeof value.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.fingerprint)) throw new Error('プレビューの確認情報が不正です。')
    const input = parseNoteComposeInput(value.input)
    await this.assertNoPending(input)
    const { preview, revisions, root, templateBinding } = await this.inspect(input)
    if (preview.fingerprint !== value.fingerprint) fail('プレビュー後にノートが変更されました。再度プレビューしてください。')
    const journal: Journal = { version: 1, id: randomUUID(), input, preview, revisions, ...(templateBinding !== undefined ? { templateBinding } : {}) }
    const path = await this.journalPath(root, true)
    await this.scope(input)
    const temporary = `${path}.${journal.id}.tmp`
    const handle = await open(temporary, 'wx')
    try {
      try {
        await handle.writeFile(JSON.stringify(journal), 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
      await this.scope(input)
      // Publish a complete journal without replacing another pending operation.
      await link(temporary, path)
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined)
    }
    try { return await this.finish(journal, path, false) }
    catch (error) { throw new Error('RECOVERY_REQUIRED: 未完了のノート操作を保持しました。再起動時に復旧します。 ' + (error instanceof Error ? error.message : ''), { cause: error }) }
  }
  private async state(change: NoteComposeChange) {
    try {
      const note = await this.vault.readNote(change.path)
      const bytes = await readFile(await this.vault.resolveFileForOpen(change.path))
      if (!bytes.equals(Buffer.from(note.content, 'utf8'))) throw new Error(`UTF-8を保持できません: ${change.path}`)
      return note
    } catch (error) {
      if (error instanceof VaultError && error.appError.code === 'NOT_FOUND') return null
      throw error
    }
  }
  private async finish(journal: Journal, path: string, recovery: boolean): Promise<NoteComposeResult> {
    const { input, preview } = journal
    await this.scope(input)
    const trash = preview.changes.find(change => change.kind === 'trash')
    const trashedPath = trash ? `.trash/onoko-op-${journal.id}/${trash.path}` : undefined
    // Validate the entire batch before the first resumed write; external edits never become rollback casualties.
    for (const change of preview.changes) {
      await this.policy(change.path)
      const note = await this.state(change)
      if (change.kind === 'trash' && !note && trashedPath) {
        const trashed = await readFile(await this.vault.resolveComposerTrash(journal.id, change.path))
        if (!trashed.equals(Buffer.from(change.before!, 'utf8'))) fail(`RECOVERY_REQUIRED: ごみ箱の内容が変更されています: ${trashedPath}`)
      } else if (note?.content !== change.before && note?.content !== change.after && !(note === null && change.before === null)) fail(`RECOVERY_REQUIRED: 外部変更を保持しました: ${change.path}`)
      if (!recovery && change.before !== null && note && (note.content !== change.before || note.modifiedAt !== journal.revisions[change.path])) fail(`操作中にノートが変更されました: ${change.path}`)
    }
    for (const change of preview.changes.filter(change => change.kind !== 'trash')) {
      await this.scope(input); await this.policy(change.path)
      const note = await this.state(change)
      if (note?.content === change.after) continue
      if (note?.content !== change.before && !(note === null && change.before === null)) fail(`外部変更を保持しました: ${change.path}`)
      await this.scope(input)
      if (note) await this.vault.saveNote({ path: change.path, content: change.after!, expectedContent: change.before!, expectedModifiedAt: note.modifiedAt })
      else await this.vault.createComposerNote({ path: change.path, content: change.after! }, () => this.scope(input))
      const saved = await open(await this.vault.resolveFileForOpen(change.path), 'r+')
      try { await saved.sync() } finally { await saved.close() }
      await this.afterWrite?.(change.path)
    }
    if (trash) {
      await this.scope(input)
      await this.vault.trashEntry(trash.path, async () => { await this.scope(input); await this.policy(trash.path) }, { id: journal.id, expectedRevision: digest(trash.before), verifyRevision: (content) => content === trash.before })
      const saved = await open(await this.vault.resolveComposerTrash(journal.id, trash.path), 'r+')
      try { await saved.sync() } finally { await saved.close() }
      await this.afterWrite?.(trash.path)
    }
    await this.scope(input)
    await rm(path)
    return { path: input.targetPath, changedPaths: preview.changes.map(change => change.path), ...(trashedPath ? { trashedPath } : {}) }
  }
  async recover(): Promise<void> {
    try { await this.recoverPending() }
    catch (error) { throw new Error('RECOVERY_REQUIRED: ノート操作を安全に復旧できません。 ' + (error instanceof Error ? error.message : ''), { cause: error }) }
  }
  private async recoverPending(): Promise<void> {
    const root = this.vault.getRootPath()
    if (!root) return
    const path = await this.journalPath(root)
    let raw: string
    try { raw = await readFile(path, 'utf8') } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error }
    const journal = JSON.parse(raw) as Journal
    if (journal.version !== 1 || !/^[a-f0-9-]{36}$/.test(journal.id)) throw new Error('RECOVERY_REQUIRED: journalが不正です。')
    const input = parseNoteComposeInput(journal.input)
    // A reopened Vault has a fresh process-local revision; canonical location remains binding.
    if (input.scope.rootPath !== await canonicalWorkspaceVaultKey(root)) fail('RECOVERY_REQUIRED: journalのVaultが一致しません。')
    const { fingerprint, sourcePath, targetPath, ...transformed } = journal.preview
    if (fingerprint !== digest({ input, transformed, revisions: journal.revisions, ...(journal.templateBinding !== undefined ? { templateBinding: journal.templateBinding } : {}) }) || sourcePath !== input.sourcePath || targetPath !== input.targetPath) throw new Error('RECOVERY_REQUIRED: journalの整合性を確認できません。')
    journal.input = { ...input, scope: { ...input.scope, rootRevision: this.vault.getRootRevision() } }
    await this.finish(journal, path, true)
  }
}
