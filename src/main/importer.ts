import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { IMPORT_MAX_FILES, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_TOTAL_BYTES, safeImportPath, hasImportCaseCollision } from '../shared/importer'
import type { ImportApplyResult, ImportFile, ImportPreview, ImportPreviewInput, ImportReadRequest, ImportSelectedFile, ImportSource } from '../shared/importer'
import type { PropertyChangeScope } from '../shared/property-changes'
import { canonicalWorkspaceVaultKey } from './workspaces'
import { VaultError, type VaultService } from './vault'
import { readImportZip } from './importer-zip'

const marker = '.tsuzune-import.json'
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
function invalid(message: string): never { throw new VaultError({ code: 'INVALID_PATH', message }) }
function changed(): never { throw new VaultError({ code: 'FILE_CHANGED', message: '元ファイルまたはVaultが変更されました。再度プレビューしてください。' }) }
const key = (path: string): string => resolve(path).replaceAll('\\', '/').toLowerCase()
const overlaps = (a: string, b: string): boolean => a === b || a.startsWith(b + '/') || b.startsWith(a + '/')

function checkedFiles(files: ImportFile[]): ImportFile[] {
  if (!Array.isArray(files) || !files.length || files.length > IMPORT_MAX_FILES) invalid('ファイル数の上限は5000です。')
  let total = 0
  const names = new Set<string>()
  const outputs = files.map(file => {
    if (!file || !safeImportPath(file.path) || !(file.bytes instanceof Uint8Array) || file.bytes.byteLength > IMPORT_MAX_FILE_BYTES) invalid('無効なパスまたはファイルサイズです。')
    const name = file.path.toLowerCase()
    if (names.has(name) || [...names].some(other => other.startsWith(name + '/') || name.startsWith(other + '/'))) invalid('ファイル名が衝突しています。')
    names.add(name); total += file.bytes.byteLength
    if (total > IMPORT_MAX_TOTAL_BYTES) invalid('合計サイズの上限は256MiBです。')
    return { path: file.path, bytes: new Uint8Array(file.bytes) }
  })
  if (hasImportCaseCollision(outputs.map(file => file.path))) invalid('フォルダー名の大小文字が衝突しています。')
  return outputs
}

async function hasSymlink(path: string): Promise<boolean> {
  // Check every component: a regular leaf through a junction is still an unsafe source.
  for (let current = resolve(path); ; current = dirname(current)) {
    if ((await lstat(current)).isSymbolicLink()) return true
    if (dirname(current) === current) break
  }
  return false
}

async function sourceBytes(path: string): Promise<Uint8Array> {
  if (await hasSymlink(path)) invalid('シンボリックリンクは取り込めません。')
  const handle = await open(path, 'r')
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size > IMPORT_MAX_FILE_BYTES) invalid('一ファイルの上限は128MiBです。')
    const chunks: Buffer[] = []; let size = 0
    while (true) {
      const chunk = Buffer.alloc(Math.min(1024 * 1024, IMPORT_MAX_FILE_BYTES - size + 1))
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null)
      if (!bytesRead) break
      size += bytesRead
      if (size > IMPORT_MAX_FILE_BYTES) invalid('一ファイルの上限は128MiBです。')
      chunks.push(chunk.subarray(0, bytesRead))
    }
    const after = await handle.stat()
    if (info.size !== after.size || info.mtimeMs !== after.mtimeMs || await hasSymlink(path)) changed()
    return Buffer.concat(chunks, size)
  } finally { await handle.close() }
}

type Source = { scope: PropertyChangeScope; root: string; source: Omit<ImportSource, 'files'>; originals: Array<{ path: string; name: string; hash: string; canonical: string }>; fingerprint: string }
type Plan = { source: Source; files: ImportFile[]; preview: ImportPreview }

/** Human-only local import. Tokens retain OS paths in main; preview outputs are sealed copies. */
export class ImporterService {
  private sources = new Map<string, Source>()
  private plans = new Map<string, Plan>()
  constructor(private readonly vault: VaultService, private readonly getFilters: () => Promise<readonly string[]> = async () => []) {}

  private async guard(scope: PropertyChangeScope): Promise<string> {
    const root = this.vault.getRootPath()
    const revision = this.vault.getRootRevision()
    if (!root || !scope || scope.rootRevision !== this.vault.getRootRevision() || scope.rootPath !== await canonicalWorkspaceVaultKey(root)) changed()
    if ((await lstat(root)).isSymbolicLink()) changed()
    if (root !== this.vault.getRootPath() || revision !== this.vault.getRootRevision()) changed()
    return root
  }

  async read(request: ImportReadRequest, selected: ImportSelectedFile[]): Promise<ImportSource> {
    const root = await this.guard(request?.scope)
    if (!['markdown', 'chatgpt', 'notion', 'enex'].includes(request.format) || !['folder', 'file'].includes(request.kind) ||
      !Array.isArray(selected) || !selected.length) invalid('取り込み元を選択してください。')
    if (selected.length > IMPORT_MAX_FILES) invalid('ファイル数の上限は5000です。')
    this.sources.clear(); this.plans.clear()
    const files: ImportFile[] = [], warnings: string[] = [], originals: Source['originals'] = []
    let sourceName = '', total = 0
    for (const item of selected) {
      if (!item || typeof item.path !== 'string' || !isAbsolute(item.path) || typeof item.relativePath !== 'string') invalid('選択ファイルが無効です。')
      const pieces = item.relativePath.split('/')
      if (!safeImportPath(item.relativePath)) {
        if (pieces.some(part => part.startsWith('.') && part !== '..' && part !== '.')) { warnings.push('隠しファイル/設定を除外しました。'); continue }
        invalid('選択パスが無効です。')
      }
      const path = request.kind === 'folder' ? pieces.slice(1).join('/') : basename(item.relativePath)
      if (!safeImportPath(path)) invalid('フォルダー内のファイルを選択してください。')
      if (await hasSymlink(item.path)) { warnings.push('シンボリックリンクを除外しました。'); continue }
      const expected = request.kind === 'folder' ? resolve(item.path, ...pieces.slice(1).map(() => '..')) : resolve(item.path)
      if (overlaps(key(expected), key(root))) invalid('取り込み元とVaultが重なっています。')
      sourceName ||= request.kind === 'folder' ? pieces[0] : basename(item.path)
      if (request.kind === 'folder' && pieces[0] !== sourceName) invalid('一つのフォルダーを選択してください。')
      const bytes = await sourceBytes(item.path)
      const canonical = await realpath(item.path)
      if (overlaps(key(canonical), key(root))) invalid('取り込み元とVaultが重なっています。')
      total += bytes.length
      if (total > IMPORT_MAX_TOTAL_BYTES) invalid('合計サイズの上限は256MiBです。')
      originals.push({ path: item.path, name: path, hash: hash(bytes), canonical })
      if (/\.zip$/i.test(path)) {
        if (request.kind !== 'file' || selected.length !== 1 || !['chatgpt', 'notion'].includes(request.format)) invalid('この形式ではZIPを選択できません。')
        try { files.push(...readImportZip(bytes)) } catch { invalid('ZIPが壊れているか、未対応です。ZIP64・暗号化・分割ZIP・危険なパスは取り込めません。') }
      } else files.push({ path, bytes })
    }
    const clean = checkedFiles(files)
    const source: ImportSource = { token: randomUUID(), format: request.format, sourceName, files: clean, warnings }
    const fingerprint = hash(new TextEncoder().encode(JSON.stringify(originals.map(item => [request.kind === 'file' ? '' : item.name, item.hash]).sort())))
    const stored = { token: source.token, format: source.format, sourceName, warnings: [...warnings] }
    this.sources.set(source.token, { root, scope: { ...request.scope }, source: stored, originals, fingerprint })
    await this.guard(request.scope)
    return source
  }

  private async inspect(root: string, folder: string, fingerprint: string): Promise<{ duplicateFolder: string | null; conflicts: string[] }> {
    const entries = await readdir(root, { withFileTypes: true })
    let duplicateFolder: string | null = null
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('.')) continue
      const path = join(root, entry.name, marker)
      try {
        const info = await lstat(path)
        if (info.isFile() && !info.isSymbolicLink() && info.size < 8192 && JSON.parse(await readFile(path, 'utf8')).fingerprint === fingerprint) duplicateFolder = entry.name
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error }
    }
    return { duplicateFolder, conflicts: entries.filter(entry => entry.name.toLowerCase() === folder.toLowerCase()).map(entry => entry.name) }
  }

  async preview(input: ImportPreviewInput): Promise<ImportPreview> {
    const root = await this.guard(input?.scope), source = this.sources.get(input.sourceToken)
    if (!source || source.root !== root || source.scope.rootRevision !== input.scope.rootRevision) changed()
    if (!safeImportPath(input.destinationName) || input.destinationName.includes('/')) invalid('新規フォルダー名が無効です。')
    const files = checkedFiles(input.files), noteCount = files.filter(file => /\.md$/i.test(file.path)).length
    if (!noteCount) invalid('Markdownノートがありません。')
    if (!Array.isArray(input.warnings) || input.warnings.some(item => typeof item !== 'string' || item.length > 4096) || input.warnings.length > IMPORT_MAX_FILES) invalid('警告が無効です。')
    const preview: ImportPreview = { planId: randomUUID(), folder: input.destinationName, format: source.source.format, sourceName: source.source.sourceName,
      fileCount: files.length, noteCount, totalBytes: files.reduce((sum, file) => sum + file.bytes.length, 0), paths: files.map(file => file.path),
      warnings: [...source.source.warnings, ...input.warnings], ...await this.inspect(root, input.destinationName, source.fingerprint) }
    this.plans.clear(); this.plans.set(preview.planId, { source, files, preview: { ...preview, paths: [...preview.paths] } })
    await this.guard(input.scope)
    return preview
  }

  async apply(input: { scope: PropertyChangeScope; planId: string }): Promise<ImportApplyResult> {
    const root = await this.guard(input?.scope), plan = this.plans.get(input.planId)
    this.plans.delete(input.planId)
    if (!plan || root !== plan.source.root || plan.source.scope.rootRevision !== input.scope.rootRevision) changed()
    const check = await this.inspect(root, plan.preview.folder, plan.source.fingerprint)
    if (check.duplicateFolder || check.conflicts.length) invalid('同じ原本または保存先フォルダーが既にあります。')
    for (const original of plan.source.originals) {
      if (await realpath(original.path) !== original.canonical || hash(await sourceBytes(original.path)) !== original.hash) changed()
    }
    const stage = join(root, `.tsuzune-import-${randomUUID()}`), destination = join(root, plan.preview.folder)
    let owned: { ino: number; dev: number } | null = null
    try {
      await this.guard(input.scope); await mkdir(stage); owned = await lstat(stage)
      for (const file of plan.files) {
        const target = join(stage, ...file.path.split('/'))
        await mkdir(dirname(target), { recursive: true }); await writeFile(target, file.bytes, { flag: 'wx' })
        if (hash(await readFile(target)) !== hash(file.bytes)) invalid('保存内容を確認できませんでした。')
      }
      await writeFile(join(stage, marker), JSON.stringify({ version: 1, fingerprint: plan.source.fingerprint, format: plan.source.source.format }), { flag: 'wx' })
      await this.guard(input.scope)
      const finalCheck = await this.inspect(root, plan.preview.folder, plan.source.fingerprint)
      if (finalCheck.conflicts.length || finalCheck.duplicateFolder) invalid('保存先が変更されました。')
      for (const original of plan.source.originals) {
        if (await realpath(original.path) !== original.canonical || hash(await sourceBytes(original.path)) !== original.hash) changed()
      }
      await this.guard(input.scope)
      // Windows directory rename fails if the destination exists, including an empty directory.
      await rename(stage, destination); owned = null
      this.sources.delete(plan.source.source.token)
      return { folder: plan.preview.folder, fileCount: plan.preview.fileCount, noteCount: plan.preview.noteCount, snapshot: await this.vault.scan(await this.getFilters(), { persistCreationTimes: false }) }
    } finally {
      if (owned && dirname(stage) === root && basename(stage).startsWith('.tsuzune-import-')) {
        const current = await lstat(stage).catch(() => null)
        if (current && !current.isSymbolicLink() && current.ino === owned.ino && current.dev === owned.dev && await realpath(dirname(stage)) === await realpath(root)) await rm(stage, { recursive: true, force: true })
      }
    }
  }

  async discard(token: string): Promise<null> {
    if (typeof token !== 'string') invalid('取り込み元が無効です。')
    this.sources.delete(token)
    for (const [id, plan] of this.plans) if (plan.source.source.token === token) this.plans.delete(id)
    return null
  }
}
