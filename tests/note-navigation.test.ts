import { describe, expect, it } from 'vitest'
import type { NoteDocument } from '../src/shared/types'
import { notePreviewText, resolveNoteNavigation } from '../src/core/note-navigation'

const note = (path: string, content: string): NoteDocument => ({
  path, name: path.split('/').at(-1) ?? path, content, modifiedAt: 1, size: content.length
})
const current = note('00_入口/現在.md', '# 現在\n\n本文')
const target = note('30_知識/日本 語%メモ.md', '# 重複\n\n一つ目\n\n# 重複\n\n二つ目\n\n見出し\n------\n\nSetext本文')
const notes = [current, target]

describe('note navigation', () => {
  it('resolves relative percent-encoded Markdown paths inside the Vault', () => {
    const href = '../30_%E7%9F%A5%E8%AD%98/%E6%97%A5%E6%9C%AC%20%E8%AA%9E%25%E3%83%A1%E3%83%A2.md#%E8%A6%8B%E5%87%BA%E3%81%97'
    const resolved = resolveNoteNavigation(href, 'markdown', current.path, notes, current.content)
    expect(resolved).toMatchObject({ status: 'resolved', path: target.path, headingId: `heading-${target.content.indexOf('見出し')}` })
    expect(notePreviewText(resolved, current.path, current.content, notes)).toBe('Setext本文')
  })

  it('previews from the body start when the link has no fragment', () => {
    const introduction = note('30_知識/導入.md', '---\ntitle: 導入\n---\n導入の本文\n\n# 後の見出し\n続き')
    const resolved = resolveNoteNavigation('30_知識/導入', 'wiki', current.path, [current, introduction], current.content)
    expect(notePreviewText(resolved, current.path, current.content, [current, introduction])).toBe('導入の本文\n\n 後の見出し\n続き')
  })

  it('maps exact heading titles, duplicate slugs and same-note fragments to source IDs', () => {
    expect(resolveNoteNavigation('../30_知識/日本 語%25メモ.md#重複-1', 'markdown', current.path, notes, current.content))
      .toMatchObject({ status: 'resolved', headingId: `heading-${target.content.indexOf('# 重複', 1)}` })
    expect(resolveNoteNavigation('#現在', 'markdown', current.path, notes, current.content))
      .toMatchObject({ status: 'resolved', path: current.path, headingId: 'heading-0' })
    expect(resolveNoteNavigation('30_知識/日本 語%メモ#重複', 'wiki', current.path, notes, current.content))
      .toMatchObject({ status: 'resolved', path: target.path, headingId: 'heading-0' })
  })

  it('keeps generated slugs unique when a literal numbered title occupies a suffix', () => {
    const collisions = note('30_知識/衝突.md', '# A\n# A-1\n# A')
    const available = [current, collisions]
    expect(resolveNoteNavigation('30_知識/衝突#a-2', 'wiki', current.path, available, current.content))
      .toMatchObject({ status: 'resolved', path: collisions.path, headingId: `heading-${collisions.content.lastIndexOf('# A')}` })
    expect(resolveNoteNavigation('30_知識/衝突#A-1', 'wiki', current.path, available, current.content))
      .toMatchObject({ status: 'resolved', headingId: `heading-${collisions.content.indexOf('# A-1')}` })
  })

  it('reports missing notes and headings without creating either', () => {
    expect(resolveNoteNavigation('不存在.md', 'markdown', current.path, notes, current.content)).toMatchObject({ status: 'missing' })
    expect(resolveNoteNavigation('#存在しない', 'markdown', current.path, notes, current.content)).toMatchObject({ status: 'missing', fragment: '存在しない' })
  })

  it('rejects escaped roots, absolute/scheme paths, malformed escapes and non-Markdown targets', () => {
    for (const href of ['../../escape.md', '/root.md', 'C:/root.md', 'file:///root.md', '%ZZ.md', '../image.png']) {
      expect(resolveNoteNavigation(href, 'markdown', current.path, notes, current.content).status).toBe('invalid')
    }
  })
})
