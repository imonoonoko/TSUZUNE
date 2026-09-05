import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VaultMcpService } from '../src/mcp/service'

describe('MCP link operations (suggest_links / add_link / move preflight)', () => {
  let root = ''
  let service: VaultMcpService

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tsuzune-linkops-'))
    await mkdir(join(root, 'Projects'))
    await mkdir(join(root, 'Knowledge'))
    await mkdir(join(root, 'Recipes'))
    await writeFile(
      join(root, 'Home.md'),
      [
        '# Home',
        '',
        'AIエージェントのContext-Sidecar構想とTSUZUNEを調査する。',
        '',
        '関連: [[Projects/TSUZUNE]]'
      ].join('\n'),
      'utf8'
    )
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\n\nローカルMarkdownメモアプリ。',
      'utf8'
    )
    await writeFile(
      join(root, 'Knowledge', 'Context-Sidecar.md'),
      '# Context-Sidecar\n\nAIエージェントの文脈最適化。',
      'utf8'
    )
    await writeFile(
      join(root, 'Recipes', 'Ramen.md'),
      '# Ramen\n\n醤油ラーメンが好き。',
      'utf8'
    )
    service = new VaultMcpService({ explicitVaultPath: root })
  })

  afterEach(async () => {
    const { rm } = await import('node:fs/promises')
    await rm(root, { recursive: true, force: true })
  })

  it('suggests a directly mentioned related note and excludes already-linked notes', async () => {
    const result = await service.suggestLinks('Home.md')
    const targets = result.candidates.map((candidate) => candidate.target)

    expect(targets).toContain('Knowledge/Context-Sidecar.md')
    expect(targets).not.toContain('Projects/TSUZUNE.md')
    expect(targets).not.toContain('Recipes/Ramen.md')
    expect(result.candidates.length).toBeLessThanOrEqual(5)
    for (const candidate of result.candidates) {
      expect(candidate.confidence).toBeGreaterThanOrEqual(0.55)
      expect(candidate.already_linked).toBe(false)
      expect(candidate.evidence.length).toBeGreaterThan(0)
      expect(candidate.source).toBe('Home.md')
    }
  })

  it('does not surface candidates for weak evidence alone', async () => {
    const result = await service.suggestLinks('Recipes/Ramen.md')
    expect(
      result.candidates.some(
        (candidate) => candidate.target === 'Knowledge/Context-Sidecar.md'
      )
    ).toBe(false)
  })

  it('is read-only: no note content or note set changes after a suggestion call', async () => {
    async function markdownPaths(directory: string): Promise<string[]> {
      const entries = await readdir(directory, { withFileTypes: true })
      const paths: string[] = []
      for (const entry of entries) {
        if (entry.name.startsWith('.')) {
          continue
        }
        const absolute = join(directory, entry.name)
        if (entry.isDirectory()) {
          for (const child of await markdownPaths(absolute)) {
            paths.push(join(entry.name, child))
          }
        } else if (entry.name.endsWith('.md')) {
          paths.push(entry.name)
        }
      }
      return paths.sort()
    }

    const notesBefore = await markdownPaths(root)
    const homeBefore = await readFile(join(root, 'Home.md'), 'utf8')

    await service.suggestLinks('Home.md', { maxCandidates: 3 })

    expect(await markdownPaths(root)).toEqual(notesBefore)
    expect(await readFile(join(root, 'Home.md'), 'utf8')).toBe(homeBefore)
  })

  it('adds one Wiki link onto an existing 関連: line and keeps the rest unchanged', async () => {
    const before = await service.fetch('Home.md')
    const added = await service.addLink(
      'Home.md',
      'Knowledge/Context-Sidecar.md',
      { reason: 'リンクテスト' }
    )

    expect(added.link).toBe('[[Knowledge/Context-Sidecar]]')
    expect(added.strategy).toBe('関連行に追記')
    expect(added.new_revision).toBeDefined()
    expect(added.new_revision).not.toBe(before.metadata.revision)
    expect(added.previous_revision).toBe(before.metadata.revision)

    const content = await readFile(join(root, 'Home.md'), 'utf8')
    expect(content).toContain(
      '関連: [[Projects/TSUZUNE]] / [[Knowledge/Context-Sidecar]]'
    )
    expect(content.startsWith('# Home')).toBe(true)
    expect(content).toContain('AIエージェントのContext-Sidecar構想とTSUZUNEを調査する。')

    expect('history_path' in added).toBe(false)
  })

  it('appends a 関連: line at the end when the note has none', async () => {
    await writeFile(
      join(root, 'Notes.md'),
      '# Notes\n\n本文。\n\n```\nコード\n```\n',
      'utf8'
    )
    const added = await service.addLink('Notes.md', 'Projects/TSUZUNE.md')

    expect(added.strategy).toBe('末尾に追加')
    const content = await readFile(join(root, 'Notes.md'), 'utf8')
    expect(content).toBe(
      '# Notes\n\n本文。\n\n```\nコード\n```\n\n関連: [[Projects/TSUZUNE]]\n'
    )
  })

  it('refuses a duplicate link without changing anything', async () => {
    await service.addLink('Home.md', 'Knowledge/Context-Sidecar.md')
    const before = await readFile(join(root, 'Home.md'), 'utf8')

    await expect(
      service.addLink('Home.md', 'Knowledge/Context-Sidecar.md')
    ).rejects.toThrow('既にリンクされています')
    expect(await readFile(join(root, 'Home.md'), 'utf8')).toBe(before)
    await expect(stat(join(root, '50_履歴', 'AI更新'))).rejects.toThrow()
  })

  it('refuses missing source, missing target, and outside-Vault paths', async () => {
    await expect(
      service.addLink('Projects/Nope.md', 'Knowledge/Context-Sidecar.md')
    ).rejects.toThrow('ノートが見つかりません')
    await expect(
      service.addLink('Home.md', 'Knowledge/Missing.md')
    ).rejects.toThrow('リンク対象のノートが見つかりません')
    await expect(
      service.addLink('../outside.md', 'Knowledge/Context-Sidecar.md')
    ).rejects.toThrow()
    await expect(
      service.addLink('Home.md', '../outside.md')
    ).rejects.toThrow()
  })

  it('refuses non-Markdown sources', async () => {
    await writeFile(join(root, 'Plain.txt'), 'plain text', 'utf8')
    await expect(
      service.addLink('Plain.txt', 'Projects/TSUZUNE.md')
    ).rejects.toThrow('Vault内のMarkdownノートの相対パス')
  })

  it('refuses AI-immutable source notes', async () => {
    await mkdir(join(root, '40_情報源'))
    await writeFile(
      join(root, '40_情報源', 'Source.md'),
      '# Source\n\n原典。',
      'utf8'
    )
    await expect(
      service.addLink('40_情報源/Source.md', 'Projects/TSUZUNE.md')
    ).rejects.toThrow('AIから変更できないノートです')
  })

  it('rejects a stale revision and leaves no partial state', async () => {
    const fetched = await service.fetch('Home.md')
    await writeFile(
      join(root, 'Home.md'),
      '# Home\n\n外部から変更された。',
      'utf8'
    )

    await expect(
      service.addLink('Home.md', 'Knowledge/Context-Sidecar.md', {
        expectedRevision: fetched.metadata.revision
      })
    ).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    expect(await readFile(join(root, 'Home.md'), 'utf8')).toBe(
      '# Home\n\n外部から変更された。'
    )
    await expect(readdir(join(root, '50_履歴'))).rejects.toThrow()
  })

  it('rejects linking a note to itself', async () => {
    await expect(service.addLink('Home.md', 'Home.md')).rejects.toThrow(
      '自分自身へのリンク'
    )
  })

})
