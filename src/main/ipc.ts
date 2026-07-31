import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { readFile } from 'node:fs/promises'
import type {
  AppError,
  CreateDirectoryInput,
  CreateNoteInput,
  DriveRemoteVault,
  DriveSyncApplyResult,
  DriveSyncPreview,
  GoogleDriveStatus,
  MoveNoteInput,
  PairDriveVaultInput,
  RenameEntryInput,
  Result,
  SaveNoteInput
} from '../shared/types'
import { updateSettings, readSettings } from './settings'
import { VaultError, VaultService } from './vault'
import { VaultWatcher } from './watcher'
import type { GoogleConnectionService } from './google-connection'

let ipcTail: Promise<void> = Promise.resolve()
let googleIpcTail: Promise<void> = Promise.resolve()

function runInOrder<T>(operation: () => Promise<T>): Promise<T> {
  const result = ipcTail.then(operation, operation)
  ipcTail = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function runGoogleInOrder<T>(operation: () => Promise<T>): Promise<T> {
  const result = googleIpcTail.then(operation, operation)
  googleIpcTail = result.then(
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

function trustedSender(
  event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>,
  getWindow: () => BrowserWindow | null
): boolean {
  const window = getWindow()
  return Boolean(
    window &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
  )
}

function register<TArgs extends unknown[], TOutput>(
  channel: string,
  isTrusted: (event: IpcMainInvokeEvent) => boolean,
  handler: (...args: TArgs) => Promise<TOutput>
): void {
  ipcMain.handle(channel, async (event, ...args: TArgs): Promise<Result<TOutput>> => {
    if (!isTrusted(event)) {
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

function registerConcurrent<TArgs extends unknown[], TOutput>(
  channel: string,
  isTrusted: (event: IpcMainInvokeEvent) => boolean,
  handler: (...args: TArgs) => Promise<TOutput>
): void {
  ipcMain.handle(channel, async (event, ...args: TArgs): Promise<Result<TOutput>> => {
    if (!isTrusted(event)) {
      return {
        ok: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'この操作元は信頼できません。'
        }
      }
    }

    try {
      return success(await handler(...args))
    } catch (error) {
      return failure(error)
    }
  })
}

function registerGoogle<TArgs extends unknown[], TOutput>(
  channel: string,
  isTrusted: (event: IpcMainInvokeEvent) => boolean,
  handler: (...args: TArgs) => Promise<TOutput>
): void {
  ipcMain.handle(channel, async (event, ...args: TArgs): Promise<Result<TOutput>> => {
    if (!isTrusted(event)) {
      return {
        ok: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'この操作元は信頼できません。'
        }
      }
    }

    try {
      return success(await runGoogleInOrder(() => handler(...args)))
    } catch (error) {
      return failure(error)
    }
  })
}

export interface DriveSyncIpcService {
  getStatusMetadata(
    rootPath: string | null
  ): Promise<{ lastSyncAt: string | null; rootFolderId: string | null }>
  listRemoteVaults(): Promise<DriveRemoteVault[]>
  pairRemoteVault(rootFolderId: string, vaultId: string): Promise<void>
  preview(): Promise<DriveSyncPreview>
  apply(planId: string): Promise<DriveSyncApplyResult>
}

export interface GoogleIpcServices {
  connection: GoogleConnectionService
  driveSync: DriveSyncIpcService
}

export function registerIpc(
  vault: VaultService,
  watcher: VaultWatcher,
  google: GoogleIpcServices,
  getWindow: () => BrowserWindow | null,
  approveClose: () => void
): void {
  const isTrusted = (event: IpcMainInvokeEvent): boolean =>
    trustedSender(event, getWindow)

  const registerTrusted = <TArgs extends unknown[], TOutput>(
    channel: string,
    handler: (...args: TArgs) => Promise<TOutput>
  ): void => register(channel, isTrusted, handler)

  const registerConcurrentTrusted = <TArgs extends unknown[], TOutput>(
    channel: string,
    handler: (...args: TArgs) => Promise<TOutput>
  ): void => registerConcurrent(channel, isTrusted, handler)

  const registerGoogleTrusted = <TArgs extends unknown[], TOutput>(
    channel: string,
    handler: (...args: TArgs) => Promise<TOutput>
  ): void => registerGoogle(channel, isTrusted, handler)

  registerTrusted('vault:choose', async () => {
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

  registerTrusted('vault:openLast', async () => {
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

  registerTrusted('vault:snapshot', () => vault.scan())
  registerTrusted('vault:readNote', (path: string) => vault.readNote(path))
  registerTrusted('settings:get', () => readSettings())

  registerTrusted('note:save', async (input: SaveNoteInput) => {
    const saved = await vault.saveNote(input)
    watcher.expectOwnWrite(
      input.path,
      input.content,
      saved.modifiedAt,
      saved.size
    )
    return saved
  })

  registerTrusted('entry:createNote', async (input: CreateNoteInput) => {
    return vault.createNote(input)
  })

  registerTrusted('entry:createDirectory', async (input: CreateDirectoryInput) => {
    return vault.createDirectory(input)
  })

  registerTrusted('entry:rename', async (input: RenameEntryInput) => {
    return vault.renameEntry(input)
  })

  registerTrusted('entry:moveNote', async (input: MoveNoteInput) => {
    return vault.moveNote(input)
  })

  registerTrusted('entry:trash', async (path: string) => {
    return vault.trashEntry(path)
  })

  registerTrusted('settings:setLastNote', async (path: string | null) => {
    await updateSettings({ lastNotePath: path })
    return null
  })

  const getGoogleStatus = async (): Promise<GoogleDriveStatus> => {
    const connection = await google.connection.getStatus()
    const metadata = await google.driveSync.getStatusMetadata(vault.getRootPath())
    return {
      ...connection,
      lastSyncAt: metadata.lastSyncAt,
      vaultFolderUrl: metadata.rootFolderId
        ? `https://drive.google.com/drive/folders/${encodeURIComponent(metadata.rootFolderId)}`
        : null
    }
  }

  registerGoogleTrusted('google:chooseConfig', async () => {
    const options: Electron.OpenDialogOptions = {
      title: 'Google Desktop OAuth設定JSONを選択',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const owner = getWindow()
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    await google.connection.configure(await readFile(result.filePaths[0], 'utf8'))
    return getGoogleStatus()
  })

  registerConcurrentTrusted('google:status', getGoogleStatus)
  registerGoogleTrusted('google:connect', async () => {
    await google.connection.connect()
    return getGoogleStatus()
  })
  registerGoogleTrusted('google:authorizeCalendar', async () => {
    await google.connection.authorizeCalendarRead()
    return getGoogleStatus()
  })
  registerGoogleTrusted('google:disconnect', async () => {
    await google.connection.disconnect()
    return getGoogleStatus()
  })
  registerGoogleTrusted('drive:listVaults', () =>
    google.driveSync.listRemoteVaults()
  )
  registerTrusted('drive:pairVault', async (input: PairDriveVaultInput) => {
    return runGoogleInOrder(async () => {
      await google.driveSync.pairRemoteVault(input.rootFolderId, input.vaultId)
      return getGoogleStatus()
    })
  })
  registerTrusted('drive:preview', () => google.driveSync.preview())
  registerTrusted('drive:apply', (planId: string) => google.driveSync.apply(planId))

  registerTrusted('system:openExternal', async (url: string) => {
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
    if (!trustedSender(event, getWindow)) {
      return
    }
    if (allow) {
      approveClose()
    }
  })
}
