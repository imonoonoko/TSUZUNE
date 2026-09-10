import { describe, expect, it } from 'vitest'
import type { NoteDocument } from '../src/shared/types'
import { buildPropertyInventory } from '../src/core/property-inventory'

function note(path: string, content: string): NoteDocument {
  return { path, name: path.split('/').pop() ?? path, content, modifiedAt: 0, size: content.length }
}

describe('property inventory core', () => {
  it('summarizes visible notes deterministically without retaining values', () => {
    const notes = [
      note('zeta.md', '\uFEFF---\r\ntitle: Hello # comment\r\ncount: 2\r\ndone: true\r\ntags: []\r\nempty:\r\n---\r\n# Body\r\n'),
      note('alpha.md', ['---', 'count: text', 'tags:', '  - three', '---', '# Body'].join('\n')),
      note('compact.md', ['---', 'compact:value', '---', 'Body'].join('\n')),
      note('unsupported.md', ['---', 'mapping: { label: value }', '---', 'Body'].join('\n')),
      note('nested.md', ['---', 'nested:', '  label: value', '---', 'Body'].join('\n')),
      note('malformed.md', ['---', 'broken: "unterminated', '---', 'Body'].join('\n')),
      note('warning.md', ['---', 'warning: okay', '  broken', '---', 'Body'].join('\n')),
      note('no-frontmatter.md', '# Body')
    ]

    expect(buildPropertyInventory(notes)).toEqual({
      scope: 'visible-snapshot',
      noteCount: 8,
      frontmatterNoteCount: 7,
      entries: [
        {
          name: 'broken',
          noteCount: 1,
          shapeCounts: { malformed: 1 },
          status: 'malformed',
          samplePaths: ['malformed.md']
        },
        {
          name: 'compact',
          noteCount: 1,
          shapeCounts: { malformed: 1 },
          status: 'malformed',
          samplePaths: ['compact.md']
        },
        {
          name: 'count',
          noteCount: 2,
          shapeCounts: { number: 1, text: 1 },
          status: 'mixed-types',
          samplePaths: ['alpha.md', 'zeta.md']
        },
        {
          name: 'done',
          noteCount: 1,
          shapeCounts: { checkbox: 1 },
          status: 'consistent',
          samplePaths: ['zeta.md']
        },
        {
          name: 'empty',
          noteCount: 1,
          shapeCounts: { null: 1 },
          status: 'empty-values',
          samplePaths: ['zeta.md']
        },
        {
          name: 'mapping',
          noteCount: 1,
          shapeCounts: { unsupported: 1 },
          status: 'unsupported',
          samplePaths: ['unsupported.md']
        },
        {
          name: 'nested',
          noteCount: 1,
          shapeCounts: { unsupported: 1 },
          status: 'unsupported',
          samplePaths: ['nested.md']
        },
        {
          name: 'tags',
          noteCount: 2,
          shapeCounts: { list: 1, null: 1 },
          status: 'empty-values',
          samplePaths: ['alpha.md', 'zeta.md']
        },
        {
          name: 'title',
          noteCount: 1,
          shapeCounts: { text: 1 },
          status: 'consistent',
          samplePaths: ['zeta.md']
        },
        {
          name: 'warning',
          noteCount: 1,
          shapeCounts: { malformed: 1 },
          status: 'malformed',
          samplePaths: ['warning.md']
        }
      ]
    })
    expect(notes[0].content).toContain('title: Hello # comment')
    expect(JSON.stringify(buildPropertyInventory(notes))).not.toContain('Hello')
  })

  it('caps sorted sample paths at five', () => {
    const notes = ['f', 'b', 'e', 'a', 'd', 'c'].map((name) =>
      note(`${name}.md`, ['---', 'status: ready', '---', 'Body'].join('\n'))
    )

    expect(buildPropertyInventory(notes).entries[0].samplePaths).toEqual([
      'a.md',
      'b.md',
      'c.md',
      'd.md',
      'e.md'
    ])
  })
})
