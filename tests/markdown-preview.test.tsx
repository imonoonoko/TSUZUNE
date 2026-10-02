// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'
import type { NoteDocument, VaultAttachment } from '../src/shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('MarkdownPreview', () => {
  const note = (path: string, content: string): NoteDocument => ({
    path, name: path, content, modifiedAt: 1, size: content.length
  })
  const attachment = (path: string): VaultAttachment => ({
    path, name: path, modifiedAt: 1, createdAt: 1, size: 1
  })

  it.each([
    { source: 'notes/source.md', image: '../assets/pixel.png', path: 'assets/pixel.png' },
    { source: 'notes/source.md', image: '/assets/pixel.png', path: 'assets/pixel.png' },
    { source: '研究/source.md', image: '../assets/%E5%9B%B3%20One.png', path: 'assets/図 One.png' }
  ])('loads a local Markdown image from $image', async ({ source, image, path }) => {
    const readVaultImage = vi.fn(async () => ({ ok: true as const, value: 'data:image/png;base64,cGl4ZWw=' }))
    vi.stubGlobal('tsuzune', { readVaultImage })
    render(<MarkdownPreview content={`![Pixel](${image})`} notePath={source}
      attachments={[attachment(path)]} onWikiLink={() => {}} />)
    await waitFor(() => expect(screen.getByRole('img', { name: 'Pixel' }).getAttribute('src')).toBe('data:image/png;base64,cGl4ZWw='))
    expect(readVaultImage).toHaveBeenCalledExactlyOnceWith(path)
  })

  it('does not guess a local image by basename or leave the Vault on parent traversal', () => {
    const readVaultImage = vi.fn()
    vi.stubGlobal('tsuzune', { readVaultImage })
    render(<MarkdownPreview content={'![Missing](other/pixel.png) ![Outside](../assets/pixel.png)'}
      notePath="source.md" attachments={[attachment('assets/pixel.png')]} onWikiLink={() => {}} />)
    expect(screen.getByText('Missing')).toBeTruthy()
    expect(screen.getByText('Outside')).toBeTruthy()
    expect(readVaultImage).not.toHaveBeenCalled()
  })

  it('keeps external HTTP images as URLs', () => {
    const readVaultImage = vi.fn()
    vi.stubGlobal('tsuzune', { readVaultImage })
    render(<MarkdownPreview content={'![Remote](https://example.com/pixel.png)'}
      notePath="source.md" attachments={[]} onWikiLink={() => {}} />)
    expect(screen.getByRole('img', { name: 'Remote' }).getAttribute('src')).toBe('https://example.com/pixel.png')
    expect(readVaultImage).not.toHaveBeenCalled()
  })
  it('shows boolean state as read-only checkboxes and leaves quoted boolean text as text', () => {
    render(<MarkdownPreview content={'---\ndone: true # comment\nwaiting: FALSE\nquoted: "true"\n---\n# Body'} notePath="Note.md" attachments={[]} onWikiLink={vi.fn()} />)
    const done = screen.getByRole('checkbox', { name: 'done' }) as HTMLInputElement
    const waiting = screen.getByRole('checkbox', { name: 'waiting' }) as HTMLInputElement
    expect(done.checked).toBe(true)
    expect(waiting.checked).toBe(false)
    expect(done.disabled).toBe(true)
    expect(waiting.disabled).toBe(true)
    expect(screen.queryByRole('checkbox', { name: 'quoted' })).toBeNull()
  })

  it('renders valid frontmatter as compact read-only properties, not Markdown body', () => {
    render(
      <MarkdownPreview
        content={[
          '---',
          'type: project',
          'status: active',
          'updated: 2026-08-16',
          '---',
          '# TSUZUNE',
          '',
          '本文'
        ].join('\n')}
        notePath="10_プロジェクト/TSUZUNE.md"
        attachments={[]}
        onWikiLink={() => {}}
      />
    )

    const properties = screen.getByRole('group', { name: 'プロパティ' }) as HTMLDetailsElement
    expect(properties.open).toBe(false)
    fireEvent.click(properties.querySelector('summary')!)
    expect(properties.open).toBe(true)
    expect(within(properties).getByText('type')).toBeTruthy()
    expect(within(properties).getByText('project')).toBeTruthy()
    expect(within(properties).getByText('status')).toBeTruthy()
    expect(within(properties).getByText('active')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'TSUZUNE' })).toBeTruthy()
    expect(screen.queryByText('status: active')).toBeNull()
  })

  it('renders ordinary Markdown without an empty properties region', () => {
    render(
      <MarkdownPreview
        content={'# 通常ノート\n\n本文'}
        notePath="00_入口/通常ノート.md"
        attachments={[]}
        onWikiLink={() => {}}
      />
    )

    expect(screen.queryByRole('region', { name: 'プロパティ' })).toBeNull()
    expect(screen.getByRole('heading', { name: '通常ノート' })).toBeTruthy()
    expect(screen.getByText('本文')).toBeTruthy()
  })

  it('keeps malformed frontmatter readable instead of hiding it', () => {
    render(
      <MarkdownPreview
        content={[
          '---',
          'status: active',
          '# Closing delimiter is missing'
        ].join('\n')}
        notePath="00_入口/不完全なノート.md"
        attachments={[]}
        onWikiLink={() => {}}
      />
    )

    expect(screen.queryByRole('region', { name: 'プロパティ' })).toBeNull()
    expect(screen.getByText('status: active')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Closing delimiter is missing' })
    ).toBeTruthy()
  })

  it('anchors headings using source descriptors and ignores fenced examples', () => {
    render(<MarkdownPreview content={'# 同じ\n\n```md\n# 偽物\n```\n\n## 同じ'}
      notePath="00_入口/見出し.md" attachments={[]} onWikiLink={() => {}} />)
    const headings = screen.getAllByRole('heading')
    expect(headings).toHaveLength(2)
    expect(headings[0].id).toBe('heading-0')
    expect(headings[1].id).toBeTruthy()
    expect(headings[0].id).not.toBe(headings[1].id)
    expect(screen.queryByRole('heading', { name: '偽物' })).toBeNull()
  })

  it('keeps every ATX level anchored after CRLF frontmatter and Wiki-link transforms', () => {
    const content = [
      '---',
      'type: note',
      '---',
      '# 一',
      '## 二 [[リンク先|表示名]]',
      '### 三',
      '#### 四',
      '##### 五',
      '###### 六'
    ].join('\r\n')
    const { rerender } = render(
      <MarkdownPreview content={content} notePath="見出し.md" attachments={[]}
        onWikiLink={() => {}} />
    )

    const headings = screen.getAllByRole('heading')
    expect(headings).toHaveLength(6)
    expect(headings.map((heading) => heading.id)).toEqual([
      '# 一',
      '## 二',
      '### 三',
      '#### 四',
      '##### 五',
      '###### 六'
    ].map((marker) => `heading-${content.indexOf(marker)}`))
    expect(screen.getByRole('heading', { name: '二 表示名' })).toBeTruthy()

    const staleId = headings[1].id
    rerender(
      <MarkdownPreview content="# 更新後" notePath="見出し.md" attachments={[]}
        onWikiLink={() => {}} />
    )
    expect(document.getElementById(staleId)).toBeNull()
    expect(screen.getByRole('heading', { name: '更新後' }).id).toBe('heading-0')
  })

  it('renders GFM tables and disabled task checkboxes as read-only content', () => {
    render(<MarkdownPreview content={'| 項目 | 値 |\n| --- | --- |\n| A | B |\n\n- [x] 完了'}
      notePath="表.md" attachments={[]} onWikiLink={() => {}} />)
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'B' })).toBeTruthy()
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    expect(checkbox.disabled).toBe(true)
  })

  it('uses source-offset IDs for rendered Setext headings after CRLF frontmatter', () => {
    const content = '---\r\ntype: note\r\n---\r\n見出し\r\n======\r\n\r\n小見出し\r\n------'
    render(<MarkdownPreview content={content} notePath="見出し.md" attachments={[]} onWikiLink={() => {}} />)
    expect(screen.getByRole('heading', { name: '見出し' }).id).toBe(`heading-${content.indexOf('見出し')}`)
    expect(screen.getByRole('heading', { name: '小見出し' }).id).toBe(`heading-${content.indexOf('小見出し')}`)
  })

  it('shows and opens snapshot previews on focus for both link formats, and closes with Escape', () => {
    const destination = note('同階層/行先.md', '# 節\n\nこの部分がプレビューです。')
    const onNavigate = vi.fn()
    render(<MarkdownPreview content={'[普通](行先.md#節) と [[行先#節|Wiki]]'}
      notePath="同階層/元.md" attachments={[]} notes={[destination]}
      onWikiLink={vi.fn()} onNavigate={onNavigate} />)
    const ordinary = screen.getByRole('link', { name: '普通' })
    fireEvent.focus(ordinary)
    expect(screen.getByRole('group', { name: 'リンク先プレビュー' }).textContent).toContain('この部分がプレビューです。')
    fireEvent.click(screen.getByRole('button', { name: '開く' }))
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'markdown', status: 'resolved', path: destination.path, headingId: 'heading-0', fragment: '節' })
    const wiki = screen.getByRole('link', { name: 'Wiki' })
    fireEvent.focus(wiki)
    expect(screen.getByRole('group', { name: 'リンク先プレビュー' })).toBeTruthy()
    fireEvent.keyDown(wiki, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'リンク先プレビュー' })).toBeNull()
    fireEvent.mouseEnter(wiki)
    expect(screen.getByRole('group', { name: 'リンク先プレビュー' })).toBeTruthy()
    fireEvent.mouseLeave(wiki.closest('.note-link-preview-anchor') as Element)
    expect(screen.queryByRole('group', { name: 'リンク先プレビュー' })).toBeNull()
  })

  it('reports missing ordinary links and fragments without creating notes', () => {
    const onNavigate = vi.fn()
    const content = '[欠落](存在しない.md) [節なし](#不存在)'
    render(<MarkdownPreview content={content}
      notePath="元.md" attachments={[]} notes={[note('元.md', content)]} onWikiLink={vi.fn()} onNavigate={onNavigate} />)
    const missing = screen.getByRole('link', { name: '欠落' })
    fireEvent.focus(missing)
    expect(screen.getByRole('group', { name: 'リンク先プレビュー' }).textContent).toContain('ノートが見つかりません')
    fireEvent.click(missing)
    const fragment = screen.getByRole('link', { name: '節なし' })
    fireEvent.focus(fragment)
    expect(screen.getByRole('group', { name: 'リンク先プレビュー' }).textContent).toContain('見出し「不存在」が見つかりません')
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'markdown', status: 'missing', reason: 'ノートが見つかりません。' }))
    fireEvent.click(fragment)
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'markdown', status: 'missing', reason: '見出し「不存在」が見つかりません。' }))
  })
})
