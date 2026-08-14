import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from 'node:path'
import { randomUUID } from 'node:crypto'
import { isSupportedAttachmentPath } from '../shared/attachments'
import { createExcludedFileMatcher } from '../shared/excluded-files'
import { compilePathAliases, resolvePathAlias } from '../core/path-aliases'
import {
  basenameRelative,
  dirnameRelative,
  joinRelative,
  validateEntryName,
  validateRelativePath,
  withMarkdownExtension,
  withoutMarkdownExtension
} from '../core/paths'
import type {
  AppError,
  CreateDirectoryInput,
  CreateNoteInput,
  EntryOperationOutput,
  MoveNoteInput,
  NoteDocument,
  RenameEntryInput,
  SaveBookmarkInput,
  SaveNoteInput,
  SaveNoteOutput,
  VaultBookmark,
  VaultAttachment,
  VaultSnapshot
} from '../shared/types'

export class VaultError extends Error {
  constructor(
    readonly appError: AppError,
    options?: ErrorOptions
  ) {
    super(appError.message, options)
  }
}

function fromNodeError(error: unknown, fallback: AppError['code'], message: string): VaultError {
  if (error instanceof VaultError) {
    return error
  }

  const nodeError = error as NodeJS.ErrnoException
  let code = fallback
  if (nodeError?.code === 'ENOENT') {
    code = 'NOT_FOUND'
  } else if (nodeError?.code === 'EACCES' || nodeError?.code === 'EPERM') {
    code = 'ACCESS_DENIED'
  } else if (nodeError?.code === 'EEXIST') {
    code = 'ALREADY_EXISTS'
  }

  return new VaultError(
    {
      code,
      message
    },
    { cause: error }
  )
}

function isMarkdownFile(path: string): boolean {
  return extname(path).toLocaleLowerCase() === '.md'
}

const IMAGE_MIME_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.bmp', 'image/bmp'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif']
])

function validBirthtime(birthtimeMs: number): number | null {
  return Number.isFinite(birthtimeMs) && birthtimeMs > 0 ? birthtimeMs : null
}

type CreationTimeRegistry = Record<string, number>

function validCreationTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function normalizeCreationTimes(value: unknown): CreationTimeRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const normalized: CreationTimeRegistry = {}
  for (const [path, timestamp] of Object.entries(value)) {
    const validation = validateRelativePath(path)
    if (validation.valid && validation.normalized && validCreationTime(timestamp)) {
      normalized[validation.normalized] = timestamp
    }
  }
  return normalized
}

function normalizeBookmarks(value: unknown): VaultBookmark[] {
  if (!Array.isArray(value)) {
    return []
  }

  const bookmarks = new Map<string, VaultBookmark>()
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const candidate = item as Partial<VaultBookmark>
    const validation =
      typeof candidate.path === 'string'
        ? validateRelativePath(candidate.path)
        : { valid: false }
    if (
      candidate.type !== 'file' ||
      !validation.valid ||
      !validation.normalized ||
      !validCreationTime(candidate.ctime)
    ) {
      continue
    }
    bookmarks.set(validation.normalized, {
      type: 'file',
      path: validation.normalized,
      ...(typeof candidate.title === 'string' && candidate.title.trim()
        ? { title: candidate.title.trim() }
        : {}),
      ...(typeof candidate.group === 'string' && candidate.group.trim()
        ? { group: candidate.group.trim() }
        : {}),
      ctime: candidate.ctime
    })
  }
  return [...bookmarks.values()].sort((left, right) => left.ctime - right.ctime)
}

function timestampSuffix(date = new Date()): string {
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '-',
    pad(date.getMilliseconds(), 3)
  ].join('')
}

export class VaultService {
  private rootPath: string | null = null
  private rootRevision = 0
  private creationTimeQueue: Promise<void> = Promise.resolve()

  getRootPath(): string | null {
    return this.rootPath
  }

  async setRootPath(rootPath: string): Promise<void> {
    const info = await lstat(rootPath)
    if (info.isSymbolicLink()) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'シンボリックリンクやジャンクションはVaultにできません。'
      })
    }
    if (!info.isDirectory()) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: '選択した場所はフォルダではありません。'
      })
    }
    this.rootPath = resolve(rootPath)
    this.rootRevision += 1
  }

  clearRootPath(): void {
    if (this.rootPath) {
      this.rootRevision += 1
    }
    this.rootPath = null
  }

  private requireRoot(): string {
    if (!this.rootPath) {
      throw new VaultError({
        code: 'NO_VAULT',
        message: '先にVaultを開いてください。'
      })
    }
    return this.rootPath
  }

  private absolutePath(relativePath: string, allowRoot = false): string {
    const root = this.requireRoot()
    if (relativePath === '' && allowRoot) {
      return root
    }

    const validation = validateRelativePath(relativePath)
    if (!validation.valid || !validation.normalized) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: validation.reason ?? 'Vault内の有効なパスを指定してください。'
      })
    }

    const absolute = resolve(root, ...validation.normalized.split('/'))
    const fromRoot = relative(root, absolute)
    if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'Vault外のパスは操作できません。'
      })
    }
    return absolute
  }

  private relativePath(absolutePath: string): string {
    return relative(this.requireRoot(), absolutePath).split(sep).join('/')
  }

  private relativePathFrom(rootPath: string, absolutePath: string): string {
    return relative(rootPath, absolutePath).split(sep).join('/')
  }

  private async assertNoSymlinkTraversal(
    targetPath: string,
    allowMissing = false
  ): Promise<void> {
    const root = this.requireRoot()
    const fromRoot = relative(root, targetPath)
    const parts = fromRoot.split(sep).filter(Boolean)
    let current = root

    for (const part of parts) {
      current = join(current, part)
      try {
        const info = await lstat(current)
        if (info.isSymbolicLink()) {
          throw new VaultError({
            code: 'INVALID_PATH',
            message: 'シンボリックリンクやジャンクション経由の操作はできません。'
          })
        }
      } catch (error) {
        if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          return
        }
        throw error
      }
    }
  }

  private async ensureDestinationAvailable(
    source: string,
    destination: string
  ): Promise<void> {
    if (source === destination) {
      return
    }

    try {
      await lstat(destination)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return
      }
      throw error
    }

    throw new VaultError({
      code: 'ALREADY_EXISTS',
      message: '同じ名前の項目がすでにあります。'
    })
  }

  private async findAvailableMoveDestination(
    source: string,
    destination: string
  ): Promise<string> {
    if (source === destination) {
      return destination
    }

    const extension = extname(destination)
    const name = basename(destination, extension)
    for (let suffix = 0; ; suffix += 1) {
      const candidate =
        suffix === 0
          ? destination
          : join(dirname(destination), `${name} ${suffix}${extension}`)
      try {
        await lstat(candidate)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return candidate
        }
        throw error
      }
    }
  }

  private isCurrentRoot(rootPath: string, revision: number): boolean {
    return this.rootPath === rootPath && this.rootRevision === revision
  }

  private async readCreationTimes(rootPath: string): Promise<CreationTimeRegistry> {
    const metadataDirectory = join(rootPath, '.tsuzune')
    const registryPath = join(metadataDirectory, 'graph-file-times.json')

    try {
      const [directoryInfo, registryInfo] = await Promise.all([
        lstat(metadataDirectory),
        lstat(registryPath)
      ])
      if (
        !directoryInfo.isDirectory() ||
        directoryInfo.isSymbolicLink() ||
        !registryInfo.isFile() ||
        registryInfo.isSymbolicLink()
      ) {
        return {}
      }
      return normalizeCreationTimes(JSON.parse(await readFile(registryPath, 'utf8')))
    } catch {
      return {}
    }
  }

  private async readBookmarks(rootPath: string): Promise<VaultBookmark[]> {
    const metadataDirectory = join(rootPath, '.tsuzune')
    const bookmarkPath = join(metadataDirectory, 'bookmarks.json')
    try {
      const [directoryInfo, bookmarkInfo] = await Promise.all([
        lstat(metadataDirectory),
        lstat(bookmarkPath)
      ])
      if (
        !directoryInfo.isDirectory() ||
        directoryInfo.isSymbolicLink() ||
        !bookmarkInfo.isFile() ||
        bookmarkInfo.isSymbolicLink()
      ) {
        return []
      }
      return normalizeBookmarks(JSON.parse(await readFile(bookmarkPath, 'utf8')))
    } catch {
      return []
    }
  }

  private async readPathAliases(rootPath: string): Promise<Record<string, string>> {
    const metadataDirectory = join(rootPath, '.tsuzune')
    const aliasPath = join(metadataDirectory, 'path-aliases.json')
    try {
      const [directoryInfo, aliasInfo] = await Promise.all([
        lstat(metadataDirectory),
        lstat(aliasPath)
      ])
      if (
        !directoryInfo.isDirectory() ||
        directoryInfo.isSymbolicLink() ||
        !aliasInfo.isFile() ||
        aliasInfo.isSymbolicLink()
      ) {
        throw new Error('path-aliases.json must be a regular file.')
      }
      const parsed: unknown = JSON.parse(await readFile(aliasPath, 'utf8'))
      compilePathAliases(parsed)
      return { ...(parsed as Record<string, string>) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {}
      }
      throw new VaultError(
        {
          code: 'INVALID_PATH',
          message: '.tsuzune/path-aliases.jsonを確認してください。'
        },
        { cause: error }
      )
    }
  }

  private async bookmarkMatchesPath(
    bookmarkPath: string,
    targetPath: string,
    aliases: ReturnType<typeof compilePathAliases>
  ): Promise<boolean> {
    if (bookmarkPath.toLocaleLowerCase() === targetPath.toLocaleLowerCase()) {
      return true
    }
    if (!isMarkdownFile(bookmarkPath)) {
      return false
    }

    try {
      const absolute = this.absolutePath(bookmarkPath)
      await this.assertNoSymlinkTraversal(absolute)
      if ((await stat(absolute)).isFile()) {
        return false
      }
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== 'ENOENT' &&
        !(error instanceof VaultError && error.appError.code === 'INVALID_PATH')
      ) {
        throw error
      }
    }

    return (
      resolvePathAlias(aliases, bookmarkPath).toLocaleLowerCase() ===
      targetPath.toLocaleLowerCase()
    )
  }

  private async writeBookmarks(
    rootPath: string,
    revision: number,
    bookmarks: VaultBookmark[]
  ): Promise<void> {
    if (!this.isCurrentRoot(rootPath, revision)) {
      throw new VaultError({
        code: 'NO_VAULT',
        message: 'Vaultが切り替わったため、ブックマークを保存できませんでした。'
      })
    }

    const metadataDirectory = join(rootPath, '.tsuzune')
    const bookmarkPath = join(metadataDirectory, 'bookmarks.json')
    const temporaryPath = join(metadataDirectory, `.bookmarks-${randomUUID()}.tmp`)
    try {
      await mkdir(metadataDirectory, { recursive: true })
      const directoryInfo = await lstat(metadataDirectory)
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
        throw new VaultError({
          code: 'INVALID_PATH',
          message: 'TSUZUNEのメタデータ保存先を使用できません。'
        })
      }
      await writeFile(
        temporaryPath,
        `${JSON.stringify(normalizeBookmarks(bookmarks), null, 2)}\n`,
        { encoding: 'utf8', flag: 'wx' }
      )
      if (!this.isCurrentRoot(rootPath, revision)) {
        throw new VaultError({
          code: 'NO_VAULT',
          message: 'Vaultが切り替わったため、ブックマークを保存できませんでした。'
        })
      }
      await rename(temporaryPath, bookmarkPath)
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  private async writeCreationTimes(
    rootPath: string,
    revision: number,
    creationTimes: CreationTimeRegistry
  ): Promise<void> {
    if (!this.isCurrentRoot(rootPath, revision)) {
      return
    }

    const metadataDirectory = join(rootPath, '.tsuzune')
    const registryPath = join(metadataDirectory, 'graph-file-times.json')
    const temporaryPath = join(
      metadataDirectory,
      `.graph-file-times-${randomUUID()}.tmp`
    )

    try {
      await mkdir(metadataDirectory, { recursive: true })
      const directoryInfo = await lstat(metadataDirectory)
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
        return
      }

      const sorted = Object.fromEntries(
        Object.entries(normalizeCreationTimes(creationTimes)).sort(([left], [right]) =>
          left.localeCompare(right, 'ja')
        )
      )
      const serialized = `${JSON.stringify(sorted, null, 2)}\n`
      try {
        const registryInfo = await lstat(registryPath)
        if (
          registryInfo.isFile() &&
          !registryInfo.isSymbolicLink() &&
          (await readFile(registryPath, 'utf8')) === serialized
        ) {
          return
        }
      } catch {
        // Missing or unreadable metadata is refreshed below.
      }
      await writeFile(temporaryPath, serialized, {
        encoding: 'utf8',
        flag: 'wx'
      })
      if (!this.isCurrentRoot(rootPath, revision)) {
        await rm(temporaryPath, { force: true })
        return
      }
      await rename(temporaryPath, registryPath)
    } catch {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
    }
  }

  private async updateCreationTimes(
    rootPath: string,
    revision: number,
    update: (current: CreationTimeRegistry) => CreationTimeRegistry
  ): Promise<CreationTimeRegistry> {
    let result: CreationTimeRegistry = {}
    const operation = this.creationTimeQueue.then(async () => {
      if (!this.isCurrentRoot(rootPath, revision)) {
        return
      }
      const current = await this.readCreationTimes(rootPath)
      if (!this.isCurrentRoot(rootPath, revision)) {
        return
      }
      result = normalizeCreationTimes(update(current))
      await this.writeCreationTimes(rootPath, revision, result)
    })
    this.creationTimeQueue = operation.catch(() => undefined)
    await operation.catch(() => undefined)
    return result
  }

  private async moveCreationTimes(
    rootPath: string,
    revision: number,
    oldPath: string,
    newPath: string,
    directory: boolean
  ): Promise<void> {
    await this.updateCreationTimes(rootPath, revision, (current) => {
      const next = { ...current }
      for (const [path, timestamp] of Object.entries(current)) {
        if (path !== oldPath && (!directory || !path.startsWith(`${oldPath}/`))) {
          continue
        }
        const suffix = path.slice(oldPath.length)
        delete next[path]
        next[`${newPath}${suffix}`] = timestamp
      }
      return next
    })
  }

  private async removeCreationTimes(
    rootPath: string,
    revision: number,
    removedPath: string
  ): Promise<void> {
    await this.updateCreationTimes(rootPath, revision, (current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([path]) => path !== removedPath && !path.startsWith(`${removedPath}/`)
        )
      )
    )
  }

  async scan(userIgnoreFilters: readonly string[] = []): Promise<VaultSnapshot> {
    const root = this.requireRoot()
    const revision = this.rootRevision
    const directories: string[] = ['']
    const notePaths: string[] = []
    const attachmentPaths: string[] = []

    const walk = async (absoluteDirectory: string): Promise<void> => {
      let entries
      try {
        entries = await readdir(absoluteDirectory, { withFileTypes: true })
      } catch (error) {
        throw fromNodeError(error, 'UNKNOWN', 'Vaultを読み込めませんでした。')
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) {
          continue
        }

        const absolute = join(absoluteDirectory, entry.name)
        if (entry.isDirectory()) {
          directories.push(this.relativePathFrom(root, absolute))
          await walk(absolute)
        } else if (entry.isFile() && isMarkdownFile(entry.name)) {
          notePaths.push(absolute)
        } else if (entry.isFile() && isSupportedAttachmentPath(entry.name)) {
          attachmentPaths.push(absolute)
        }
      }
    }

    await walk(root)

    const notes = await Promise.all(
      notePaths.map(async (absolutePath): Promise<NoteDocument> => {
        const [content, info] = await Promise.all([
          readFile(absolutePath, 'utf8'),
          stat(absolutePath)
        ])
        const relativePath = this.relativePathFrom(root, absolutePath)
        return {
          path: relativePath,
          name: withoutMarkdownExtension(basenameRelative(relativePath)),
          content,
          modifiedAt: info.mtimeMs,
          createdAt: validBirthtime(info.birthtimeMs),
          size: info.size
        }
      })
    )

    const attachments = await Promise.all(
      attachmentPaths.map(async (absolutePath): Promise<VaultAttachment> => {
        const info = await stat(absolutePath)
        const relativePath = this.relativePathFrom(root, absolutePath)
        return {
          path: relativePath,
          name: basenameRelative(relativePath),
          modifiedAt: info.mtimeMs,
          createdAt: validBirthtime(info.birthtimeMs),
          size: info.size
        }
      })
    )

    if (this.rootRevision !== revision || this.rootPath !== root) {
      throw new VaultError({
        code: 'NO_VAULT',
        message: 'Vaultが切り替わったため、古い読み込み結果を破棄しました。'
      })
    }

    const pathAliases = await this.readPathAliases(root)
    const [creationTimes, bookmarks] = await Promise.all([
      this.updateCreationTimes(
        root,
        revision,
        (current) => {
          const next: CreationTimeRegistry = {}
          for (const item of [...notes, ...attachments]) {
            const timestamp = current[item.path] ?? item.createdAt
            if (validCreationTime(timestamp)) {
              next[item.path] = timestamp
            }
          }
          return next
        }
      ),
      this.readBookmarks(root)
    ])

    if (this.rootRevision !== revision || this.rootPath !== root) {
      throw new VaultError({
        code: 'NO_VAULT',
        message: 'Vaultが切り替わったため、古い読み込み結果を破棄しました。'
      })
    }

    for (const item of [...notes, ...attachments]) {
      item.createdAt = creationTimes[item.path] ?? item.createdAt
    }

    const isExcluded = createExcludedFileMatcher(userIgnoreFilters)
    const visibleNotes = notes.filter((item) => !isExcluded(item.path))
    const visibleAttachments = attachments.filter((item) => !isExcluded(item.path))

    directories.sort((left, right) => left.localeCompare(right, 'ja'))
    visibleNotes.sort((left, right) => left.path.localeCompare(right.path, 'ja'))
    visibleAttachments.sort((left, right) => left.path.localeCompare(right.path, 'ja'))

    const compiledAliases = compilePathAliases(pathAliases)
    const liveNotePaths = new Map(
      visibleNotes.map((note) => [note.path.toLocaleLowerCase(), note.path])
    )
    const resolvedBookmarks = normalizeBookmarks(
      bookmarks.map((bookmark) => {
        if (!isMarkdownFile(bookmark.path)) {
          return bookmark
        }
        const liveExactPath = liveNotePaths.get(bookmark.path.toLocaleLowerCase())
        if (liveExactPath) {
          return { ...bookmark, path: liveExactPath }
        }
        const canonicalPath = resolvePathAlias(compiledAliases, bookmark.path)
        const liveCanonicalPath = liveNotePaths.get(canonicalPath.toLocaleLowerCase())
        return liveCanonicalPath
          ? { ...bookmark, path: liveCanonicalPath }
          : bookmark
      })
    )

    return {
      rootPath: root,
      rootName: basename(root),
      directories,
      notes: visibleNotes,
      attachments: visibleAttachments,
      bookmarks: resolvedBookmarks,
      pathAliases
    }
  }

  async saveBookmark(input: SaveBookmarkInput): Promise<VaultBookmark> {
    const root = this.requireRoot()
    const revision = this.rootRevision
    const absolute = this.absolutePath(input.path)
    try {
      await this.assertNoSymlinkTraversal(absolute)
      const info = await stat(absolute)
      if (!info.isFile()) {
        throw new VaultError({
          code: 'INVALID_PATH',
          message: 'ファイルだけをブックマークできます。'
        })
      }

      const path = this.relativePathFrom(root, absolute)
      const current = await this.readBookmarks(root)
      const aliases = compilePathAliases(await this.readPathAliases(root))
      const matches = await Promise.all(
        current.map((bookmark) =>
          this.bookmarkMatchesPath(bookmark.path, path, aliases)
        )
      )
      const previous = current.find((_, index) => matches[index])
      const title = input.title?.trim()
      const group = input.group?.trim()
      const bookmark: VaultBookmark = {
        type: 'file',
        path,
        ...(title ? { title } : {}),
        ...(group ? { group } : {}),
        ctime: previous?.ctime ?? Date.now()
      }
      await this.writeBookmarks(root, revision, [
        ...current.filter((_, index) => !matches[index]),
        bookmark
      ])
      return bookmark
    } catch (error) {
      if (error instanceof VaultError) {
        throw error
      }
      throw fromNodeError(error, 'SAVE_FAILED', 'ブックマークを保存できませんでした。')
    }
  }

  async removeBookmark(path: string): Promise<void> {
    const root = this.requireRoot()
    const revision = this.rootRevision
    const absolute = this.absolutePath(path)
    const normalizedPath = this.relativePathFrom(root, absolute)
    try {
      const current = await this.readBookmarks(root)
      const aliases = compilePathAliases(await this.readPathAliases(root))
      const matches = await Promise.all(
        current.map((bookmark) =>
          this.bookmarkMatchesPath(bookmark.path, normalizedPath, aliases)
        )
      )
      await this.writeBookmarks(
        root,
        revision,
        current.filter((_, index) => !matches[index])
      )
    } catch (error) {
      if (error instanceof VaultError) {
        throw error
      }
      throw fromNodeError(error, 'SAVE_FAILED', 'ブックマークを削除できませんでした。')
    }
  }

  async readNote(relativePath: string): Promise<NoteDocument> {
    if (!isMarkdownFile(relativePath)) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'Markdownノートだけを開けます。'
      })
    }

    const root = this.requireRoot()
    const absolute = this.absolutePath(relativePath)
    try {
      await this.assertNoSymlinkTraversal(absolute)
      const [content, info] = await Promise.all([
        readFile(absolute, 'utf8'),
        stat(absolute)
      ])
      const normalizedPath = this.relativePathFrom(root, absolute)
      const creationTimes = await this.readCreationTimes(root)
      return {
        path: normalizedPath,
        name: withoutMarkdownExtension(basenameRelative(relativePath)),
        content,
        modifiedAt: info.mtimeMs,
        createdAt: creationTimes[normalizedPath] ?? validBirthtime(info.birthtimeMs),
        size: info.size
      }
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', 'ノートを読み込めませんでした。')
    }
  }

  async resolveFileForOpen(relativePath: string): Promise<string> {
    if (!isMarkdownFile(relativePath) && !isSupportedAttachmentPath(relativePath)) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'Markdownノートまたは対応する添付書類だけを開けます。'
      })
    }

    const absolute = this.absolutePath(relativePath)
    try {
      await this.assertNoSymlinkTraversal(absolute)
      const info = await stat(absolute)
      if (!info.isFile()) {
        throw new VaultError({
          code: 'INVALID_PATH',
          message: 'ファイルだけを開けます。'
        })
      }
      return absolute
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', 'ファイルを開けませんでした。')
    }
  }

  async resolveEntryForReveal(relativePath: string): Promise<string> {
    const absolute = this.absolutePath(relativePath)
    try {
      await this.assertNoSymlinkTraversal(absolute)
      const info = await stat(absolute)
      if (
        !info.isDirectory() &&
        (!info.isFile() ||
          (!isMarkdownFile(relativePath) && !isSupportedAttachmentPath(relativePath)))
      ) {
        throw new VaultError({
          code: 'INVALID_PATH',
          message: 'Vault内のノート、添付書類、フォルダーだけを表示できます。'
        })
      }
      return absolute
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', '項目を表示できませんでした。')
    }
  }

  async readImageDataUrl(relativePath: string): Promise<string> {
    const mimeType = IMAGE_MIME_TYPES.get(extname(relativePath).toLocaleLowerCase())
    if (!mimeType) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: '対応する画像ファイルだけをプレビューできます。'
      })
    }

    const absolutePath = await this.resolveFileForOpen(relativePath)
    try {
      return `data:${mimeType};base64,${(await readFile(absolutePath)).toString('base64')}`
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', '画像を読み込めませんでした。')
    }
  }

  async saveNote(input: SaveNoteInput): Promise<SaveNoteOutput> {
    if (!isMarkdownFile(input.path)) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'Markdownノートだけを保存できます。'
      })
    }

    const root = this.requireRoot()
    const revision = this.rootRevision
    const absolute = this.absolutePath(input.path)
    try {
      await this.assertNoSymlinkTraversal(absolute)
      const currentInfo = await stat(absolute)
      const normalizedPath = this.relativePathFrom(root, absolute)
      if (!input.force && Math.abs(currentInfo.mtimeMs - input.expectedModifiedAt) > 0.5) {
        const currentContent = await readFile(absolute, 'utf8')
        throw new VaultError({
          code: 'FILE_CHANGED',
          message: 'このノートは別のアプリで変更されています。',
          currentContent,
          currentModifiedAt: currentInfo.mtimeMs
        })
      }

      await this.updateCreationTimes(root, revision, (current) => {
        const timestamp = current[normalizedPath] ?? validBirthtime(currentInfo.birthtimeMs)
        return validCreationTime(timestamp)
          ? { ...current, [normalizedPath]: timestamp }
          : current
      })

      const temporaryPath = join(
        dirname(absolute),
        `.tsuzune-${basename(absolute)}-${randomUUID()}.tmp`
      )

      try {
        await writeFile(temporaryPath, input.content, {
          encoding: 'utf8',
          flag: 'wx'
        })
        if (!input.force) {
          await this.assertNoSymlinkTraversal(absolute)
          const latestInfo = await stat(absolute)
          if (
            Math.abs(latestInfo.mtimeMs - currentInfo.mtimeMs) > 0.5 ||
            latestInfo.size !== currentInfo.size
          ) {
            const currentContent = await readFile(absolute, 'utf8')
            throw new VaultError({
              code: 'FILE_CHANGED',
              message: '保存中に、このノートが別のアプリで変更されました。',
              currentContent,
              currentModifiedAt: latestInfo.mtimeMs
            })
          }
        }
        await rename(temporaryPath, absolute)
      } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => undefined)
        throw error
      }

      const savedInfo = await stat(absolute)
      return {
        path: input.path,
        modifiedAt: savedInfo.mtimeMs,
        size: savedInfo.size
      }
    } catch (error) {
      if (error instanceof VaultError) {
        throw error
      }
      throw fromNodeError(error, 'SAVE_FAILED', 'ノートを保存できませんでした。')
    }
  }

  async createNote(input: CreateNoteInput): Promise<EntryOperationOutput> {
    const name = withMarkdownExtension(input.name.trim())
    const nameValidation = validateEntryName(name)
    if (!nameValidation.valid) {
      throw new VaultError({
        code: 'INVALID_NAME',
        message: nameValidation.reason ?? 'ノート名を確認してください。'
      })
    }

    const directory = this.absolutePath(input.directory, true)
    const destination = join(directory, name)
    try {
      await this.assertNoSymlinkTraversal(directory)
      const parentInfo = await stat(directory)
      if (!parentInfo.isDirectory()) {
        throw new VaultError({
          code: 'INVALID_PATH',
          message: '作成先フォルダが見つかりません。'
        })
      }
      await writeFile(destination, input.content ?? '', {
        encoding: 'utf8',
        flag: 'wx'
      })
      return { path: this.relativePath(destination) }
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', 'ノートを作成できませんでした。')
    }
  }

  async createDirectory(input: CreateDirectoryInput): Promise<EntryOperationOutput> {
    const name = input.name.trim()
    const nameValidation = validateEntryName(name)
    if (!nameValidation.valid) {
      throw new VaultError({
        code: 'INVALID_NAME',
        message: nameValidation.reason ?? 'フォルダ名を確認してください。'
      })
    }

    const parent = this.absolutePath(input.parent, true)
    const destination = join(parent, name)
    try {
      await this.assertNoSymlinkTraversal(parent)
      await mkdir(destination)
      return { path: this.relativePath(destination) }
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', 'フォルダを作成できませんでした。')
    }
  }

  async renameEntry(input: RenameEntryInput): Promise<EntryOperationOutput> {
    const root = this.requireRoot()
    const revision = this.rootRevision
    const source = this.absolutePath(input.path)
    let info
    try {
      await this.assertNoSymlinkTraversal(source)
      info = await lstat(source)
    } catch (error) {
      throw fromNodeError(error, 'NOT_FOUND', '名前を変更する対象が見つかりません。')
    }

    if (info.isSymbolicLink()) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'シンボリックリンクは操作できません。'
      })
    }

    let newName = input.newName.trim()
    if (info.isFile() && isMarkdownFile(input.path)) {
      newName = withMarkdownExtension(newName)
    }

    const nameValidation = validateEntryName(newName)
    if (!nameValidation.valid) {
      throw new VaultError({
        code: 'INVALID_NAME',
        message: nameValidation.reason ?? '新しい名前を確認してください。'
      })
    }

    const destination = join(dirname(source), newName)
    try {
      await this.ensureDestinationAvailable(source, destination)
      await rename(source, destination)
      const oldPath = this.relativePathFrom(root, source)
      const newPath = this.relativePathFrom(root, destination)
      await this.moveCreationTimes(
        root,
        revision,
        oldPath,
        newPath,
        info.isDirectory()
      )
      return {
        oldPath,
        path: newPath
      }
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', '名前を変更できませんでした。')
    }
  }

  async moveNote(input: MoveNoteInput): Promise<EntryOperationOutput> {
    if (!isMarkdownFile(input.path) && !isSupportedAttachmentPath(input.path)) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'Markdownノートまたは対応する添付ファイルだけを移動できます。'
      })
    }

    const root = this.requireRoot()
    const revision = this.rootRevision
    const source = this.absolutePath(input.path)
    const destinationDirectory = input.destinationPath
      ? this.absolutePath(dirnameRelative(input.destinationPath), true)
      : this.absolutePath(input.destinationDirectory, true)
    const requestedDestination = input.destinationPath
      ? this.absolutePath(input.destinationPath)
      : join(destinationDirectory, basename(source))

    try {
      await this.assertNoSymlinkTraversal(source)
      await this.assertNoSymlinkTraversal(destinationDirectory)
      const directoryInfo = await stat(destinationDirectory)
      if (!directoryInfo.isDirectory()) {
        throw new VaultError({
          code: 'INVALID_PATH',
          message: '移動先フォルダが見つかりません。'
        })
      }
      const destination = input.destinationPath
        ? requestedDestination
        : await this.findAvailableMoveDestination(
            source,
            requestedDestination
          )
      await this.ensureDestinationAvailable(source, destination)
      await rename(source, destination)
      const oldPath = this.relativePathFrom(root, source)
      const newPath = this.relativePathFrom(root, destination)
      await this.moveCreationTimes(root, revision, oldPath, newPath, false)
      return {
        oldPath,
        path: newPath
      }
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', 'ファイルを移動できませんでした。')
    }
  }

  async trashEntry(relativePath: string): Promise<EntryOperationOutput> {
    if (relativePath === '.trash' || relativePath.startsWith('.trash/')) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: '.trashはTSUZUNEから削除できません。'
      })
    }

    const root = this.requireRoot()
    const revision = this.rootRevision
    const source = this.absolutePath(relativePath)
    const normalizedPath = this.relativePathFrom(root, source)
    const trashRoot = join(root, '.trash')
    const batchRoot = join(trashRoot, `${timestampSuffix()}-${randomUUID()}`)
    const destination = join(batchRoot, ...relativePath.split('/'))
    let batchCreated = false

    try {
      await this.assertNoSymlinkTraversal(source)
      await this.assertNoSymlinkTraversal(trashRoot, true)
      await mkdir(trashRoot, { recursive: true })
      await this.assertNoSymlinkTraversal(trashRoot)
      await this.assertNoSymlinkTraversal(dirname(destination), true)
      await mkdir(batchRoot)
      batchCreated = true
      await mkdir(dirname(destination), { recursive: true })
      await this.assertNoSymlinkTraversal(dirname(destination))
      await rename(source, destination)
      await this.removeCreationTimes(root, revision, normalizedPath)
      return {
        oldPath: normalizedPath,
        path: this.relativePathFrom(root, destination)
      }
    } catch (error) {
      if (batchCreated) {
        await rm(batchRoot, { recursive: true, force: true }).catch(() => undefined)
      }
      throw fromNodeError(error, 'UNKNOWN', '.trashへ移動できませんでした。')
    }
  }

  buildPathAfterRename(relativePath: string, newName: string): string {
    const currentName = basenameRelative(relativePath)
    const extension = isMarkdownFile(currentName) ? '.md' : ''
    const normalizedName =
      extension && !newName.toLocaleLowerCase().endsWith(extension)
        ? `${newName}${extension}`
        : newName
    return joinRelative(dirnameRelative(relativePath), normalizedName)
  }
}
