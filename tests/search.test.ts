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
})
