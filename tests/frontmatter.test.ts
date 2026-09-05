import { describe, expect, it } from 'vitest'
import {
  deleteFrontmatterScalar,
  inspectFrontmatterScalar,
  parseFrontmatter,
  setFrontmatterScalar
} from '../src/core/frontmatter'

describe('frontmatter parsing', () => {
  it('reads top-level metadata without changing the Markdown body', () => {
    const markdown = [
      '---',
      'kind: state',
      'subject: "[[10_プロジェクト/TSUZUNE]]"',
      'status: active',
      'valid_from: 2026-07-30',
      '---',
      '# TSUZUNEの状態',
      '',
      '本文はそのまま残す。'
    ].join('\n')

    expect(parseFrontmatter(markdown)).toEqual({
      found: true,
      attributes: {
        kind: 'state',
        subject: '[[10_プロジェクト/TSUZUNE]]',
        status: 'active',
        valid_from: '2026-07-30'
      },
      body: '# TSUZUNEの状態\n\n本文はそのまま残す。',
      raw: [
        '---',
        'kind: state',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'status: active',
        'valid_from: 2026-07-30',
        '---'
      ].join('\n'),
      warnings: []
    })
  })

  it('keeps malformed frontmatter readable and reports a warning', () => {
    const markdown = [
      '---',
      'kind: state',
      'status: active',
      '# Closing delimiter is missing'
    ].join('\n')

    expect(parseFrontmatter(markdown)).toEqual({
      found: true,
      attributes: {},
      body: markdown,
      raw: null,
      warnings: [
        {
          code: 'MALFORMED_FRONTMATTER',
          message: 'Frontmatter closing delimiter is missing.'
        }
      ]
    })
  })

  it('preserves Windows line endings and the final body newline', () => {
    const markdown = [
      '---',
      'kind: event',
      'occurred_at: 2026-07-30',
      '---',
      '# 再開',
      ''
    ].join('\r\n')

    const parsed = parseFrontmatter(markdown)

    expect(parsed.raw).toBe(
      ['---', 'kind: event', 'occurred_at: 2026-07-30', '---'].join('\r\n')
    )
    expect(parsed.body).toBe('# 再開\r\n')
  })

  it('accepts nested YAML blocks while keeping only top-level scalar metadata', () => {
    const markdown = [
      '---',
      'kind: ai_revision',
      'source_refs:',
      '  - "40_情報源/検証.md"',
      'theme:',
      '  colors:',
      '    primary: "#2F655F"',
      '---',
      '# Previous content'
    ].join('\n')

    expect(parseFrontmatter(markdown)).toMatchObject({
      attributes: {
        kind: 'ai_revision',
        source_refs: null,
        theme: null
      },
      body: '# Previous content',
      warnings: []
    })
  })

  it('still warns when an indented block line is not YAML-like', () => {
    const parsed = parseFrontmatter(
      ['---', 'source_refs:', '  definitely-not-yaml', '---', '# Note'].join(
        '\n'
      )
    )

    expect(parsed.warnings).toContainEqual({
      code: 'MALFORMED_FRONTMATTER',
      message: 'Top-level key and scalar value are required.',
      line: 3
    })
  })
})

describe('frontmatter scalar editing', () => {
  it('updates one scalar without changing surrounding YAML or Markdown', () => {
    const markdown = [
      '\uFEFF---',
      'kind: state',
      'subject: "[[10_プロジェクト/TSUZUNE]]"',
      'status: active',
      '# このコメントは残す',
      "unknown_key: 'quoted value'",
      '---',
      '# 本文',
      ''
    ].join('\r\n')

    expect(setFrontmatterScalar(markdown, 'status', 'complete')).toEqual({
      ok: true,
      markdown: markdown.replace('status: active', 'status: "complete"')
    })
  })

  it('adds a scalar before the closing delimiter without reserializing the block', () => {
    const markdown = [
      '---',
      'kind: state',
      '# keep this position',
      '---',
      '# Body'
    ].join('\n')

    expect(setFrontmatterScalar(markdown, 'status', 'active')).toEqual({
      ok: true,
      markdown: [
        '---',
        'kind: state',
        '# keep this position',
        'status: "active"',
        '---',
        '# Body'
      ].join('\n')
    })
  })

  it('creates frontmatter ahead of an existing BOM-prefixed Markdown body', () => {
    const markdown = '\uFEFF# 本文\r\n\r\n内容\r\n'

    expect(setFrontmatterScalar(markdown, 'status', 'active')).toEqual({
      ok: true,
      markdown: [
        '\uFEFF---',
        'status: "active"',
        '---',
        '# 本文',
        '',
        '内容',
        ''
      ].join('\r\n')
    })
  })

  it('deletes only the selected scalar property line', () => {
    const markdown = [
      '---',
      'kind: state',
      'status: active',
      'subject: "[[TSUZUNE]]"',
      '---',
      '# Body'
    ].join('\n')

    expect(deleteFrontmatterScalar(markdown, 'status')).toEqual({
      ok: true,
      markdown: [
        '---',
        'kind: state',
        'subject: "[[TSUZUNE]]"',
        '---',
        '# Body'
      ].join('\n')
    })
  })

  it('edits a scalar that appears before an unrelated nested property', () => {
    const markdown = [
      '---',
      'kind: state',
      'source_refs:',
      '  - "40_情報源/検証.md"',
      '---',
      '# Body'
    ].join('\n')

    expect(setFrontmatterScalar(markdown, 'kind', 'event')).toEqual({
      ok: true,
      markdown: markdown.replace('kind: state', 'kind: "event"')
    })
  })

  it('keeps an inline comment attached to the edited property', () => {
    const markdown = [
      '---',
      'status: active  # human context',
      'subject: "value # not a comment"',
      '---',
      '# Body'
    ].join('\n')

    expect(setFrontmatterScalar(markdown, 'status', 'complete')).toEqual({
      ok: true,
      markdown: markdown.replace(
        'status: active  # human context',
        'status: "complete"  # human context'
      )
    })
  })

  it('inspects text scalars and leaves a same-value edit byte-for-byte unchanged', () => {
    const markdown = ['---', 'status: "active"  # human context', '---'].join(
      '\n'
    )

    expect(inspectFrontmatterScalar(markdown, 'status')).toEqual({
      ok: true,
      value: 'active'
    })
    expect(setFrontmatterScalar(markdown, 'status', 'active')).toEqual({
      ok: true,
      markdown
    })
  })

  it('adds to an empty frontmatter block without adding a blank metadata line', () => {
    expect(setFrontmatterScalar('---\n---\n# Body', 'status', 'active')).toEqual({
      ok: true,
      markdown: '---\nstatus: "active"\n---\n# Body'
    })
  })

  it('recognizes comments after a plain scalar containing an apostrophe', () => {
    const markdown = [
      '---',
      "status: don't stop # human context",
      '---'
    ].join('\n')

    expect(setFrontmatterScalar(markdown, 'status', 'continue')).toEqual({
      ok: true,
      markdown: ['---', 'status: "continue" # human context', '---'].join('\n')
    })
  })

  it('preserves a quoted scalar comment and retains it as a standalone comment on delete', () => {
    const markdown = ['---', 'status: "active"  # human context', '---'].join(
      '\n'
    )

    expect(deleteFrontmatterScalar(markdown, 'status')).toEqual({
      ok: true,
      markdown: ['---', '# human context', '---'].join('\n')
    })
  })

  it.each([
    ['collection', 'status: [active]'],
    ['anchor', 'status: &state active'],
    ['alias', 'status: *state'],
    ['tag', 'status: !custom active'],
    ['multiline', 'status: |']
  ])('rejects a targeted %s value', (_label, property) => {
    const markdown = ['---', property, '---'].join('\n')

    expect(inspectFrontmatterScalar(markdown, 'status')).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
    expect(setFrontmatterScalar(markdown, 'status', 'complete')).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
  })

  it('rejects duplicate, typed, and malformed scalar syntax without changing Markdown', () => {
    const cases = [
      ['duplicate', ['---', 'status: active', 'status: complete', '---'].join('\n'), 'DUPLICATE_PROPERTY'],
      ['boolean', ['---', 'status: true', '---'].join('\n'), 'NON_SCALAR_PROPERTY'],
      ['number', ['---', 'status: 42', '---'].join('\n'), 'NON_SCALAR_PROPERTY'],
      ['date', ['---', 'status: 2026-09-05', '---'].join('\n'), 'NON_SCALAR_PROPERTY'],
      ['unclosed quote', ['---', 'status: "active', '---'].join('\n'), 'MALFORMED_FRONTMATTER'],
      ['colon-space', ['---', 'status: active: invalid', '---'].join('\n'), 'MALFORMED_FRONTMATTER']
    ] as const

    for (const [_label, markdown, code] of cases) {
      expect(setFrontmatterScalar(markdown, 'status', 'complete')).toMatchObject({
        ok: false,
        code
      })
    }
  })

  it.each([
    '0xFF',
    '0o77',
    '0b101',
    '1.',
    '1.e2',
    '.inf',
    '-.inf',
    '.nan'
  ])('refuses the typed YAML scalar %s for inspection, edit, and delete', (value) => {
    const markdown = ['---', `status: ${value}`, '---'].join('\n')

    expect(inspectFrontmatterScalar(markdown, 'status')).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
    expect(setFrontmatterScalar(markdown, 'status', 'text')).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
    expect(deleteFrontmatterScalar(markdown, 'status')).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
  })

  it.each([':', '-', '?', '@x', '%x', ']', '}', ',', '`x', '- .inf'])(
    'rejects malformed reserved plain YAML %s when adding a different property',
    (value) => {
      const markdown = ['---', `kind: ${value}`, '---'].join('\n')

      expect(setFrontmatterScalar(markdown, 'status', 'active')).toMatchObject({
        ok: false,
        code: 'MALFORMED_FRONTMATTER'
      })
    }
  )

  it('refuses adding around an unsupported flow mapping without changing it', () => {
    const markdown = [
      '---',
      'kind: { label: value }',
      'linked: "[[Note]]"',
      '---'
    ].join('\n')

    expect(setFrontmatterScalar(markdown, 'status', 'active')).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
  })

  it('allows adding around a demonstrated simple flow list and quoted link', () => {
    const markdown = ['---', 'kind: [a,b]', 'linked: "[[Note]]"', '---'].join(
      '\n'
    )

    expect(setFrontmatterScalar(markdown, 'status', 'active')).toEqual({
      ok: true,
      markdown: [
        '---',
        'kind: [a,b]',
        'linked: "[[Note]]"',
        'status: "active"',
        '---'
      ].join('\n')
    })
  })

  it.each([
    ['unclosed flow list', 'kind: [a,b', 'MALFORMED_FRONTMATTER'],
    ['unclosed flow mapping', 'kind: { label: value', 'MALFORMED_FRONTMATTER'],
    ['anchor', 'kind: &state active', 'NON_SCALAR_PROPERTY'],
    ['alias', 'kind: *state', 'NON_SCALAR_PROPERTY']
  ])('refuses adding around an unsupported %s', (_label, property, code) => {
    const markdown = ['---', property, '---'].join('\n')

    expect(setFrontmatterScalar(markdown, 'status', 'active')).toMatchObject({
      ok: false,
      code
    })
  })

  it('escapes Unicode line separators and preserves mixed existing line endings', () => {
    const markdown = '---\r\nkind: state\n---\r\n# Body'
    const result = setFrontmatterScalar(markdown, 'status', 'one\u2028two\u2029three')

    expect(result).toEqual({
      ok: true,
      markdown: '---\r\nkind: state\nstatus: "one\\u2028two\\u2029three"\r\n---\r\n# Body'
    })
  })

  it('keeps __proto__ as an ordinary own frontmatter property', () => {
    const parsed = parseFrontmatter(['---', '__proto__: preserved', '---'].join('\n'))

    expect(Object.hasOwn(parsed.attributes, '__proto__')).toBe(true)
    expect(parsed.attributes.__proto__).toBe('preserved')
  })
})
