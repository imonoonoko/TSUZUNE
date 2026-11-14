import { describe, expect, it } from 'vitest'
import { footnoteChange, markdownFootnotes } from '../src/core/markdown-footnotes'

describe('Markdown footnotes', () => {
  it('lists real multiline definitions in source order and matches references by normalized identifier', () => {
    const source = 'Text[^A] and [^a].\n\n[^A]: First **note**\n    continued\n\n[^unused]: Unused'
    const notes = markdownFootnotes(source)
    expect(notes.map(note => [note.identifier, note.label, note.source, note.editable])).toEqual([
      ['a', 'A', '[^A]: First **note**\n    continued', true],
      ['unused', 'unused', '[^unused]: Unused', true]
    ])
    expect(notes[0].references.map(ref => source.slice(ref.from, ref.to))).toEqual(['[^A]', '[^a]'])
    expect(notes[1].references).toEqual([])
    expect(source.slice(notes[0].from, notes[0].to)).toBe(notes[0].source)
  })

  it('excludes fake syntax in frontmatter, code, HTML, and escaped text with exact CRLF offsets', () => {
    const prefix = '\uFEFF---\r\ntitle: "[^fake]: hidden"\r\n---\r\n\r\n'
    const body = '`[^real]` \\[^real]\r\n\r\n```md\r\n[^fake]: code\r\n```\r\n\r\n    [^fake]: indented code\r\n\r\n<!-- [^fake]: html -->\r\n\r\nText[^real]\r\n\r\n[^real]: one\r\n    two'
    const source = prefix + body
    const [note] = markdownFootnotes(source)
    expect(markdownFootnotes(source)).toHaveLength(1)
    expect(note.from).toBe(source.indexOf('[^real]: one'))
    expect(note.to).toBe(source.length)
    expect(note.source).toBe('[^real]: one\r\n    two')
    expect(note.references).toEqual([{ from: source.indexOf('[^real]\r\n\r\n[^real]'), to: source.indexOf('[^real]\r\n\r\n[^real]') + 7 }])
  })

  it('keeps duplicate and nested definitions visible but read only', () => {
    const notes = markdownFootnotes('[^A]: one\n\n[^a]: two\n\n> [^b]: quote\n\n- [^c]: list\n\n[^d]: outer\n\n    [^e]: inner')
    expect(notes.map(note => note.identifier)).toEqual(['a', 'a', 'b', 'c', 'd', 'e'])
    expect(notes.every(note => !note.editable && Boolean(note.reason))).toBe(true)
  })

  it('fails closed for malformed frontmatter', () => {
    for (const source of ['---\nmissing close\n\n[^a]: hidden', '---\nnot yaml\n---\n\n[^a]: hidden']) {
      expect(markdownFootnotes(source)).toEqual([])
      expect(() => footnoteChange(source, source.indexOf('[^a]'), '[^a]: changed')).toThrow()
    }
  })

  it('replaces only the definition and retains CRLF and outside bytes', () => {
    const before = '---\r\ntitle: Test\r\n---\r\nText[^a]\r\n\r\n'
    const definition = '[^a]: old\r\n    continuation'
    const after = '\r\n\r\nTail\r\n\r\n[^b]: untouched\r\n'
    const source = before + definition + after
    const change = footnoteChange(source, before.length, '[^A]: new\n    more\n')
    expect(change).toEqual({ from: before.length, to: before.length + definition.length, insert: '[^A]: new\r\n    more' })
    expect(source.slice(0, change.from) + change.insert + source.slice(change.to)).toBe(before + '[^A]: new\r\n    more' + after)
    expect(footnoteChange(source, before.length, definition).insert).toBe(definition)
  })

  it('rejects rename, deletion, stray text, extra/nested definitions and lazy continuations', () => {
    const source = 'Before\n\n[^a]: old\n\nAfter'
    for (const replacement of ['', '[^b]: renamed', 'before\n\n[^a]: text', '[^a]: text\n\nafter', '[^a]: text\nafter', '[^a]: first\n\n[^a]: duplicate', '> [^a]: nested', '[^a]: outer\n\n    [^b]: inner', '[^a] no colon', '---\n[^a]: text']) {
      expect(() => footnoteChange(source, 8, replacement), replacement).toThrow()
    }
    expect(() => footnoteChange(source, 9, '[^a]: new')).toThrow()
    expect(() => footnoteChange('[^a]: one\n\n[^A]: two', 0, '[^a]: new')).toThrow()
    expect(() => footnoteChange('> [^a]: nested', 2, '[^a]: new')).toThrow()
  })

  it('preserves the original EOF newline policy and accepts an exact unchanged definition', () => {
    for (const ending of ['', '\n', '\n\n']) {
      const source = '[^a]: old' + ending
      const change = footnoteChange(source, 0, '[^a]: new\n')
      expect(source.slice(0, change.from) + change.insert + source.slice(change.to)).toBe('[^a]: new' + ending)
    }
    const source = '[^a]: valid existing\nlazy continuation'
    expect(footnoteChange(source, 0, source)).toEqual({ from: 0, to: source.length, insert: source })
  })

  it('rejects a standalone valid replacement if it absorbs following prose in context', () => {
    const source = '[^a]:\n    ```\n    code\n    ```\nAfter'
    expect(markdownFootnotes(source)[0].source).not.toContain('After')
    expect(() => footnoteChange(source, 0, '[^a]: new paragraph')).toThrow('外側')
  })
})
