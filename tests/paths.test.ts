import { describe, expect, it } from 'vitest'
import {
  basenameRelative,
  dirnameRelative,
  formatPathForCopy,
  isPathInsideOrEqual,
  joinRelative,
  validateEntryName,
  validateRelativePath,
  withMarkdownExtension,
  withoutMarkdownExtension
} from '../src/core/paths'

describe('path validation', () => {
  it.each([
    ['../outside.md'],
    ['folder/../outside.md'],
    ['folder//note.md'],
    ['C:\\outside\\note.md'],
    ['\\\\server\\share\\note.md'],
    ['/outside/note.md']
  ])('rejects a path that cannot safely address a Vault entry: %s', (value) => {
    expect(validateRelativePath(value).valid).toBe(false)
  })

  it.each(['CON', 'nul.md', '.hidden', 'bad:name', 'trailing.', ' leading'])(
    'rejects a Windows-invalid entry name: %s',
    (value) => {
      expect(validateEntryName(value).valid).toBe(false)
    }
  )

  it('normalizes safe relative paths and keeps path helpers platform-neutral', () => {
    expect(validateRelativePath('開発\\方針.md')).toEqual({
      valid: true,
      normalized: '開発/方針.md'
    })
    expect(joinRelative('開発/', '/設計', '概要.md')).toBe('開発/設計/概要.md')
    expect(dirnameRelative('開発/設計/概要.md')).toBe('開発/設計')
    expect(basenameRelative('開発/設計/概要.md')).toBe('概要.md')
    expect(withMarkdownExtension('概要')).toBe('概要.md')
    expect(withoutMarkdownExtension('概要.MD')).toBe('概要')
  })

  it('does not confuse a sibling path with a child path', () => {
    expect(isPathInsideOrEqual('C:/Vault/notes/a.md', 'C:/Vault')).toBe(true)
    expect(isPathInsideOrEqual('C:/Vault-copy/a.md', 'C:/Vault')).toBe(false)
  })

  it('formats the three Obsidian path-copy choices exactly', () => {
    const root = 'C:\\Vault'
    const path = 'attachments/diagram.svg'

    expect(formatPathForCopy(root, 'vault', path, 'obsidian-url')).toBe(
      'obsidian://open?vault=vault&file=attachments%2Fdiagram.svg'
    )
    expect(formatPathForCopy(root, 'vault', path, 'vault-relative')).toBe(path)
    expect(formatPathForCopy(root, 'vault', path, 'system-absolute')).toBe(
      'C:\\Vault\\attachments\\diagram.svg'
    )
  })
})
