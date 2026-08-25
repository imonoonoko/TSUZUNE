import {
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VaultService } from '../src/main/vault'
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

  async function writePathAliases(
    aliases: Record<string, string>
  ): Promise<void> {
    await mkdir(join(root, '.tsuzune'), { recursive: true })
    await writeFile(
      join(root, '.tsuzune', 'path-aliases.json'),
      JSON.stringify(aliases),
      'utf8'
    )
  }

  async function persistCreationTimes(): Promise<void> {
    const vault = new VaultService()
    await vault.setRootPath(root)
    await vault.scan()
  }

  it('does not create creation-time metadata during a read-only search', async () => {
    await service.search('AI連携')

    await expect(stat(join(root, '.tsuzune'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('does not repair malformed creation-time metadata during a read-only fetch', async () => {
    const sidecarPath = join(root, '.tsuzune', 'graph-file-times.json')
    await mkdir(join(root, '.tsuzune'))
    await writeFile(sidecarPath, '{ malformed', 'utf8')
    const fixedTime = new Date('2001-01-01T00:00:00.000Z')
    await utimes(sidecarPath, fixedTime, fixedTime)
    const before = await stat(sidecarPath)

    await service.fetch('Home.md')

    expect(await readFile(sidecarPath, 'utf8')).toBe('{ malformed')
    expect((await stat(sidecarPath)).mtimeMs).toBe(before.mtimeMs)
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

  it('returns fetch-compatible descriptors for every included context source', async () => {
    const context = await service.buildContext('Home.md')

    for (const source of context.included) {
      const fetched = await service.fetch(source.path)
      expect(source.revision).toBe(fetched.metadata.revision)
      expect(source.modified_at).toBe(fetched.metadata.modified_at)
    }
  })

  it('changes only the descriptor of a context source that changed', async () => {
    const before = await service.buildContext('Home.md')
    const beforeByPath = new Map(
      before.included.map((source) => [source.path, source])
    )
    const targetPath = join(root, 'Projects', 'TSUZUNE.md')

    await writeFile(targetPath, '# TSUZUNE\n\nAI連携を更新。', 'utf8')
    const targetInfo = await stat(targetPath)
    const changedTime = new Date(targetInfo.mtimeMs + 10_000)
    await utimes(targetPath, changedTime, changedTime)

    const after = await service.buildContext('Home.md')
    const afterByPath = new Map(
      after.included.map((source) => [source.path, source])
    )

    expect(afterByPath.get('Home.md')?.revision).toBe(
      beforeByPath.get('Home.md')?.revision
    )
    expect(afterByPath.get('Home.md')?.modified_at).toBe(
      beforeByPath.get('Home.md')?.modified_at
    )
    expect(afterByPath.get('Projects/TSUZUNE.md')?.revision).not.toBe(
      beforeByPath.get('Projects/TSUZUNE.md')?.revision
    )
    expect(afterByPath.get('Projects/TSUZUNE.md')?.modified_at).not.toBe(
      beforeByPath.get('Projects/TSUZUNE.md')?.modified_at
    )
  })

  it('excludes history backlinks by default', async () => {
    await mkdir(join(root, '50_履歴', 'AI更新'), { recursive: true })
    await writeFile(
      join(root, '50_履歴', 'AI更新', 'Backlink.md'),
      '# History backlink\n\n[[Projects/TSUZUNE]]',
      'utf8'
    )

    const backlinks = await service.backlinks('Projects/TSUZUNE.md')

    expect(backlinks.backlinks.map((item) => item.id)).toEqual(['Home.md'])
    expect(backlinks.total).toBe(1)
  })

  it('includes history backlinks when explicitly requested', async () => {
    await mkdir(join(root, '50_履歴', 'AI更新'), { recursive: true })
    await writeFile(
      join(root, '50_履歴', 'AI更新', 'Backlink.md'),
      '# History backlink\n\n[[Projects/TSUZUNE]]',
      'utf8'
    )

    const backlinks = await service.backlinks(
      'Projects/TSUZUNE.md',
      20,
      true
    )

    expect(backlinks.backlinks.map((item) => item.id)).toEqual([
      '50_履歴/AI更新/Backlink.md',
      'Home.md'
    ])
    expect(backlinks.total).toBe(2)
  })

  it('continues backlinks with a stateless path cursor', async () => {
    await writeFile(
      join(root, 'Alpha.md'),
      '# Alpha backlink\n\n[[Projects/TSUZUNE]]',
      'utf8'
    )
    await writeFile(
      join(root, 'Zulu.md'),
      '# Zulu backlink\n\n[[Projects/TSUZUNE]]',
      'utf8'
    )

    const first = await service.backlinks('Projects/TSUZUNE.md', 2)
    const second = await service.backlinks(
      'Projects/TSUZUNE.md',
      2,
      false,
      first.next_after
    )
    const ids = [...first.backlinks, ...second.backlinks].map(
      (item) => item.id
    )

    expect(first.total).toBe(3)
    expect(second.total).toBe(3)
    expect(first.next_after).toBe(first.backlinks.at(-1)?.id)
    expect(second.next_after).toBeUndefined()
    expect(ids).toEqual(['Alpha.md', 'Home.md', 'Zulu.md'])
    expect(new Set(ids).size).toBe(3)
  })

  it('ranks natural multiword MCP queries with the target note on top', async () => {
    const search = await service.search('TSUZUNE AI連携')

    expect(search.results[0]?.id).toBe('Projects/TSUZUNE.md')
  })

  it('ranks natural Japanese sentence queries without requiring all terms', async () => {
    const search = await service.search('TSUZUNEの検索を良くしたい')

    expect(search.results[0]?.id).toBe('Projects/TSUZUNE.md')
  })

  it('lists bounded directory metadata without note content and continues after a page', async () => {
    await mkdir(join(root, 'Projects', 'Nested'))
    await writeFile(join(root, 'Projects', 'asset.png'), 'image', 'utf8')
    await writeFile(join(root, 'Projects', 'Nested', 'Deep.md'), 'secret body', 'utf8')
    await Promise.all(
      Array.from({ length: 198 }, (_, index) =>
        mkdir(join(root, 'Projects', `Folder-${String(index).padStart(3, '0')}`))
      )
    )

    const first = await service.listDirectory('Projects', 2)

    expect(first).toMatchObject({
      path: 'Projects',
      depth: 2,
      truncated: true
    })
    expect(first.entries).toHaveLength(200)
    expect(JSON.stringify(first)).not.toContain('secret body')

    const second = await service.listDirectory('Projects', 2, first.next_after)
    expect(second).toMatchObject({ truncated: false })
    const entries = [...first.entries, ...second.entries]
    expect(entries).toHaveLength(202)
    expect(entries.find((entry) => entry.path === 'Projects/Nested')).toEqual({
      type: 'directory',
      path: 'Projects/Nested',
      name: 'Nested',
      counts: { directories: 0, notes: 1, attachments: 0 }
    })
    expect(entries.find((entry) => entry.path === 'Projects/asset.png')).toEqual({
      type: 'attachment',
      path: 'Projects/asset.png',
      name: 'asset.png',
      size_bytes: 5,
      modified_at: expect.any(String)
    })
    expect(entries.map((entry) => entry.path)).toContain('Projects/Nested/Deep.md')
  })

  it('keeps one inventory fingerprint across three unchanged directory pages', async () => {
    await Promise.all(
      Array.from({ length: 400 }, (_, index) =>
        mkdir(join(root, 'Projects', `Page-${String(index).padStart(3, '0')}`))
      )
    )

    const first = await service.listDirectory('Projects')
    const second = await service.listDirectory(
      'Projects',
      1,
      first.next_after,
      first.fingerprint
    )
    const third = await service.listDirectory(
      'Projects',
      1,
      second.next_after,
      first.fingerprint
    )

    expect(first.entries).toHaveLength(200)
    expect(second.entries).toHaveLength(200)
    expect(third.entries).toHaveLength(1)
    expect(first.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(second.fingerprint).toBe(first.fingerprint)
    expect(third.fingerprint).toBe(first.fingerprint)
  })

  it('guards later pages from in-scope inventory changes only', async () => {
    await Promise.all(
      Array.from({ length: 200 }, (_, index) =>
        mkdir(join(root, 'Projects', `Guard-${String(index).padStart(3, '0')}`))
      )
    )
    const first = await service.listDirectory('Projects')
    await writeFile(join(root, 'Projects', 'Added.md'), '# Added', 'utf8')

    await expect(
      service.listDirectory(
        'Projects',
        1,
        first.next_after,
        first.fingerprint
      )
    ).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })

    const afterAddition = await service.listDirectory('Projects')
    await rm(join(root, 'Projects', 'Added.md'))
    await expect(
      service.listDirectory(
        'Projects',
        1,
        afterAddition.next_after,
        afterAddition.fingerprint
      )
    ).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })

    const afterDeletion = await service.listDirectory('Projects')
    const notePath = join(root, 'Projects', 'TSUZUNE.md')
    const noteInfo = await stat(notePath)
    const changedTime = new Date(noteInfo.mtimeMs + 10_000)
    await utimes(notePath, changedTime, changedTime)
    await expect(
      service.listDirectory(
        'Projects',
        1,
        afterDeletion.next_after,
        afterDeletion.fingerprint
      )
    ).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })

    const beforeOutsideChange = await service.listDirectory('Projects')
    await writeFile(join(root, 'Home.md'), '# Home changed outside scope', 'utf8')
    const afterOutsideChange = await service.listDirectory(
      'Projects',
      1,
      beforeOutsideChange.next_after,
      beforeOutsideChange.fingerprint
    )
    expect(afterOutsideChange.fingerprint).toBe(
      beforeOutsideChange.fingerprint
    )
  })

  it('omits folders covered by the active excluded-files settings', async () => {
    await mkdir(join(root, 'Hidden'))
    await writeFile(join(root, 'Hidden', 'Secret.md'), '# Secret', 'utf8')
    const settingsPath = join(root, 'settings.json')
    await writeFile(
      settingsPath,
      JSON.stringify({ lastVaultPath: root, userIgnoreFilters: ['Hidden/'] }),
      'utf8'
    )
    const configured = new VaultMcpService({ settingsPath })

    const listed = await configured.listDirectory()

    expect(listed.entries.map((entry) => entry.path)).not.toContain('Hidden')
    expect(listed.entries.map((entry) => entry.path)).not.toContain('Hidden/Secret.md')
  })

  it('excludes 50_履歴 audit history from search by default', async () => {
    await mkdir(join(root, '50_履歴', 'AI更新'), { recursive: true })
    await writeFile(
      join(root, '50_履歴', 'AI更新', '2026-08-13T00-00-00-000Z-00_-sample-abc123.md'),
      '# Previous content\n\nAI連携を試した記録。',
      'utf8'
    )
    await mkdir(join(root, '40_情報源'), { recursive: true })
    await writeFile(
      join(root, '40_情報源', 'evidence-2026-08-13.md'),
      '# Evidence\n\nAI連携の証拠。',
      'utf8'
    )

    const results = await service.search('AI連携')
    expect(results.results.map((result) => result.id).sort()).toEqual([
      '40_情報源/evidence-2026-08-13.md',
      'Projects/TSUZUNE.md'
    ])
  })

  it('includes 50_履歴 audit history when include_history is true', async () => {
    await mkdir(join(root, '50_履歴', 'AI更新'), { recursive: true })
    await writeFile(
      join(root, '50_履歴', 'AI更新', '2026-08-13T00-00-00-000Z-00_-sample-abc123.md'),
      '# Previous content\n\nAI連携を試した記録。',
      'utf8'
    )

    const excluded = await service.search('AI連携')
    expect(excluded.results.map((result) => result.id)).toEqual([
      'Projects/TSUZUNE.md'
    ])

    const included = await service.search('AI連携', 10, true)
    expect(included.results.map((result) => result.id).sort()).toEqual([
      '50_履歴/AI更新/2026-08-13T00-00-00-000Z-00_-sample-abc123.md',
      'Projects/TSUZUNE.md'
    ])
  })

  it('returns empty results for a query that only matches history by default', async () => {
    await mkdir(join(root, '50_履歴', 'AI更新'), { recursive: true })
    await writeFile(
      join(root, '50_履歴', 'AI更新', '2026-08-13T00-00-00-000Z-00_-sample-abc123.md'),
      '# Previous content\n\n唯一のヒットは履歴のみ。',
      'utf8'
    )

    expect((await service.search('唯一のヒット')).results).toEqual([])
    const included = await service.search('唯一のヒット', 10, true)
    expect(included.results).toHaveLength(1)
    expect(included.results[0].id).toContain('50_履歴')
  })

  it('applies limit after excluding history', async () => {
    await mkdir(join(root, '30_知識'), { recursive: true })
    await writeFile(
      join(root, '30_知識', 'A.md'),
      '# A\n\nAI連携 通常ノートA。',
      'utf8'
    )
    await writeFile(
      join(root, '30_知識', 'B.md'),
      '# B\n\nAI連携 通常ノートB。',
      'utf8'
    )
    await mkdir(join(root, '50_履歴'), { recursive: true })
    await writeFile(join(root, '50_履歴', 'H.md'), '# H\n\nAI連携 履歴。', 'utf8')

    const limited = await service.search('AI連携', 1)
    expect(limited.results).toHaveLength(1)

    const all = await service.search('AI連携', 10, true)
    expect(all.results.map((result) => result.id).sort()).toEqual([
      '30_知識/A.md',
      '30_知識/B.md',
      '50_履歴/H.md',
      'Projects/TSUZUNE.md'
    ])
  })

  it('excludes history tags from tag: search by default', async () => {
    await mkdir(join(root, '50_履歴'), { recursive: true })
    await writeFile(
      join(root, '50_履歴', 'tagged.md'),
      '# Tagged\n\n#deferred を含む履歴。',
      'utf8'
    )
    await writeFile(
      join(root, 'Knowledge.md'),
      '# Knowledge\n\n#deferred を含む通常ノート。',
      'utf8'
    )

    const results = await service.search('tag:#deferred')
    expect(results.results.map((result) => result.id)).toEqual(['Knowledge.md'])
  })

  it('patches a single occurrence with history and provenance', async () => {
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\n\nAI連携を試す。\n\nあとで直す。',
      'utf8'
    )
    const fetched = await service.fetch('Projects/TSUZUNE.md')

    const patched = await service.patchNote(
      'Projects/TSUZUNE.md',
      fetched.metadata.revision,
      [{ find: 'あとで直す。', replace: '直しました。' }],
      { reason: 'テスト用の部分更新' }
    )

    expect(patched.metadata.revision).not.toBe(fetched.metadata.revision)
    expect(patched.patch.operations).toEqual([
      { find: 'あとで直す。', replace: '直しました。', match_count: 1 }
    ])
    expect(patched.provenance.reason).toBe('テスト用の部分更新')
    expect(patched.provenance.history_path).toBeTruthy()

    const after = await service.fetch('Projects/TSUZUNE.md')
    expect(after.text).toContain('直しました。')
    expect(after.text).not.toContain('あとで直す。')
  })

  it('rejects a find that matches zero or multiple times', async () => {
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\n\nAI連携を試す。\n\nキーワード。\n\nキーワード。',
      'utf8'
    )
    const fetched = await service.fetch('Projects/TSUZUNE.md')

    await expect(
      service.patchNote('Projects/TSUZUNE.md', fetched.metadata.revision, [
        { find: '存在しない', replace: 'x' }
      ])
    ).rejects.toThrow(/0件/)
    await expect(
      service.patchNote('Projects/TSUZUNE.md', fetched.metadata.revision, [
        { find: 'キーワード。', replace: 'x' }
      ])
    ).rejects.toThrow(/2件/)
  })

  it('replaces every occurrence with replace_all', async () => {
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\n\nキーワード。\n\nキーワード。',
      'utf8'
    )
    const fetched = await service.fetch('Projects/TSUZUNE.md')

    const patched = await service.patchNote(
      'Projects/TSUZUNE.md',
      fetched.metadata.revision,
      [{ find: 'キーワード。', replace: '置換。', replaceAll: true }]
    )
    expect(patched.patch.operations[0].match_count).toBe(2)

    const after = await service.fetch('Projects/TSUZUNE.md')
    expect(after.text).toContain('置換。')
    expect(after.text).not.toContain('キーワード。')
  })

  it('rejects replace_all when there are no matches', async () => {
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\n\nAI連携を試す。',
      'utf8'
    )
    const fetched = await service.fetch('Projects/TSUZUNE.md')

    await expect(
      service.patchNote('Projects/TSUZUNE.md', fetched.metadata.revision, [
        { find: '存在しない', replace: 'x', replaceAll: true }
      ])
    ).rejects.toThrow(/0件/)
  })

  it('applies multiple operations in order when all succeed', async () => {
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\n\nAI連携を試す。\n\n修正対象A。\n\n修正対象B。',
      'utf8'
    )
    const fetched = await service.fetch('Projects/TSUZUNE.md')

    const patched = await service.patchNote(
      'Projects/TSUZUNE.md',
      fetched.metadata.revision,
      [
        { find: 'AI連携を試す。', replace: '更新後。' },
        { find: '修正対象A。', replace: '修正A。' },
        { find: '修正対象B。', replace: '修正B。' }
      ]
    )
    expect(patched.patch.operations.map((op) => op.match_count)).toEqual([
      1, 1, 1
    ])

    const after = await service.fetch('Projects/TSUZUNE.md')
    expect(after.text).toContain('更新後。')
    expect(after.text).toContain('修正A。')
    expect(after.text).toContain('修正B。')
    expect(after.text).not.toContain('AI連携を試す。')
    expect(after.text).not.toContain('修正対象A。')
    expect(after.text).not.toContain('修正対象B。')
  })

  it('applies patches atomically', async () => {
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\n\nAI連携を試す。\n\n修正対象。',
      'utf8'
    )
    const fetched = await service.fetch('Projects/TSUZUNE.md')

    await expect(
      service.patchNote('Projects/TSUZUNE.md', fetched.metadata.revision, [
        { find: 'AI連携を試す。', replace: '更新後。' },
        { find: '存在しない', replace: 'x' }
      ])
    ).rejects.toThrow(/0件/)

    const after = await service.fetch('Projects/TSUZUNE.md')
    expect(after.text).toContain('AI連携を試す。')
    expect(after.text).not.toContain('更新後。')
    await expect(stat(join(root, '50_履歴', 'AI更新'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('rejects stale revision and immutable paths for patches', async () => {
    await expect(
      service.patchNote(
        'Projects/TSUZUNE.md',
        'sha256:' + 'a'.repeat(64),
        [{ find: 'AI連携', replace: 'x' }]
      )
    ).rejects.toThrow(/変更されたか/)

    await mkdir(join(root, '50_履歴'), { recursive: true })
    await writeFile(join(root, '50_履歴', 'old.md'), '# Old\n\n本文。', 'utf8')
    const historyFetched = await service.fetch('50_履歴/old.md')
    await expect(
      service.patchNote('50_履歴/old.md', historyFetched.metadata.revision, [
        { find: '本文。', replace: '変更。' }
      ])
    ).rejects.toThrow(/AIから変更できない/)
  })

  it('preserves CRLF line endings when patching', async () => {
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\r\n\r\nAI連携を試す。\r\n',
      'utf8'
    )
    const fetched = await service.fetch('Projects/TSUZUNE.md')

    await service.patchNote('Projects/TSUZUNE.md', fetched.metadata.revision, [
      { find: 'AI連携を試す。', replace: '更新後。' }
    ])
    const raw = await readFile(join(root, 'Projects', 'TSUZUNE.md'), 'utf8')
    expect(raw).toBe('# TSUZUNE\r\n\r\n更新後。\r\n')
  })

  it('keeps LF-only files LF when patching', async () => {
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\n\nAI連携を試す。\n',
      'utf8'
    )
    const fetched = await service.fetch('Projects/TSUZUNE.md')

    await service.patchNote('Projects/TSUZUNE.md', fetched.metadata.revision, [
      { find: 'AI連携を試す。', replace: '更新後。' }
    ])
    const raw = await readFile(join(root, 'Projects', 'TSUZUNE.md'), 'utf8')
    expect(raw).toBe('# TSUZUNE\n\n更新後。\n')
  })

  it('matches a find spanning a line break on a CRLF file', async () => {
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\r\n\r\nAI連携を\r\n試す。\r\n',
      'utf8'
    )
    const fetched = await service.fetch('Projects/TSUZUNE.md')

    await service.patchNote('Projects/TSUZUNE.md', fetched.metadata.revision, [
      { find: 'AI連携を\n試す。', replace: '更新後。' }
    ])
    const raw = await readFile(join(root, 'Projects', 'TSUZUNE.md'), 'utf8')
    expect(raw).toBe('# TSUZUNE\r\n\r\n更新後。\r\n')
  })

  it('rejects a no-op patch', async () => {
    const fetched = await service.fetch('Projects/TSUZUNE.md')
    await expect(
      service.patchNote('Projects/TSUZUNE.md', fetched.metadata.revision, [
        { find: 'AI連携を試す。', replace: 'AI連携を試す。' }
      ])
    ).rejects.toThrow(/no-op/)
  })

  it('honors the app-wide excluded files setting in MCP retrieval', async () => {
    const settingsPath = join(root, 'settings.json')
    await writeFile(
      settingsPath,
      JSON.stringify({
        lastVaultPath: root,
        userIgnoreFilters: ['Projects']
      }),
      'utf8'
    )
    const activeVaultService = new VaultMcpService({ settingsPath })

    expect((await activeVaultService.search('AI連携')).results).toEqual([])

    const context = await activeVaultService.buildContext('Home.md')
    expect(context.included.map((source) => source.path)).not.toContain(
      'Projects/TSUZUNE.md'
    )
    expect(context.markdown).not.toContain('AI連携を試す。')
  })

  it('passes an optional query to the recall-safe context builder', async () => {
    const baseline = await service.buildContext('Home.md')
    const queried = await service.buildContext('Home.md', 15_000, {
      query: 'AI連携'
    })

    expect(baseline.markdown).not.toContain('Query:')
    expect(queried.markdown).not.toContain('Query:')
    expect(
      queried.included.find(
        (source) => source.path === 'Projects/TSUZUNE.md'
      )?.selection_reasons
    ).toEqual(['起点ノートからの明示リンク', '質問語に一致'])
    expect(
      [
        ...queried.included.map((source) => source.path),
        ...queried.omitted_ids
      ].sort()
    ).toEqual(
      [
        ...baseline.included.map((source) => source.path),
        ...baseline.omitted_ids
      ].sort()
    )
  })

  it('returns an explicit MOC as a title-only router', async () => {
    await writeFile(
      join(root, 'Map.md'),
      [
        '---',
        'type: moc',
        '---',
        '# Map',
        '',
        'MOC_DESCRIPTION_SENTINEL',
        '- [[Projects/TSUZUNE]] — TARGET_DESCRIPTION_SENTINEL'
      ].join('\n'),
      'utf8'
    )
    await writeFile(
      join(root, 'Backlink.md'),
      '# Backlink\n\nBACKLINK_BODY_SENTINEL [[Map]]',
      'utf8'
    )

    const context = await service.buildContext('Map.md')

    expect(context.included).toEqual([
      {
        path: 'Map.md',
        name: 'Map',
        relation: 'seed',
        truncated: false,
        revision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        modified_at: expect.any(String),
        selection_reasons: ['MOCタイトル索引']
      }
    ])
    expect(context.markdown).toContain('- [[Projects/TSUZUNE]]')
    expect(context.markdown).not.toContain('MOC_DESCRIPTION_SENTINEL')
    expect(context.markdown).not.toContain('TARGET_DESCRIPTION_SENTINEL')
    expect(context.markdown).not.toContain('AI連携を試す。')
    expect(context.markdown).not.toContain('BACKLINK_BODY_SENTINEL')
  })

  it('uses a live canonical note through an old path across MCP reads and writes', async () => {
    await mkdir(join(root, 'Knowledge'))
    await rename(
      join(root, 'Projects', 'TSUZUNE.md'),
      join(root, 'Knowledge', 'TSUZUNE.md')
    )
    await writePathAliases({
      'Projects/TSUZUNE.md': 'Archive/TSUZUNE.md',
      'Archive/TSUZUNE.md': 'Knowledge/TSUZUNE.md'
    })

    const search = await service.search('AI連携')
    expect(search.results.map((result) => result.id)).toEqual([
      'Knowledge/TSUZUNE.md'
    ])

    const fetched = await service.fetch('Projects/TSUZUNE.md')
    expect(fetched.id).toBe('Knowledge/TSUZUNE.md')
    expect(fetched.metadata.path).toBe('Knowledge/TSUZUNE.md')

    const backlinks = await service.backlinks('Projects/TSUZUNE.md')
    expect(backlinks.note.id).toBe('Knowledge/TSUZUNE.md')
    expect(backlinks.backlinks.map((item) => item.id)).toEqual(['Home.md'])

    const context = await service.buildContext('Projects/TSUZUNE.md')
    expect(context.seed_id).toBe('Knowledge/TSUZUNE.md')
    expect(context.included.map((item) => item.path)).toContain('Home.md')

    const updated = await service.updateNote(
      'Projects/TSUZUNE.md',
      '# TSUZUNE\n\n旧IDから更新。',
      fetched.metadata.revision
    )
    expect(updated.id).toBe('Knowledge/TSUZUNE.md')
    expect(
      await readFile(join(root, 'Knowledge', 'TSUZUNE.md'), 'utf8')
    ).toContain('旧IDから更新')

    const autonomous = await service.autonomousUpdateNote(
      'Projects/TSUZUNE.md',
      '# TSUZUNE\n\n旧IDから自動更新。'
    )
    expect(autonomous.id).toBe('Knowledge/TSUZUNE.md')
    const historyPath = autonomous.provenance.history_path
    expect(historyPath).toBeDefined()
    if (!historyPath) {
      throw new Error('autonomous update must record a history path')
    }
    const history = await readFile(
      join(root, historyPath),
      'utf8'
    )
    expect(history).toContain('target: Knowledge/TSUZUNE.md')
  })

  it('prefers an existing old-path note and rejects aliases without a live target', async () => {
    await mkdir(join(root, 'Knowledge'))
    await writeFile(
      join(root, 'Knowledge', 'TSUZUNE.md'),
      '# Canonical',
      'utf8'
    )
    await writePathAliases({
      'Projects/TSUZUNE.md': 'Knowledge/TSUZUNE.md',
      'Missing-old.md': 'Knowledge/Missing.md'
    })

    const exact = await service.fetch('Projects/TSUZUNE.md')
    expect(exact.id).toBe('Projects/TSUZUNE.md')
    expect(exact.text).toContain('AI連携を試す')
    await expect(service.fetch('Missing-old.md')).rejects.toThrow(
      'ノートが見つかりません'
    )
  })

  it('rejects a revision issued before a note moved behind an alias', async () => {
    const beforeMove = await service.fetch('Projects/TSUZUNE.md')
    await mkdir(join(root, 'Knowledge'))
    await rename(
      join(root, 'Projects', 'TSUZUNE.md'),
      join(root, 'Knowledge', 'TSUZUNE.md')
    )
    await writePathAliases({
      'Projects/TSUZUNE.md': 'Knowledge/TSUZUNE.md'
    })

    await expect(
      service.updateNote(
        'Projects/TSUZUNE.md',
        '移動前revisionで上書きしない',
        beforeMove.metadata.revision
      )
    ).rejects.toMatchObject({
      appError: { code: 'FILE_CHANGED' }
    })
    expect(
      await readFile(join(root, 'Knowledge', 'TSUZUNE.md'), 'utf8')
    ).toContain('AI連携を試す')
  })

  it('builds an as-of context with temporal evidence in the MCP output', async () => {
    await mkdir(join(root, 'History'))
    await writeFile(
      join(root, 'History', 'Home-planning.md'),
      [
        '---',
        'kind: state',
        'subject: "[[Home]]"',
        'status: planning',
        'valid_from: 2026-06-01',
        'valid_to: 2026-07-01',
        'review_after: 2026-06-10',
        '---',
        '# Home planning'
      ].join('\n'),
      'utf8'
    )

    const context = await service.buildContext('Home.md', 15_000, {
      asOf: '2026-06-15'
    })

    expect(context.as_of).toBe('2026-06-15')
    expect(context.temporal_perspective).toBe('valid-time')
    expect(context.included).toContainEqual({
      path: 'Home.md',
      name: 'Home',
      relation: 'seed',
      truncated: false,
      revision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      modified_at: expect.any(String),
      content_omitted: true,
      selection_reasons: ['起点ノート（時間範囲のない本文は省略）']
    })
    expect(context.markdown).not.toContain('[[Projects/TSUZUNE]]')
    expect(context.warnings).toContainEqual(
      expect.objectContaining({
        code: 'UNSCOPED_NORMAL_CONTENT_OMITTED',
        paths: ['Home.md', 'Projects/TSUZUNE.md']
      })
    )
    expect(context.included).toContainEqual({
      path: 'History/Home-planning.md',
      name: 'Home-planning',
      relation: 'backlink',
      truncated: false,
      revision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      modified_at: expect.any(String),
      temporal_status: 'review_due',
      selection_reasons: ['指定時点で有効だが再確認期限を超過']
    })
    expect(context.warnings).toContainEqual({
      code: 'REVIEW_DUE',
      message: '現在も有効か再確認が必要です。',
      path: 'History/Home-planning.md'
    })
  })

  it('lets MCP callers choose knowledge-time explicitly', async () => {
    await mkdir(join(root, 'History'))
    await writeFile(
      join(root, 'History', 'Home-observed-later.md'),
      [
        '---',
        'kind: state',
        'subject: "[[Home]]"',
        'status: active',
        'valid_from: 2026-06-01',
        'observed_at: 2026-07-01',
        '---',
        '# OBSERVED_LATER_SENTINEL'
      ].join('\n'),
      'utf8'
    )

    const validTime = await service.buildContext('Home.md', 15_000, {
      asOf: '2026-06-15'
    })
    const knowledgeTime = await service.buildContext('Home.md', 15_000, {
      asOf: '2026-06-15',
      temporalPerspective: 'knowledge-time'
    })

    expect(validTime.markdown).toContain('OBSERVED_LATER_SENTINEL')
    expect(validTime.temporal_perspective).toBe('valid-time')
    expect(knowledgeTime.markdown).not.toContain(
      'OBSERVED_LATER_SENTINEL'
    )
    expect(knowledgeTime.temporal_perspective).toBe('knowledge-time')
  })

  it('includes historical states only when the MCP caller requests them', async () => {
    await mkdir(join(root, 'History'))
    await writeFile(
      join(root, 'History', 'Home-planning.md'),
      [
        '---',
        'kind: state',
        'subject: "[[Home]]"',
        'status: planning',
        'valid_from: 2026-06-01',
        'valid_to: 2026-07-01',
        '---',
        '# Home planning'
      ].join('\n'),
      'utf8'
    )
    await writeFile(
      join(root, 'History', 'Home-active.md'),
      [
        '---',
        'kind: state',
        'subject: "[[Home]]"',
        'status: active',
        'valid_from: 2026-07-01',
        '---',
        '# Home active'
      ].join('\n'),
      'utf8'
    )

    const current = await service.buildContext('Home.md', 15_000, {
      asOf: '2026-07-15'
    })
    const withHistory = await service.buildContext('Home.md', 15_000, {
      asOf: '2026-07-15',
      includeHistory: true
    })

    expect(current.included.map((source) => source.path)).not.toContain(
      'History/Home-planning.md'
    )
    expect(withHistory.included).toContainEqual({
      path: 'History/Home-planning.md',
      name: 'Home-planning',
      relation: 'backlink',
      truncated: false,
      revision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      modified_at: expect.any(String),
      temporal_status: 'historical',
      selection_reasons: ['指定時点より前に終了した状態']
    })
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

  it('creates one new folder inside an existing Vault folder without overwriting', async () => {
    await expect(service.createDirectory('Projects/資料')).resolves.toEqual({
      path: 'Projects/資料'
    })
    expect((await stat(join(root, 'Projects', '資料'))).isDirectory()).toBe(true)

    await expect(service.createDirectory('Projects/資料')).rejects.toThrow()
    await expect(service.createDirectory('Missing/資料')).rejects.toThrow()
    await expect(service.createDirectory('../資料')).rejects.toThrow('相対パス')
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

  it('lets AI update a note without human approval and records a reversible provenance snapshot', async () => {
    const updated = await service.autonomousUpdateNote(
      'Projects/TSUZUNE.md',
      '# TSUZUNE\n\nNotebookLMで確認した連携方針。',
      {
        reason: '調査結果を知識ノートへ反映',
        sourceRefs: ['NotebookLM/research-package-001.md']
      }
    )

    expect(updated.provenance.actor).toBe('ai')
    expect(updated.provenance.reason).toBe('調査結果を知識ノートへ反映')
    expect(updated.provenance.source_refs).toEqual([
      'NotebookLM/research-package-001.md'
    ])
    expect(updated.provenance.previous_revision).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(updated.unchanged).toBeUndefined()
    const historyPath = updated.provenance.history_path
    expect(historyPath).toMatch(/^50_履歴\/AI更新\/.*\.md$/)
    if (!historyPath) {
      throw new Error('changed autonomous update must record a history path')
    }
    expect(await readFile(join(root, 'Projects/TSUZUNE.md'), 'utf8')).toContain(
      'NotebookLMで確認した連携方針'
    )

    const history = await readFile(join(root, historyPath), 'utf8')
    expect(history).toContain('kind: ai_revision')
    expect(history).toContain('target: Projects/TSUZUNE.md')
    expect(history).toMatch(/previous_modified_at: \d+/)
    expect(history).toMatch(/previous_size_bytes: \d+/)
    expect(history).toMatch(/revision_root_sha256: [a-f0-9]{64}/)
    expect(history).toContain('調査結果を知識ノートへ反映')
    expect(history).toContain('NotebookLM/research-package-001.md')
    expect(history).toContain('AI連携を試す。')
  })

  it('queues one review proposal without changing the note or history', async () => {
    const settingsPath = join(root, 'settings.json')
    await writeFile(
      settingsPath,
      JSON.stringify({
        lastVaultPath: root,
        aiReviewPaths: ['Projects']
      }),
      'utf8'
    )
    const reviewService = new VaultMcpService({ settingsPath })

    const proposed = await reviewService.autonomousUpdateNote(
      'Projects/TSUZUNE.md',
      '# TSUZUNE\n\n承認後に反映する。',
      { reason: 'Review動作を確認' }
    )

    expect(proposed).toMatchObject({
      pending_review: true,
      proposal: {
        path: 'Projects/TSUZUNE.md',
        operation: 'update',
        reason: 'Review動作を確認'
      }
    })
    expect(await readFile(join(root, 'Projects/TSUZUNE.md'), 'utf8')).toContain(
      'AI連携を試す。'
    )
    await expect(stat(join(root, '50_履歴', 'AI更新'))).rejects.toThrow()
    expect(
      await new VaultMcpService({ settingsPath }).listReviewProposals()
    ).toHaveLength(1)

    await expect(
      reviewService.autonomousUpdateNote(
        'Projects/TSUZUNE.md',
        '# TSUZUNE\n\n別の提案。'
      )
    ).rejects.toThrow('承認待ち')
  })

  it('routes create and guarded update through review, then approves or cancels explicitly', async () => {
    const settingsPath = join(root, 'settings.json')
    await writeFile(
      settingsPath,
      JSON.stringify({ lastVaultPath: root, aiReviewPaths: ['Projects'] }),
      'utf8'
    )
    const reviewService = new VaultMcpService({ settingsPath })

    const created = await reviewService.createNote(
      'Projects/Review-created.md',
      '# Review created'
    )
    expect(created.pending_review).toBe(true)
    await expect(stat(join(root, 'Projects', 'Review-created.md'))).rejects.toThrow()
    await reviewService.cancelReviewProposal(created.proposal?.id ?? '')
    expect(await reviewService.listReviewProposals()).toEqual([])

    const opened = await reviewService.fetch('Projects/TSUZUNE.md')
    const updated = await reviewService.updateNote(
      opened.id,
      '# TSUZUNE\n\n承認済み。',
      opened.metadata.revision
    )
    expect(updated.pending_review).toBe(true)
    expect(await readFile(join(root, opened.id), 'utf8')).toContain('AI連携を試す。')

    const applied = await reviewService.approveReviewProposal(
      updated.proposal?.id ?? ''
    )
    expect(applied.id).toBe(opened.id)
    expect(await readFile(join(root, opened.id), 'utf8')).toContain('承認済み。')
    expect(await reviewService.listReviewProposals()).toEqual([])
    expect(await stat(join(root, '50_履歴', 'AI更新'))).toBeTruthy()
  })

  it('invalidates a review proposal when the target revision changed', async () => {
    const settingsPath = join(root, 'settings.json')
    await writeFile(
      settingsPath,
      JSON.stringify({ lastVaultPath: root, aiReviewPaths: ['Projects'] }),
      'utf8'
    )
    const reviewService = new VaultMcpService({ settingsPath })
    const opened = await reviewService.fetch('Projects/TSUZUNE.md')
    const proposed = await reviewService.updateNote(
      opened.id,
      '# TSUZUNE\n\n古い提案。',
      opened.metadata.revision
    )
    await writeFile(join(root, 'Projects', 'TSUZUNE.md'), '外部変更', 'utf8')

    await expect(
      reviewService.approveReviewProposal(proposed.proposal?.id ?? '')
    ).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    expect(await reviewService.listReviewProposals()).toEqual([])
    expect(await readFile(join(root, 'Projects', 'TSUZUNE.md'), 'utf8')).toBe(
      '外部変更'
    )
  })

  it('returns a matching revision and identical autonomous update as an unchanged no-op', async () => {
    const targetPath = join(root, 'Projects', 'TSUZUNE.md')
    const sidecarPath = join(root, '.tsuzune', 'graph-file-times.json')
    const historyDirectory = join(root, '50_履歴', 'AI更新')
    const fixedTime = new Date('2001-01-01T00:00:00.000Z')

    await utimes(targetPath, fixedTime, fixedTime)
    await persistCreationTimes()
    const opened = await service.fetch('Projects/TSUZUNE.md')
    const targetContents = await readFile(targetPath, 'utf8')
    const sidecarContents = await readFile(sidecarPath, 'utf8')
    await utimes(sidecarPath, fixedTime, fixedTime)
    const [targetBefore, sidecarBefore] = await Promise.all([
      stat(targetPath),
      stat(sidecarPath)
    ])
    await expect(stat(historyDirectory)).rejects.toMatchObject({ code: 'ENOENT' })

    const unchanged = await service.autonomousUpdateNote(opened.id, opened.text, {
      expectedRevision: opened.metadata.revision,
      reason: '同一本文を再送した',
      sourceRefs: ['NotebookLM/research-package-001.md']
    })

    expect(unchanged.unchanged).toBe(true)
    expect(unchanged.metadata.revision).toBe(opened.metadata.revision)
    expect(unchanged.provenance.previous_revision).toBe(
      opened.metadata.revision
    )
    expect(unchanged.provenance.history_path).toBeUndefined()
    expect(await readFile(targetPath, 'utf8')).toBe(targetContents)
    expect((await stat(targetPath)).mtimeMs).toBe(targetBefore.mtimeMs)
    expect(await readFile(sidecarPath, 'utf8')).toBe(sidecarContents)
    expect((await stat(sidecarPath)).mtimeMs).toBe(sidecarBefore.mtimeMs)
    await expect(stat(historyDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses autonomous updates to protected source notes without writing history', async () => {
    const sourceDirectory = join(root, '40_情報源')
    await mkdir(sourceDirectory)
    await writeFile(
      join(sourceDirectory, 'Original.md'),
      '# Original\n\n変更しない原典。',
      'utf8'
    )
    const opened = await service.fetch('40_情報源/Original.md')
    const historyDirectory = join(root, '50_履歴', 'AI更新')

    expect(opened.metadata.editable).toBe(false)
    await expect(
      service.autonomousUpdateNote(
        opened.id,
        '# Original\n\n変更後。',
        { expectedRevision: opened.metadata.revision }
      )
    ).rejects.toThrow('AIから変更できないノートです')
    expect(await readFile(join(sourceDirectory, 'Original.md'), 'utf8')).toBe(
      opened.text
    )
    await expect(stat(historyDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('ignores legacy configured immutable paths for ordinary notes', async () => {
    const settingsPath = join(root, 'settings.json')
    await writeFile(
      settingsPath,
      JSON.stringify({
        lastVaultPath: root,
        aiImmutablePaths: ['Projects']
      }),
      'utf8'
    )
    const activeVaultService = new VaultMcpService({ settingsPath })
    const opened = await activeVaultService.fetch('Projects/TSUZUNE.md')

    expect(opened.metadata.editable).toBe(true)
    await activeVaultService.createNote('Projects/New.md', '# New')
    await activeVaultService.createDirectory('Projects/New')
    await activeVaultService.updateNote(
      opened.id,
      '# TSUZUNE\n\n更新後。',
      opened.metadata.revision
    )

    expect(await readFile(join(root, 'Projects', 'New.md'), 'utf8')).toBe('# New')
    await expect(stat(join(root, 'Projects', 'New'))).resolves.toBeDefined()
    expect(await readFile(join(root, 'Projects', 'TSUZUNE.md'), 'utf8')).toBe(
      '# TSUZUNE\n\n更新後。'
    )
  })

  it('returns an unchanged no-op for identical content without a revision guard', async () => {
    const opened = await service.fetch('Projects/TSUZUNE.md')
    const updated = await service.autonomousUpdateNote(opened.id, opened.text)

    expect(updated.unchanged).toBe(true)
    expect(updated.metadata.revision).toBe(opened.metadata.revision)
    expect(updated.provenance.previous_revision).toBe(
      opened.metadata.revision
    )
    expect(updated.provenance.history_path).toBeUndefined()
    await expect(stat(join(root, '50_履歴', 'AI更新'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('rejects a stale autonomous revision before considering identical content', async () => {
    const targetPath = join(root, 'Projects', 'TSUZUNE.md')
    const sidecarPath = join(root, '.tsuzune', 'graph-file-times.json')
    const historyDirectory = join(root, '50_履歴', 'AI更新')
    await persistCreationTimes()
    const opened = await service.fetch('Projects/TSUZUNE.md')

    await writeFile(targetPath, '# TSUZUNE\n\n外部更新。', 'utf8')
    const externalInfo = await stat(targetPath)
    const externalTime = new Date(externalInfo.mtimeMs + 10_000)
    await utimes(targetPath, externalTime, externalTime)
    const [targetContents, targetBefore, sidecarContents, sidecarBefore] =
      await Promise.all([
        readFile(targetPath, 'utf8'),
        stat(targetPath),
        readFile(sidecarPath, 'utf8'),
        stat(sidecarPath)
      ])

    await expect(
      service.autonomousUpdateNote(opened.id, targetContents, {
        expectedRevision: opened.metadata.revision
      })
    ).rejects.toMatchObject({
      appError: {
        code: 'FILE_CHANGED'
      }
    })
    expect(await readFile(targetPath, 'utf8')).toBe(targetContents)
    expect((await stat(targetPath)).mtimeMs).toBe(targetBefore.mtimeMs)
    expect(await readFile(sidecarPath, 'utf8')).toBe(sidecarContents)
    expect((await stat(sidecarPath)).mtimeMs).toBe(sidecarBefore.mtimeMs)
    await expect(stat(historyDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
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
