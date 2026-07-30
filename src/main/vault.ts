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
  SaveNoteInput,
  SaveNoteOutput,
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

  async scan(): Promise<VaultSnapshot> {
    const root = this.requireRoot()
    const revision = this.rootRevision
    const directories: string[] = ['']
    const notePaths: string[] = []

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

    directories.sort((left, right) => left.localeCompare(right, 'ja'))
    notes.sort((left, right) => left.path.localeCompare(right.path, 'ja'))

    return {
      rootPath: root,
      rootName: basename(root),
      directories,
      notes
    }
  }

  async readNote(relativePath: string): Promise<NoteDocument> {
    if (!isMarkdownFile(relativePath)) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'Markdownノートだけを開けます。'
      })
    }

    const absolute = this.absolutePath(relativePath)
    try {
      await this.assertNoSymlinkTraversal(absolute)
      const [content, info] = await Promise.all([
        readFile(absolute, 'utf8'),
        stat(absolute)
      ])
      return {
        path: relativePath.replaceAll('\\', '/'),
        name: withoutMarkdownExtension(basenameRelative(relativePath)),
        content,
        modifiedAt: info.mtimeMs,
        size: info.size
      }
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', 'ノートを読み込めませんでした。')
    }
  }

  async saveNote(input: SaveNoteInput): Promise<SaveNoteOutput> {
    if (!isMarkdownFile(input.path)) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'Markdownノートだけを保存できます。'
      })
    }

    const absolute = this.absolutePath(input.path)
    try {
      await this.assertNoSymlinkTraversal(absolute)
      const currentInfo = await stat(absolute)
      if (!input.force && Math.abs(currentInfo.mtimeMs - input.expectedModifiedAt) > 0.5) {
        const currentContent = await readFile(absolute, 'utf8')
        throw new VaultError({
          code: 'FILE_CHANGED',
          message: 'このノートは別のアプリで変更されています。',
          currentContent,
          currentModifiedAt: currentInfo.mtimeMs
        })
      }

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
      return {
        oldPath: input.path,
        path: this.relativePath(destination)
      }
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', '名前を変更できませんでした。')
    }
  }

  async moveNote(input: MoveNoteInput): Promise<EntryOperationOutput> {
    if (!isMarkdownFile(input.path)) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'v0.1ではノートだけを移動できます。'
      })
    }

    const source = this.absolutePath(input.path)
    const destinationDirectory = this.absolutePath(input.destinationDirectory, true)
    const destination = join(destinationDirectory, basename(source))

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
      await this.ensureDestinationAvailable(source, destination)
      await rename(source, destination)
      return {
        oldPath: input.path,
        path: this.relativePath(destination)
      }
    } catch (error) {
      throw fromNodeError(error, 'UNKNOWN', 'ノートを移動できませんでした。')
    }
  }

  async trashEntry(relativePath: string): Promise<EntryOperationOutput> {
    if (relativePath === '.trash' || relativePath.startsWith('.trash/')) {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: '.trashはTSUZUNEから削除できません。'
      })
    }

    const source = this.absolutePath(relativePath)
    const trashRoot = join(this.requireRoot(), '.trash')
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
      return {
        oldPath: relativePath,
        path: this.relativePath(destination)
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
