import { describe, expect, it } from 'vitest'
import type { WikiGraphNode } from '../src/core/graph'
import { getGraphNodeGroupColor } from '../src/core/graph-groups'
import { parseGraphGroups } from '../src/shared/graph-groups'
import type { GraphGroup, NoteDocument } from '../src/shared/types'

const notes: NoteDocument[] = [
  {
    path: 'Projects/TSUZUNE.md',
    name: 'TSUZUNE',
    content: '# TSUZUNE\n\n#project/tsuzune graph roadmap',
    modifiedAt: 1,
    size: 42
  }
]

describe('Obsidian graph groups', () => {
  it('uses the first matching query for file-backed notes and attachments', () => {
    const groups: GraphGroup[] = [
      { id: 'projects', query: 'tag:#project/tsuzune', color: '#e57373' },
      { id: 'all-notes', query: 'file:TSUZUNE', color: '#64b5f6' },
      { id: 'tags', query: 'tag:#project/tsuzune', color: '#08b94e' },
      { id: 'attachments', query: 'path:assets', color: '#e0ac00' }
    ]

    expect(
      getGraphNodeGroupColor(
        {
          path: 'Projects/TSUZUNE.md',
          name: 'TSUZUNE',
          kind: 'note'
        },
        groups,
        notes
      )
    ).toBe('#e57373')
    expect(
      getGraphNodeGroupColor(
        { path: 'tag:#project/tsuzune', name: '#project/tsuzune', kind: 'tag' },
        groups,
        notes
      )
    ).toBeNull()
    expect(
      getGraphNodeGroupColor(
        { path: 'assets/map.png', name: 'map.png', kind: 'attachment' },
        groups,
        notes
      )
    ).toBe('#e0ac00')
    expect(
      getGraphNodeGroupColor(
        { path: 'Missing.md', name: 'Missing', kind: 'unresolved', exists: false },
        [{ id: 'missing', query: 'file:Missing', color: '#ff0000' }],
        notes
      )
    ).toBeNull()
  })

  it('does not treat a blank group query as matching every node', () => {
    const node: WikiGraphNode = { path: 'A.md', name: 'A', kind: 'note' }
    expect(
      getGraphNodeGroupColor(
        node,
        [{ id: 'blank', query: '   ', color: '#ff0000' }],
        []
      )
    ).toBeNull()
  })

  it('parses persisted groups and drops malformed entries', () => {
    expect(
      parseGraphGroups([
        { id: 'one', query: 'path:Projects', color: '#123abc' },
        { id: '', query: 'tag:#idea', color: '#ABCDEF' },
        { id: 'bad-color', query: 'file:A', color: 'red' },
        null
      ])
    ).toEqual([
      { id: 'one', query: 'path:Projects', color: '#123abc' },
      { id: 'graph-group-2', query: 'tag:#idea', color: '#abcdef' }
    ])
  })
})
