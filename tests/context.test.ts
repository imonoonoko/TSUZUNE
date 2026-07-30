import { describe, expect, it } from 'vitest'
import { buildContextBundle } from '../src/core/context'
import type { NoteDocument } from '../src/shared/types'

function note(path: string, content: string): NoteDocument {
  const fileName = path.split('/').at(-1) ?? path
  return {
    path,
    name: fileName.replace(/\.md$/i, ''),
    content,
    modifiedAt: 0,
    size: Buffer.byteLength(content)
  }
}

describe('context bundle', () => {
  const notes = [
    note('Home.md', '# Home\n\n[[Project]] [[Shared]]'),
    note('Project.md', '# Project\n\nProject body'),
    note('Shared.md', '# Shared\n\nShared body'),
    note('Backlink.md', '# Backlink\n\n[[Home]] and [[Shared]]')
  ]

  it('includes one-hop outgoing links and backlinks without duplicates', () => {
    const bundle = buildContextBundle('Home.md', notes)

    expect(bundle.included.map((source) => source.path)).toEqual([
      'Home.md',
      'Project.md',
      'Shared.md',
      'Backlink.md'
    ])
    expect(bundle.included.map((source) => source.relation)).toEqual([
      'seed',
      'outgoing',
      'outgoing',
      'backlink'
    ])
    expect(bundle.markdown).toContain('Path: Project.md')
    expect(bundle.truncated).toBe(false)
  })

  it('never exceeds the requested character limit', () => {
    const bundle = buildContextBundle('Home.md', notes, {
      maxCharacters: 250
    })

    expect(bundle.characterCount).toBeLessThanOrEqual(250)
    expect(bundle.truncated).toBe(true)
    expect(
      bundle.included.some((source) => source.truncated) ||
        bundle.omittedPaths.length > 0
    ).toBe(true)
  })
})
