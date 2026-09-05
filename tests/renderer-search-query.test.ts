import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseRendererSearchQuery,
  searchNotes,
  searchRendererRanked
} from '../src/core/search'
import type { NoteDocument } from '../src/shared/types'

const fixtureRoot = resolve('fixtures/obsidian-graph-parity-vault')
const fixturePaths = [
  '00_Home.md',
  '10_projects/Project Alpha.md',
  '10_projects/Project Beta.md',
  '20_knowledge/Distillation.md',
  '20_knowledge/Reference.md',
  '80_excluded/Hidden.md',
  '90_orphan/Orphan.md'
]

const notes: NoteDocument[] = fixturePaths.map((path) => {
  const content = readFileSync(resolve(fixtureRoot, path), 'utf8')
  const fileName = path.split('/').at(-1) ?? path
  return {
    path,
    name: fileName.replace(/\.md$/i, ''),
    content,
    modifiedAt: 0,
    size: Buffer.byteLength(content)
  }
})

describe('Renderer search query parser', () => {
  it('parses implicit AND, negation, filters, and phrases', () => {
    expect(
      parseRendererSearchQuery('計画 -"古い 案" TAG:#Project path:"10 Projects" file:Plan')
    ).toEqual([
      { kind: 'term', value: '計画', negated: false },
      { kind: 'term', value: '古い 案', negated: true },
      { kind: 'tag', value: '#Project', negated: false },
      { kind: 'path', value: '10 Projects', negated: false },
      { kind: 'file', value: 'Plan', negated: false }
    ])
  })

  it('keeps empty input and malformed operator tokens closed', () => {
    expect(parseRendererSearchQuery('   ')).toEqual([])
    expect(parseRendererSearchQuery('tag:')).toEqual([
      { kind: 'term', value: 'tag:', negated: false }
    ])
    expect(parseRendererSearchQuery('tag: project')).toEqual([
      { kind: 'tag', value: 'project', negated: false }
    ])
    expect(parseRendererSearchQuery('-')).toEqual([
      { kind: 'term', value: '-', negated: false }
    ])
    expect(parseRendererSearchQuery('owner:Home')).toEqual([
      { kind: 'term', value: 'owner:Home', negated: false }
    ])
    expect(parseRendererSearchQuery('"閉じない phrase')).toEqual([
      { kind: 'term', value: '"閉じない phrase', negated: false }
    ])
    expect(parseRendererSearchQuery('"" tag:""')).toEqual([
      { kind: 'term', value: '""', negated: false },
      { kind: 'term', value: 'tag:""', negated: false }
    ])
  })

  it('preserves Japanese values and operator spelling while matching case-insensitively', () => {
    expect(parseRendererSearchQuery('PATH:知識 TAG:#設計')).toEqual([
      { kind: 'path', value: '知識', negated: false },
      { kind: 'tag', value: '#設計', negated: false }
    ])
  })

  it('parses note-role metadata filters', () => {
    expect(parseRendererSearchQuery('type:knowledge role:source lifecycle:held')).toEqual([
      { kind: 'type', value: 'knowledge', negated: false },
      { kind: 'role', value: 'source', negated: false },
      { kind: 'lifecycle', value: 'held', negated: false }
    ])
  })
})

describe('Renderer search operator integration', () => {
  const tsuZuneExpected: Record<string, string[]> = {
    Project: ['00_Home.md', '10_projects/Project Alpha.md', '10_projects/Project Beta.md', '20_knowledge/Distillation.md'],
    'Project active': ['10_projects/Project Alpha.md'],
    'Project missing': ['00_Home.md'],
    'Project -paused': ['00_Home.md', '10_projects/Project Alpha.md', '20_knowledge/Distillation.md'],
    '-excluded': ['00_Home.md', '10_projects/Project Alpha.md', '10_projects/Project Beta.md', '20_knowledge/Distillation.md', '20_knowledge/Reference.md', '90_orphan/Orphan.md'],
    'tag:project': ['10_projects/Project Alpha.md', '10_projects/Project Beta.md'],
    'tag:#project/active': ['10_projects/Project Alpha.md'],
    'TAG:PROJECT': ['10_projects/Project Alpha.md', '10_projects/Project Beta.md'],
    'path:10_pro': ['10_projects/Project Alpha.md', '10_projects/Project Beta.md'],
    'path:knowledge Distillation': ['20_knowledge/Distillation.md', '20_knowledge/Reference.md'],
    'file:project': ['10_projects/Project Alpha.md', '10_projects/Project Beta.md'],
    'file:alpha': ['10_projects/Project Alpha.md'],
    '"Project Alpha"': ['00_Home.md', '10_projects/Project Alpha.md', '10_projects/Project Beta.md'],
    '"project alpha"': ['00_Home.md', '10_projects/Project Alpha.md', '10_projects/Project Beta.md'],
    '"知識を残す"': ['20_knowledge/Distillation.md'],
    'tag:': [],
    'tag: project': ['10_projects/Project Alpha.md', '10_projects/Project Beta.md'],
    'owner:Home': [],
    '-': []
  }

  it.each(Object.entries(tsuZuneExpected))(
    'keeps the TSUZUNE search contract for $query',
    (query, paths) => {
      expect(searchRendererRanked(notes, query).map((result) => result.path).sort()).toEqual(paths)
    }
  )

  it('keeps the complete legacy result for an ordinary single-word query', () => {
    expect(searchRendererRanked(notes, 'Project')).toEqual(searchNotes(notes, 'Project'))
  })
})
