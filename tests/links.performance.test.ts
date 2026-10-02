import { afterEach, describe, expect, it, vi } from 'vitest'
import { commonmarkLanguage } from '@codemirror/lang-markdown'
import { extractNoteLinks, getBacklinks } from '../src/core/links'

afterEach(() => vi.restoreAllMocks())

describe('note link parsing work', () => {
  it('skips syntax parsing when the body cannot contain a note link', () => {
    const parse = vi.spyOn(commonmarkLanguage.parser, 'parse')
    expect(extractNoteLinks('# Plain\nProse, **bold**, `code`, <https://example.com> and 😀', 'Plain.md')).toEqual([])
    expect(parse).not.toHaveBeenCalled()
  })

  it('parses a linked body once while preserving source ranges and exclusions', () => {
    const parse = vi.spyOn(commonmarkLanguage.parser, 'parse')
    const content = '[local](Target.md#part) [[Target|alias]] `[[Ignored]]`\n<!-- [[Hidden]] -->'
    const links = extractNoteLinks(content, 'Source.md')
    expect(links.map(link => [link.kind, link.target, content.slice(link.range.from, link.range.to)])).toEqual([
      ['markdown', 'Target.md#part', '[local](Target.md#part)'],
      ['wiki', 'Target', '[[Target|alias]]']
    ])
    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('does not parse link-free backlink candidates and retains reference links', () => {
    const parse = vi.spyOn(commonmarkLanguage.parser, 'parse')
    const notes = [
      { path: 'Target.md', name: 'Target', content: '# Target', modifiedAt: 1, size: 8 },
      { path: 'Plain.md', name: 'Plain', content: 'Text without links', modifiedAt: 1, size: 18 },
      { path: 'Source.md', name: 'Source', content: '[Target][ref]\n\n[ref]: Target.md', modifiedAt: 1, size: 29 }
    ]
    expect(getBacklinks('Target.md', notes).map(note => note.path)).toEqual(['Source.md'])
    expect(parse).toHaveBeenCalledTimes(1)
  })
})
