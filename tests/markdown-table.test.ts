import { describe, expect, it } from 'vitest'
import { markdownTables, newMarkdownTable, renderMarkdownTable } from '../src/core/markdown-table'

describe('Markdown table editing', () => {
  it('edits a cell while preserving inline Markdown and surrounding CRLF content', () => {
    const before = '\uFEFF---\r\ntitle: 表\r\n---\r\n前文\r\n\r\n'
    const source = '| 名前 | 値 |\r\n| :--- | ---: |\r\n| **強調** | a\\|b |'
    const after = '\r\n\r\n後文'
    const [table] = markdownTables(before + source + after)
    expect(table.rows).toEqual([['名前', '値'], ['**強調**', 'a\\|b']])
    table.rows[1][0] = '変更'
    const text = before + source + after
    const result = text.slice(0, table.from) + renderMarkdownTable(table) + text.slice(table.to)
    expect(result).toBe(before + source.replace('**強調**', '変更') + after)
  })

  it('keeps typed pipes inside cells without double escaping existing Markdown', () => {
    const [table] = markdownTables('| H | V |\n| --- | --- |\n| a | b |')
    table.rows[1] = ['[[Note|別名]]', '`a\\|b` と C:\\tmp']
    const result = renderMarkdownTable(table)
    expect(result).toContain('| [[Note\\|別名]] | `a\\|b` と C:\\tmp |')
    expect(markdownTables(result)[0].rows).toEqual([['H', 'V'], ['[[Note\\|別名]]', '`a\\|b` と C:\\tmp']])
  })

  it('escapes adjacent pipes and pipes after an even number of backslashes', () => {
    const [table] = markdownTables('| H |\n| --- |')
    table.rows.push(['a||b' + '\\'.repeat(2) + '|c'])
    expect(markdownTables(renderMarkdownTable(table))[0].rows[1]).toEqual(['a\\|\\|b' + '\\'.repeat(3) + '|c'])
  })

  it('retains surplus cells and fills missing cells instead of dropping content', () => {
    const [table] = markdownTables('| A | B |\n| --- | --- |\n| 1 |\n| 2 | 3 | extra |')
    expect(table.rows).toEqual([['A', 'B', ''], ['1', '', ''], ['2', '3', 'extra']])
    expect(table.align).toEqual([null, null, null])
    expect(markdownTables(renderMarkdownTable(table))[0].rows).toEqual(table.rows)
  })

  it('excludes code, frontmatter and nested tables from editable ranges', () => {
    const source = '---\ntext: |\n  | A |\n  | --- |\n---\n\n```md\n| B |\n| --- |\n```\n\n> | C |\n> | --- |\n\n- | D |\n  | --- |\n\n| E |\n| --- |'
    expect(markdownTables(source).map(table => table.rows)).toEqual([[['E']]])
  })

  it('does not expose tables in unclosed frontmatter or accept multiline cells', () => {
    expect(markdownTables('---\ntitle: bad\n\n| A |\n| --- |')).toEqual([])
    const [table] = markdownTables('| H |\n| --- |')
    table.rows.push(['line\nbreak'])
    expect(() => renderMarkdownTable(table)).toThrow('改行')
  })

  it('rejects insertion where an unclosed code or HTML block would swallow the new table', () => {
    for (const source of ['Before\n\n```md\ncode', '<!-- comment', '<script>text', '---\ntitle: bad']) {
      expect(newMarkdownTable(source, source.length)).toBeNull()
    }
  })
})
