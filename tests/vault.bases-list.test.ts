import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fsControl = vi.hoisted(() => ({
  delayedDirectory: '',
  delayStarted: null as (() => void) | null,
  releaseDelay: null as (() => void) | null,
  collisionDirectory: '',
  errorDirectory: '',
  errorCode: '',
  rootSwapPath: '',
  rootSwappedPath: '',
  rootSwapBackup: '',
  rootSwapOutside: '',
  childSwapPath: '',
  childSwappedPath: '',
  childSwapBackup: '',
  childSwapOutside: '',
  childReaddirSwapPath: '',
  childReaddirSwappedPath: '',
  childReaddirSwapBackup: '',
  childReaddirSwapOutside: ''
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
    lstat: vi.fn(async (...args: any[]) => {
      const path = String(args[0])
      if (fsControl.childSwapPath === path) {
        fsControl.childSwapPath = ''
        await actual.rename(path, fsControl.childSwapBackup)
        await actual.symlink(fsControl.childSwapOutside, path, 'junction')
        fsControl.childSwappedPath = path
      }
      const info = await (actual.lstat as (...values: any[]) => Promise<any>)(...args)
      if (fsControl.rootSwapPath === path) {
        fsControl.rootSwapPath = ''
        await actual.rename(path, fsControl.rootSwapBackup)
        await actual.symlink(fsControl.rootSwapOutside, path, 'junction')
        fsControl.rootSwappedPath = path
      }
      return info
    }),
    readdir: vi.fn(async (path: any, options: any) => {
      const textPath = String(path)
      if (fsControl.childReaddirSwapPath === textPath) {
        fsControl.childReaddirSwapPath = ''
        await actual.rename(textPath, fsControl.childReaddirSwapBackup)
        await actual.symlink(fsControl.childReaddirSwapOutside, textPath, 'junction')
        fsControl.childReaddirSwappedPath = textPath
      }
      if (fsControl.errorDirectory === textPath) {
        throw Object.assign(new Error(`readdir failed: ${textPath}`), {
          code: fsControl.errorCode
        })
      }
      if (fsControl.delayedDirectory === textPath) {
        fsControl.delayedDirectory = ''
        fsControl.delayStarted?.()
        await new Promise<void>((resolve) => {
          fsControl.releaseDelay = resolve
        })
      }
      const entries = (await actual.readdir(path, options)) as any[]
      if (fsControl.collisionDirectory !== textPath) {
        return entries
      }
      const original = entries.find((entry: any) => entry.name === 'Case.base')
      if (!original) return entries
      const alias = new Proxy(original, {
        get(target, property, receiver) {
          if (property === 'name') return 'case.base'
          const value = Reflect.get(target, property, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        }
      })
      return [...entries, alias]
    })
  }
})

import { VaultService } from '../src/main/vault'

const temporaryPaths: string[] = []

async function temporaryDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix))
  temporaryPaths.push(path)
  return path
}

async function restoreJunction(path: string, backup: string): Promise<void> {
  await unlink(path).catch(() => undefined)
  await rename(backup, path).catch(() => undefined)
}

afterEach(async () => {
  fsControl.releaseDelay?.()
  fsControl.delayedDirectory = ''
  fsControl.delayStarted = null
  fsControl.releaseDelay = null
  fsControl.collisionDirectory = ''
  fsControl.errorDirectory = ''
  fsControl.errorCode = ''
  if (fsControl.rootSwapBackup && fsControl.rootSwappedPath) {
    await restoreJunction(fsControl.rootSwappedPath, fsControl.rootSwapBackup)
  }
  if (fsControl.childSwapBackup && fsControl.childSwappedPath) {
    await restoreJunction(fsControl.childSwappedPath, fsControl.childSwapBackup)
  }
  if (fsControl.childReaddirSwapBackup && fsControl.childReaddirSwappedPath) {
    await restoreJunction(
      fsControl.childReaddirSwappedPath,
      fsControl.childReaddirSwapBackup
    )
  }
  fsControl.rootSwapPath = ''
  fsControl.rootSwappedPath = ''
  fsControl.rootSwapBackup = ''
  fsControl.rootSwapOutside = ''
  fsControl.childSwapPath = ''
  fsControl.childSwappedPath = ''
  fsControl.childSwapBackup = ''
  fsControl.childSwapOutside = ''
  fsControl.childReaddirSwapPath = ''
  fsControl.childReaddirSwappedPath = ''
  fsControl.childReaddirSwapBackup = ''
  fsControl.childReaddirSwapOutside = ''
  await Promise.all(
    temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  )
  vi.mocked(readFile).mockClear()
  vi.mocked(lstat).mockClear()
  vi.mocked(readdir).mockClear()
})

describe('VaultService Base list race boundaries', () => {
  it('rejects an A-B-A Vault revision change and never adopts the stale result', async () => {
    const firstRoot = await temporaryDirectory('tsuzune-base-list-a-')
    const secondRoot = await temporaryDirectory('tsuzune-base-list-b-')
    await writeFile(join(firstRoot, 'A.base'), 'first', 'utf8')
    await writeFile(join(secondRoot, 'B.base'), 'second', 'utf8')
    const vault = new VaultService()
    await vault.setRootPath(firstRoot)
    fsControl.delayedDirectory = firstRoot
    const started = new Promise<void>((resolve) => {
      fsControl.delayStarted = resolve
    })

    const stale = vault.listBases(firstRoot, [])
    await started
    await vault.setRootPath(secondRoot)
    await vault.setRootPath(firstRoot)
    fsControl.releaseDelay?.()

    await expect(stale).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    await expect(vault.listBases(firstRoot, [])).resolves.toEqual(['A.base'])
  })

  it.skipIf(process.platform !== 'win32')(
    'rejects the result if the captured root is replaced by a junction',
    async () => {
      const root = await temporaryDirectory('tsuzune-base-root-swap-')
      const outside = await temporaryDirectory('tsuzune-base-root-outside-')
      await writeFile(join(root, 'inside.base'), 'inside', 'utf8')
      await writeFile(join(outside, 'outside.base'), 'outside', 'utf8')
      const vault = new VaultService()
      await vault.setRootPath(root)
      const backup = `${root}-original`
      fsControl.rootSwapPath = root
      fsControl.rootSwapBackup = backup
      fsControl.rootSwapOutside = outside

      await expect(vault.listBases(root, [])).rejects.toMatchObject({
        appError: { code: 'INVALID_PATH' }
      })
      expect(await readFile(join(outside, 'outside.base'), 'utf8')).toBe('outside')

      await restoreJunction(root, backup)
      fsControl.rootSwapBackup = ''
      fsControl.rootSwappedPath = ''
    }
  )

  it.skipIf(process.platform !== 'win32')(
    'does not enter a child replaced by a junction before traversal',
    async () => {
      const root = await temporaryDirectory('tsuzune-base-child-swap-')
      const child = join(root, 'child')
      const outside = await temporaryDirectory('tsuzune-base-child-outside-')
      await mkdir(child)
      await writeFile(join(child, 'inside.base'), 'inside', 'utf8')
      await writeFile(join(outside, 'outside.base'), 'outside', 'utf8')
      const vault = new VaultService()
      await vault.setRootPath(root)
      const backup = join(root, 'child-original')
      fsControl.childSwapPath = child
      fsControl.childSwapBackup = backup
      fsControl.childSwapOutside = outside

      await expect(vault.listBases(root, [])).resolves.toEqual([])
      expect(await readFile(join(outside, 'outside.base'), 'utf8')).toBe('outside')

      await restoreJunction(child, backup)
      fsControl.childSwapBackup = ''
      fsControl.childSwappedPath = ''
    }
  )

  it.skipIf(process.platform !== 'win32')(
    'rejects a child replaced by a junction immediately before readdir',
    async () => {
      const root = await temporaryDirectory('tsuzune-base-child-readdir-swap-')
      const child = join(root, 'child')
      const outside = await temporaryDirectory('tsuzune-base-child-readdir-outside-')
      await mkdir(child)
      await writeFile(join(child, 'inside.base'), 'inside', 'utf8')
      await writeFile(join(outside, 'outside.base'), 'outside', 'utf8')
      const vault = new VaultService()
      await vault.setRootPath(root)
      const backup = join(root, 'child-original')
      fsControl.childReaddirSwapPath = child
      fsControl.childReaddirSwapBackup = backup
      fsControl.childReaddirSwapOutside = outside

      await expect(vault.listBases(root, [])).rejects.toMatchObject({
        appError: { code: 'INVALID_PATH' }
      })
      expect(await readFile(join(outside, 'outside.base'), 'utf8')).toBe('outside')

      await restoreJunction(child, backup)
      fsControl.childReaddirSwapBackup = ''
      fsControl.childReaddirSwappedPath = ''
    }
  )

  it.skipIf(process.platform !== 'win32')(
    'rejects case-insensitive path collisions instead of choosing one entry',
    async () => {
      const root = await temporaryDirectory('tsuzune-base-case-collision-')
      await writeFile(join(root, 'Case.base'), 'one', 'utf8')
      const vault = new VaultService()
      await vault.setRootPath(root)
      fsControl.collisionDirectory = root

      await expect(vault.listBases(root, [])).rejects.toMatchObject({
        appError: { code: 'INVALID_PATH' }
      })
    }
  )

  it.each([
    ['ENOENT', 'NOT_FOUND'],
    ['EACCES', 'ACCESS_DENIED'],
    ['EIO', 'UNKNOWN']
  ])('maps a %s traversal failure to %s without a partial success', async (errorCode, appCode) => {
    const root = await temporaryDirectory('tsuzune-base-list-error-')
    await writeFile(join(root, 'visible.base'), 'visible', 'utf8')
    const broken = join(root, 'broken')
    await mkdir(broken)
    const vault = new VaultService()
    await vault.setRootPath(root)
    fsControl.errorDirectory = broken
    fsControl.errorCode = errorCode

    await expect(vault.listBases(root, [])).rejects.toMatchObject({
      appError: { code: appCode }
    })
  })

  it('enumerates names without reading file bodies', async () => {
    const root = await temporaryDirectory('tsuzune-base-no-read-')
    await writeFile(join(root, 'table.base'), 'must not be read', 'utf8')
    await writeFile(join(root, 'note.md'), 'must not be read', 'utf8')
    const vault = new VaultService()
    await vault.setRootPath(root)
    vi.mocked(readFile).mockClear()

    await expect(vault.listBases(root, [])).resolves.toEqual(['table.base'])
    expect(readFile).not.toHaveBeenCalled()
  })
})
