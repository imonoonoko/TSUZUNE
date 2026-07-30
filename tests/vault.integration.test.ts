import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  utimes,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VaultService } from '../src/main/vault'

let rootPath: string
let vault: VaultService

function absolute(relativePath: string): string {
  return join(rootPath, ...relativePath.split('/'))
}

beforeEach(async () => {
  rootPath = await mkdtemp(join(tmpdir(), 'tsuzune-vault-test-'))
  vault = new VaultService()
  await vault.setRootPath(rootPath)
})

afterEach(async () => {
  await rm(rootPath, { recursive: true, force: true })
})

describe('VaultService path and scan boundaries', () => {
  it('scans nested Markdown while excluding internal folders and non-Markdown files', async () => {
    await mkdir(absolute('開発'), { recursive: true })
    await mkdir(absolute('.trash'), { recursive: true })
    await writeFile(absolute('開発/方針.md'), '本文', 'utf8')
    await writeFile(absolute('readme.txt'), '対象外', 'utf8')
    await writeFile(absolute('.trash/削除済み.md'), '対象外', 'utf8')

    const snapshot = await vault.scan()

    expect(snapshot.directories).toEqual(['', '開発'])
    expect(snapshot.notes.map((item) => item.path)).toEqual(['開発/方針.md'])
    expect(snapshot.notes[0].content).toBe('本文')
  })

  it.each([
    () => vault.readNote('../outside.md'),
    () => vault.createDirectory({ parent: '../outside', name: '逃走先' }),
    () => vault.createNote({ directory: 'folder//nested', name: 'ノート' })
  ])('rejects an operation that contains an invalid relative path', async (operation) => {
    await expect(operation()).rejects.toMatchObject({
      appError: { code: 'INVALID_PATH' }
    })
  })

  it('rejects a Windows-reserved note name without creating a file', async () => {
    await expect(
      vault.createNote({ directory: '', name: 'CON', content: '作成しない' })
    ).rejects.toMatchObject({
      appError: { code: 'INVALID_NAME' }
    })
    await expect(access(absolute('CON.md'))).rejects.toBeDefined()
  })

  it.skipIf(process.platform !== 'win32')(
    'rejects junction traversal for reads and the trash destination',
    async () => {
      const outsidePath = await mkdtemp(join(tmpdir(), 'tsuzune-outside-test-'))

      try {
        await writeFile(join(outsidePath, 'outside.md'), 'Vault外の本文', 'utf8')
        await symlink(outsidePath, absolute('linked'), 'junction')

        await expect(vault.readNote('linked/outside.md')).rejects.toMatchObject({
          appError: { code: 'INVALID_PATH' }
        })

        await vault.createNote({
          directory: '',
          name: '記録',
          content: 'Vault内の本文'
        })
        await symlink(outsidePath, absolute('.trash'), 'junction')

        await expect(vault.trashEntry('記録.md')).rejects.toMatchObject({
          appError: { code: 'INVALID_PATH' }
        })
        expect(await readFile(absolute('記録.md'), 'utf8')).toBe('Vault内の本文')
        await expect(access(join(outsidePath, '記録.md'))).rejects.toBeDefined()
      } finally {
        await rm(outsidePath, { recursive: true, force: true })
      }
    }
  )
})

describe('VaultService file operations', () => {
  it('renames and moves a note without changing its Markdown content', async () => {
    await vault.createDirectory({ parent: '', name: '作業中' })
    await vault.createDirectory({ parent: '', name: '保管' })
    await vault.createNote({
      directory: '作業中',
      name: '下書き',
      content: '# 下書き\n\n日本語の本文'
    })

    const renamed = await vault.renameEntry({
      path: '作業中/下書き.md',
      newName: '完成'
    })
    expect(renamed).toEqual({
      oldPath: '作業中/下書き.md',
      path: '作業中/完成.md'
    })

    const moved = await vault.moveNote({
      path: renamed.path,
      destinationDirectory: '保管'
    })
    expect(moved).toEqual({
      oldPath: '作業中/完成.md',
      path: '保管/完成.md'
    })
    expect(await readFile(absolute('保管/完成.md'), 'utf8')).toBe(
      '# 下書き\n\n日本語の本文'
    )
    await expect(access(absolute('作業中/下書き.md'))).rejects.toBeDefined()
    await expect(access(absolute('作業中/完成.md'))).rejects.toBeDefined()
  })

  it('never overwrites an existing note during rename or move', async () => {
    await vault.createDirectory({ parent: '', name: '移動先' })
    await vault.createNote({ directory: '', name: '元', content: '元の本文' })
    await vault.createNote({ directory: '', name: '既存', content: '既存の本文' })
    await vault.createNote({
      directory: '移動先',
      name: '元',
      content: '移動先の本文'
    })

    await expect(
      vault.renameEntry({ path: '元.md', newName: '既存' })
    ).rejects.toMatchObject({
      appError: { code: 'ALREADY_EXISTS' }
    })
    await expect(
      vault.moveNote({ path: '元.md', destinationDirectory: '移動先' })
    ).rejects.toMatchObject({
      appError: { code: 'ALREADY_EXISTS' }
    })

    expect(await readFile(absolute('元.md'), 'utf8')).toBe('元の本文')
    expect(await readFile(absolute('既存.md'), 'utf8')).toBe('既存の本文')
    expect(await readFile(absolute('移動先/元.md'), 'utf8')).toBe('移動先の本文')
  })

  it('keeps every deleted version in its own trash batch', async () => {
    await vault.createNote({ directory: '', name: '記録', content: '最初の版' })
    const firstTrash = await vault.trashEntry('記録.md')

    await vault.createNote({ directory: '', name: '記録', content: '二番目の版' })
    const secondTrash = await vault.trashEntry('記録.md')

    await vault.createNote({ directory: '', name: '記録', content: '三番目の版' })
    const thirdTrash = await vault.trashEntry('記録.md')

    const paths = [firstTrash.path, secondTrash.path, thirdTrash.path]
    expect(new Set(paths).size).toBe(3)
    for (const path of paths) {
      expect(path).toMatch(
        /^\.trash\/\d{8}-\d{6}-\d{3}-[0-9a-f-]{36}\/記録\.md$/
      )
    }
    expect(await readFile(absolute(firstTrash.path), 'utf8')).toBe('最初の版')
    expect(await readFile(absolute(secondTrash.path), 'utf8')).toBe('二番目の版')
    expect(await readFile(absolute(thirdTrash.path), 'utf8')).toBe('三番目の版')
  })
})

describe('VaultService save conflicts', () => {
  it('preserves an external edit until the caller explicitly forces an overwrite', async () => {
    await vault.createNote({ directory: '', name: '競合', content: '読み込み時の本文' })
    const opened = await vault.readNote('競合.md')

    await writeFile(absolute('競合.md'), '外部アプリの本文', 'utf8')
    const externalTime = new Date(opened.modifiedAt + 10_000)
    await utimes(absolute('競合.md'), externalTime, externalTime)

    await expect(
      vault.saveNote({
        path: '競合.md',
        content: 'TSUZUNE側の本文',
        expectedModifiedAt: opened.modifiedAt
      })
    ).rejects.toMatchObject({
      appError: {
        code: 'FILE_CHANGED',
        currentContent: '外部アプリの本文'
      }
    })
    expect(await readFile(absolute('競合.md'), 'utf8')).toBe('外部アプリの本文')

    const saved = await vault.saveNote({
      path: '競合.md',
      content: '明示的に上書きした本文',
      expectedModifiedAt: opened.modifiedAt,
      force: true
    })
    expect(saved.path).toBe('競合.md')
    expect(await readFile(absolute('競合.md'), 'utf8')).toBe(
      '明示的に上書きした本文'
    )
  })
})
