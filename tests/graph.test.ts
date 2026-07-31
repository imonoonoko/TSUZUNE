import { describe, expect, it } from 'vitest'
import {
  buildWikiGraph,
  filterWikiGraph,
  getLocalWikiGraph,
  getVaultWikiGraph
} from '../src/core/graph'
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

  it('shows exactly two hops when local depth is 2', () => {
    const notes = [
      note('A.md', '[[B]]'),
      note('B.md', '[[C]]'),
      note('C.md', '[[A]]\n[[D]]'),
      note('D.md', '[[E]]'),
      note('E.md')
    ]

    expect(getLocalWikiGraph(buildWikiGraph(notes), 'A.md', 2)).toEqual({
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'C.md', name: 'C' },
        { path: 'D.md', name: 'D' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'B.md', targetPath: 'C.md' },
        { sourcePath: 'C.md', targetPath: 'A.md' },
        { sourcePath: 'C.md', targetPath: 'D.md' }
      ]
    })
  })

  it('shows the connected Vault graph and includes isolated notes only when requested', () => {
    const graph = buildWikiGraph([
      note('A.md', '[[B]]'),
      note('B.md'),
      note('C.md', '[[D]]'),
      note('D.md'),
      note('孤立.md')
    ])

    expect(getVaultWikiGraph(graph, 'A.md', false)).toEqual({
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'C.md', name: 'C' },
        { path: 'D.md', name: 'D' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'C.md', targetPath: 'D.md' }
      ]
    })

    expect(getVaultWikiGraph(graph, 'A.md', true).nodes).toContainEqual({
      path: '孤立.md',
      name: '孤立'
    })
    expect(getVaultWikiGraph(graph, '孤立.md', false).nodes).toContainEqual({
      path: '孤立.md',
      name: '孤立'
    })
  })

  it('filters by note name or path while keeping the current note and visible edges', () => {
    const graph = buildWikiGraph([
      note('入口.md', '[[開発/ONOKO]]\n[[資料/設計書]]'),
      note('開発/ONOKO.md', '[[資料/設計書]]'),
      note('資料/設計書.md'),
      note('保管/ONOKO旧版.md')
    ])

    expect(filterWikiGraph(graph, '入口.md', 'onoko')).toEqual({
      nodes: [
        { path: '開発/ONOKO.md', name: 'ONOKO' },
        { path: '入口.md', name: '入口' },
        { path: '保管/ONOKO旧版.md', name: 'ONOKO旧版' }
      ],
      edges: [{ sourcePath: '入口.md', targetPath: '開発/ONOKO.md' }]
    })

    expect(filterWikiGraph(graph, '入口.md', '資料/')).toEqual({
      nodes: [
        { path: '資料/設計書.md', name: '設計書' },
        { path: '入口.md', name: '入口' }
      ],
      edges: [{ sourcePath: '入口.md', targetPath: '資料/設計書.md' }]
    })

    expect(filterWikiGraph(graph, '入口.md', '   ')).toBe(graph)
  })
})
