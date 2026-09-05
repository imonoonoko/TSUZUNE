import { describe, expect, it } from 'vitest'
import {
  deleteFrontmatterProperty,
  inspectFrontmatterProperty,
  setFrontmatterProperty
} from '../src/core/frontmatter'

describe('typed frontmatter properties: checkboxes', () => {
  it.each(['true', 'false', 'True', 'False', 'TRUE', 'FALSE'])('inspects %s as a boolean', (source) => {
    expect(inspectFrontmatterProperty(['---', `done: ${source}`, '---'].join('\n'), 'done')).toEqual({
      ok: true,
      property: { type: 'checkbox', value: source.toLowerCase() === 'true' }
    })
  })

  it('changes checkbox spelling to lowercase and preserves its comment and body', () => {
    const markdown = ['---', 'done: True  # reviewed', 'title: "Keep"', '---', '', '# Body'].join('\n')
    expect(setFrontmatterProperty(markdown, 'done', { type: 'checkbox', value: false })).toEqual({
      ok: true,
      markdown: markdown.replace('done: True', 'done: false')
    })
  })

  it('keeps bytes on a checkbox no-op, including the unseen BOM and CRLF boundary', () => {
    const markdown = '\uFEFF---\r\ndone: FALSE\r\n# keep\r\n---\r\nbody'
    expect(setFrontmatterProperty(markdown, 'done', { type: 'checkbox', value: false })).toEqual({
      ok: true,
      markdown
    })
  })

  it('refuses changing a checkbox to another property kind', () => {
    const markdown = ['---', 'done: false', '---'].join('\n')
    expect(setFrontmatterProperty(markdown, 'done', { type: 'text', value: 'false' })).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
  })

  it.each(['yes', 'no', 'on', 'off', 'null', '~'])('refuses false-like source %s as a checkbox', (source) => {
    const markdown = ['---', `done: ${source}`, '---'].join('\n')
    expect(inspectFrontmatterProperty(markdown, 'done')).toMatchObject({ ok: false, code: 'NON_SCALAR_PROPERTY' })
    expect(setFrontmatterProperty(markdown, 'done', { type: 'checkbox', value: false })).toMatchObject({
      ok: false,
      code: 'NON_SCALAR_PROPERTY'
    })
  })

  it('refuses boolean list items instead of converting them', () => {
    const markdown = ['---', 'flags: [true, false]', '---'].join('\n')
    expect(inspectFrontmatterProperty(markdown, 'flags')).toMatchObject({ ok: false, code: 'NON_SCALAR_PROPERTY' })
    expect(setFrontmatterProperty(markdown, 'flags', {
      type: 'list',
      value: [{ type: 'text', value: 'true' }]
    })).toMatchObject({ ok: false, code: 'NON_SCALAR_PROPERTY' })
  })

  it('deletes a checkbox while preserving surrounding comments and fields', () => {
    const markdown = ['---', '# before', 'done: TRUE # reviewed', '# after', 'title: x', '---'].join('\n')
    expect(deleteFrontmatterProperty(markdown, 'done')).toEqual({
      ok: true,
      markdown: ['---', '# before', '# reviewed', '# after', 'title: x', '---'].join('\n')
    })
  })
})
