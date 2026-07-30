import { EventEmitter } from 'node:events'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const watcherMock = vi.hoisted(() => ({
  instances: [] as unknown[]
}))

vi.mock('chokidar', async () => {
  const { EventEmitter: MockEmitter } = await import('node:events')

  class FakeWatcher extends MockEmitter {
    close = vi.fn(async () => undefined)
  }

  return {
    watch: vi.fn(() => {
      const watcher = new FakeWatcher()
      watcherMock.instances.push(watcher)
      return watcher
    })
  }
})

import { VaultWatcher } from '../src/main/watcher'

type FakeWatcher = EventEmitter & {
  close: ReturnType<typeof vi.fn>
}

const temporaryRoots: string[] = []

function latestWatcher(): FakeWatcher {
  const watcher = watcherMock.instances.at(-1)
  if (!watcher) {
    throw new Error('watcher was not created')
  }
  return watcher as FakeWatcher
}

afterEach(async () => {
  watcherMock.instances.length = 0
  vi.restoreAllMocks()
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    )
  )
})

describe('VaultWatcher startup and errors', () => {
  it('does not resolve start before the watcher is ready', async () => {
    const watcher = new VaultWatcher(() => undefined)
    let resolved = false
    const start = watcher.start('C:\\vault').then(() => {
      resolved = true
    })
    await Promise.resolve()

    expect(resolved).toBe(false)
    latestWatcher().emit('ready')
    await start
    expect(resolved).toBe(true)
    await watcher.stop()
  })

  it('rejects and closes the candidate when startup emits an error', async () => {
    const watcher = new VaultWatcher(() => undefined)
    const start = watcher.start('C:\\vault')
    await Promise.resolve()
    const candidate = latestWatcher()
    candidate.emit('error', new Error('watch failed'))

    await expect(start).rejects.toThrow('watch failed')
    expect(candidate.close).toHaveBeenCalledOnce()
  })

  it('handles an error after ready without throwing it from EventEmitter', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const watcher = new VaultWatcher(() => undefined)
    const start = watcher.start('C:\\vault')
    await Promise.resolve()
    const candidate = latestWatcher()
    candidate.emit('ready')
    await start

    expect(() => candidate.emit('error', new Error('runtime failure'))).not.toThrow()
    expect(consoleError).toHaveBeenCalled()
    await watcher.stop()
  })

  it('suppresses its own matching save but still reports an immediate external overwrite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-watcher-'))
    temporaryRoots.push(root)
    const notePath = join(root, 'Note.md')
    const events: Array<{ type: string; path: string }> = []
    await writeFile(notePath, 'TSUZUNE own save', 'utf8')
    const ownInfo = await stat(notePath)

    const watcher = new VaultWatcher((event) => events.push(event))
    const start = watcher.start(root)
    await Promise.resolve()
    const candidate = latestWatcher()
    candidate.emit('ready')
    await start

    watcher.expectOwnWrite(
      'Note.md',
      'TSUZUNE own save',
      ownInfo.mtimeMs,
      ownInfo.size
    )
    candidate.emit('change', notePath)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(events).toEqual([])

    await writeFile(notePath, 'external editor overwrite', 'utf8')
    candidate.emit('change', notePath)
    await vi.waitFor(() => {
      expect(events).toContainEqual({ type: 'change', path: 'Note.md' })
    })
    await watcher.stop()
  })

  it('reports an external overwrite even when the own-save event has not arrived yet', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-watcher-'))
    temporaryRoots.push(root)
    const notePath = join(root, 'Note.md')
    const events: Array<{ type: string; path: string }> = []
    await writeFile(notePath, 'TSUZUNE own save', 'utf8')
    const ownInfo = await stat(notePath)

    const watcher = new VaultWatcher((event) => events.push(event))
    const start = watcher.start(root)
    await Promise.resolve()
    const candidate = latestWatcher()
    candidate.emit('ready')
    await start

    watcher.expectOwnWrite(
      'Note.md',
      'TSUZUNE own save',
      ownInfo.mtimeMs,
      ownInfo.size
    )
    await writeFile(notePath, 'external overwrite before own event', 'utf8')
    candidate.emit('change', notePath)

    await vi.waitFor(() => {
      expect(events).toContainEqual({ type: 'change', path: 'Note.md' })
    })
    await watcher.stop()
  })

  it('never suppresses an external deletion after an own save', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-watcher-'))
    temporaryRoots.push(root)
    const notePath = join(root, 'Note.md')
    const events: Array<{ type: string; path: string }> = []
    await writeFile(notePath, 'saved content', 'utf8')
    const ownInfo = await stat(notePath)

    const watcher = new VaultWatcher((event) => events.push(event))
    const start = watcher.start(root)
    await Promise.resolve()
    const candidate = latestWatcher()
    candidate.emit('ready')
    await start

    watcher.expectOwnWrite(
      'Note.md',
      'saved content',
      ownInfo.mtimeMs,
      ownInfo.size
    )
    candidate.emit('unlink', notePath)

    expect(events).toContainEqual({ type: 'unlink', path: 'Note.md' })
    await watcher.stop()
  })
})
