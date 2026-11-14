import { describe, expect, it } from 'vitest'
import { compareNoteVersions } from '../src/core/note-history-diff'

describe('note history comparison', () => {
  it('shows additions and removals while preserving unchanged lines between edits', () => {
    const result = compareNoteVersions('A\nold\nC\nD\n', 'A\nnew\nC\nE\n')
    expect(result.text).toBe('  A\n- old\n+ new\n  C\n- D\n+ E\n')
    expect(result.coarse).toBe(false)
  })
  it('distinguishes line endings and missing final newline', () => {
    expect(compareNoteVersions('same\r\n', 'same\n').text).toContain('- same [CRLF]')
    expect(compareNoteVersions('same', 'same\n').text).toContain('- same [末尾改行なし]')
    expect(compareNoteVersions('', '').text).toBe('差分はありません。')
  })
  it('bounds work and output for large unrelated documents', () => {
    const result = compareNoteVersions('before\n'.repeat(10000), 'after\n'.repeat(10000))
    expect(result.coarse).toBe(true)
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBeLessThanOrEqual(150000)
  })
})
