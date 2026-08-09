import { describe, expect, it } from 'vitest'
import { formatMarkdownSelection } from '../src/core/markdown-edit'

describe('human-friendly Markdown edits', () => {
  it('wraps selected text as bold or a Wiki link', () => {
    expect(formatMarkdownSelection('大切な内容', 0, 2, 'bold')).toEqual({
      value: '**大切**な内容',
      selectionStart: 2,
      selectionEnd: 4
    })
    expect(formatMarkdownSelection('関連: ', 4, 4, 'link')).toEqual({
      value: '関連: [[ノート名]]',
      selectionStart: 6,
      selectionEnd: 10
    })
  })

  it('adds a readable line prefix at the current line', () => {
    expect(formatMarkdownSelection('前の行\n次の行', 7, 7, 'task')).toEqual({
      value: '前の行\n- [ ] 次の行',
      selectionStart: 13,
      selectionEnd: 13
    })
  })
})
