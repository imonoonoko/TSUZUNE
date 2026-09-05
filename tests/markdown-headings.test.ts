import { describe, expect, it } from 'vitest'
import { extractMarkdownHeadings } from '../src/core/markdown-headings'

describe('extractMarkdownHeadings', () => {
  it('extracts ATX headings from h1 through h6 and strips closing hashes', () => {
    expect(extractMarkdownHeadings('# one\n ## two\n  ### three\n   #### four\n##### five\n###### six ##')).toMatchObject([
      { title: 'one', level: 1 }, { title: 'two', level: 2 }, { title: 'three', level: 3 },
      { title: 'four', level: 4 }, { title: 'five', level: 5 }, { title: 'six', level: 6 }
    ])
  })

  it('excludes valid frontmatter and reports source and preview positions', () => {
    const markdown = '---\ntitle: Demo\n---\n# Heading\n\n## Second'
    const headings = extractMarkdownHeadings(markdown)
    expect(headings).toMatchObject([
      { title: 'Heading', line: 4, previewLine: 1, sourceOffset: markdown.indexOf('# Heading') },
      { title: 'Second', line: 6, previewLine: 3, sourceOffset: markdown.indexOf('## Second') }
    ])
  })

  it('keeps headings when frontmatter is malformed, like Preview', () => {
    expect(extractMarkdownHeadings('---\ntitle: Demo\n# body heading')).toMatchObject([{ title: 'body heading', line: 3, previewLine: 3 }])
  })

  it('ignores fenced content and only closes with a matching long marker', () => {
    const markdown = '# before\n```md\n# hidden\n``\n# still hidden\n```\n~~~\n# hidden too\n~~\n# still hidden\n~~~\n# after'
    expect(extractMarkdownHeadings(markdown).map((heading) => heading.title)).toEqual(['before', 'after'])
  })

  it('excludes four-space and setext headings, and gives duplicate titles unique ids', () => {
    const headings = extractMarkdownHeadings('    # indented\nsetext\n=======\n# same\n# same')
    expect(headings.map((heading) => heading.title)).toEqual(['same', 'same'])
    expect(new Set(headings.map((heading) => heading.id)).size).toBe(2)
  })

  it('handles CRLF offsets', () => {
    const markdown = '# first\r\n\r\n## second'
    expect(extractMarkdownHeadings(markdown)[1]).toMatchObject({ line: 3, previewLine: 3, sourceOffset: markdown.indexOf('## second') })
  })
})
