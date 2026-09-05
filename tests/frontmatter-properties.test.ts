import { describe, expect, it } from 'vitest'
import {
  deleteFrontmatterProperty,
  inspectFrontmatterProperty,
  parseFrontmatter,
  setFrontmatterProperty
} from '../src/core/frontmatter'

describe('typed frontmatter properties: numbers', () => {
  it('reads and edits decimal numbers without converting their lexical value', () => {
    const markdown = [
      '---',
      'count: +9007199254740993.20  # keep',
      'title: "A note"',
      '---',
      '# Body'
    ].join('\n')

    expect(inspectFrontmatterProperty(markdown, 'count')).toEqual({
      ok: true,
      property: { type: 'number', value: '+9007199254740993.20' }
    })
    expect(
      setFrontmatterProperty(markdown, 'count', {
        type: 'number',
        value: '-0.50'
      })
    ).toEqual({
      ok: true,
      markdown: markdown.replace(
        'count: +9007199254740993.20  # keep',
        'count: -0.50  # keep'
      )
    })
  })

  it('adds a number and preserves quoted numeric text as text', () => {
    const markdown = ['---', 'code: "007"', '---'].join('\n')

    expect(
      setFrontmatterProperty(markdown, 'count', { type: 'number', value: '0' })
    ).toEqual({
      ok: true,
      markdown: ['---', 'code: "007"', 'count: 0', '---'].join('\n')
    })
    expect(inspectFrontmatterProperty(markdown, 'code')).toEqual({
      ok: true,
      property: { type: 'text', value: '007' }
    })
  })

  it.each(['01', '1.', '.5', '1e3', '0x10', '.inf', '.nan'])(
    'refuses unsupported numeric source %s',
    (value) => {
      const markdown = ['---', `count: ${value}`, '---'].join('\n')
      expect(inspectFrontmatterProperty(markdown, 'count')).toMatchObject({
        ok: false,
        code: 'NON_SCALAR_PROPERTY'
      })
      expect(
        setFrontmatterProperty(markdown, 'count', { type: 'number', value: '2' })
      ).toMatchObject({ ok: false, code: 'NON_SCALAR_PROPERTY' })
    }
  )

  it('refuses changing a scalar property kind', () => {
    const markdown = ['---', 'count: 2', '---'].join('\n')
    expect(
      setFrontmatterProperty(markdown, 'count', { type: 'text', value: '2' })
    ).toMatchObject({ ok: false, code: 'NON_SCALAR_PROPERTY' })
  })
})

describe('typed frontmatter properties: lists', () => {
  it('reads flow lists with quoted commas, hashes, and Wiki links', () => {
    const markdown = ['---', 'links: ["one, two", "#tag", "[[Note, A]]", 2]', '---'].join('\n')

    expect(inspectFrontmatterProperty(markdown, 'links')).toEqual({
      ok: true,
      property: {
        type: 'list',
        value: [
          { type: 'text', value: 'one, two' },
          { type: 'text', value: '#tag' },
          { type: 'text', value: '[[Note, A]]' },
          { type: 'number', value: '2' }
        ]
      }
    })
  })

  it('edits indented block lists while retaining item comments', () => {
    const markdown = [
      '---',
      'tags: # header',
      '  - old # retain',
      '  # standalone',
      '  - 2 # removed item',
      'title: "Note"',
      '---'
    ].join('\n')

    expect(
      setFrontmatterProperty(markdown, 'tags', {
        type: 'list',
        value: [
          { type: 'text', value: 'new' },
          { type: 'number', value: '3' }
        ]
      })
    ).toEqual({
      ok: true,
      markdown: [
        '---',
        'tags: # header',
        '  - "new"',
        '  - 3',
        '# standalone',
        '# retain',
        '# removed item',
        'title: "Note"',
        '---'
      ].join('\n')
    })
  })

  it('supports an indentless list, empty lists, and byte-preserving no-ops', () => {
    const markdown = ['---', 'tags:', '- alpha', '- 2', '---'].join('\n')
    const property = {
      type: 'list' as const,
      value: [
        { type: 'text' as const, value: 'alpha' },
        { type: 'number' as const, value: '2' }
      ]
    }

    expect(inspectFrontmatterProperty(markdown, 'tags')).toEqual({ ok: true, property })
    expect(setFrontmatterProperty(markdown, 'tags', property)).toEqual({ ok: true, markdown })
    expect(
      setFrontmatterProperty(markdown, 'tags', { type: 'list', value: [] })
    ).toEqual({ ok: true, markdown: ['---', 'tags: []', '---'].join('\n') })
  })

  it('leaves list comments as standalone comments on delete', () => {
    const markdown = ['---', 'tags: # header', '  - alpha # item', 'next: value', '---'].join('\n')

    expect(deleteFrontmatterProperty(markdown, 'tags')).toEqual({
      ok: true,
      markdown: ['---', '# header', '# item', 'next: value', '---'].join('\n')
    })
  })

  it.each([
    ['nested list', ['tags:', '  - - nested']],
    ['mapping', ['tags:', '  label: value']],
    ['anchor', ['tags: &items', '  - alpha']],
    ['alias', ['tags: *items']],
    ['tag', ['tags: !items alpha']],
    ['block scalar', ['tags: |', '  alpha']]
  ])('refuses unsupported %s without editing', (_label, lines) => {
    const markdown = ['---', ...lines, 'title: "Note"', '---'].join('\n')
    expect(setFrontmatterProperty(markdown, 'title', { type: 'text', value: 'Changed' })).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
  })
})

describe('typed frontmatter properties: source boundaries', () => {
  it.each([
    ['comment header', ['items: # keep', '  - "42"', '  - -3.50']],
    ['indentless header', ['items:', '- "42"', '- -3.50']]
  ])('keeps %s block lists valid for public frontmatter parsing', (_label, lines) => {
    const markdown = ['---', ...lines, '---', '# Body'].join('\n')

    expect(parseFrontmatter(markdown)).toMatchObject({
      found: true,
      attributes: { items: null },
      warnings: []
    })
  })

  it('changes and deletes a scalar without consuming following comments or blank lines', () => {
    const markdown = ['---', 'count: 1', '# next field', '', 'other: x', '---'].join('\n')

    expect(setFrontmatterProperty(markdown, 'count', { type: 'number', value: '2' })).toEqual({
      ok: true,
      markdown: ['---', 'count: 2', '# next field', '', 'other: x', '---'].join('\n')
    })
    expect(deleteFrontmatterProperty(markdown, 'count')).toEqual({
      ok: true,
      markdown: ['---', '# next field', '', 'other: x', '---'].join('\n')
    })
  })

  it('preserves every list comment when changing a list to empty', () => {
    const markdown = ['---', 'tags: # header', '  - alpha # item', '  # standalone', '  - beta # last', 'next: x', '---'].join('\n')

    expect(setFrontmatterProperty(markdown, 'tags', { type: 'list', value: [] })).toEqual({
      ok: true,
      markdown: ['---', 'tags: [] # header', '# standalone', '# item', '# last', 'next: x', '---'].join('\n')
    })
  })

  it.each([
    ['negative decimal', ['tags:', '  - -2'], { type: 'list', value: [{ type: 'number', value: '-2' }] }],
    ['missing dash space', ['tags:', '  -alpha'], null],
    ['tab indent', ['tags:', '\t- alpha'], null],
    ['mixed indentation', ['tags:', '  - alpha', '   - beta'], null],
    ['nested list', ['tags:', '  - - nested'], null]
  ])('enforces block-list syntax for %s', (_label, lines, expected) => {
    const markdown = ['---', ...lines, '---'].join('\n')
    if (expected) {
      expect(inspectFrontmatterProperty(markdown, 'tags')).toEqual({ ok: true, property: expected })
    } else {
      expect(inspectFrontmatterProperty(markdown, 'tags')).toMatchObject({
        ok: false,
        code: 'NON_SCALAR_PROPERTY'
      })
    }
  })

  it('keeps an empty/null block distinct from an empty list', () => {
    const markdown = ['---', 'empty:', '# context', 'title: x', '---'].join('\n')

    expect(inspectFrontmatterProperty(markdown, 'empty')).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
    expect(setFrontmatterProperty(markdown, 'title', { type: 'text', value: 'y' })).toEqual({
      ok: true,
      markdown: ['---', 'empty:', '# context', 'title: "y"', '---'].join('\n')
    })
  })

  it('retains a plain apostrophe and its comment when editing text', () => {
    const markdown = ['---', "status: don't stop # human", '---'].join('\n')

    expect(setFrontmatterProperty(markdown, 'status', { type: 'text', value: 'continue' })).toEqual({
      ok: true,
      markdown: ['---', 'status: "continue" # human', '---'].join('\n')
    })
  })

  it.each(['true', '2026-09-05', 'null', '01'])('allows edits beside non-target typed source %s', (value) => {
    const markdown = ['---', `tags: ${value}`, 'status: active', '---'].join('\n')

    expect(setFrontmatterProperty(markdown, 'status', { type: 'text', value: 'complete' })).toEqual({
      ok: true,
      markdown: ['---', `tags: ${value}`, 'status: "complete"', '---'].join('\n')
    })
  })

  it('refuses colon-without-space syntax before any write', () => {
    const markdown = ['---', 'status:abc', 'title: x', '---'].join('\n')

    expect(setFrontmatterProperty(markdown, 'title', { type: 'text', value: 'y' })).toMatchObject({
      ok: false,
      code: 'MALFORMED_FRONTMATTER'
    })
  })
})
