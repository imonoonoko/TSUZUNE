import { describe, expect, it } from 'vitest'
import { searchNotes, searchRendererRanked, segmentJapaneseQuery } from '../src/core/search'
import type { NoteDocument } from '../src/shared/types'

function note(
  path: string,
  content: string,
  modifiedAt = 0
): NoteDocument {
  const fileName = path.split('/').at(-1) ?? path
  return {
    path,
    name: fileName.replace(/\.md$/i, ''),
    content,
    modifiedAt,
    size: Buffer.byteLength(content)
  }
}

describe('note search', () => {
  const notes = [
    note('開発/方針.md', '知識をWikiリンクでつなぐメモ帳です。', 30),
    note('日記/今日.md', '今日は検索画面を試した。', 20),
    note('Archive/Release Notes.md', 'TSUZUNE desktop release', 10)
  ]

  it('finds an unsegmented Japanese substring in note content', () => {
    const results = searchNotes(notes, 'つなぐメモ')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      path: '開発/方針.md',
      name: '方針'
    })
    expect(results[0].excerpt).toContain('つなぐメモ')
  })

  it('searches Japanese paths as well as content', () => {
    expect(searchNotes(notes, '日記').map((result) => result.path)).toEqual([
      '日記/今日.md'
    ])
  })

  it('matches English without case sensitivity and trims the query', () => {
    expect(searchNotes(notes, '  release notes  ').map((result) => result.path)).toEqual([
      'Archive/Release Notes.md'
    ])
  })

  it('returns no results for an empty or missing query', () => {
    expect(searchNotes(notes, '   ')).toEqual([])
    expect(searchNotes(notes, '見つからない')).toEqual([])
  })

  it('resolves graph tag searches against Markdown tags', () => {
    const tagged = [
      note('設計.md', 'UI方針 #design', 20),
      note('実装.md', 'タグなし'),
      note('資料.md', '---\ntags: [design, research]\n---\n資料', 10)
    ]

    expect(searchNotes(tagged, 'tag:#design').map((result) => result.path)).toEqual([
      '設計.md',
      '資料.md'
    ])
  })
})

describe('segmentJapaneseQuery', () => {
  it('splits a natural Japanese sentence on particles and punctuation', () => {
    expect(segmentJapaneseQuery('OpenEvolveって使える？')).toEqual([
      'openevolve',
      '使える'
    ])
    expect(segmentJapaneseQuery('TSUZUNEの検索を良くしたい')).toEqual([
      'tsuzune',
      '検索',
      '良くしたい'
    ])
    expect(segmentJapaneseQuery('本番アップデートは必要？')).toEqual([
      '本番アップデート',
      '必要'
    ])
  })
})

describe('ranked note search', () => {
  const notes = [
    note(
      '30_知識/TSUZUNE-検索・Wikiリンク・Graph.md',
      '検索とWikiリンクとGraphの設計。',
      30
    ),
    note('30_知識/OpenEvolveの評価.md', 'OpenEvolveの評価判断。', 20),
    note('日記/今日.md', '今日は検索画面を試した。', 10)
  ]

  it('ranks a note that matches any segmented term, not all terms', () => {
    const results = searchRendererRanked(notes, 'TSUZUNEの検索を良くしたい')

    expect(results[0]?.path).toBe('30_知識/TSUZUNE-検索・Wikiリンク・Graph.md')
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('still honors a path filter as a mandatory clause', () => {
    const results = searchRendererRanked(notes, 'path:30_知識 OpenEvolve')

    expect(results.map((result) => result.path)).toEqual([
      '30_知識/OpenEvolveの評価.md'
    ])
  })

  it('returns filter-only results when no positive term clause exists', () => {
    const results = searchRendererRanked(notes, 'file:TSUZUNE-検索・Wikiリンク・Graph')

    expect(results.map((result) => result.path)).toEqual([
      '30_知識/TSUZUNE-検索・Wikiリンク・Graph.md'
    ])
  })

  it('requires every whitespace-separated positive term clause to match', () => {
    const results = searchRendererRanked(notes, 'OpenEvolve 評価')

    expect(results.map((result) => result.path)).toEqual([
      '30_知識/OpenEvolveの評価.md'
    ])
  })

  it('filters renderer results by frontmatter category and inline topics', () => {
    const categorized = [
      note('30_知識/設計.md', '設計本文\n---', 30),
      note('30_知識/研究.md', '研究本文', 20),
      note('40_情報源/原典.md', '原典本文', 10)
    ]
    categorized[0].content = '---\ncategory: "知識管理"\ntopics: ["AI", "原典,追跡"]\n---\n設計本文'
    categorized[1].content = '---\ncategory: "知識管理"\ntopics: [research]\n---\n研究本文'
    categorized[2].content = '---\ntype: source\n---\n原典本文'

    expect(searchRendererRanked(categorized, 'category:知識管理').map((r) => r.path)).toEqual([
      '30_知識/設計.md',
      '30_知識/研究.md'
    ])
    expect(searchRendererRanked(categorized, 'category:知識管理')[0]).toMatchObject({
      category: '知識管理',
      topics: ['AI', '原典,追跡']
    })
    expect(searchRendererRanked(categorized, 'topic:"原典,追跡"').map((r) => r.path)).toEqual([
      '30_知識/設計.md'
    ])
    expect(searchRendererRanked(categorized, '知識管理').map((r) => r.path)).toEqual([
      '30_知識/設計.md',
      '30_知識/研究.md'
    ])
    expect(searchRendererRanked(categorized, '設計本文')[0].topics).toEqual([
      'AI',
      '原典,追跡'
    ])
  })

  it('separates reusable knowledge from records with metadata filters', () => {
    const classified = [
      note('30_知識/原則.md', '---\ntype: knowledge\nrole: knowledge\nlifecycle: current\ncategory: 知識管理\n---\n原則'),
      note('30_知識/実施記録.md', '---\ntype: execution-record\nrole: execution-record\nlifecycle: reference\ncategory: 知識管理\n---\n記録')
    ]

    expect(searchRendererRanked(classified, 'category:知識管理 type:knowledge').map((r) => r.path)).toEqual([
      '30_知識/原則.md'
    ])
    expect(searchRendererRanked(classified, 'role:execution-record').map((r) => r.path)).toEqual([
      '30_知識/実施記録.md'
    ])
    expect(searchRendererRanked(classified, 'lifecycle:current').map((r) => r.path)).toEqual([
      '30_知識/原則.md'
    ])
  })

  const padding = 'X'.repeat(200)
  const leadingContext = '…' + 'X'.repeat(45)
  const firstPage = 'X'.repeat(120)
  const excerptCases: [string, string, string, string, string | null][] = [
    ['D01: late segmented match', '再利用の導線', 'cases/entry.md',
      padding + '\n再利用の話。', '…' + 'X'.repeat(44) + ' 再利用の話。'],
    ['D02: preserves an existing phrase', '再利用の導線', 'cases/entry.md',
      '再利用' + padding + '再利用の導線', leadingContext + '再利用の導線'],
    ['D03: preserves excerptQuery after a filter', 'path:cases 再利用の導線', 'cases/entry.md',
      '再利用' + padding + '再利用の導線', leadingContext + '再利用の導線'],
    ['D04: case-insensitive fallback', 'ALPHA BETA', 'cases/ALPHA.md',
      padding + 'bEtA', leadingContext + 'bEtA'],
    ['D05: preserves a quoted space phrase', '"alpha beta" gamma', 'cases/alpha beta.md',
      'alphaZZbeta' + padding + 'gamma', leadingContext + 'gamma'],
    ['D06: existing Japanese quote segmentation', '"再利用の導線"', 'cases/entry.md',
      padding + '再利用', leadingContext + '再利用'],
    ['D07: longest match at the same position', 'anchor abc abcdef', 'cases/anchor.md',
      padding + 'abcdef' + 'Y'.repeat(75) + 'END', leadingContext + 'abcdef' + 'Y'.repeat(75) + '…'],
    ['D08: title-only match', '再利用の導線', 'cases/再利用.md', padding, firstPage],
    ['D09: path-only match', '再利用の導線', 'cases/再利用/entry.md', padding, firstPage],
    ['D10: filter-only keeps its existing excerpt', 'path:cases', 'cases/entry.md',
      padding + 'path:cases', leadingContext + 'path:cases'],
    ['D11: negative-only keeps its existing excerpt', '-secret', 'cases/entry.md', padding, firstPage],
    ['D12: never uses a filter as a fallback term', 'path:cases 再利用の導線 -secret', 'cases/entry.md',
      'cases' + padding + '再利用', leadingContext + '再利用'],
    ['D13: first body position before term order', 'anchor beta gamma', 'cases/anchor.md',
      'gamma' + padding + 'beta', 'gamma' + 'X'.repeat(75) + '…'],
    ['D14: empty query', '', 'cases/entry.md', padding, null],
    ['D15: filter still rejects', 'path:absent 再利用の導線', 'cases/entry.md', padding + '再利用', null],
    ['D16: negation still rejects', '再利用の導線 -secret', 'cases/entry.md', padding + '再利用 secret', null],
    ['D17: a quoted phrase is not split', '"alpha beta"', 'cases/entry.md', padding + 'alphaZZbeta', null],
    ['D18: standalone dash', '-', 'cases/entry.md', padding + '-', null],
    ['D19: start and whitespace boundaries', '再利用の導線', 'cases/entry.md', '再利用\n\n説明', '再利用 説明']
  ]

  it.each(excerptCases)('%s', (_label, query, path, content, expectedExcerpt) => {
    const results = searchRendererRanked([note(path, content)], query)

    if (expectedExcerpt === null) {
      expect(results).toEqual([])
    } else {
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ path, excerpt: expectedExcerpt })
    }
  })

  it('D20: preserves score, time, path order and search metadata', () => {
    const results = searchRendererRanked([
      note('cases/b.md', padding + '再利用', 2),
      note('cases/a.md', padding + '再利用', 2),
      note('cases/old.md', padding + '再利用', 1),
      note('cases/再利用.md', padding, 1),
      note('cases/unrelated.md', padding, 9)
    ], '再利用の導線')

    expect(results.map(({ excerpt, ...metadata }) => metadata)).toEqual([
      { path: 'cases/再利用.md', name: '再利用', modifiedAt: 1, score: 120 },
      { path: 'cases/a.md', name: 'a', modifiedAt: 2, score: 10 },
      { path: 'cases/b.md', name: 'b', modifiedAt: 2, score: 10 },
      { path: 'cases/old.md', name: 'old', modifiedAt: 1, score: 10 }
    ])
  })
})
