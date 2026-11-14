import { describe, expect, it } from 'vitest'
import { createPdfCitation, resolvePdfLink } from '../src/core/pdf-links'
import type { VaultAttachment } from '../src/shared/types'

const attachments = ['assets/研究 One.pdf', 'a/same.pdf', 'b/same.pdf'].map(path => ({ path } as VaultAttachment))
describe('PDF citation links', () => {
  it('round trips a root-relative Markdown citation with a quoted passage', () => {
    const citation = createPdfCitation({ path: 'assets/研究 One.pdf', page: 3, search: '' }, '選んだ文章\nの続き')
    expect(citation).toContain('> 選んだ文章\n> の続き')
    const href = citation.match(/\]\(([^)]+)\)$/)![1]
    expect(resolvePdfLink(href, 'markdown', 'notes/source.md', attachments)).toEqual({ path: 'assets/研究 One.pdf', page: 3, search: '選んだ文章 の続き' })
  })
  it('resolves relative Markdown and unique Wiki paths without guessing ambiguous names', () => {
    expect(resolvePdfLink('../assets/%E7%A0%94%E7%A9%B6%20One.pdf#page=2', 'markdown', 'notes/source.md', attachments)?.page).toBe(2)
    expect(resolvePdfLink('研究 One.pdf#page=2', 'wiki', 'source.md', attachments)?.path).toBe('assets/研究 One.pdf')
    expect(resolvePdfLink('same.pdf', 'wiki', 'source.md', attachments)).toBeNull()
    expect(resolvePdfLink('wrong/研究 One.pdf', 'wiki', 'source.md', attachments)).toBeNull()
  })
  it.each(['../assets/研究%20One.pdf', 'https://site/研究%20One.pdf', '//host/x.pdf', '/assets/研究%20One.pdf#page=0', '/assets/研究%20One.pdf#page=-1', '/assets/研究%20One.pdf#page=abc', '/assets/研究%20One.pdf#page=1&unknown=x', '/assets/研究%20One.pdf#page=2&page=3', '/assets/研究%20One.pdf?remote=x', '/assets/%00.pdf'])('rejects unsafe or invalid targets: %s', target => {
    expect(resolvePdfLink(target, 'markdown', 'source.md', attachments)).toBeNull()
  })
  it('escapes Markdown delimiters and caps the search text while preserving the copied quote', () => {
    const quote = 'word '.repeat(300)
    const text = createPdfCitation({ path: 'a/[one](two).pdf', page: 1, search: '' }, quote)
    expect(text).toContain('\\[one\\]\\(two\\).pdf')
    expect(text).toContain('%28two%29.pdf#page=1')
    expect(new URLSearchParams(text.split('#')[1].slice(0, -1)).get('search')!.length).toBeLessThanOrEqual(500)
    expect(text).toContain('> ' + quote.trim())
  })
})
