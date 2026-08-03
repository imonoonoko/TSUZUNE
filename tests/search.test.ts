import { describe, expect, it } from 'vitest'
import { searchNotes } from '../src/core/search'
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
