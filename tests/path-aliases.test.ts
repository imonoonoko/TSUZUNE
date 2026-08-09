import { describe, expect, it } from 'vitest'
import {
  compilePathAliases,
  resolvePathAlias
} from '../src/core/path-aliases'

describe('path aliases', () => {
  it('provides flattened case-insensitive resolution', () => {
    const aliases = compilePathAliases({
      'Old\\Note.md': 'Archive/Middle.md',
      'Archive/Middle.md': 'Knowledge/Canonical Note.md'
    })

    expect(resolvePathAlias(aliases, 'old\\note.md')).toBe(
      'Knowledge/Canonical Note.md'
    )
    expect(resolvePathAlias(aliases, 'Other\\Note.md')).toBe('Other/Note.md')
    expect(aliases.flattened.get('old/note.md')).toBe(
      'Knowledge/Canonical Note.md'
    )
  })

  it('allows several old paths to share one exactly-cased canonical path', () => {
    const aliases = compilePathAliases({
      'Old/A.md': 'New/Note.md',
      'Old/B.md': 'New/Note.md'
    })

    expect(resolvePathAlias(aliases, 'old/a.md')).toBe('New/Note.md')
    expect(resolvePathAlias(aliases, 'OLD/B.MD')).toBe('New/Note.md')
  })

  it.each([
    {
      'Old.md': 'New/A.md',
      'old.MD': 'New/B.md'
    },
    {
      'Old/A.md': 'New/Note.md',
      'Old/B.md': 'new/note.md'
    }
  ])('rejects case-insensitive source or canonical collisions', (value) => {
    expect(() => compilePathAliases(value)).toThrow(/衝突/)
  })

  it.each([
    { 'A.md': 'A.md' },
    { 'A.md': 'B.md', 'B.md': 'C.md', 'C.md': 'A.md' }
  ])('rejects self references and cycles', (value) => {
    expect(() => compilePathAliases(value)).toThrow(/循環/)
  })

  it.each([
    { '../Old.md': 'New.md' },
    { 'Old.txt': 'New.md' },
    { 'Old.md': 'C:\\Vault\\New.md' },
    { 'Old.md': 'New.txt' },
    { 'Old.md': 42 }
  ])('rejects unsafe or non-Markdown entries', (value) => {
    expect(() => compilePathAliases(value)).toThrow(/Vault相対Markdownパス|文字列/)
  })

  it.each(['Old.md#heading', 'Old.md#^block', 'Old.md|表示名'])(
    'requires callers to retain link metadata outside the base path: %s',
    (value) => {
      const aliases = compilePathAliases({ 'Old.md': 'New.md' })
      expect(() => resolvePathAlias(aliases, value)).toThrow(/Vault相対Markdownパス/)
    }
  )
})
