import { describe, expect, it } from 'vitest'
import { buildWikiGraph, getLocalWikiGraph } from '../src/core/graph'
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

describe('Wiki graph', () => {
  it('builds unique directed edges only for resolved links', () => {
    const notes = [
      note(
        '入口.md',
        [
          '[[知識/方針]]',
          '[[方針]]',
          '[[未作成]]',
          '[[入口]]',
          '[[議事録]]',
          '```md',
          '[[コード内]]',
          '```'
        ].join('\n')
      ),
      note('知識/方針.md'),
      note('仕事/議事録.md'),
      note('個人/議事録.md')
    ]

    expect(buildWikiGraph(notes)).toEqual({
      nodes: [
        { path: '個人/議事録.md', name: '議事録' },
        { path: '仕事/議事録.md', name: '議事録' },
        { path: '知識/方針.md', name: '方針' },
        { path: '入口.md', name: '入口' }
      ],
      edges: [{ sourcePath: '入口.md', targetPath: '知識/方針.md' }]
    })
  })

  it('keeps the current note, its one-hop neighbors, and edges within that local set', () => {
    const notes = [
      note('A.md', '[[B]]'),
      note('B.md', '[[C]]'),
      note('C.md', '[[A]]'),
      note('D.md', '[[E]]'),
      note('E.md'),
      note('F.md')
    ]

    expect(getLocalWikiGraph(buildWikiGraph(notes), 'A.md')).toEqual({
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'C.md', name: 'C' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'B.md', targetPath: 'C.md' },
        { sourcePath: 'C.md', targetPath: 'A.md' }
      ]
    })

    expect(getLocalWikiGraph(buildWikiGraph(notes), 'F.md')).toEqual({
      nodes: [{ path: 'F.md', name: 'F' }],
      edges: []
    })
  })
})
