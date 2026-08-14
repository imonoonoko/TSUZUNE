import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const scanControl = vi.hoisted(() => ({
  delayedPath: '',
  started: null as (() => void) | null,
  release: null as (() => void) | null
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    readFile: vi.fn(async (...args: Parameters<typeof actual.readFile>) => {
      if (String(args[0]) === scanControl.delayedPath) {
        scanControl.started?.()
        await new Promise<void>((resolve) => {
          scanControl.release = resolve
        })
      }
      return actual.readFile(...args)
    })
  }
})

import { VaultService } from '../src/main/vault'

const roots: string[] = []

afterEach(async () => {
  scanControl.delayedPath = ''
  scanControl.started = null
  scanControl.release?.()
  scanControl.release = null
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('VaultService scan generation', () => {
  it('discards a scan if the Vault root changes while files are being read', async () => {
    const firstRoot = await mkdtemp(join(tmpdir(), 'tsuzune-scan-a-'))
    const secondRoot = await mkdtemp(join(tmpdir(), 'tsuzune-scan-b-'))
    roots.push(firstRoot, secondRoot)
    await writeFile(join(firstRoot, 'A.md'), 'first', 'utf8')
    await writeFile(join(secondRoot, 'B.md'), 'second', 'utf8')

    const vault = new VaultService()
    await vault.setRootPath(firstRoot)
    scanControl.delayedPath = join(firstRoot, 'A.md')
    const readStarted = new Promise<void>((resolve) => {
      scanControl.started = resolve
    })

    const oldScan = vault.scan()
    await readStarted
    await vault.setRootPath(secondRoot)
    scanControl.release?.()

    await expect(oldScan).rejects.toMatchObject({
      appError: { code: 'NO_VAULT' }
    })
    await expect(
      access(join(firstRoot, '.tsuzune', 'graph-file-times.json'))
    ).rejects.toBeDefined()
    const current = await vault.scan()
    expect(current.rootPath).toBe(secondRoot)
    expect(current.notes.map((note) => note.path)).toEqual(['B.md'])
  })
})
