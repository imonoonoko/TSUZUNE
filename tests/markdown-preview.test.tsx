// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'

afterEach(cleanup)

describe('MarkdownPreview', () => {
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

    const properties = screen.getByRole('region', { name: 'プロパティ' })
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
})
