// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'
import type { NoteDocument } from '../src/shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const note = (path: string, content: string): NoteDocument => ({ path, name: path, content, modifiedAt: 1, size: content.length })
const preview = (content: string, notes: NoteDocument[]) => <MarkdownPreview content={content} notePath="Home.md"
  notes={notes} attachments={[]} onWikiLink={vi.fn()} />

describe('note embeds', () => {
  it('shows the referenced body as Markdown and refreshes from the note snapshot', () => {
    const readVaultImage = vi.fn()
    vi.stubGlobal('tsuzune', { readVaultImage })
    const { rerender, container } = render(preview('Before ![[Source|原典]] after', [note('Source.md', '---\nsecret: hidden\n---\n# Source\n\n**Original**\n\n- [x] Task')]))
    const embed = screen.getByRole('group', { name: '埋め込み: 原典' })
    expect(within(embed).getByRole('heading', { name: 'Source' })).toBeTruthy()
    expect(embed.querySelector('strong')?.textContent).toBe('Original')
    expect((within(embed).getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
    expect(embed.textContent).not.toContain('hidden')
    expect(container.querySelector('p .note-embed')).toBeNull()
    expect(readVaultImage).not.toHaveBeenCalled()
    rerender(preview('Before ![[Source|原典]] after', [note('Source.md', '# Source\n\nUpdated')]))
    expect(within(screen.getByRole('group', { name: '埋め込み: 原典' })).getByText('Updated')).toBeTruthy()
    expect(screen.queryByText('Original')).toBeNull()
  })

  it('embeds a heading section with children, ending at the next peer, including local draft sections', () => {
    const source = '---\r\ntype: note\r\n---\r\n# Before\r\nExclude before\r\n\r\n## Pick\r\nSelected\r\n\r\n### Child\r\nChild body\r\n\r\n## After\r\nExclude after'
    const { container } = render(preview('![[Source#Pick]]\n\n# Local\n\nDraft body\n\n# End\n\n![[#Local]]', [note('Source.md', source)]))
    const picked = screen.getByRole('group', { name: '埋め込み: Source#Pick' })
    expect(within(picked).getByRole('heading', { name: 'Pick' })).toBeTruthy()
    expect(within(picked).getByText('Child body')).toBeTruthy()
    expect(picked.textContent).not.toContain('Exclude')
    const local = screen.getByRole('group', { name: '埋め込み: #Local' })
    expect(within(local).getByText('Draft body')).toBeTruthy()
    const ids = [...container.querySelectorAll('[id]')].map(el => el.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each([
    ['paragraph', 'Before\n\nFirst line\nSelected **paragraph** ^pick\n\nAfter', 'Selected paragraph', 'Before'],
    ['list item', '- Before\n- Selected item ^pick\n- After', 'Selected item', 'Before'],
    ['list', '- Alpha\n- Beta\n\n^pick\n\nAfter', 'Alpha', 'After'],
    ['quote', '> Quote line\n> Continuation\n\n^pick\n\nAfter', 'Continuation', 'After'],
    ['table', '| A | B |\n| --- | --- |\n| Alpha | Beta |\n\n^pick\n\nAfter', 'Alpha', 'After']
  ])('embeds the identified %s without its marker or adjacent blocks', (_name, source, included, excluded) => {
    render(preview('![[Source#^pick]]', [note('Source.md', source)]))
    const embed = screen.getByRole('group', { name: '埋め込み: Source#^pick' })
    const body = embed.querySelector('.markdown-preview')!
    expect(body?.textContent).toContain(included)
    expect(body?.textContent).not.toContain(excluded)
    expect(body?.textContent).not.toContain('^pick')
  })

  it('keeps fenced, inline, escaped, indented and commented examples out of embed rendering', () => {
    const content = ['`![[Source]]`', '```md\n![[Source]]\n```', '\\![[Source]]', '    ![[Source]]', '<!-- ![[Source]] -->'].join('\n\n')
    render(preview(content, [note('Source.md', 'Must not appear')]))
    expect(screen.queryByText('Must not appear')).toBeNull()
    expect(screen.queryByRole('group', { name: /埋め込み/ })).toBeNull()
  })

  it('reports missing, ambiguous, invalid, cyclic and duplicate block references without writes', () => {
    render(preview('![[Missing]]\n\n![[Dupe]]\n\n![[../Outside]]\n\n![[Loop]]\n\n![[Source#Absent]]\n\n![[Source#^twice]]', [
      note('a/Dupe.md', 'A'), note('b/Dupe.md', 'B'), note('Loop.md', '![[Home]]'),
      note('Home.md', '![[Loop]]'), note('Source.md', 'A ^twice\n\nB ^twice')]))
    expect(screen.getByText(/Missing: ノートが見つかりません/)).toBeTruthy()
    expect(screen.getByText(/Dupe: 同名ノートが複数/)).toBeTruthy()
    expect(screen.getByText(/循環参照/)).toBeTruthy()
    expect(screen.getByText(/見出し「Absent」/)).toBeTruthy()
    expect(screen.getByText(/ブロックID「twice」が複数/)).toBeTruthy()
  })

  it('ignores fake block IDs in code and supports section reference definitions and source-relative navigation', () => {
    const onNavigate = vi.fn()
    render(<MarkdownPreview content={'![[folder/Source#Pick]]\n\n![[folder/Source#^fake]]'} notePath="Home.md" attachments={[]} onWikiLink={vi.fn()} onNavigate={onNavigate}
      notes={[note('folder/Source.md', '# Pick\n\n[Sibling][ref]\n\n# End\n\n[ref]: Next.md#Focus\n\n```\nFake ^fake\n```'), note('folder/Next.md', '# Focus\n\nNext body')]} />)
    const link = screen.getByRole('link', { name: 'Sibling' })
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ path: 'folder/Next.md', headingId: 'heading-0' }))
    expect(screen.getByText(/ブロック「fake」が見つかりません/)).toBeTruthy()
  })

  it('bounds a branching embed graph and explains the limit', () => {
    const notes = Array.from({ length: 8 }, (_, i) => note(`N${i}.md`, Array(8).fill(`![[N${i + 1}]]`).join('\n\n')))
    const { container } = render(preview('![[N0]]', notes))
    expect(container.querySelectorAll('.note-embed .markdown-preview').length).toBeLessThanOrEqual(64)
    expect(container.textContent).toContain('上限')
  })

  it('ignores commented headings when resolving and ending a section', () => {
    render(preview('![[Source#Pick]]\n\n![[Source#Comment heading]]', [note('Source.md', '# Pick\n\nVisible before\n\n<!--\n# Comment heading\nHidden comment\n-->\n\nVisible after\n\n# End\nOther')]))
    const embed = screen.getByRole('group', { name: '埋め込み: Source#Pick' })
    expect(within(embed).getByText('Visible after')).toBeTruthy()
    expect(within(embed).queryByRole('heading', { name: 'Comment heading' })).toBeNull()
    expect(screen.getByText(/見出し「Comment heading」が見つかりません/)).toBeTruthy()
  })
})
