import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import type {
  AppError,
  CreateDirectoryInput,
  CreateNoteInput,
  MoveNoteInput,
  RenameEntryInput,
  Result,
  SaveNoteInput
} from '../shared/types'
import { updateSettings, readSettings } from './settings'
import { VaultError, VaultService } from './vault'
import { VaultWatcher } from './watcher'

let ipcTail: Promise<void> = Promise.resolve()

function runInOrder<T>(operation: () => Promise<T>): Promise<T> {
  const result = ipcTail.then(operation, operation)
  ipcTail = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function success<T>(value: T): Result<T> {
  return { ok: true, value }
}

function failure(error: unknown): Result<never> {
  if (error instanceof VaultError) {
    return { ok: false, error: error.appError }
  }

  return {
    ok: false,
    error: {
      code: 'UNKNOWN',
      message: error instanceof Error ? error.message : '予期しないエラーが発生しました。'
    }
  }
}

function trustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url
  return Boolean(
    url &&
      (url.startsWith('file://') ||
        url.startsWith('http://localhost:') ||
        url.startsWith('http://127.0.0.1:'))
  )
}

function register<TArgs extends unknown[], TOutput>(
  channel: string,
  handler: (...args: TArgs) => Promise<TOutput>
): void {
  ipcMain.handle(channel, async (event, ...args: TArgs): Promise<Result<TOutput>> => {
    if (!trustedSender(event)) {
      const error: AppError = {
        code: 'ACCESS_DENIED',
        message: 'この操作元は信頼できません。'
      }
      return { ok: false, error }
    }

    try {
      return success(await runInOrder(() => handler(...args)))
    } catch (error) {
      return failure(error)
    }
  })
}

export function registerIpc(
  vault: VaultService,
  watcher: VaultWatcher,
  getWindow: () => BrowserWindow | null,
  approveClose: () => void
): void {
  register('vault:choose', async () => {
    const options: Electron.OpenDialogOptions = {
      title: 'Vaultフォルダを選択',
      properties: ['openDirectory', 'createDirectory']
    }
    const owner = getWindow()
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const rootPath = result.filePaths[0]
    const previousRoot = vault.getRootPath()
    const previousSettings = await readSettings()
    let watcherSwitchAttempted = false
    let settingsAttempted = false

    try {
      watcherSwitchAttempted = true
      await watcher.stop()
      await vault.setRootPath(rootPath)
      const snapshot = await vault.scan()
      await watcher.start(rootPath)
      settingsAttempted = true
      await updateSettings({
        lastVaultPath: rootPath,
        lastNotePath: null
      })
      return snapshot
    } catch (error) {
      let rootRestored = false
      if (previousRoot) {
        await vault
          .setRootPath(previousRoot)
          .then(() => {
            rootRestored = true
          })
          .catch(() => vault.clearRootPath())
      } else {
        vault.clearRootPath()
      }
      if (watcherSwitchAttempted) {
        if (previousRoot && rootRestored) {
          await watcher.start(previousRoot).catch(async () => {
            await watcher.stop().catch(() => undefined)
          })
        } else {
          await watcher.stop().catch(() => undefined)
        }
      }
      if (settingsAttempted) {
        await updateSettings(previousSettings).catch(() => undefined)
      }
      throw error
    }
  })

  register('vault:openLast', async () => {
    const settings = await readSettings()
    if (!settings.lastVaultPath) {
      return null
    }

    try {
      await vault.setRootPath(settings.lastVaultPath)
      await watcher.start(settings.lastVaultPath)
      return await vault.scan()
    } catch {
      vault.clearRootPath()
      await watcher.stop()
      await updateSettings({
        lastVaultPath: null,
        lastNotePath: null
      })
      return null
    }
  })

  register('vault:snapshot', () => vault.scan())
  register('vault:readNote', (path: string) => vault.readNote(path))
  register('settings:get', () => readSettings())

  register('note:save', async (input: SaveNoteInput) => {
    const saved = await vault.saveNote(input)
    watcher.expectOwnWrite(
      input.path,
      input.content,
      saved.modifiedAt,
      saved.size
    )
    return saved
  })

  register('entry:createNote', async (input: CreateNoteInput) => {
    return vault.createNote(input)
  })

  register('entry:createDirectory', async (input: CreateDirectoryInput) => {
    return vault.createDirectory(input)
  })

  register('entry:rename', async (input: RenameEntryInput) => {
    return vault.renameEntry(input)
  })

  register('entry:moveNote', async (input: MoveNoteInput) => {
    return vault.moveNote(input)
  })

  register('entry:trash', async (path: string) => {
    return vault.trashEntry(path)
  })

  register('settings:setLastNote', async (path: string | null) => {
    await updateSettings({ lastNotePath: path })
    return null
  })

  register('system:openExternal', async (url: string) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new VaultError({
        code: 'INVALID_PATH',
        message: 'httpまたはhttpsのリンクだけを開けます。'
      })
    }
    await shell.openExternal(parsed.toString())
    return null
  })

  ipcMain.on('app:confirmClose', (event, allow: boolean) => {
    const url = event.senderFrame?.url
    if (
      !url ||
      (!url.startsWith('file://') &&
        !url.startsWith('http://localhost:') &&
        !url.startsWith('http://127.0.0.1:'))
    ) {
      return
    }
    if (allow) {
      approveClose()
    }
  })
}
