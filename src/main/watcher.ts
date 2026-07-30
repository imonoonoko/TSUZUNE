import { watch, type FSWatcher } from 'chokidar'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { relative, sep } from 'node:path'
import type { VaultChangeEvent } from '../shared/types'

interface ExpectedOwnWrite {
  expiresAt: number
  modifiedAt: number
  size: number
  digest: string
}

export class VaultWatcher {
  private watcher: FSWatcher | null = null
  private rootPath: string | null = null
  private expectedOwnWrites = new Map<string, ExpectedOwnWrite>()

  constructor(private readonly onChange: (event: VaultChangeEvent) => void) {}

  async start(rootPath: string): Promise<void> {
    await this.stop()
    this.rootPath = rootPath

    const toRelative = (absolutePath: string): string =>
      relative(rootPath, absolutePath).split(sep).join('/')

    const emit = async (
      type: VaultChangeEvent['type'],
      absolutePath: string
    ): Promise<void> => {
      const path = toRelative(absolutePath)
      if (!path) {
        return
      }

      if (type === 'change' || type === 'add') {
        if (await this.matchesExpectedOwnWrite(path, absolutePath)) {
          return
        }
      } else if (type === 'unlink' || type === 'unlinkDir') {
        this.expectedOwnWrites.delete(path)
      }

      if (this.watcher !== nextWatcher || this.rootPath !== rootPath) {
        return
      }
      this.onChange({ type, path })
    }

    const nextWatcher = watch(rootPath, {
      ignoreInitial: true,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 50
      },
      ignored: (absolutePath) => {
        const path = toRelative(absolutePath)
        return path
          .split('/')
          .filter(Boolean)
          .some((part) => part.startsWith('.'))
      }
    })
    this.watcher = nextWatcher

    nextWatcher
      .on('add', (path) => void emit('add', path))
      .on('change', (path) => void emit('change', path))
      .on('unlink', (path) => void emit('unlink', path))
      .on('addDir', (path) => void emit('addDir', path))
      .on('unlinkDir', (path) => void emit('unlinkDir', path))

    try {
      await new Promise<void>((resolve, reject) => {
        let ready = false

        nextWatcher.once('ready', () => {
          ready = true
          resolve()
        })
        nextWatcher.on('error', (error) => {
          if (!ready) {
            reject(error)
            return
          }
          console.error('Vault watcher error:', error)
        })
      })
    } catch (error) {
      if (this.watcher === nextWatcher) {
        this.watcher = null
        this.rootPath = null
      }
      await nextWatcher.close().catch(() => undefined)
      throw error
    }
  }

  expectOwnWrite(
    path: string,
    content: string,
    modifiedAt: number,
    size: number,
    milliseconds = 5000
  ): void {
    this.expectedOwnWrites.set(path.replaceAll('\\', '/'), {
      expiresAt: Date.now() + milliseconds,
      modifiedAt,
      size,
      digest: createHash('sha256').update(content, 'utf8').digest('hex')
    })
  }

  private async matchesExpectedOwnWrite(
    path: string,
    absolutePath: string
  ): Promise<boolean> {
    const expected = this.expectedOwnWrites.get(path)
    if (!expected) {
      return false
    }

    if (expected.expiresAt <= Date.now()) {
      this.expectedOwnWrites.delete(path)
      return false
    }

    try {
      const [content, info] = await Promise.all([
        readFile(absolutePath),
        stat(absolutePath)
      ])
      const digest = createHash('sha256').update(content).digest('hex')
      const matches =
        Math.abs(info.mtimeMs - expected.modifiedAt) <= 0.5 &&
        info.size === expected.size &&
        digest === expected.digest
      this.expectedOwnWrites.delete(path)
      return matches
    } catch {
      this.expectedOwnWrites.delete(path)
      return false
    }
  }

  async stop(): Promise<void> {
    const current = this.watcher
    this.watcher = null
    this.rootPath = null
    this.expectedOwnWrites.clear()
    if (current) {
      await current.close()
    }
  }
}
