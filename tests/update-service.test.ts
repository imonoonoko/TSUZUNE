import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  resolveGitHubUpdateToken,
  UpdateService,
  type UpdateClient
} from '../src/main/update-service'

class FakeUpdateClient extends EventEmitter implements UpdateClient {
  autoDownload = true
  autoInstallOnAppQuit = true
  autoRunAppAfterInstall = true

  checkForUpdates = vi.fn(async () => null)
  downloadUpdate = vi.fn(async () => [] as string[])
  quitAndInstall = vi.fn()
}

describe('UpdateService', () => {
  it('uses an environment token without persisting or rewriting it', async () => {
    const previousGhToken = process.env.GH_TOKEN
    const previousGitHubToken = process.env.GITHUB_TOKEN
    process.env.GH_TOKEN = '  process-only-token  '
    process.env.GITHUB_TOKEN = 'fallback-token'

    try {
      expect(await resolveGitHubUpdateToken()).toBe('process-only-token')
      expect(process.env.GH_TOKEN).toBe('  process-only-token  ')
      expect(process.env.GITHUB_TOKEN).toBe('fallback-token')
    } finally {
      if (previousGhToken === undefined) delete process.env.GH_TOKEN
      else process.env.GH_TOKEN = previousGhToken
      if (previousGitHubToken === undefined) delete process.env.GITHUB_TOKEN
      else process.env.GITHUB_TOKEN = previousGitHubToken
    }
  })

  it('stays disabled outside a packaged application', async () => {
    const client = new FakeUpdateClient()
    const tokenProvider = vi.fn(async () => 'secret-token')
    const service = new UpdateService({
      isPackaged: false,
      currentVersion: '0.4.0',
      client,
      tokenProvider,
      approveInstall: vi.fn()
    })

    expect(service.getStatus()).toEqual({
      phase: 'disabled',
      currentVersion: '0.4.0',
      availableVersion: null,
      downloadPercent: null,
      message: '更新確認はインストール版で利用できます。'
    })

    await service.checkForUpdates()
    expect(client.checkForUpdates).not.toHaveBeenCalled()
    expect(tokenProvider).not.toHaveBeenCalled()
  })

  it('uses the GitHub token only while checking and reports an available update', async () => {
    const client = new FakeUpdateClient()
    let tokenDuringCheck: string | undefined
    client.checkForUpdates.mockImplementation(async () => {
      tokenDuringCheck = process.env.GH_TOKEN
      client.emit('checking-for-update')
      client.emit('update-available', { version: '0.5.0' })
      return null
    })
    const previousToken = process.env.GH_TOKEN
    delete process.env.GH_TOKEN

    try {
      const service = new UpdateService({
        isPackaged: true,
        currentVersion: '0.4.0',
        client,
        tokenProvider: async () => 'secret-token',
        approveInstall: vi.fn()
      })

      expect(await service.checkForUpdates()).toEqual({
        phase: 'available',
        currentVersion: '0.4.0',
        availableVersion: '0.5.0',
        downloadPercent: null,
        message: 'TSUZUNE 0.5.0をダウンロードできます。'
      })
      expect(tokenDuringCheck).toBe('secret-token')
      expect(process.env.GH_TOKEN).toBeUndefined()
      expect(client.autoDownload).toBe(false)
    } finally {
      if (previousToken === undefined) {
        delete process.env.GH_TOKEN
      } else {
        process.env.GH_TOKEN = previousToken
      }
    }
  })

  it('downloads explicitly and approves shutdown before installing', async () => {
    const client = new FakeUpdateClient()
    client.checkForUpdates.mockImplementation(async () => {
      client.emit('update-available', { version: '0.5.0' })
      return null
    })
    client.downloadUpdate.mockImplementation(async () => {
      client.emit('download-progress', { percent: 42.55 })
      client.emit('update-downloaded', { version: '0.5.0' })
      return ['TSUZUNE-Setup-0.5.0.exe']
    })
    const order: string[] = []
    client.quitAndInstall.mockImplementation(() => {
      order.push('install')
    })
    const service = new UpdateService({
      isPackaged: true,
      currentVersion: '0.4.0',
      client,
      tokenProvider: async () => 'secret-token',
      approveInstall: () => order.push('approve')
    })

    await service.checkForUpdates()
    expect(await service.downloadUpdate()).toEqual({
      phase: 'downloaded',
      currentVersion: '0.4.0',
      availableVersion: '0.5.0',
      downloadPercent: 100,
      message: 'TSUZUNE 0.5.0を再起動して適用できます。'
    })

    service.installUpdate()
    expect(order).toEqual(['approve', 'install'])
    expect(client.quitAndInstall).toHaveBeenCalledWith(true, true)
  })
})
