import { describe, expect, it } from 'vitest'
import { composeNotes } from '../src/core/note-composer'
import type { NoteDocument } from '../src/shared/types'
const note = (path: string, content: string): NoteDocument => ({ path, content, name: path, modifiedAt: 1, size: content.length })
const input = { scope: { rootPath: 'x', rootRevision: 1 }, mode: 'extract' as const, sourcePath: 'A.md', expectedSourceContent: 'before\nselected\nafter\n', targetPath: 'B.md', targetMode: 'new' as const, placement: 'append' as const, range: { from: 7, to: 16 } }
const withTemplate = { ...input, targetTemplate: { path: 'Templates/T.md', now: '2026-10-27T01:02:03.000Z' } }
describe('extraction templates', () => {
  it('inserts content once, preserving literal variables inside moved text and template metadata', () => {
    const content = '{{title}} {{source_title}} {{content}}\n'
    const result = composeNotes({ ...withTemplate, expectedSourceContent: content, range: { from: 0, to: content.length } }, [note('A.md', content)], {}, '---\ntags: [extracted]\n---\n# {{title}} from {{source_title}}\n{{date:YYYY}}\n\n{{content}}\n\nend')
    expect(result.changes[0].after).toBe('---\ntags: [extracted]\n---\n# B from A\n2026\n\n' + content + '\nend')
  })
  it('appends content with a blank boundary when the template has no content marker', () => {
    expect(composeNotes(withTemplate, [note('A.md', input.expectedSourceContent)], {}, '# {{title}}').changes[0].after).toBe('# B\n\nselected\n')
  })
  it.each(['inline {{content}}', '{{content}}\n\n{{content}}', '---\nx: {{content}}\n---\n', '```\n{{content}}\n```', '<!--\n{{content}}\n-->', '> {{content}}', '- {{content}}', '<div>\n{{content}}\n</div>', '```\nopen', '**start\n{{content}}\nend**', '    {{content}}'])('rejects unsafe content placement: %s', template => {
    expect(() => composeNotes(withTemplate, [note('A.md', input.expectedSourceContent)], {}, template)).toThrow()
  })
  it('rejects duplicate anchors, newly resolved references, and reference definition collisions', () => {
    const content = '# Section\nbody ^block\n'
    for (const template of ['# Section\n\n{{content}}', 'text ^block\n\n{{content}}']) expect(() => composeNotes({ ...withTemplate, expectedSourceContent: content, range: { from: 0, to: content.length } }, [note('A.md', content)], {}, template)).toThrow()
    const literal = 'literal [ref]\n'
    expect(() => composeNotes({ ...withTemplate, expectedSourceContent: literal, range: { from: 0, to: literal.length } }, [note('A.md', literal)], {}, '[ref]: target.png\n\n{{content}}')).toThrow('参照リンク')
    const refs = '[label][ref]\n\n[ref]: source.png\n'
    expect(() => composeNotes({ ...withTemplate, expectedSourceContent: refs, range: { from: 0, to: 13 } }, [note('A.md', refs)], {}, '[ref]: target.png\n\n{{content}}')).toThrow('参照リンク')
  })
  it('uses literal filenames inside inline code, wiki links and ordinary title text', () => {
    const content = input.expectedSourceContent
    const result = composeNotes({ ...withTemplate, sourcePath: 'A&B.md', targetPath: 'Note-One.md' }, [note('A&B.md', content)], {}, '`{{title}}`\n\n[[{{source_title}}]]\n\n{{content}}')
    expect(result.changes[0].after).toBe('`Note-One`\n\n[[A&B]]\n\nselected\n')
  })
  it('rejects a title variable that duplicates an extracted block anchor', () => {
    const content = 'selected ^block\n'
    expect(() => composeNotes({ ...withTemplate, targetPath: 'B ^block.md', expectedSourceContent: content, range: { from: 0, to: content.length } }, [note('A.md', content)], {}, '{{title}}\n\n{{content}}')).toThrow('重複')
  })
  it('rejects a footnote definition that absorbs extracted indented code', () => {
    const content = '    Visible selected code\n'
    expect(() => composeNotes({ ...withTemplate, expectedSourceContent: content, range: { from: 0, to: content.length } }, [note('A.md', content)], {}, '[^f]: unused note\n\n{{content}}')).toThrow('解釈')
  })
  it('keeps filename scalar values literal in template YAML', () => {
    const result = composeNotes({ ...withTemplate, targetPath: 'Note-One.md' }, [note('A.md', input.expectedSourceContent)], {}, '---\ntitle: "{{title}}"\nsource: "{{source_title}}"\n---\n\n{{content}}')
    expect(result.changes[0].after).toContain('title: "Note-One"\nsource: "A"')
  })
  it('does not interpret a filename token as another content marker', () => {
    const result = composeNotes({ ...withTemplate, targetPath: '{{content}}.md' }, [note('A.md', input.expectedSourceContent)], {}, '---\ntitle: "{{title}}"\n---\n\n{{content}}')
    expect(result.changes[0].after).toBe('---\ntitle: "{{content}}"\n---\n\n\nselected\n')
  })
  it.each(['$$\n\n{{content}}\n\n$$', '$$'])('rejects a template math context that absorbs the moved prose', template => {
    expect(() => composeNotes(withTemplate, [note('A.md', input.expectedSourceContent)], {}, template)).toThrow()
  })
  it('allows a closed template math block before the extracted prose', () => {
    expect(composeNotes(withTemplate, [note('A.md', input.expectedSourceContent)], {}, '$$\nx^2\n$$\n\n{{content}}').changes[0].after).toContain('$$\nx^2\n$$\n\nselected\n')
  })
  it('preserves safe reference links already present in the template', () => {
    const template = '[guide][g]\n\n[g]: https://example.com\n\n{{content}}'
    expect(composeNotes(withTemplate, [note('A.md', input.expectedSourceContent)], {}, template).changes[0].after).toBe('[guide][g]\n\n[g]: https://example.com\n\nselected\n')
  })
  it('retains empty template frontmatter bytes', () => {
    expect(composeNotes(withTemplate, [note('A.md', input.expectedSourceContent)], {}, '---\n\n---\n{{content}}').changes[0].after).toBe('---\n\n---\nselected\n')
  })
  it.each(['# Duplicate\n\none\n\n# Duplicate\n\ntwo\n\n{{content}}', 'one ^same\n\ntwo ^same\n\n{{content}}'])('rejects duplicate anchors entirely within a template', template => {
    expect(() => composeNotes(withTemplate, [note('A.md', input.expectedSourceContent)], {}, template)).toThrow('重複')
  })
})
describe('note composer content', () => {
  it('requires the canonical spelling of an existing target path', () => {
    expect(() => composeNotes({ ...input, targetPath: 'b.md', targetMode: 'existing' }, [note('A.md', input.expectedSourceContent), note('B.md', 'target')])).toThrow('実際の表記')
  })
  it('preserves an existing target frontmatter header with no properties', () => {
    const result = composeNotes({ ...input, targetMode: 'existing' }, [note('A.md', input.expectedSourceContent), note('B.md', '---\r\n---')])
    expect(result.changes[0].after).toBe('---\r\n---\r\nselected\n')
  })
  it('removes only selected bytes when no source replacement is chosen', () => {
    const result = composeNotes({ ...input, sourceReplacement: 'none' }, [note('A.md', input.expectedSourceContent)])
    expect(result.changes[0].after).toBe('selected\n')
    expect(result.changes[1].after).toBe('before\nafter\n')
  })
  it('leaves an embed when chosen while preserving moved and surrounding content', () => {
    const result = composeNotes({ ...input, sourceReplacement: 'embed' }, [note('A.md', input.expectedSourceContent)])
    expect(result.changes).toEqual([{ path: 'B.md', kind: 'create', before: null, after: 'selected\n' }, { path: 'A.md', kind: 'update', before: input.expectedSourceContent, after: 'before\n![[B]]\nafter\n' }])
  })
  it('extracts exact selected body into a new note and leaves full path reference', () => {
    const result = composeNotes(input, [note('A.md', input.expectedSourceContent)])
    expect(result.changes).toEqual([{ path: 'B.md', kind: 'create', before: null, after: 'selected\n' }, { path: 'A.md', kind: 'update', before: input.expectedSourceContent, after: 'before\n[[B]]\nafter\n' }])
  })
})

describe('preserved reference and metadata meaning', () => {
 it('rebases moved assets once and redirects only extracted heading references including self links', () => {
  const content = 'keep\n\n# Section\n![pic](img.png) [[#Section]]\n'
  const result = composeNotes({ ...input, sourcePath: 'old/A.md', targetPath: 'new/B.md', expectedSourceContent: content, range: { from: 6, to: content.length } }, [note('old/A.md', content), note('ref.md', '[[old/A#Section|label]] [[old/A]] `[[old/A#Section]]`')])
  expect(result.changes[0].after).toBe('# Section\n![pic](../old/img.png) [[new/B#Section]]\n')
  expect(result.changes.find(change => change.path === 'ref.md')?.after).toBe('[[new/B#Section|label]] [[old/A]] `[[old/A#Section]]`')
 })
 it('rewrites target incoming references during full merge and retains source metadata comments', () => {
  const content = '---\n# source comment\naliases: [Old]\ncustom: value # why\n---\n# Source\nbody\n'
  const result = composeNotes({ ...input, mode: 'merge', targetMode: 'existing', expectedSourceContent: content, range: undefined }, [note('A.md', content), note('B.md', '---\ntags: [t]\n---\n[[A#Source|old]]\n')])
  expect(result.changes[0].after).toContain('[[B#Source|old]]')
  expect(result.changes[0].after).toContain('source comment')
  expect(result.changes[0].after).toContain('custom: value # why')
  expect(result.changes[1]).toEqual({ path: 'A.md', kind: 'trash', before: content, after: null })
 })
 it('preserves retained self anchors and updates moved anchors in the retained source', () => {
  const content = '[[#Moved]]\n# Keep\nkept\n# Moved\n[[#Keep]] [kept](#Keep)\n'
  const result = composeNotes({ ...input, expectedSourceContent: content, targetPath: 'folder/B.md', range: { from: content.indexOf('# Moved'), to: content.length } }, [note('A.md', content)])
  expect(result.changes[0].after).toContain('[[A#Keep]] [kept](../A.md#Keep)')
  expect(result.changes[1].after).toContain('[[folder/B#Moved]]')
 })
 it('guards property conflict and split declarations', () => {
  const content = '---\nx: 1\n---\nbody'
  expect(() => composeNotes({ ...input, mode: 'merge', targetMode: 'existing', expectedSourceContent: content }, [note('A.md', content), note('B.md', '---\nx: 2\n---\nother')])).toThrow('x')
  expect(() => composeNotes({ ...input, expectedSourceContent: '# Heading\nbody', range: { from: 2, to: 6 } }, [note('A.md', '# Heading\nbody')])).toThrow()
 })
})

it('keeps target BOM/CRLF frontmatter bytes while updating its moved references', () => {
 const content = '# Moved\r\ntext\r\n'
 const target = '\uFEFF---\r\ncustom: "[[A#Moved]]" # keep\r\n---\r\nbody\r\n'
 const result = composeNotes({ ...input, targetMode: 'existing', expectedSourceContent: content, range: { from: 0, to: content.length } }, [note('A.md', content), note('B.md', target)])
 expect(result.changes[0].after).toContain('\uFEFF---\r\ncustom: "[[B#Moved]]" # keep\r\n---\r\n')
})
it('redirects encoded generated heading slugs and rejects slug reassignment', () => {
 const content = '# My Section\ntext\n'
 const result = composeNotes({ ...input, expectedSourceContent: content, range: { from: 0, to: content.length } }, [note('A.md', content), note('C.md', '[text](A.md#my-section) [[A#My Section]]')])
 expect(result.changes.find(change => change.path === 'C.md')?.after).toBe('[text](B.md#my-section) [[B#My Section]]')
 expect(result.updatedLinkCount).toBe(2)
 const ambiguous = '# a!\nfirst\n# a?\nsecond\n'
 expect(() => composeNotes({ ...input, expectedSourceContent: ambiguous, range: { from: ambiguous.indexOf('# a?'), to: ambiguous.length } }, [note('A.md', ambiguous)])).toThrow('識別子')
})

it('refuses extraction that splits the block denoted by a moved block ID', () => {
 const content = 'first line\nsecond line ^block\n'
 expect(() => composeNotes({ ...input, expectedSourceContent: content, range: { from: 11, to: content.length } }, [note('A.md', content)])).toThrow('block')
})
it('carries external reference definitions with an extracted reference link', () => {
 const content = '[label][ref]\n\n[ref]: image.png\n'
 const result = composeNotes({ ...input, expectedSourceContent: content, targetPath: 'folder/B.md', range: { from: 0, to: 13 } }, [note('A.md', content)])
 expect(result.changes[0].after).toContain('[ref]: ../image.png')
 expect(result.changes[1].after).toContain('[ref]: image.png')
})

it('retains comments from equal metadata values and guards unsafe YAML', () => {
 const content = '---\n# key context\ncustom:\n  child: value # source detail\n---\nbody'
 const target = '---\ncustom:\n  child: value # target detail\n---\ntarget'
 const result = composeNotes({ ...input, mode: 'merge', targetMode: 'existing', expectedSourceContent: content }, [note('A.md', content), note('B.md', target)])
 expect(result.changes[0].after).toContain('source detail')
 expect(result.changes[0].after).toContain('target detail')
 expect(result.changes[0].after).toContain('key context')
 expect(() => composeNotes({ ...input, mode: 'merge', targetMode: 'existing', expectedSourceContent: '---\nx: &a [1]\ny: *a\n---\nbody' }, [note('A.md', '---\nx: &a [1]\ny: *a\n---\nbody'), note('B.md', 'target')])).toThrow('YAML')
})

it('refuses newly resolving reference links in either concatenated body', () => {
 const content = '[ref]: file.png\n\nsource [ref]\n'
 expect(() => composeNotes({ ...input, mode: 'merge', targetMode: 'existing', expectedSourceContent: content }, [note('A.md', content), note('B.md', 'literal [ref]\n')])).toThrow('参照リンク')
 const selected = 'literal [ref]\n'
 expect(() => composeNotes({ ...input, targetMode: 'existing', expectedSourceContent: selected, range: { from: 0, to: selected.length } }, [note('A.md', selected), note('B.md', '[ref]: file.png\n')])).toThrow('参照リンク')
})

it('preserves Markdown link label bytes and rejects unterminated surrounding fences', () => {
 const content = 'body\n'
 const result = composeNotes({ ...input, mode: 'merge', targetMode: 'existing', expectedSourceContent: content }, [note('A.md', content), note('B.md', 'target'), note('C.md', '[see [[A]]](https://example.com) [[A]]')])
 expect(result.changes.find(change => change.path === 'C.md')?.after).toBe('[see [[A]]](https://example.com) [[B]]')
 expect(() => composeNotes({ ...input, mode: 'merge', targetMode: 'existing', expectedSourceContent: content }, [note('A.md', content), note('B.md', 'target\n\n```txt\ncode\n')])).toThrow('フェンス')
})
