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
    const history = await readFile(
      join(root, autonomous.provenance.history_path),
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
    expect(updated.provenance.history_path).toMatch(
      /^50_履歴\/AI更新\/.*\.md$/
    )
    expect(await readFile(join(root, 'Projects/TSUZUNE.md'), 'utf8')).toContain(
      'NotebookLMで確認した連携方針'
    )

    const history = await readFile(join(root, updated.provenance.history_path), 'utf8')
    expect(history).toContain('kind: ai_revision')
    expect(history).toContain('target: Projects/TSUZUNE.md')
    expect(history).toContain('調査結果を知識ノートへ反映')
    expect(history).toContain('NotebookLM/research-package-001.md')
    expect(history).toContain('AI連携を試す。')
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
