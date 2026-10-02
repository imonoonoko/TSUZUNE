import { describe, expect, it } from 'vitest'
import { createUserProfileMarkdown, parseUserProfile } from '../src/core/user-profile'
import type { NoteDocument } from '../src/shared/types'

describe('parseUserProfile', () => {
  it('round-trips an avatar path containing YAML punctuation', () => {
    const iconPath = 'assets/me: #1.png'
    expect(parseUserProfile({ path: 'user.md', name: 'user', content: createUserProfileMarkdown(iconPath), modifiedAt: 1, size: 1 }).iconPath).toBe(iconPath)
  })
  it('returns nulls when note is null', () => {
    expect(parseUserProfile(null)).toEqual({
      name: null,
      description: null,
      iconPath: null
    })
  })

  it('returns nulls when note has no frontmatter', () => {
    const note: NoteDocument = {
      path: 'user.md',
      name: 'user',
      content: '# ユーザーノート\n\n本文です。',
      modifiedAt: Date.now(),
      size: 100
    }
    expect(parseUserProfile(note)).toEqual({
      name: null,
      description: null,
      iconPath: null
    })
  })

  it('parses name, description, and icon from frontmatter', () => {
    const note: NoteDocument = {
      path: 'user.md',
      name: 'user',
      content: `---
name: Humin
description: 工房主 · 個人開発者
icon: assets/avatar.png
---

# プロフィール
`,
      modifiedAt: Date.now(),
      size: 100
    }

    expect(parseUserProfile(note)).toEqual({
      name: 'Humin',
      description: '工房主 · 個人開発者',
      iconPath: 'assets/avatar.png'
    })
  })

  it('handles partial attributes in frontmatter', () => {
    const note: NoteDocument = {
      path: 'user.md',
      name: 'user',
      content: `---
name: "Im_onoko"
---
`,
      modifiedAt: Date.now(),
      size: 50
    }

    expect(parseUserProfile(note)).toEqual({
      name: 'Im_onoko',
      description: null,
      iconPath: null
    })
  })
})
