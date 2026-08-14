import type { EventEmitter } from 'node:events'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AppUpdateStatus } from '../shared/types'

const execFileAsync = promisify(execFile)

export async function resolveGitHubUpdateToken(): Promise<string | null> {
  const environmentToken =
    process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()
  if (environmentToken) {
    return environmentToken
  }

  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000
    })
    return stdout.trim() || null
  } catch {
    return null
  }
}

export interface UpdateClient extends Pick<EventEmitter, 'on'> {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  autoRunAppAfterInstall: boolean
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<string[]>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export interface UpdateServiceOptions {
  isPackaged: boolean
  currentVersion: string
  client: UpdateClient
  tokenProvider: () => Promise<string | null>
  approveInstall: () => void
}

export class UpdateService {
  private status: AppUpdateStatus
  private readonly listeners = new Set<(status: AppUpdateStatus) => void>()

  constructor(private readonly options: UpdateServiceOptions) {
    options.client.autoDownload = false
    options.client.autoInstallOnAppQuit = true
    options.client.autoRunAppAfterInstall = true
    this.status = options.isPackaged
      ? {
          phase: 'idle',
          currentVersion: options.currentVersion,
          availableVersion: null,
          downloadPercent: null,
          message: null
        }
      : {
          phase: 'disabled',
          currentVersion: options.currentVersion,
          availableVersion: null,
          downloadPercent: null,
          message: '更新確認はインストール版で利用できます。'
        }

    if (options.isPackaged) {
      options.client.on('checking-for-update', () => {
        this.setStatus({
          ...this.status,
          phase: 'checking',
          downloadPercent: null,
          message: '更新を確認しています…'
        })
      })
      options.client.on('update-available', (info: { version?: string }) => {
        const version = info.version?.trim() || null
        this.setStatus({
          ...this.status,
          phase: 'available',
          availableVersion: version,
          downloadPercent: null,
          message: version
            ? `TSUZUNE ${version}をダウンロードできます。`
            : '新しいTSUZUNEをダウンロードできます。'
        })
      })
      options.client.on('update-not-available', () => {
        this.setStatus({
          ...this.status,
          phase: 'up-to-date',
          availableVersion: null,
          downloadPercent: null,
          message: 'TSUZUNEは最新です。'
        })
      })
      options.client.on('download-progress', (progress: { percent?: number }) => {
        const percent = Math.max(0, Math.min(100, progress.percent ?? 0))
        this.setStatus({
          ...this.status,
          phase: 'downloading',
          downloadPercent: percent,
          message: `更新をダウンロードしています… ${Math.round(percent)}%`
        })
      })
      options.client.on('update-downloaded', (info: { version?: string }) => {
        const version = info.version?.trim() || this.status.availableVersion
        this.setStatus({
          ...this.status,
          phase: 'downloaded',
          availableVersion: version,
          downloadPercent: 100,
          message: version
            ? `TSUZUNE ${version}を再起動して適用できます。`
            : '更新を再起動して適用できます。'
        })
      })
      options.client.on('error', () => {
        this.setStatus({
          ...this.status,
          phase: 'error',
          downloadPercent: null,
          message: '更新処理に失敗しました。'
        })
      })
    }
  }

  private setStatus(status: AppUpdateStatus): void {
    this.status = status
    const snapshot = this.getStatus()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  getStatus(): AppUpdateStatus {
    return { ...this.status }
  }

  subscribe(listener: (status: AppUpdateStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async checkForUpdates(): Promise<AppUpdateStatus> {
    if (!this.options.isPackaged) {
      return this.getStatus()
    }
    const token = await this.options.tokenProvider()
    if (!token) {
      this.setStatus({
        ...this.status,
        phase: 'error',
        message: 'GitHubにログインすると更新を確認できます。'
      })
      return this.getStatus()
    }

    const previousToken = process.env.GH_TOKEN
    process.env.GH_TOKEN = token
    try {
      await this.options.client.checkForUpdates()
    } catch {
      this.setStatus({
        ...this.status,
        phase: 'error',
        message: '更新の確認に失敗しました。'
      })
    } finally {
      if (previousToken === undefined) {
        delete process.env.GH_TOKEN
      } else {
        process.env.GH_TOKEN = previousToken
      }
    }
    return this.getStatus()
  }

  async downloadUpdate(): Promise<AppUpdateStatus> {
    if (this.status.phase !== 'available') {
      throw new Error('ダウンロード可能な更新がありません。')
    }

    this.setStatus({
      ...this.status,
      phase: 'downloading',
      downloadPercent: 0,
      message: '更新をダウンロードしています… 0%'
    })
    try {
      await this.options.client.downloadUpdate()
    } catch {
      this.setStatus({
        ...this.status,
        phase: 'error',
        downloadPercent: null,
        message: '更新のダウンロードに失敗しました。'
      })
    }
    return this.getStatus()
  }

  installUpdate(): void {
    if (this.status.phase !== 'downloaded') {
      throw new Error('適用できる更新がありません。')
    }
    this.options.approveInstall()
    this.options.client.quitAndInstall(true, true)
  }
}
