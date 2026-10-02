import { describe, expect, it } from 'vitest'
import { bookmarkId, normalizeBookmarks } from '../src/shared/bookmarks'
import { resolveBookmarkTarget } from '../src/core/bookmark-navigation'
import type { NoteDocument } from '../src/shared/types'

const note = (path: string, content: string): NoteDocument => ({
  path, name: path.split('/').at(-1) ?? path, content, modifiedAt: 1, size: content.length
})

describe('bookmarks', () => {
  it('normalizes legacy files in memory and deduplicates stable target IDs', () => {
    const entries = normalizeBookmarks([
      { type: 'file', path: 'Notes/One.md', title: 'old', ctime: 1 },
      { path: 'Notes\\One.md', title: 'new', ctime: 2 },
      { type: 'file', path: '../outside.md', ctime: 3 },
      { type: 'search', query: 'tag:#work OR name:one', ctime: 4 }
    ])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ id: bookmarkId({ path: 'Notes/One.md' }), type: 'file', path: 'Notes/One.md', title: 'new' })
    expect(entries[1]).toMatchObject({ id: bookmarkId({ type: 'search', query: 'tag:#work OR name:one' }), query: 'tag:#work OR name:one' })
  })

  it('opens a heading by its generated slug and offers the note root when it goes stale', () => {
    const content = '# A\n# A-1\n# A\n'
    const notes = [note('Notes/One.md', content)]
    const bookmark = normalizeBookmarks([{ type: 'heading', path: 'Notes/One.md', slug: 'a-2', headingTitle: 'A', ctime: 1 }])[0]
    expect(resolveBookmarkTarget(bookmark, notes)).toMatchObject({ status: 'resolved', type: 'heading', path: notes[0].path, headingId: `heading-${content.lastIndexOf('# A')}` })
    expect(resolveBookmarkTarget(bookmark, [note('Notes/One.md', '# B')])).toMatchObject({ status: 'stale', rootPath: notes[0].path })
  })

  it('replays the exact saved search text', () => {
    const bookmark = normalizeBookmarks([{ type: 'search', query: '  title:"A B" ', ctime: 1 }])[0]
    expect(resolveBookmarkTarget(bookmark, [])).toEqual({ status: 'resolved', type: 'search', query: '  title:"A B" ' })
  })
})
