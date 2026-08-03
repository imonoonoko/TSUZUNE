import { describe, expect, it } from 'vitest'
import { extractMarkdownTags } from '../src/core/tags'

describe('extractMarkdownTags', () => {
  it('extracts plain, hierarchical, and Japanese tags', () => {
    expect(
      extractMarkdownTags(
        '本文の #tag と #project/tsuzune、そして #日本語タグ を収集する。'
      )
    ).toEqual(['#tag', '#project/tsuzune', '#日本語タグ'])
  })

  it('deduplicates tags while preserving their first-seen order', () => {
    expect(extractMarkdownTags('#first #second #first #third #second')).toEqual([
      '#first',
      '#second',
      '#third'
    ])
  })

  it('ignores fenced code, inline code, Markdown headings, and URL fragments', () => {
    const markdown = [
      '# Markdown heading',
      '本文の #visible',
      '`#inline-code` は無視する。',
      'https://example.com/page#url-fragment',
      '```ts',
      'const hidden = "#fenced-code"',
      '```',
      '~~~',
      '#also-fenced',
      '~~~'
    ].join('\n')

    expect(extractMarkdownTags(markdown)).toEqual(['#visible'])
  })

  it('extracts inline YAML frontmatter tags before body tags', () => {
    const markdown = [
      '---',
      'title: Example',
      'tags: [alpha, project/tsuzune, "日本語"]',
      '---',
      '#body #alpha'
    ].join('\n')

    expect(extractMarkdownTags(markdown)).toEqual([
      '#alpha',
      '#project/tsuzune',
      '#日本語',
      '#body'
    ])
  })

  it('extracts multiline YAML frontmatter tag lists', () => {
    const markdown = [
      '---',
      'tags:',
      '  - inbox',
      "  - 'project/tsuzune'",
      '  - #日本語',
      'status: active',
      '---',
      '#body'
    ].join('\n')

    expect(extractMarkdownTags(markdown)).toEqual([
      '#inbox',
      '#project/tsuzune',
      '#日本語',
      '#body'
    ])
  })
})
