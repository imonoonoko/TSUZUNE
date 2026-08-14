import { describe, expect, it } from 'vitest'
import {
  formatMarkdownSelection,
  insertWikiLink
} from '../src/core/markdown-edit'

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

  it('formats every selected line without requiring Markdown syntax', () => {
    expect(formatMarkdownSelection('一つ目\n二つ目\n三つ目', 0, 7, 'list')).toEqual({
      value: '- 一つ目\n- 二つ目\n三つ目',
      selectionStart: 2,
      selectionEnd: 11
    })
  })

  it('inserts an exact Vault note link chosen by the user', () => {
    expect(insertWikiLink('関連: ', 4, 4, '10_プロジェクト/TSUZUNE.md')).toEqual({
      value: '関連: [[10_プロジェクト/TSUZUNE]]',
      selectionStart: 25,
      selectionEnd: 25
    })
  })

  it('keeps selected text intact when it cannot be a Wiki-link label', () => {
    expect(insertWikiLink('一行目\n二行目', 0, 7, '関連.md')).toEqual({
      value: '[[関連]]一行目\n二行目',
      selectionStart: 13,
      selectionEnd: 13
    })
    expect(insertWikiLink('A|B]', 0, 4, '関連.md').value).toBe('[[関連]]A|B]')
  })
})
