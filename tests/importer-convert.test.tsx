// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { buildImportDraft } from '../src/renderer/importer-convert'
import { createHash } from 'node:crypto'

const file = (path: string, text: string) => ({ path, bytes: new TextEncoder().encode(text) })
const text = (draft: ReturnType<typeof buildImportDraft>, path: string) => new TextDecoder().decode(draft.files.find(f => f.path === path)?.bytes)

describe('import conversion', () => {
  it('rejects ragged CSV expansion before materializing its oversized padded table', () => {
    const original = Array.from
    const allocationGuard = vi.spyOn(Array, 'from').mockImplementation(((input: unknown, ...args: unknown[]) => {
      if (input && typeof input === 'object' && 'length' in input && typeof input.length === 'number' && input.length >= 8000) throw new Error('Oversized padded row allocation reached')
      return Reflect.apply(original, Array, [input, ...args])
    }) as typeof Array.from)
    try {
      // Only 20KB of input, but padding to 8000 columns would exceed 128MiB.
      const source = file('ragged.csv', ','.repeat(7999) + '\n' + 'x\n'.repeat(6000))
      expect(() => buildImportDraft('notion', [source])).toThrow(/上限/)
    } finally { allocationGuard.mockRestore() }
  })
  it('reads standard ENML character entities after stripping the known DTD without resolving it', () => {
    const result = buildImportDraft('enex', [file('entities.enex', '<en-export><note><title>Entities</title><content><![CDATA[<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>A&nbsp;B &copy; &lt;tag&gt; &amp;</en-note>]]></content></note></en-export>')])
    expect(text(result, 'Entities.md')).toContain('A\u00a0B © &lt;tag&gt; &amp;')
  })
  it('converts ENEX structure, metadata and MD5 referenced resources while retaining the raw export', () => {
    const raw = file('notes.enex', `<?xml version="1.0"?><!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export3.dtd"><en-export><note><title>Test</title><created>20200101T000000Z</created><updated>20200102T000000Z</updated><tag>ideas</tag><content><![CDATA[<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note><h2>Heading</h2><div>Hello <b>world</b><br/>Again</div><ul><li>One</li></ul><en-todo checked="true"/>Task<pre>code</pre><table><tr><td>A</td><td>B</td></tr></table><a href="https://example.com">Link</a><en-media type="text/plain" hash="900150983cd24fb0d6963f7d28e17f72"/><unknown>kept</unknown></en-note>]]></content><resource><data encoding="base64">YWJj</data><mime>text/plain</mime><resource-attributes><file-name>a.txt</file-name></resource-attributes></resource></note></en-export>`)
    const result = buildImportDraft('enex', [raw])
    expect(result.files.find(f => f.path === raw.path)).toEqual(raw)
    expect(text(result, 'attachments/1-a.txt')).toBe('abc')
    const md = text(result, 'Test.md')
    for (const expected of ['## Heading', '**world**', '- One', '[x]', '```', '| A | B |', '[Link](https://example.com)', 'attachments/1-a.txt', 'ideas', '20200101', 'kept']) expect(md).toContain(expected)
    expect(result.warnings.join(' ')).toContain('unknown')
  })

  it('rejects XML entities/malformed XML/base64 and warns when an ENML resource is missing', () => {
    const wrap = (content: string, resource = '') => file('a.enex', `<en-export><note><title>A</title><content><![CDATA[${content}]]></content>${resource}</note></en-export>`)
    expect(() => buildImportDraft('enex', [file('a.enex', '<!DOCTYPE en-export [<!ENTITY x SYSTEM "file:///private">]><en-export/>')])).toThrow(/XML|ENTITY/)
    expect(() => buildImportDraft('enex', [file('a.enex', '<en-export><note></en-export>')])).toThrow(/XML/)
    expect(() => buildImportDraft('enex', [wrap('<en-note>x</en-note>', '<resource><data encoding="base64">a!??</data></resource>')])).toThrow(/base64/)
    expect(() => buildImportDraft('enex', [wrap('<!DOCTYPE en-note SYSTEM "https://evil.invalid/a.dtd"><en-note/>')])).toThrow(/DOCTYPE/)
    const missing = buildImportDraft('enex', [wrap('<en-note><en-media hash="deadbeef"/></en-note>')])
    expect(missing.warnings.join(' ')).toContain('deadbeef')
  })

  it('matches MD5 for resources across padding blocks and disambiguates extensionless filenames and titles', () => {
    const strings = ['', 'a', 'message digest', 'a'.repeat(55), 'a'.repeat(56), 'b'.repeat(64), 'c'.repeat(130)]
    const notes = strings.map(value => `<note><title>Same</title><content><![CDATA[<en-note><en-media hash="${createHash('md5').update(value).digest('hex')}"/></en-note>]]></content><resource><data encoding="base64">${btoa(value)}</data><resource-attributes><file-name>plain</file-name></resource-attributes></resource><resource><data encoding="base64">${btoa(value)}</data><resource-attributes><file-name>plain</file-name></resource-attributes></resource></note>`).join('')
    const result = buildImportDraft('enex', [file('all.enex', `<en-export>${notes}</en-export>`)])
    expect(result.warnings).toEqual([])
    expect(text(result, 'attachments/1-plain')).toBe('')
    expect(result.files.some(f => f.path === 'attachments/1-plain (2)')).toBe(true)
    expect(result.files.filter(f => f.path.endsWith('.md'))).toHaveLength(strings.length)
    expect(text(result, 'Same (2).md')).toContain('attachments/2-plain')
  })

  it('warns on unmapped ChatGPT assets and unknown content without copying unrelated account data', () => {
    const result = buildImportDraft('chatgpt', [file('conversations.json', JSON.stringify([{ title: 'Chat', mapping: { node: { message: { content: { parts: [{ asset_pointer: 'file-service://missing.png' }] } } } } }])), file('user.json', '{}')])
    expect(result.files.some(f => f.path === 'user.json')).toBe(false)
    expect(result.warnings.join(' ')).toContain('missing.png')
    expect(result.warnings.join(' ')).toContain('unknown')
    expect(result.files.filter(f => f.path.endsWith('.md')).map(f => new TextDecoder().decode(f.bytes)).join('')).toContain('非テキスト')
  })

  it('warns about opaque parts even when ChatGPT labels a mixed message as text', () => {
    const result = buildImportDraft('chatgpt', [file('conversations.json', JSON.stringify([{ id: 'c', current_node: 'n', mapping: { n: { parent: null, message: { id: 'm', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['known', { opaque: 'not rendered' }] } } } } }]))])
    expect(result.warnings.join(' ')).toContain('非テキストpart')
    expect(text(result, '無題.md')).toContain('known')
    expect(text(result, '無題.md')).not.toContain('not rendered')
  })
  it('renders ChatGPT branches and metadata, retains only original conversations and referenced assets', () => {
    const message = (id: string, kind: string, parts: unknown[]) => ({ id, author: { role: 'user' }, create_time: 1700000000, content: { content_type: kind, parts } })
    const original = file('conversations-001.json', JSON.stringify([{ id: 'c', title: 'CON', current_node: 'a', mapping: {
      a: { parent: null, message: message('a', 'text', ['hello']) },
      b: { parent: null, message: message('b', 'multimodal_text', [{ asset_pointer: 'file-service://image.png' }]) }
    } }]))
    const result = buildImportDraft('chatgpt', [original, file('image.png', 'image'), file('user.json', '{"private":true}')])
    expect(result.files.find(f => f.path === original.path)).toEqual(original)
    expect(result.files.some(f => f.path === 'user.json')).toBe(false)
    expect(result.files.some(f => f.path === 'image.png')).toBe(true)
    const md = result.files.filter(f => f.path.endsWith('.md')).map(f => new TextDecoder().decode(f.bytes)).join('\n')
    expect(md).toContain('current'); expect(md).toContain('old'); expect(md).toContain('user'); expect(md).toContain('2023-11-14'); expect(md).toContain('conversations-001.json')
    expect(result.warnings.join(' ')).toContain('multimodal_text')
    expect(() => buildImportDraft('chatgpt', [file('conversations.json', '{}')])).toThrow()
    expect(() => buildImportDraft('chatgpt', [file('conversations.json', '[]')])).toThrow()
  })
  it('preserves Notion CSV and renders quoted multiline fields without replacing an existing note', () => {
    const result = buildImportDraft('notion', [file('db.csv', 'Name,Description\r\n"a,b","line1\nline2"\r\n'), file('db.csv.md', '# original')])
    expect(text(result, 'db.csv')).toContain('"a,b"')
    expect(text(result, 'db.csv.md')).toBe('# original')
    expect(text(result, 'db.csv (2).md')).toContain('| a,b | line1<br>line2 |')
    expect(() => buildImportDraft('notion', [file('page.html', '<p>hello</p>')])).toThrow(/Markdown|CSV/)
    expect(() => buildImportDraft('notion', [file('bad.csv', 'a\n"unterminated')])).toThrow(/CSV/)
  })
  it('preserves Markdown and assets exactly and warns about hidden configuration', () => {
    const files = [file('nested/a.md', '\uFEFF# hello\r\n'), file('nested/pic.png', 'pixels'), file('.obsidian/a.json', '{}')]
    const result = buildImportDraft('markdown', files)
    expect(result.files).toEqual(files.slice(0, 2))
    expect(result.warnings.join(' ')).toContain('.obsidian')
    expect(() => buildImportDraft('markdown', [file('a.png', '')])).toThrow()
    expect(() => buildImportDraft('markdown', [file('../a.md', '')])).toThrow()
    expect(() => buildImportDraft('markdown', [file('a.md', ''), file('A.md', '')])).toThrow()
  })
})
