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
import { isSupportedAttachmentPath } from '../src/shared/attachments'

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
  it('recognizes supported attachment extensions on either path separator', () => {
    expect(isSupportedAttachmentPath('assets/image.PNG')).toBe(true)
    expect(isSupportedAttachmentPath('media\\clip.webm')).toBe(true)
    expect(isSupportedAttachmentPath('data/export.json')).toBe(false)
    expect(isSupportedAttachmentPath('.png')).toBe(false)
  })

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
    expect(snapshot.attachments).toEqual([])
  })

  it('loads validated path aliases and resolves old Markdown bookmarks', async () => {
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await mkdir(absolute('知識'), { recursive: true })
    await writeFile(absolute('知識/正本.md'), '# 正本', 'utf8')
    await writeFile(
      absolute('.tsuzune/path-aliases.json'),
      JSON.stringify({ '旧/ノート.md': '知識/正本.md' }),
      'utf8'
    )
    await writeFile(
      absolute('.tsuzune/bookmarks.json'),
      JSON.stringify([
        { type: 'file', path: '旧/ノート.md', title: '以前の入口', ctime: 123 }
      ]),
      'utf8'
    )

    const snapshot = await vault.scan()

    expect(snapshot.pathAliases).toEqual({ '旧/ノート.md': '知識/正本.md' })
    expect(snapshot.bookmarks).toEqual([
      { type: 'file', path: '知識/正本.md', title: '以前の入口', ctime: 123 }
    ])
  })

  it('removes a bookmark through its canonical path after alias restoration', async () => {
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await mkdir(absolute('知識'), { recursive: true })
    await writeFile(absolute('知識/正本.md'), '# 正本', 'utf8')
    await writeFile(
      absolute('.tsuzune/path-aliases.json'),
      JSON.stringify({ '旧/ノート.md': '知識/正本.md' }),
      'utf8'
    )
    await writeFile(
      absolute('.tsuzune/bookmarks.json'),
      JSON.stringify([
        {
          type: 'file',
          path: '旧/ノート.md',
          title: '以前の入口',
          group: '移行前',
          ctime: 123
        }
      ]),
      'utf8'
    )

    expect((await vault.scan()).bookmarks).toEqual([
      {
        type: 'file',
        path: '知識/正本.md',
        title: '以前の入口',
        group: '移行前',
        ctime: 123
      }
    ])
    await vault.removeBookmark('知識/正本.md')

    expect((await vault.scan()).bookmarks).toEqual([])
    expect(
      JSON.parse(await readFile(absolute('.tsuzune/bookmarks.json'), 'utf8'))
    ).toEqual([])
  })

  it('updates an aliased bookmark as one canonical entry without losing its ctime', async () => {
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await mkdir(absolute('知識'), { recursive: true })
    await writeFile(absolute('知識/正本.md'), '# 正本', 'utf8')
    await writeFile(
      absolute('.tsuzune/path-aliases.json'),
      JSON.stringify({ '旧/ノート.md': '知識/正本.md' }),
      'utf8'
    )
    await writeFile(
      absolute('.tsuzune/bookmarks.json'),
      JSON.stringify([
        {
          type: 'file',
          path: '旧/ノート.md',
          title: '以前の入口',
          group: '移行前',
          ctime: 123
        }
      ]),
      'utf8'
    )

    const updated = await vault.saveBookmark({
      path: '知識/正本.md',
      title: '現在の入口',
      group: '正本'
    })

    expect(updated).toEqual({
      type: 'file',
      path: '知識/正本.md',
      title: '現在の入口',
      group: '正本',
      ctime: 123
    })
    expect(
      JSON.parse(await readFile(absolute('.tsuzune/bookmarks.json'), 'utf8'))
    ).toEqual([updated])
  })

  it('keeps a bookmark on a live old path instead of applying its stale alias', async () => {
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await mkdir(absolute('旧'), { recursive: true })
    await mkdir(absolute('知識'), { recursive: true })
    await writeFile(absolute('旧/ノート.md'), '# 新しく作られた別ノート', 'utf8')
    await writeFile(absolute('知識/正本.md'), '# 正本', 'utf8')
    await writeFile(
      absolute('.tsuzune/path-aliases.json'),
      JSON.stringify({ '旧/ノート.md': '知識/正本.md' }),
      'utf8'
    )
    await writeFile(
      absolute('.tsuzune/bookmarks.json'),
      JSON.stringify([{ type: 'file', path: '旧/ノート.md', ctime: 123 }]),
      'utf8'
    )

    expect((await vault.scan()).bookmarks).toEqual([
      { type: 'file', path: '旧/ノート.md', ctime: 123 }
    ])
  })

  it('keeps an old bookmark unchanged when the alias terminal is missing', async () => {
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await writeFile(
      absolute('.tsuzune/path-aliases.json'),
      JSON.stringify({ '旧/ノート.md': '知識/欠損.md' }),
      'utf8'
    )
    await writeFile(
      absolute('.tsuzune/bookmarks.json'),
      JSON.stringify([{ type: 'file', path: '旧/ノート.md', ctime: 123 }]),
      'utf8'
    )

    expect((await vault.scan()).bookmarks).toEqual([
      { type: 'file', path: '旧/ノート.md', ctime: 123 }
    ])
  })

  it('fails closed when path aliases are malformed or cyclic', async () => {
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await writeFile(
      absolute('.tsuzune/path-aliases.json'),
      JSON.stringify({ 'A.md': 'B.md', 'B.md': 'A.md' }),
      'utf8'
    )

    await expect(vault.scan()).rejects.toMatchObject({
      appError: { code: 'INVALID_PATH' }
    })
  })

  it('scans supported attachments recursively with file metadata', async () => {
    const supportedExtensions = [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'bmp',
      'svg',
      'webp',
      'avif',
      'pdf',
      'mp3',
      'wav',
      'm4a',
      'ogg',
      'mp4',
      'webm',
      'mov',
      'mkv'
    ]
    await mkdir(absolute('資料/深い'), { recursive: true })
    await mkdir(absolute('.trash'), { recursive: true })
    await mkdir(absolute('.obsidian'), { recursive: true })
    await writeFile(absolute('資料/本文.md'), '# 本文', 'utf8')
    await Promise.all(
      supportedExtensions.map((extension, index) =>
        writeFile(
          absolute(`資料/深い/${String(index).padStart(2, '0')}.${extension}`),
          `asset-${extension}`,
          'utf8'
        )
      )
    )
    await writeFile(absolute('資料/深い/大文字.PNG'), 'upper-case', 'utf8')
    await writeFile(absolute('資料/深い/対象外.txt'), 'text', 'utf8')
    await writeFile(absolute('資料/深い/対象外.json'), '{}', 'utf8')
    await writeFile(absolute('資料/深い/対象外.exe'), 'binary', 'utf8')
    await writeFile(absolute('.trash/削除済み.png'), 'hidden', 'utf8')
    await writeFile(absolute('.obsidian/キャッシュ.pdf'), 'hidden', 'utf8')

    const snapshot = await vault.scan()

    expect(snapshot.attachments?.map((item) => item.path)).toEqual([
      ...supportedExtensions.map(
        (extension, index) =>
          `資料/深い/${String(index).padStart(2, '0')}.${extension}`
      ),
      '資料/深い/大文字.PNG'
    ])
    expect(snapshot.attachments?.[0]).toMatchObject({
      name: `00.${supportedExtensions[0]}`,
      size: Buffer.byteLength(`asset-${supportedExtensions[0]}`)
    })
    expect(snapshot.attachments?.[0].modifiedAt).toEqual(expect.any(Number))
    expect(
      typeof snapshot.attachments?.[0].createdAt === 'number' ||
        snapshot.attachments?.[0].createdAt === null
    ).toBe(true)
    expect(snapshot.notes[0].createdAt).not.toBeUndefined()
  })

  it('persists, updates, and removes one Vault-scoped file bookmark', async () => {
    await mkdir(absolute('attachments'), { recursive: true })
    await writeFile(absolute('attachments/diagram.svg'), '<svg/>', 'utf8')

    const created = await vault.saveBookmark({
      path: 'attachments/diagram.svg',
      title: ' 構成図 ',
      group: ' 資料 '
    })
    expect(created).toMatchObject({
      type: 'file',
      path: 'attachments/diagram.svg',
      title: '構成図',
      group: '資料'
    })
    expect((await vault.scan()).bookmarks).toEqual([created])

    const reopened = new VaultService()
    await reopened.setRootPath(rootPath)
    expect((await reopened.scan()).bookmarks).toEqual([created])

    const updated = await reopened.saveBookmark({
      path: 'attachments/diagram.svg',
      title: '新しい構成図',
      group: ''
    })
    expect(updated).toEqual({
      type: 'file',
      path: 'attachments/diagram.svg',
      title: '新しい構成図',
      ctime: created.ctime
    })
    expect((await reopened.scan()).bookmarks).toEqual([updated])

    await reopened.removeBookmark('attachments/diagram.svg')
    expect((await reopened.scan()).bookmarks).toEqual([])
    expect(
      JSON.parse(await readFile(absolute('.tsuzune/bookmarks.json'), 'utf8'))
    ).toEqual([])
  })

  it('does not create a bookmark for a missing or outside-Vault file', async () => {
    await expect(
      vault.saveBookmark({ path: 'missing.svg' })
    ).rejects.toMatchObject({ appError: { code: 'NOT_FOUND' } })
    await expect(
      vault.saveBookmark({ path: '../outside.svg' })
    ).rejects.toMatchObject({ appError: { code: 'INVALID_PATH' } })
  })

  it('excludes matching notes and attachments without discarding their creation times', async () => {
    await mkdir(absolute('80_excluded'), { recursive: true })
    await writeFile(absolute('Visible.md'), '# visible', 'utf8')
    await writeFile(absolute('80_excluded/Hidden.md'), '# hidden', 'utf8')
    await writeFile(absolute('80_excluded/Hidden.png'), 'image', 'utf8')

    const filtered = await vault.scan(['80_excluded'])

    expect(filtered.notes.map((item) => item.path)).toEqual(['Visible.md'])
    expect(filtered.attachments).toEqual([])

    const creationTimes = JSON.parse(
      await readFile(absolute('.tsuzune/graph-file-times.json'), 'utf8')
    ) as Record<string, number>
    expect(Object.keys(creationTimes)).toEqual([
      '80_excluded/Hidden.md',
      '80_excluded/Hidden.png',
      'Visible.md'
    ])

    const unfiltered = await vault.scan([])
    expect(unfiltered.notes.map((item) => item.path)).toEqual([
      '80_excluded/Hidden.md',
      'Visible.md'
    ])
    expect(unfiltered.attachments?.map((item) => item.path)).toEqual([
      '80_excluded/Hidden.png'
    ])
    expect(unfiltered.notes[0].createdAt).toBe(
      creationTimes['80_excluded/Hidden.md']
    )
  })

  it('resolves only file-backed graph entries for an external open', async () => {
    await mkdir(absolute('assets'), { recursive: true })
    await writeFile(absolute('ノート.md'), '# ノート', 'utf8')
    await writeFile(absolute('assets/図.png'), 'image', 'utf8')
    await writeFile(absolute('assets/対象外.txt'), 'text', 'utf8')

    await expect(vault.resolveFileForOpen('ノート.md')).resolves.toBe(
      absolute('ノート.md')
    )
    await expect(vault.resolveFileForOpen('assets/図.png')).resolves.toBe(
      absolute('assets/図.png')
    )
    await expect(vault.resolveFileForOpen('assets/対象外.txt')).rejects.toMatchObject({
      appError: { code: 'INVALID_PATH' }
    })
    await expect(vault.resolveFileForOpen('assets')).rejects.toMatchObject({
      appError: { code: 'INVALID_PATH' }
    })
  })

  it('reads a Vault image as a browser-safe data URL', async () => {
    await mkdir(absolute('attachments'), { recursive: true })
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" /></svg>'
    await writeFile(absolute('attachments/diagram.svg'), svg, 'utf8')

    await expect(vault.readImageDataUrl('attachments/diagram.svg')).resolves.toBe(
      `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    )
  })

  it('does not expose non-image files through preview data URLs', async () => {
    await writeFile(absolute('note.md'), '# private text', 'utf8')

    await expect(vault.readImageDataUrl('note.md')).rejects.toMatchObject({
      appError: { code: 'INVALID_PATH' }
    })
    await expect(vault.readImageDataUrl('../outside.png')).rejects.toMatchObject({
      appError: { code: 'INVALID_PATH' }
    })
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

  it('keeps rename collisions and auto-numbers move collisions without overwriting', async () => {
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
    ).resolves.toEqual({
      oldPath: '元.md',
      path: '移動先/元 1.md'
    })

    await expect(access(absolute('元.md'))).rejects.toBeDefined()
    expect(await readFile(absolute('既存.md'), 'utf8')).toBe('既存の本文')
    expect(await readFile(absolute('移動先/元.md'), 'utf8')).toBe('移動先の本文')
    expect(await readFile(absolute('移動先/元 1.md'), 'utf8')).toBe('元の本文')
  })

  it('moves a supported attachment without changing its bytes or Obsidian 1.13.4 embed', async () => {
    const logicalCreatedAt = 1_650_000_000_000
    const attachment = Buffer.from([0, 255, 17, 34, 51, 68])
    const home = '# Home\n\n![[attachments/diagram.svg]]\n'
    await mkdir(absolute('attachments'), { recursive: true })
    await mkdir(absolute('20_knowledge'), { recursive: true })
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await writeFile(absolute('00_Home.md'), home, 'utf8')
    await writeFile(absolute('attachments/diagram.svg'), attachment)
    await writeFile(
      absolute('.tsuzune/graph-file-times.json'),
      JSON.stringify({ 'attachments/diagram.svg': logicalCreatedAt }),
      'utf8'
    )

    await expect(
      vault.moveNote({
        path: 'attachments/diagram.svg',
        destinationDirectory: '20_knowledge'
      })
    ).resolves.toEqual({
      oldPath: 'attachments/diagram.svg',
      path: '20_knowledge/diagram.svg'
    })

    expect(await readFile(absolute('20_knowledge/diagram.svg'))).toEqual(attachment)
    expect(await readFile(absolute('00_Home.md'), 'utf8')).toBe(home)
    await expect(access(absolute('attachments/diagram.svg'))).rejects.toBeDefined()
    expect((await vault.scan()).attachments).toEqual([
      expect.objectContaining({
        path: '20_knowledge/diagram.svg',
        createdAt: logicalCreatedAt,
        size: attachment.byteLength
      })
    ])
  })

  it('uses the first free numbered attachment path without overwriting', async () => {
    const logicalCreatedAt = 1_660_000_000_000
    await mkdir(absolute('attachments'), { recursive: true })
    await mkdir(absolute('20_knowledge'), { recursive: true })
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await writeFile(absolute('attachments/diagram.svg'), 'source-bytes', 'utf8')
    await writeFile(absolute('20_knowledge/diagram.svg'), 'destination-bytes', 'utf8')
    await writeFile(absolute('20_knowledge/diagram 1.svg'), 'number-one', 'utf8')
    await writeFile(
      absolute('.tsuzune/graph-file-times.json'),
      JSON.stringify({ 'attachments/diagram.svg': logicalCreatedAt }),
      'utf8'
    )

    await expect(
      vault.moveNote({
        path: 'attachments/diagram.svg',
        destinationDirectory: '20_knowledge'
      })
    ).resolves.toEqual({
      oldPath: 'attachments/diagram.svg',
      path: '20_knowledge/diagram 2.svg'
    })

    await expect(access(absolute('attachments/diagram.svg'))).rejects.toBeDefined()
    expect(await readFile(absolute('20_knowledge/diagram.svg'), 'utf8')).toBe(
      'destination-bytes'
    )
    expect(await readFile(absolute('20_knowledge/diagram 1.svg'), 'utf8')).toBe(
      'number-one'
    )
    expect(await readFile(absolute('20_knowledge/diagram 2.svg'), 'utf8')).toBe(
      'source-bytes'
    )
    expect((await vault.scan()).attachments).toContainEqual(
      expect.objectContaining({
        path: '20_knowledge/diagram 2.svg',
        createdAt: logicalCreatedAt
      })
    )
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
