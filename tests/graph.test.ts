import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildWikiGraph,
  buildWikiGraphForView,
  excludeWikiGraphPaths,
  filterWikiGraph,
  getLocalWikiGraph,
  getVaultWikiGraph
} from '../src/core/graph'
import { compilePathAliases } from '../src/core/path-aliases'
import type { NoteDocument, VaultAttachment } from '../src/shared/types'

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

const GRAPH_PARITY_FIXTURE_PATHS = [
  '00_Home.md',
  '10_projects/Project Alpha.md',
  '10_projects/Project Beta.md',
  '20_knowledge/Distillation.md',
  '20_knowledge/Reference.md',
  '80_excluded/Hidden.md',
  '90_orphan/Orphan.md'
] as const

function graphParityFixtureNotes(): NoteDocument[] {
  return GRAPH_PARITY_FIXTURE_PATHS.map((path) =>
    note(
      path,
      readFileSync(
        new URL(
          `../fixtures/obsidian-graph-parity-vault/${path}`,
          import.meta.url
        ),
        'utf8'
      )
    )
  )
}

function existingNode(path: string, name: string) {
  return { path, name, kind: 'note' as const, exists: true as const }
}

function tagNode(tag: string) {
  return {
    path: `tag:${tag}`,
    name: tag,
    kind: 'tag' as const,
    exists: true as const
  }
}

function attachment(path: string): VaultAttachment {
  return {
    path,
    name: path.split('/').at(-1) ?? path,
    modifiedAt: 1,
    createdAt: null,
    size: 10
  }
}

function attachmentNode(path: string) {
  return {
    path,
    name: path.split('/').at(-1) ?? path,
    kind: 'attachment' as const,
    exists: true as const,
    createdAt: null
  }
}

describe('Wiki graph', () => {
  it('builds the Vault graph only while the graph view is visible', () => {
    const notes = [
      note('A.md', '[[B]]'),
      note('B.md'),
      note('孤立.md')
    ]

    expect(buildWikiGraphForView(notes, 'edit')).toEqual({
      nodes: [],
      edges: []
    })
    expect(buildWikiGraphForView(notes, 'preview')).toEqual({
      nodes: [],
      edges: []
    })
    expect(buildWikiGraphForView(notes, 'graph')).toEqual({
      nodes: [
        existingNode('A.md', 'A'),
        existingNode('B.md', 'B'),
        existingNode('孤立.md', '孤立')
      ],
      edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
    })

    const notesWithMissingLink = [note('A.md', '[[未作成]]')]
    expect(
      buildWikiGraphForView(notesWithMissingLink, 'graph', {
        includeUnresolved: true
      })
    ).toEqual({
      nodes: [
        existingNode('A.md', 'A'),
        {
          path: '未作成',
          name: '未作成',
          kind: 'unresolved',
          exists: false
        }
      ],
      edges: [{ sourcePath: 'A.md', targetPath: '未作成' }]
    })
  })

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
        existingNode('個人/議事録.md', '議事録'),
        existingNode('仕事/議事録.md', '議事録'),
        existingNode('知識/方針.md', '方針'),
        existingNode('入口.md', '入口')
      ],
      edges: [{ sourcePath: '入口.md', targetPath: '知識/方針.md' }]
    })
  })

  it('optionally distinguishes unresolved Wiki links from existing Markdown notes', () => {
    const notes = [
      note(
        '入口.md',
        [
          '[[知識/既存]]',
          '[[未作成]]',
          '[[未作成|別名]]',
          '[[予定/あとで作る]]',
          '[[議事録]]',
          '[[入口]]',
          '[[../危険]]'
        ].join('\n')
      ),
      note('知識/既存.md'),
      note('仕事/議事録.md'),
      note('個人/議事録.md'),
      note('孤立.md')
    ]

    const defaultGraph = buildWikiGraph(notes)
    expect(defaultGraph.nodes.every((node) => node.kind === 'note')).toBe(true)
    expect(defaultGraph.nodes.every((node) => node.exists === true)).toBe(true)
    expect(defaultGraph.nodes.some((node) => node.path === '未作成')).toBe(false)

    expect(buildWikiGraph(notes, { includeUnresolved: true })).toEqual({
      nodes: [
        { path: '個人/議事録.md', name: '議事録', kind: 'note', exists: true },
        { path: '孤立.md', name: '孤立', kind: 'note', exists: true },
        { path: '仕事/議事録.md', name: '議事録', kind: 'note', exists: true },
        { path: '知識/既存.md', name: '既存', kind: 'note', exists: true },
        { path: '入口.md', name: '入口', kind: 'note', exists: true },
        { path: '未作成', name: '未作成', kind: 'unresolved', exists: false },
        { path: '予定/あとで作る', name: 'あとで作る', kind: 'unresolved', exists: false }
      ],
      edges: [
        { sourcePath: '入口.md', targetPath: '知識/既存.md' },
        { sourcePath: '入口.md', targetPath: '未作成' },
        { sourcePath: '入口.md', targetPath: '予定/あとで作る' }
      ]
    })
  })

  it('resolves heading and block links to their existing Markdown note', () => {
    const notes = [
      note('入口.md', '[[Note#Heading]]\n[[Note#^block-id]]'),
      note('Note.md')
    ]

    expect(buildWikiGraph(notes, { includeUnresolved: true })).toEqual({
      nodes: [
        existingNode('Note.md', 'Note'),
        existingNode('入口.md', '入口')
      ],
      edges: [{ sourcePath: '入口.md', targetPath: 'Note.md' }]
    })
  })

  it('optionally adds Markdown tags as shared graph nodes', () => {
    const notes = [
      note('A.md', '#project/tsuzune #design'),
      note('B.md', 'tags: [design]\n---\n#project/tsuzune')
    ]

    expect(buildWikiGraph(notes).nodes).toEqual([
      existingNode('A.md', 'A'),
      existingNode('B.md', 'B')
    ])
    expect(buildWikiGraph(notes, { includeTags: true })).toEqual({
      nodes: [
        existingNode('A.md', 'A'),
        existingNode('B.md', 'B'),
        tagNode('#design'),
        tagNode('#project/tsuzune')
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'tag:#design' },
        { sourcePath: 'A.md', targetPath: 'tag:#project/tsuzune' },
        { sourcePath: 'B.md', targetPath: 'tag:#project/tsuzune' }
      ]
    })
  })

  it('resolves supported attachments without inventing Markdown notes', () => {
    const notes = [
      note(
        'A.md',
        '![[assets/diagram.svg]]\n[[poster.png]]\n[[missing.png]]'
      )
    ]
    const attachments = [
      attachment('assets/diagram.svg'),
      attachment('media/poster.png'),
      attachment('orphan.pdf')
    ]

    const hidden = buildWikiGraph(notes, {
      includeUnresolved: true,
      attachments
    })
    expect(hidden).toEqual({
      nodes: [existingNode('A.md', 'A')],
      edges: []
    })
    expect(hidden.nodes.some((node) => node.path.endsWith('.png.md'))).toBe(
      false
    )

    const shown = buildWikiGraph(notes, {
      includeUnresolved: true,
      includeAttachments: true,
      attachments
    })
    expect(shown).toEqual({
      nodes: [
        existingNode('A.md', 'A'),
        attachmentNode('assets/diagram.svg'),
        attachmentNode('media/poster.png'),
        {
          path: 'missing.png',
          name: 'missing.png',
          kind: 'unresolved',
          exists: false
        },
        attachmentNode('orphan.pdf')
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'assets/diagram.svg' },
        { sourcePath: 'A.md', targetPath: 'media/poster.png' },
        { sourcePath: 'A.md', targetPath: 'missing.png' }
      ]
    })
    expect(getLocalWikiGraph(shown, 'A.md').nodes).toEqual([
      existingNode('A.md', 'A'),
      attachmentNode('assets/diagram.svg'),
      attachmentNode('media/poster.png'),
      {
        path: 'missing.png',
        name: 'missing.png',
        kind: 'unresolved',
        exists: false
      }
    ])
    expect(getVaultWikiGraph(shown, 'A.md', false).nodes).not.toContainEqual(
      attachmentNode('orphan.pdf')
    )
  })

  it('keeps missing attachment paths while excluding ambiguous and invalid targets', () => {
    const notes = [
      note(
        'A.md',
        [
          '![[attachments/diagram.svg]]',
          '[[diagram.svg]]',
          '[[../outside.svg]]'
        ].join('\n')
      )
    ]
    const graph = buildWikiGraph(notes, {
      includeAttachments: true,
      includeUnresolved: true,
      attachments: [
        attachment('20_knowledge/diagram.svg'),
        attachment('other/diagram.svg')
      ]
    })

    expect(graph.nodes).toEqual([
      attachmentNode('20_knowledge/diagram.svg'),
      existingNode('A.md', 'A'),
      {
        path: 'attachments/diagram.svg',
        name: 'diagram.svg',
        kind: 'unresolved',
        exists: false
      },
      attachmentNode('other/diagram.svg')
    ])
    expect(graph.edges).toEqual([
      { sourcePath: 'A.md', targetPath: 'attachments/diagram.svg' }
    ])
  })

  it('resolves graph links from an index without rescanning the note array', () => {
    const notes = [
      note('入口.md', '[[知識/方針]]\n[[単独名]]\n[[未作成]]'),
      note('知識/方針.md'),
      note('資料/単独名.md'),
      note('孤立.md')
    ]
    const rejectFullScan = (): never => {
      throw new Error('graph link resolution must not rescan the note array')
    }
    Object.defineProperties(notes, {
      find: { value: rejectFullScan },
      filter: { value: rejectFullScan }
    })

    expect(buildWikiGraph(notes)).toEqual({
      nodes: [
        existingNode('孤立.md', '孤立'),
        existingNode('資料/単独名.md', '単独名'),
        existingNode('知識/方針.md', '方針'),
        existingNode('入口.md', '入口')
      ],
      edges: [
        { sourcePath: '入口.md', targetPath: '資料/単独名.md' },
        { sourcePath: '入口.md', targetPath: '知識/方針.md' }
      ]
    })
  })

  it('connects old aliased links to the canonical node without an alias node', () => {
    const notes = [
      note('入口.md', '[[旧分類/旧名#見出し]]'),
      note('30_知識/新名.md')
    ]
    const graph = buildWikiGraph(notes, {
      includeUnresolved: true,
      pathAliases: compilePathAliases({
        '旧分類/旧名.md': '30_知識/新名.md'
      })
    })

    expect(graph.nodes).toEqual([
      existingNode('30_知識/新名.md', '新名'),
      existingNode('入口.md', '入口')
    ])
    expect(graph.edges).toEqual([
      { sourcePath: '入口.md', targetPath: '30_知識/新名.md' }
    ])
  })

  it('keeps direct incoming and outgoing links while hiding neighbor links by default', () => {
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
        existingNode('A.md', 'A'),
        existingNode('B.md', 'B'),
        existingNode('C.md', 'C')
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'C.md', targetPath: 'A.md' }
      ]
    })

    expect(getLocalWikiGraph(buildWikiGraph(notes), 'F.md')).toEqual({
      nodes: [existingNode('F.md', 'F')],
      edges: []
    })
  })

  it('applies Local Graph outgoing, incoming, and neighbor-link filters', () => {
    const graph = buildWikiGraph([
      note('A.md', '[[B]]'),
      note('B.md', '[[C]]'),
      note('C.md', '[[A]]'),
      note('D.md')
    ])

    expect(
      getLocalWikiGraph(graph, 'A.md', {
        outgoingLinks: true,
        incomingLinks: false,
        neighborLinks: false
      })
    ).toEqual({
      nodes: [existingNode('A.md', 'A'), existingNode('B.md', 'B')],
      edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
    })

    expect(
      getLocalWikiGraph(graph, 'A.md', {
        outgoingLinks: false,
        incomingLinks: true,
        neighborLinks: false
      })
    ).toEqual({
      nodes: [existingNode('A.md', 'A'), existingNode('C.md', 'C')],
      edges: [{ sourcePath: 'C.md', targetPath: 'A.md' }]
    })

    expect(
      getLocalWikiGraph(graph, 'A.md', {
        outgoingLinks: true,
        incomingLinks: true,
        neighborLinks: true
      })
    ).toEqual({
      nodes: [
        existingNode('A.md', 'A'),
        existingNode('B.md', 'B'),
        existingNode('C.md', 'C')
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'B.md', targetPath: 'C.md' },
        { sourcePath: 'C.md', targetPath: 'A.md' }
      ]
    })
  })

  it('never expands the local graph beyond direct connections', () => {
    const notes = [
      note('A.md', '[[B]]'),
      note('B.md', '[[C]]'),
      note('C.md')
    ]

    expect(getLocalWikiGraph(buildWikiGraph(notes), 'A.md')).toEqual({
      nodes: [
        existingNode('A.md', 'A'),
        existingNode('B.md', 'B')
      ],
      edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
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
        existingNode('A.md', 'A'),
        existingNode('B.md', 'B'),
        existingNode('C.md', 'C'),
        existingNode('D.md', 'D')
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'C.md', targetPath: 'D.md' }
      ]
    })

    expect(getVaultWikiGraph(graph, 'A.md', true).nodes).toContainEqual(
      existingNode('孤立.md', '孤立')
    )
    expect(getVaultWikiGraph(graph, '孤立.md', false).nodes).toContainEqual(
      existingNode('孤立.md', '孤立')
    )
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
        existingNode('開発/ONOKO.md', 'ONOKO'),
        existingNode('入口.md', '入口'),
        existingNode('保管/ONOKO旧版.md', 'ONOKO旧版')
      ],
      edges: [{ sourcePath: '入口.md', targetPath: '開発/ONOKO.md' }]
    })

    expect(filterWikiGraph(graph, '入口.md', '資料/')).toEqual({
      nodes: [
        existingNode('資料/設計書.md', '設計書'),
        existingNode('入口.md', '入口')
      ],
      edges: [{ sourcePath: '入口.md', targetPath: '資料/設計書.md' }]
    })

    expect(filterWikiGraph(graph, '入口.md', '   ')).toBe(graph)
  })

  it('removes excluded existing files without turning them into unresolved nodes', () => {
    const graph = buildWikiGraph(
      [
        note(
          'A.md',
          '[[80_excluded/Hidden]] [[Missing Note]] #visible-tag'
        ),
        note('80_excluded/Hidden.md', '#hidden-tag')
      ],
      { includeUnresolved: true, includeTags: true }
    )

    expect(
      excludeWikiGraphPaths(graph, (path) => path.startsWith('80_excluded/'))
    ).toEqual({
      nodes: [
        existingNode('A.md', 'A'),
        {
          path: 'Missing Note',
          name: 'Missing Note',
          kind: 'unresolved',
          exists: false
        },
        tagNode('#visible-tag')
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'Missing Note' },
        { sourcePath: 'A.md', targetPath: 'tag:#visible-tag' }
      ]
    })
  })

  it('matches the Obsidian unresolved-node sets for malformed graph queries', () => {
    const projectNodePaths = [
      '00_Home.md',
      '10_projects/Project Alpha.md',
      '10_projects/Project Beta.md',
      '20_knowledge/Distillation.md',
      'Missing Note'
    ]
    const allNodePaths = [
      '00_Home.md',
      '10_projects/Project Alpha.md',
      '10_projects/Project Beta.md',
      '20_knowledge/Distillation.md',
      '20_knowledge/Reference.md',
      '80_excluded/Hidden.md',
      '90_orphan/Orphan.md',
      'Missing Note'
    ]
    const cases: Array<[string, string[]]> = [
      ['"Project', projectNodePaths],
      ['Project OR', projectNodePaths],
      ['(Project', projectNodePaths],
      ['/Project', projectNodePaths],
      ['[status:Act', []],
      ['/(?/', allNodePaths],
      ['(', []]
    ]
    const notes = graphParityFixtureNotes()
    const graph = buildWikiGraph(notes, { includeUnresolved: true })

    for (const [query, expectedNodePaths] of cases) {
      const nodePaths = filterWikiGraph(graph, null, query, notes).nodes.map(
        (node) => node.path
      )
      expect(nodePaths, query).toEqual(expectedNodePaths)
    }
  })

  it('uses Obsidian search operators against note content and tags', () => {
    const notes = [
      note('入口.md', '[[設計]]'),
      note('設計.md', 'The whisky analogy. #project/tsuzune'),
      note('保管.md', 'old material #archive')
    ]
    const graph = buildWikiGraph(notes, { includeTags: true })

    expect(
      filterWikiGraph(graph, null, 'content:"whisky analogy"', notes).nodes
    ).toEqual([existingNode('設計.md', '設計')])
    expect(filterWikiGraph(graph, null, 'tag:#archive', notes).nodes).toEqual([
      tagNode('#archive'),
      existingNode('保管.md', '保管')
    ])
  })

})
