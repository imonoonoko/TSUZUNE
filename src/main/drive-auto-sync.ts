import type { DriveAutoSyncStatus } from '../shared/drive-auto-sync'
import type { DriveSyncService } from './drive-sync-service'

interface Context {
  rootPath: string | null
  enabled: boolean
  connected: boolean
  lastSyncAt: string | null
}

export class DriveAutoSync {
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = true
  private running = false
  private changedWhileRunning = false
  private failures = 0
  private retryAt = 0
  private status: DriveAutoSyncStatus = {
    rootPath: null, enabled: false, state: 'off', lastCheckedAt: null,
    lastSyncAt: null, message: '自動同期はオフです。', conflictPaths: []
  }

  constructor(private readonly dependencies: {
    context(): Promise<Context>
    sync: Pick<DriveSyncService, 'syncAutomatically'>
    runExclusive<T>(operation: () => Promise<T>): Promise<T>
    onStatus(status: DriveAutoSyncStatus): void
  }) {}

  start(): void {
    this.stopped = false
    this.schedule(5_000)
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  notifyLocalChange(): void {
    if (this.running) this.changedWhileRunning = true
    else this.schedule(Math.max(5_000, this.retryAt - Date.now()))
  }

  settingsChanged(): void {
    this.failures = 0
    this.retryAt = 0
    if (this.running) this.changedWhileRunning = true
    else this.schedule(0)
  }

  async getStatus(): Promise<DriveAutoSyncStatus> {
    const context = await this.dependencies.context()
    this.acceptContext(context)
    return { ...this.status, conflictPaths: [...this.status.conflictPaths] }
  }

  private acceptContext(context: Context): void {
    if (context.rootPath !== this.status.rootPath || context.enabled !== this.status.enabled) {
      this.failures = 0
      this.retryAt = 0
      this.status = { ...this.status, rootPath: context.rootPath, enabled: context.enabled,
        state: context.enabled ? 'waiting' : 'off', lastCheckedAt: null, conflictPaths: [],
        message: context.enabled ? '次の自動同期を待っています。' : '自動同期はオフです。' }
    }
    this.status.lastSyncAt = context.lastSyncAt
  }

  private publish(patch: Partial<DriveAutoSyncStatus>): void {
    this.status = { ...this.status, ...patch }
    this.dependencies.onStatus({ ...this.status, conflictPaths: [...this.status.conflictPaths] })
  }

  private schedule(milliseconds: number): void {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { this.timer = null; void this.tick() }, milliseconds)
    this.timer.unref?.()
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.running) return
    this.running = true
    this.changedWhileRunning = false
    try {
      await this.dependencies.runExclusive(async () => {
        if (this.stopped) return
        const context = await this.dependencies.context()
        this.acceptContext(context)
        if (!context.rootPath || !context.enabled) {
          this.publish({ state: 'off', message: '自動同期はオフです。', conflictPaths: [] })
          return
        }
        if (!context.connected || !context.lastSyncAt) {
          this.publish({ state: 'waiting', message: !context.connected
            ? 'Googleに接続すると自動同期を再開します。'
            : '初回は「同期内容を確認」から手動で同期してください。' })
          return
        }
        this.publish({ state: 'syncing', message: '自動同期中…' })
        const { preview, result } = await this.dependencies.sync.syncAutomatically()
        this.failures = 0
        this.retryAt = 0
        const conflictPaths = preview.items.filter((item) => item.action === 'conflict').map((item) => item.path)
        this.publish({ state: conflictPaths.length ? 'conflict' : 'synced',
          lastCheckedAt: new Date().toISOString(), lastSyncAt: result?.completedAt ?? context.lastSyncAt,
          conflictPaths, message: conflictPaths.length
            ? `競合${conflictPaths.length}件のため自動同期を停止しています。「同期内容を確認」で解決してください。`
            : result ? `同期済み · 送信${result.uploaded} / 受信${result.downloaded} / 移動${result.moved}`
              : '同期済み · 新しい変更はありません。' })
      })
    } catch (error) {
      this.failures += 1
      const delay = Math.min(600_000, 60_000 * 2 ** Math.min(this.failures - 1, 4))
      this.retryAt = Date.now() + delay
      this.publish({ state: 'error', message: `同期できませんでした。${delay / 60_000}分後に再試行します。${error instanceof Error ? error.message : String(error)}` })
    } finally {
      this.running = false
      this.schedule(Math.max(this.changedWhileRunning ? 5_000 : 60_000, this.retryAt - Date.now()))
    }
  }
}
