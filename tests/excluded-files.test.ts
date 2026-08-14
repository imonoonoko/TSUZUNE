import { describe, expect, it } from 'vitest'
import {
  isExcludedFilePath,
  parseUserIgnoreFilters
} from '../src/shared/excluded-files'

describe('Obsidian excluded file patterns', () => {
  it('matches a plain entry as a case-insensitive path prefix', () => {
    const patterns = [' 80_excluded ']

    expect(isExcludedFilePath('80_excluded/Hidden.md', patterns)).toBe(true)
    expect(isExcludedFilePath('80_EXCLUDED-NOTES.md', patterns)).toBe(true)
    expect(isExcludedFilePath('Notes/80_excluded.md', patterns)).toBe(false)
  })

  it('matches slash-delimited JavaScript regular expressions case-insensitively', () => {
    const patterns = ['/\\.private\\.md$/']

    expect(isExcludedFilePath('People/Profile.PRIVATE.md', patterns)).toBe(true)
    expect(isExcludedFilePath('People/Profile.private.txt', patterns)).toBe(false)
  })

  it('ignores blank and invalid regular-expression entries', () => {
    const patterns = ['', '   ', '/[/']

    expect(isExcludedFilePath('Anything.md', patterns)).toBe(false)
  })

  it('parses persisted filters without trusting legacy or malformed values', () => {
    expect(parseUserIgnoreFilters(undefined)).toEqual([])
    expect(parseUserIgnoreFilters('80_excluded')).toEqual([])
    expect(
      parseUserIgnoreFilters([
        ' 80_excluded ',
        '',
        42,
        '/\\.private\\.md$/'
      ])
    ).toEqual(['80_excluded', '/\\.private\\.md$/'])
  })
})
