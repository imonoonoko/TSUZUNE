import { describe, expect, it } from 'vitest'
import {
  buildNoteCreationPath,
  extractWikiLinks,
  getBacklinks,
  getOutgoingLinks,
  resolveWikiLink,
  transformWikiLinksForPreview
} from '../src/core/links'
import { compilePathAliases } from '../src/core/path-aliases'
import type { NoteDocument } from '../src/shared/types'

function note(path: string, content = ''): NoteDocument {
  const fileName = path.split('/').at(-1) ?? path
  return {
    path,
    name: fileName.replace(/\.md$/i, ''),
    content,
    modifiedAt: 0,
    size: Buffer.byteLength(content)
  }
}

describe('Wiki link parsing', () => {
  it('extracts links from prose while excluding inline code and fenced code blocks', () => {
    const markdown = [
      '本文の [[公開ノート]] と [[方針|表示名]]。',
      '`[[インラインコード]]`',
      '```md',
      '[[バッククォート内]]',
      '```',
      '~~~',
      '[[チルダ内]]',
      '~~~',
      '最後に [[開発/実装]]。'
    ].join('\n')

    expect(extractWikiLinks(markdown)).toEqual([
      { raw: '[[公開ノート]]', target: '公開ノート', alias: null },
      { raw: '[[方針|表示名]]', target: '方針', alias: '表示名' },
      { raw: '[[開発/実装]]', target: '開発/実装', alias: null }
    ])
  })

  it('transforms visible links for preview without touching code', () => {
    const markdown = '[[方針|表示名]] と `[[コード]]`'
    expect(transformWikiLinksForPreview(markdown)).toBe(
      '[表示名](#/wiki/%E6%96%B9%E9%87%9D) と `[[コード]]`'
    )
  })

  it('marks embedded Wiki links as Vault assets for preview', () => {
    expect(transformWikiLinksForPreview('![[attachments/diagram.svg|構成図]]')).toBe(
      '![構成図](#/vault-asset/attachments%2Fdiagram.svg)'
    )
  })
})

describe('Wiki link resolution', () => {
  const notes = [
    note('開発/方針.md'),
    note('仕事/議事録.md'),
    note('個人/議事録.md')
  ]

  it('distinguishes unique, missing, and ambiguous note-name targets', () => {
    expect(resolveWikiLink('方針', notes)).toMatchObject({
      status: 'resolved',
      resolvedPath: '開発/方針.md',
      candidates: ['開発/方針.md']
    })
    expect(resolveWikiLink('存在しない', notes)).toMatchObject({
      status: 'missing',
      candidates: []
    })
    expect(resolveWikiLink('議事録', notes)).toMatchObject({
      status: 'ambiguous',
      candidates: ['仕事/議事録.md', '個人/議事録.md']
    })
  })

  it('uses an explicit relative path to disambiguate a note', () => {
    expect(resolveWikiLink('個人/議事録', notes)).toMatchObject({
      status: 'resolved',
      resolvedPath: '個人/議事録.md'
    })
  })

  it('resolves old full paths, basenames, and fragments through live aliases', () => {
    const renamedNotes = [note('30_知識/新しい名前.md')]
    const aliases = compilePathAliases({
      '旧分類/古い名前.md': '30_知識/新しい名前.md'
    })

    for (const target of [
      '旧分類/古い名前',
      '古い名前',
      '旧分類/古い名前#見出し',
      '古い名前#^block-id'
    ]) {
      expect(resolveWikiLink(target, renamedNotes, aliases)).toMatchObject({
        status: 'resolved',
        resolvedPath: '30_知識/新しい名前.md'
      })
    }
    expect(
      getOutgoingLinks('[[古い名前#見出し]]', renamedNotes, aliases)
    ).toMatchObject([{ resolvedPath: '30_知識/新しい名前.md' }])
    expect(
      getBacklinks(
        '30_知識/新しい名前.md',
        [...renamedNotes, note('入口.md', '[[旧分類/古い名前]]')],
        aliases
      ).map((item) => item.path)
    ).toEqual(['入口.md'])
  })

  it('prefers live notes and rejects missing or ambiguous alias terminals', () => {
    const aliases = compilePathAliases({
      '旧分類/同名.md': '新分類/一.md',
      '別の旧分類/同名.md': '新分類/二.md',
      '消えた旧名.md': '新分類/欠損.md'
    })
    const renamedNotes = [
      note('旧分類/同名.md'),
      note('新分類/一.md'),
      note('新分類/二.md')
    ]

    expect(resolveWikiLink('旧分類/同名', renamedNotes, aliases)).toMatchObject({
      status: 'resolved',
      resolvedPath: '旧分類/同名.md'
    })
    expect(resolveWikiLink('同名', renamedNotes, aliases)).toMatchObject({
      status: 'resolved',
      resolvedPath: '旧分類/同名.md'
    })
    expect(resolveWikiLink('消えた旧名', renamedNotes, aliases)).toMatchObject({
      status: 'missing'
    })

    const withoutLiveOldPath = renamedNotes.slice(1)
    expect(resolveWikiLink('同名', withoutLiveOldPath, aliases)).toMatchObject({
      status: 'ambiguous',
      candidates: ['新分類/一.md', '新分類/二.md']
    })
  })

  it.each(['../秘密', 'C:\\秘密', '/絶対パス', 'CON'])(
    'marks an unsafe target as invalid: %s',
    (target) => {
      expect(resolveWikiLink(target, notes)).toMatchObject({
        status: 'invalid',
        candidates: []
      })
      expect(buildNoteCreationPath('開発/方針.md', target)).toBeNull()
    }
  )

  it('deduplicates outgoing links and derives backlinks only from active prose', () => {
    const linkedNotes = [
      note('方針.md'),
      note('概要.md', '[[方針]] と、もう一度 [[方針]]'),
      note('コード例.md', '```\n[[方針]]\n```')
    ]

    expect(getOutgoingLinks(linkedNotes[1].content, linkedNotes)).toHaveLength(1)
    expect(getBacklinks('方針.md', linkedNotes).map((item) => item.path)).toEqual([
      '概要.md'
    ])
  })

  it('does not report embedded attachments as missing note links', () => {
    expect(
      getOutgoingLinks('![[attachments/diagram.svg]]', [note('Home.md')])
    ).toEqual([])
  })
})
