import { describe, expect, it } from 'vitest'
import { resolveMarkdownBlock } from '../src/core/markdown-blocks'

describe('Markdown block targets', () => {
  it('resolves paragraph, list and standalone block beginnings in source coordinates', () => {
    const source = '---\ntitle: X\n---\n\nFirst\ncontinued ^One\n\n- list item ^list\n\n> quote\n\n^quote\n'
    expect(resolveMarkdownBlock(source, 'One')).toEqual({ content: 'First\ncontinued', sourceOffset: source.indexOf('First') })
    expect(resolveMarkdownBlock(source, 'list')).toEqual({ content: '- list item', sourceOffset: source.indexOf('- list') })
    expect(resolveMarkdownBlock(source, 'quote')).toEqual({ content: '> quote', sourceOffset: source.indexOf('> quote') })
    expect(resolveMarkdownBlock(source, 'one')).toHaveProperty('reason')
  })

  it('offers only unambiguous real blocks, excluding code and frontmatter', () => {
    const source = '---\ntitle: false ^front\n---\n\n```\nfalse ^code\n```\n\n`false ^inline`\n\nGood ^ID\n\nOther ^id\n\nA ^duplicate\n\nB ^duplicate\n'
    expect(resolveMarkdownBlock(source, 'ID')).toMatchObject({ content: 'Good' })
    expect(resolveMarkdownBlock(source, 'id')).toMatchObject({ content: 'Other' })
    expect(resolveMarkdownBlock(source, 'front')).toHaveProperty('reason')
    expect(resolveMarkdownBlock(source, 'code')).toHaveProperty('reason')
    expect(resolveMarkdownBlock(source, 'duplicate')).toMatchObject({ reason: expect.stringContaining('複数') })
    expect(resolveMarkdownBlock(source, '../bad')).toHaveProperty('reason')
  })
})
