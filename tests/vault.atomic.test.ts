import {
  mkdtemp,
  readFile,
  readdir,
  rm
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const renameControl = vi.hoisted(() => ({
  failAtomicReplace: false,
  changeAfterTempWrite: false,
  preserveExternalTime: false,
  externalMtime: 0,
  externalTarget: '',
  externalContent: ''
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    writeFile: vi.fn(
      async (...args: Parameters<typeof actual.writeFile>) => {
        const result = await actual.writeFile(...args)
        const writtenPath = String(args[0])
        if (
          renameControl.changeAfterTempWrite &&
          writtenPath.includes('.tsuzune-') &&
          writtenPath.endsWith('.tmp')
        ) {
          renameControl.changeAfterTempWrite = false
          await actual.writeFile(
            renameControl.externalTarget,
            renameControl.externalContent,
            'utf8'
          )
          const changedTime = new Date(
            renameControl.preserveExternalTime
              ? renameControl.externalMtime
              : Date.now() + 10_000
          )
          await actual.utimes(
            renameControl.externalTarget,
            changedTime,
            changedTime
          )
        }
        return result
      }
    ),
    rename: vi.fn(async (oldPath: string, newPath: string) => {
      if (
        renameControl.failAtomicReplace &&
        oldPath.includes('.tsuzune-') &&
        oldPath.endsWith('.tmp')
      ) {
        throw Object.assign(new Error(`replace blocked: ${newPath}`), {
          code: 'EPERM'
        })
      }
      return actual.rename(oldPath, newPath)
    })
  }
})

import { VaultService } from '../src/main/vault'

let rootPath: string
let vault: VaultService

beforeEach(async () => {
  renameControl.failAtomicReplace = false
  renameControl.changeAfterTempWrite = false
  renameControl.preserveExternalTime = false
  renameControl.externalMtime = 0
  renameControl.externalTarget = ''
  renameControl.externalContent = ''
  rootPath = await mkdtemp(join(tmpdir(), 'tsuzune-atomic-test-'))
  vault = new VaultService()
  await vault.setRootPath(rootPath)
})

afterEach(async () => {
  renameControl.failAtomicReplace = false
  renameControl.changeAfterTempWrite = false
  renameControl.preserveExternalTime = false
  await rm(rootPath, { recursive: true, force: true })
})

describe('VaultService atomic save', () => {
  it('keeps the original Markdown and removes the temporary file when replace fails', async () => {
    await vault.createNote({
      directory: '',
      name: '安全な保存',
      content: '置換前の本文'
    })
    const opened = await vault.readNote('安全な保存.md')
    renameControl.failAtomicReplace = true

    await expect(
      vault.saveNote({
        path: opened.path,
        content: '途中で失敗する本文',
        expectedModifiedAt: opened.modifiedAt
      })
    ).rejects.toMatchObject({
      appError: { code: 'ACCESS_DENIED' }
    })

    expect(await readFile(join(rootPath, '安全な保存.md'), 'utf8')).toBe(
      '置換前の本文'
    )
    expect((await readdir(rootPath)).filter((name) => name.startsWith('.tsuzune-'))).toEqual(
      []
    )
  })

  it('preserves an external edit made while the temporary save is being written', async () => {
    await vault.createNote({
      directory: '',
      name: '外部競合',
      content: '読み込み時の本文'
    })
    const opened = await vault.readNote('外部競合.md')
    renameControl.externalTarget = join(rootPath, opened.path)
    renameControl.externalContent = '外部アプリが保存した本文'
    renameControl.changeAfterTempWrite = true

    await expect(
      vault.saveNote({
        path: opened.path,
        content: 'TSUZUNEで編集中の本文',
        expectedModifiedAt: opened.modifiedAt
      })
    ).rejects.toMatchObject({
      appError: {
        code: 'FILE_CHANGED',
        currentContent: '外部アプリが保存した本文'
      }
    })

    expect(await readFile(renameControl.externalTarget, 'utf8')).toBe(
      '外部アプリが保存した本文'
    )
    expect((await readdir(rootPath)).filter((name) => name.startsWith('.tsuzune-'))).toEqual(
      []
    )
  })

  it('rejects an external same-size edit when the expected content is unchanged in metadata', async () => {
    await vault.createNote({
      directory: '',
      name: '同一時刻競合',
      content: '1234567890'
    })
    const opened = await vault.readNote('同一時刻競合.md')
    renameControl.externalTarget = join(rootPath, opened.path)
    renameControl.externalContent = 'abcdefghij'
    renameControl.changeAfterTempWrite = true
    renameControl.preserveExternalTime = true
    renameControl.externalMtime = opened.modifiedAt

    await expect(
      vault.saveNote({
        path: opened.path,
        content: 'TSUZUNE本文',
        expectedModifiedAt: opened.modifiedAt,
        expectedContent: opened.content
      })
    ).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })

    expect(await readFile(renameControl.externalTarget, 'utf8')).toBe('abcdefghij')
  })
})
