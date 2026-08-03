import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VaultService } from '../src/main/vault'

let rootPath: string
let vault: VaultService

function absolute(relativePath: string): string {
  return join(rootPath, ...relativePath.split('/'))
}

async function readCreationTimes(): Promise<Record<string, number>> {
  return JSON.parse(
    await readFile(absolute('.tsuzune/graph-file-times.json'), 'utf8')
  ) as Record<string, number>
}

beforeEach(async () => {
  rootPath = await mkdtemp(join(tmpdir(), 'tsuzune-creation-times-'))
  vault = new VaultService()
  await vault.setRootPath(rootPath)
})

afterEach(async () => {
  await rm(rootPath, { recursive: true, force: true })
})

describe('VaultService logical creation times', () => {
  it('records the first known creation time for notes and supported attachments', async () => {
    await mkdir(absolute('assets'), { recursive: true })
    await writeFile(absolute('記録.md'), '# 記録', 'utf8')
    await writeFile(absolute('assets/写真.png'), 'image-bytes', 'utf8')

    const snapshot = await vault.scan()
    const creationTimes = await readCreationTimes()

    expect(snapshot.notes[0].createdAt).toEqual(expect.any(Number))
    expect(snapshot.attachments?.[0].createdAt).toEqual(expect.any(Number))
    expect(creationTimes).toEqual({
      'assets/写真.png': snapshot.attachments?.[0].createdAt,
      '記録.md': snapshot.notes[0].createdAt
    })
    expect(await readFile(absolute('記録.md'), 'utf8')).toBe('# 記録')
    expect(await readFile(absolute('assets/写真.png'), 'utf8')).toBe(
      'image-bytes'
    )
  })

  it('records the pre-replace creation time when a note is saved before any scan', async () => {
    await writeFile(absolute('直接保存.md'), '保存前', 'utf8')
    const opened = await vault.readNote('直接保存.md')

    await vault.saveNote({
      path: opened.path,
      content: '保存後',
      expectedModifiedAt: opened.modifiedAt
    })

    expect(await readCreationTimes()).toEqual({
      '直接保存.md': opened.createdAt
    })
    expect(await readFile(absolute('直接保存.md'), 'utf8')).toBe('保存後')
  })

  it('returns the logical creation time when a saved note is read again', async () => {
    const logicalCreatedAt = 1_700_000_000_000
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await writeFile(
      absolute('.tsuzune/graph-file-times.json'),
      JSON.stringify({ '再読込.md': logicalCreatedAt }),
      'utf8'
    )
    await writeFile(absolute('再読込.md'), '保存前', 'utf8')

    const opened = await vault.readNote('再読込.md')
    expect(opened.createdAt).toBe(logicalCreatedAt)

    await vault.saveNote({
      path: opened.path,
      content: '保存後',
      expectedModifiedAt: opened.modifiedAt
    })

    expect((await vault.readNote('再読込.md')).createdAt).toBe(logicalCreatedAt)
  })

  it('moves a logical creation time with a TSUZUNE rename and note move', async () => {
    const logicalCreatedAt = 1_650_000_000_000
    await mkdir(absolute('作業中'), { recursive: true })
    await mkdir(absolute('保管'), { recursive: true })
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await writeFile(absolute('作業中/下書き.md'), '本文', 'utf8')
    await writeFile(
      absolute('.tsuzune/graph-file-times.json'),
      JSON.stringify({ '作業中/下書き.md': logicalCreatedAt }),
      'utf8'
    )

    const renamed = await vault.renameEntry({
      path: '作業中/下書き.md',
      newName: '完成'
    })
    await vault.moveNote({
      path: renamed.path,
      destinationDirectory: '保管'
    })

    const snapshot = await vault.scan()
    expect(snapshot.notes).toHaveLength(1)
    expect(snapshot.notes[0]).toMatchObject({
      path: '保管/完成.md',
      createdAt: logicalCreatedAt
    })
    expect(await readCreationTimes()).toEqual({
      '保管/完成.md': logicalCreatedAt
    })
  })

  it('moves nested note and attachment times with a TSUZUNE folder rename', async () => {
    const noteCreatedAt = 1_640_000_000_000
    const attachmentCreatedAt = 1_640_000_000_001
    await mkdir(absolute('資料/画像'), { recursive: true })
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await writeFile(absolute('資料/概要.md'), '本文', 'utf8')
    await writeFile(absolute('資料/画像/図.png'), 'png-bytes', 'utf8')
    await writeFile(
      absolute('.tsuzune/graph-file-times.json'),
      JSON.stringify({
        '資料/概要.md': noteCreatedAt,
        '資料/画像/図.png': attachmentCreatedAt
      }),
      'utf8'
    )

    await vault.renameEntry({ path: '資料', newName: '参考資料' })

    const snapshot = await vault.scan()
    expect(snapshot.notes[0]).toMatchObject({
      path: '参考資料/概要.md',
      createdAt: noteCreatedAt
    })
    expect(snapshot.attachments?.[0]).toMatchObject({
      path: '参考資料/画像/図.png',
      createdAt: attachmentCreatedAt
    })
  })

  it('repairs malformed metadata softly and persists only valid timestamps', async () => {
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await writeFile(absolute('記録.md'), '本文', 'utf8')
    await writeFile(
      absolute('.tsuzune/graph-file-times.json'),
      '{ this is not valid JSON',
      'utf8'
    )

    const first = await vault.scan()
    expect(first.notes[0].createdAt).toEqual(expect.any(Number))

    await writeFile(
      absolute('.tsuzune/graph-file-times.json'),
      JSON.stringify({
        '記録.md': 'invalid',
        '存在しない.md': 1_600_000_000_000,
        '../vault外.md': 1_500_000_000_000,
        'ゼロ.md': 0
      }),
      'utf8'
    )

    const second = await vault.scan()
    const creationTimes = await readCreationTimes()
    expect(second.notes[0].createdAt).toEqual(expect.any(Number))
    expect(Object.keys(creationTimes)).toEqual(['記録.md'])
    expect(creationTimes['記録.md']).toEqual(expect.any(Number))
    expect(Number.isFinite(creationTimes['記録.md'])).toBe(true)
    expect(creationTimes['記録.md']).toBeGreaterThan(0)
  })

  it('does not reuse a trashed file creation time when its path is created again', async () => {
    const oldCreatedAt = 1_500_000_000_000
    await mkdir(absolute('.tsuzune'), { recursive: true })
    await writeFile(absolute('再利用.md'), '古い本文', 'utf8')
    await writeFile(
      absolute('.tsuzune/graph-file-times.json'),
      JSON.stringify({ '再利用.md': oldCreatedAt }),
      'utf8'
    )

    await vault.trashEntry('再利用.md')
    await vault.createNote({ directory: '', name: '再利用', content: '新しい本文' })

    const recreated = (await vault.scan()).notes[0]
    expect(recreated.path).toBe('再利用.md')
    expect(recreated.createdAt).not.toBe(oldCreatedAt)
    expect((await readCreationTimes())['再利用.md']).toBe(recreated.createdAt)
  })
})
