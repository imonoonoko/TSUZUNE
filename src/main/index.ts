import { app, BrowserWindow, Menu, safeStorage, shell, Tray } from 'electron'
import electronUpdater from 'electron-updater'
import { writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { DriveSyncService } from './drive-sync-service'
import { GoogleConnectionService } from './google-connection'
import { runGoogleOAuthLoopback } from './google-oauth-flow'
import { registerIpc, runGoogleInOrder } from './ipc'
import {
  startDriveSyncBridge,
  type DriveSyncBridge
} from './mcp-drive-sync-bridge'
import { SecureTokenStore } from './secure-token-store'
import { resolveGitHubUpdateToken, UpdateService } from './update-service'
import { VaultService } from './vault'
import { VaultWatcher } from './watcher'
import trayIconPath from '../renderer/assets/tsuzune-tray-icon.png?asset'

const { autoUpdater } = electronUpdater

app.setAppUserModelId('jp.tsuzune.app')

let mainWindow: BrowserWindow | null = null
let closeApproved = false
let quitRequested = false
let driveSyncBridge: DriveSyncBridge | null = null
let tray: Tray | null = null

const vault = new VaultService()
const attachmentWindows = new Set<BrowserWindow>()
const watcher = new VaultWatcher((change) => {
  mainWindow?.webContents.send('vault:changed', change)
})

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function openAttachmentWindow(path: string): Promise<void> {
  const dataUrl = await vault.readImageDataUrl(path)
  const name = basename(path)
  const attachmentWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 560,
    minHeight: 420,
    show: false,
    title: `${name} - TSUZUNE`,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  attachmentWindows.add(attachmentWindow)
  attachmentWindow.once('ready-to-show', () => {
    if (process.env.TSUZUNE_HEADLESS_SMOKE !== '1') attachmentWindow.show()
  })
  attachmentWindow.on('closed', () => attachmentWindows.delete(attachmentWindow))
  attachmentWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  attachmentWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escapeHtml(name)}</title><style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#262626;font:14px "Segoe UI","Noto Sans JP",sans-serif}.tabs{height:40px;border-bottom:1px solid #ddd;display:flex;align-items:center}.tab{height:40px;min-width:180px;padding:10px 16px;border-right:1px solid #ddd;font-weight:600}.path{height:40px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:center;color:#555}.preview{height:calc(100vh - 80px);display:flex;align-items:flex-start;justify-content:center;padding:50px 24px;overflow:auto}.preview img{max-width:100%;height:auto}</style></head><body><div class="tabs"><div class="tab">${escapeHtml(name)}</div></div><div class="path">${escapeHtml(path)}</div><main class="preview"><img src="${dataUrl}" alt="${escapeHtml(name)}"></main></body></html>`
  await attachmentWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  )
}

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

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

async function createTray(): Promise<void> {
  tray = new Tray(trayIconPath)
  tray.setToolTip('TSUZUNE')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'TSUZUNEを開く', click: showMainWindow },
      {
        label: '終了',
        click: () => {
          quitRequested = true
          showMainWindow()
          mainWindow?.webContents.send('app:requestClose')
        }
      }
    ])
  )
  tray.on('click', showMainWindow)
}

app.whenReady().then(async () => {
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
    (allow) => {
      if (!allow) {
        quitRequested = false
        return
      }
      if (quitRequested) {
        closeApproved = true
        mainWindow?.close()
        return
      }
      mainWindow?.hide()
    },
    openAttachmentWindow
  )
  try {
    driveSyncBridge = await startDriveSyncBridge({
      statePath: join(app.getPath('userData'), 'mcp-drive-sync.json'),
      preview: () => runGoogleInOrder(() => driveSync.preview()),
      apply: (planId) => runGoogleInOrder(() => driveSync.apply(planId))
    })
  } catch (error) {
    console.error(
      `Drive sync MCP bridge failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  await createTray()
  createWindow()
  if (app.isPackaged) {
    const updateCheckTimer = setTimeout(() => {
      void updates.checkForUpdates()
    }, 5_000)
    updateCheckTimer.unref()
  }

  app.on('activate', () => {
    showMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void Promise.all([watcher.stop(), driveSyncBridge?.close()]).finally(() => {
      driveSyncBridge = null
      app.quit()
    })
  }
})
