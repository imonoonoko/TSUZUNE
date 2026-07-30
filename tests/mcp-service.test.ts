import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VaultMcpService } from '../src/mcp/service'

describe('MCP vault service', () => {
  let root = ''
  let service: VaultMcpService

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tsuzune-service-'))
    await mkdir(join(root, 'Projects'))
    await writeFile(
      join(root, 'Home.md'),
      '# Home\n\n[[Projects/TSUZUNE]]',
      'utf8'
    )
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\n\nAI連携を試す。',
      'utf8'
    )
    service = new VaultMcpService({ explicitVaultPath: root })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('searches, fetches, follows backlinks, and builds context', async () => {
    const search = await service.search('AI連携')
    expect(search.results.map((result) => result.id)).toEqual([
      'Projects/TSUZUNE.md'
    ])

    const fetched = await service.fetch('Projects/TSUZUNE.md')
    expect(fetched.text).toContain('AI連携')

    const backlinks = await service.backlinks('Projects/TSUZUNE.md')
    expect(backlinks.backlinks.map((item) => item.id)).toEqual(['Home.md'])

    const context = await service.buildContext('Home.md')
    expect(context.markdown).toContain('Path: Projects/TSUZUNE.md')
  })

  it('rejects traversal and does not modify Markdown files', async () => {
    const path = join(root, 'Home.md')
    const beforeContent = await readFile(path, 'utf8')
    const beforeInfo = await stat(path)

    await expect(service.fetch('../Home.md')).rejects.toThrow(
      '相対パス'
    )
    await service.search('Home')
    await service.backlinks('Home.md')
    await service.buildContext('Home.md')

    expect(await readFile(path, 'utf8')).toBe(beforeContent)
    expect((await stat(path)).mtimeMs).toBe(beforeInfo.mtimeMs)
  })

  it('creates a new Markdown note without overwriting an existing file', async () => {
    const created = await service.createNote(
      'Projects/連携メモ.md',
      '# 連携メモ\n\nCodexから作成。'
    )

    expect(created.id).toBe('Projects/連携メモ.md')
    expect(await readFile(join(root, created.id), 'utf8')).toContain(
      'Codexから作成'
    )
    await expect(
      service.createNote('Projects/連携メモ.md', '上書き')
    ).rejects.toThrow()
    expect(await readFile(join(root, created.id), 'utf8')).not.toBe('上書き')
  })

  it('updates only the exact revision returned by fetch', async () => {
    const opened = await service.fetch('Projects/TSUZUNE.md')
    const updated = await service.updateNote(
      opened.id,
      '# TSUZUNE\n\nCodexから更新。',
      opened.metadata.revision
    )

    expect(updated.id).toBe(opened.id)
    expect(await readFile(join(root, opened.id), 'utf8')).toContain(
      'Codexから更新'
    )

    const current = await service.fetch(opened.id)
    await writeFile(join(root, opened.id), '外部エディタの更新', 'utf8')
    const externalInfo = await stat(join(root, opened.id))
    const externalTime = new Date(externalInfo.mtimeMs + 10_000)
    await utimes(join(root, opened.id), externalTime, externalTime)

    await expect(
      service.updateNote(opened.id, '古い内容で上書き', current.metadata.revision)
    ).rejects.toMatchObject({
      appError: {
        code: 'FILE_CHANGED'
      }
    })
    expect(await readFile(join(root, opened.id), 'utf8')).toBe(
      '外部エディタの更新'
    )
  })

  it('never applies a revision token after the active Vault changes', async () => {
    const otherRoot = await mkdtemp(join(tmpdir(), 'tsuzune-other-vault-'))
    const settingsPath = join(root, 'settings.json')
    const originalPath = join(root, 'Projects', 'TSUZUNE.md')
    const otherPath = join(otherRoot, 'Projects', 'TSUZUNE.md')

    try {
      await mkdir(join(otherRoot, 'Projects'))
      const originalContent = await readFile(originalPath, 'utf8')
      await writeFile(otherPath, originalContent, 'utf8')
      const originalInfo = await stat(originalPath)
      await utimes(otherPath, originalInfo.atime, originalInfo.mtime)

      await writeFile(
        settingsPath,
        JSON.stringify({ lastVaultPath: root }),
        'utf8'
      )
      const activeVaultService = new VaultMcpService({ settingsPath })
      const opened = await activeVaultService.fetch('Projects/TSUZUNE.md')

      await writeFile(
        settingsPath,
        JSON.stringify({ lastVaultPath: otherRoot }),
        'utf8'
      )
      await expect(
        activeVaultService.updateNote(
          opened.id,
          '別のVaultを上書きしない',
          opened.metadata.revision
        )
      ).rejects.toThrow()
      expect(await readFile(otherPath, 'utf8')).toBe(originalContent)
    } finally {
      await rm(otherRoot, { recursive: true, force: true })
    }
  })

  it('does not create or replace notes beyond the full-document limit', async () => {
    const tooLarge = 'x'.repeat(100_001)
    await expect(
      service.createNote('Projects/大きすぎる.md', tooLarge)
    ).rejects.toThrow('10万文字')

    const existingPath = join(root, 'Projects', '巨大ノート.md')
    await writeFile(existingPath, tooLarge, 'utf8')
    const opened = await service.fetch('Projects/巨大ノート.md')
    expect(opened.text).toHaveLength(100_000)
    expect(opened.metadata.editable).toBe(false)

    await expect(
      service.updateNote(opened.id, opened.text, opened.metadata.revision)
    ).rejects.toThrow('10万文字')
    expect(await readFile(existingPath, 'utf8')).toBe(tooLarge)
  })
})
