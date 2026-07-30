import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../src/core/frontmatter'

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
})
