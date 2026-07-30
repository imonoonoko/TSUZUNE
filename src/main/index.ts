import { app, BrowserWindow, Menu, safeStorage, shell } from 'electron'
import { join } from 'node:path'
import { DriveSyncService } from './drive-sync-service'
import { GoogleConnectionService } from './google-connection'
import { runGoogleOAuthLoopback } from './google-oauth-flow'
import { registerIpc } from './ipc'
import { SecureTokenStore } from './secure-token-store'
import { VaultService } from './vault'
import { VaultWatcher } from './watcher'

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
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: 'TSUZUNE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    if (process.env.TSUZUNE_HEADLESS_SMOKE !== '1') {
      mainWindow?.show()
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
    authorize: (clientId) =>
      runGoogleOAuthLoopback({
        clientId,
        openExternal: (url) => shell.openExternal(url)
      }),
    fetchImpl: globalThis.fetch
  })
  const driveSync = new DriveSyncService({
    ledgerPath: join(googleStateDirectory, 'drive-sync.json'),
    vault,
    connection: googleConnection
  })
  registerIpc(
    vault,
    watcher,
    {
      connection: googleConnection,
      driveSync
    },
    () => mainWindow,
    () => {
      closeApproved = true
      mainWindow?.close()
    }
  )
  createWindow()

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
