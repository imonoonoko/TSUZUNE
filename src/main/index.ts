import { app, BrowserWindow, Menu, safeStorage, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DriveSyncService } from './drive-sync-service'
import { GoogleConnectionService } from './google-connection'
import { runGoogleOAuthLoopback } from './google-oauth-flow'
import { registerIpc } from './ipc'
import { SecureTokenStore } from './secure-token-store'
import { resolveGitHubUpdateToken, UpdateService } from './update-service'
import { VaultService } from './vault'
import { VaultWatcher } from './watcher'

const { autoUpdater } = electronUpdater

app.setAppUserModelId('jp.tsuzune.app')

let mainWindow: BrowserWindow | null = null
let closeApproved = false

const vault = new VaultService()
const watcher = new VaultWatcher((change) => {
  mainWindow?.webContents.send('vault:changed', change)
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    show: false,
    title: 'TSUZUNE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: process.env.TSUZUNE_HEADLESS_SMOKE !== '1'
    }
  })

  mainWindow.once('ready-to-show', () => {
    if (process.env.TSUZUNE_HEADLESS_SMOKE !== '1') {
      mainWindow?.show()
    }
  })

  mainWindow.webContents.once('did-finish-load', () => {
    const readyFile = process.env.TSUZUNE_HEADLESS_SMOKE_READY_FILE
    if (process.env.TSUZUNE_HEADLESS_SMOKE === '1' && readyFile) {
      writeFileSync(readyFile, 'ready', 'utf8')
      closeApproved = true
      app.quit()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL()
    if (current && url !== current && !url.startsWith(`${current.split('#')[0]}#`)) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase()
    if (key === 'f5' || ((input.control || input.meta) && key === 'r')) {
      event.preventDefault()
    }
  })

  mainWindow.on('close', (event) => {
    if (!closeApproved) {
      event.preventDefault()
      mainWindow?.webContents.send('app:requestClose')
      return
    }
    closeApproved = false
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  const googleStateDirectory = join(app.getPath('userData'), 'google')
  const tokenStore = new SecureTokenStore(
    join(googleStateDirectory, 'refresh-token.json'),
    {
      isAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
      encrypt: (plainText) => safeStorage.encryptStringAsync(plainText),
      decrypt: async (encrypted) =>
        (await safeStorage.decryptStringAsync(encrypted)).result
    }
  )
  const googleConnection = new GoogleConnectionService({
    stateDirectory: googleStateDirectory,
    tokenStore,
    bundledClientId:
      import.meta.env.MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() || null,
    bundledClientSecret:
      import.meta.env.MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET?.trim() || null,
    authorize: ({ clientId, scopes, loginHint }) =>
      runGoogleOAuthLoopback({
        clientId,
        scopes,
        loginHint,
        openExternal: (url) => shell.openExternal(url)
      }),
    fetchImpl: globalThis.fetch
  })
  const driveSync = new DriveSyncService({
    ledgerPath: join(googleStateDirectory, 'drive-sync.json'),
    vault,
    connection: googleConnection
  })
  autoUpdater.logger = null
  const updates = new UpdateService({
    isPackaged: app.isPackaged,
    currentVersion: app.getVersion(),
    client: autoUpdater,
    tokenProvider: resolveGitHubUpdateToken,
    approveInstall: () => {
      closeApproved = true
    }
  })
  updates.subscribe((status) => {
    mainWindow?.webContents.send('app:updateStatusChanged', status)
  })
  registerIpc(
    vault,
    watcher,
    {
      connection: googleConnection,
      driveSync
    },
    updates,
    () => mainWindow,
    () => {
      closeApproved = true
      mainWindow?.close()
    }
  )
  createWindow()
  if (app.isPackaged) {
    const updateCheckTimer = setTimeout(() => {
      void updates.checkForUpdates()
    }, 5_000)
    updateCheckTimer.unref()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  void watcher.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
