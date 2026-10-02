import { commonmarkLanguage } from '@codemirror/lang-markdown'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findUnlinkedMentions } from '../src/core/unlinked-mentions'

const note = (path: string, content = '') => ({
  path, name: path.split('/').at(-1)!.replace(/\.md$/, ''), content, size: content.length, modifiedAt: 1
})
afterEach(() => vi.restoreAllMocks())

describe('unlinked mention parsing', () => {
  it('does not parse bodies without a target name or alias, preserving ambiguity and excluded ranges', () => {
    const unrelated = '# Unrelated\nOrdinary text.\n'.repeat(50)
    const candidate = '別名 Targeting `Target` [Target](https://example.com) Target'
    const parse = vi.spyOn(commonmarkLanguage.parser, 'parse')
    const result = findUnlinkedMentions('Target.md', [
      note('Target.md', '---\naliases: [別名]\n---\n'), note('Other/Target.md'),
      note('Unrelated.md', unrelated), note('Source.md', candidate)
    ])
    expect(result.map(item => item.text)).toEqual(['別名', 'Target'])
    expect(result[1].ambiguous).toBe(true)
    expect(result.every(item => candidate.slice(item.range.from, item.range.to) === item.text)).toBe(true)
    expect(parse.mock.calls.some(([input]) => input === unrelated)).toBe(false)
    expect(parse.mock.calls.some(([input]) => input === candidate)).toBe(true)
  })

  it('does not parse any bodies when the target is absent', () => {
    const parse = vi.spyOn(commonmarkLanguage.parser, 'parse')
    expect(findUnlinkedMentions('Missing.md', [note('Other.md', '# Other\ntext')])).toEqual([])
    expect(parse).not.toHaveBeenCalled()
  })
})
