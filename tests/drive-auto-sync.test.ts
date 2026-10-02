import { afterEach, describe, expect, it, vi } from 'vitest'
import { DriveAutoSync } from '../src/main/drive-auto-sync'
import type { DriveAutoSyncStatus } from '../src/shared/drive-auto-sync'

afterEach(() => vi.useRealTimers())

function setup() {
  vi.useFakeTimers()
  const context = { rootPath: 'C:/Vault', enabled: true, connected: true, lastSyncAt: '2026-10-02T00:00:00Z' }
  const syncAutomatically = vi.fn().mockResolvedValue({ preview: { items: [] }, result: null })
  const onStatus = vi.fn<(status: DriveAutoSyncStatus) => void>()
  const runner = new DriveAutoSync({ context: async () => ({ ...context }),
    sync: { syncAutomatically }, runExclusive: (operation) => operation(), onStatus })
  runner.start()
  return { runner, context, syncAutomatically, onStatus }
}

describe('automatic Drive synchronization', () => {
  it('debounces saved changes and polls remote changes while the window is hidden', async () => {
    const { runner, syncAutomatically } = setup()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(syncAutomatically).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(syncAutomatically).toHaveBeenCalledTimes(2)
    runner.notifyLocalChange()
    await vi.advanceTimersByTimeAsync(4_000)
    runner.notifyLocalChange()
    await vi.advanceTimersByTimeAsync(4_999)
    expect(syncAutomatically).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(syncAutomatically).toHaveBeenCalledTimes(3)
    runner.stop()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(syncAutomatically).toHaveBeenCalledTimes(3)
  })

  it('waits for connection and the first manual sync, and scopes enablement to the active Vault', async () => {
    const { runner, context, syncAutomatically } = setup()
    context.enabled = false
    await vi.advanceTimersByTimeAsync(5_000)
    expect(syncAutomatically).not.toHaveBeenCalled()
    context.enabled = true
    context.connected = false
    runner.settingsChanged()
    await vi.advanceTimersByTimeAsync(0)
    expect((await runner.getStatus()).message).toContain('Googleに接続')
    context.connected = true
    context.lastSyncAt = null as unknown as string
    runner.settingsChanged()
    await vi.advanceTimersByTimeAsync(0)
    expect((await runner.getStatus()).message).toContain('初回')
    expect(syncAutomatically).not.toHaveBeenCalled()
    context.lastSyncAt = '2026-10-02T00:00:00Z'
    runner.settingsChanged()
    await vi.advanceTimersByTimeAsync(0)
    expect(syncAutomatically).toHaveBeenCalledTimes(1)
    context.rootPath = 'C:/Other'
    context.enabled = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect((await runner.getStatus())).toMatchObject({ rootPath: 'C:/Other', enabled: false, state: 'off', lastCheckedAt: null })
    expect(syncAutomatically).toHaveBeenCalledTimes(1)
    runner.stop()
  })

  it('backs off after failures even if more local saves arrive, and resumes without duplicating work', async () => {
    const { runner, syncAutomatically } = setup()
    syncAutomatically.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('still offline'))
    await vi.advanceTimersByTimeAsync(5_000)
    expect((await runner.getStatus())).toMatchObject({ state: 'error' })
    runner.notifyLocalChange()
    await vi.advanceTimersByTimeAsync(59_999)
    expect(syncAutomatically).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(syncAutomatically).toHaveBeenCalledTimes(2)
    runner.notifyLocalChange()
    await vi.advanceTimersByTimeAsync(119_999)
    expect(syncAutomatically).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect((await runner.getStatus()).state).toBe('synced')
    expect(syncAutomatically).toHaveBeenCalledTimes(3)
    runner.stop()
  })

  it('keeps one run active and reports conflicts until the manual operation resolves them', async () => {
    const { runner, syncAutomatically } = setup()
    let resolve!: (value: unknown) => void
    syncAutomatically.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    await vi.advanceTimersByTimeAsync(5_000)
    runner.notifyLocalChange()
    runner.notifyLocalChange()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(syncAutomatically).toHaveBeenCalledTimes(1)
    resolve({ preview: { items: [{ path: 'A.md', action: 'conflict' }] }, result: null })
    await vi.advanceTimersByTimeAsync(0)
    expect(await runner.getStatus()).toMatchObject({ state: 'conflict', conflictPaths: ['A.md'] })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(syncAutomatically).toHaveBeenCalledTimes(2)
    expect(await runner.getStatus()).toMatchObject({ state: 'synced', conflictPaths: [] })
    runner.stop()
  })

  it('does not begin an operation queued behind a manual action after shutdown', async () => {
    vi.useFakeTimers()
    let queued!: () => Promise<void>
    const syncAutomatically = vi.fn()
    const runner = new DriveAutoSync({ context: async () => ({ rootPath: 'C:/Vault', enabled: true, connected: true, lastSyncAt: 'today' }),
      sync: { syncAutomatically }, runExclusive: (operation) => new Promise((resolve) => { queued = async () => { resolve(await operation()) } }),
      onStatus: vi.fn() })
    runner.start()
    await vi.advanceTimersByTimeAsync(5_000)
    runner.stop()
    await queued()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(syncAutomatically).not.toHaveBeenCalled()
  })
})
