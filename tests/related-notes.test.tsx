// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RelatedNotes from '../src/renderer/components/RelatedNotes'
import type { NoteDocument, ResolvedWikiLink } from '../src/shared/types'

const outgoing: ResolvedWikiLink[] = [
  {
    target: 'リンク先',
    alias: null,
    status: 'resolved',
    resolvedPath: 'リンク先.md',
    candidates: ['リンク先.md']
  },
  {
    target: '未作成',
    alias: null,
    status: 'missing',
    candidates: []
  }
]

const backlink: NoteDocument = {
  path: '参照元.md',
  name: '参照元',
  content: '[[対象]]',
  modifiedAt: 1,
  size: 6
}

afterEach(cleanup)

describe('RelatedNotes', () => {
  it('shows one context category at a time and switches it with tabs', () => {
    const onOpen = vi.fn()
    const onMissing = vi.fn()

    render(
      <RelatedNotes
        outgoing={outgoing}
        backlinks={[backlink]}
        temporal={<p>時間の内容</p>}
        onOpen={onOpen}
        onMissing={onMissing}
      />
    )

    const tabs = screen.getByRole('tablist', { name: 'ノートの文脈' })
    const linksTab = within(tabs).getByRole('tab', { name: 'リンク 2件' })
    const backlinksTab = within(tabs).getByRole('tab', { name: 'バックリンク 1件' })
    const temporalTab = within(tabs).getByRole('tab', { name: '時間' })

    expect(linksTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel', { name: 'リンク 2件' })).toBeTruthy()
    expect(screen.queryByRole('tabpanel', { name: 'バックリンク 1件' })).toBeNull()
    expect(screen.queryByRole('tabpanel', { name: '時間' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'リンク先' }))
    fireEvent.click(screen.getByRole('button', { name: '＋ 未作成' }))
    expect(onOpen).toHaveBeenCalledWith('リンク先.md')
    expect(onMissing).toHaveBeenCalledWith('未作成')

    fireEvent.click(backlinksTab)
    expect(backlinksTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel', { name: 'バックリンク 1件' })).toBeTruthy()
    expect(screen.getByText('参照元.md')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'リンク先' })).toBeNull()

    fireEvent.click(temporalTab)
    expect(temporalTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel', { name: '時間' })).toBeTruthy()
    expect(screen.getByText('時間の内容')).toBeTruthy()
    expect(screen.queryByRole('tabpanel', { name: 'バックリンク 1件' })).toBeNull()
  })

  it('moves selection and focus with tab keyboard controls', () => {
    render(
      <RelatedNotes
        outgoing={outgoing}
        backlinks={[backlink]}
        temporal={<p>時間の内容</p>}
        onOpen={() => undefined}
        onMissing={() => undefined}
      />
    )

    const linksTab = screen.getByRole('tab', { name: 'リンク 2件' })
    const backlinksTab = screen.getByRole('tab', { name: 'バックリンク 1件' })
    const temporalTab = screen.getByRole('tab', { name: '時間' })

    linksTab.focus()
    fireEvent.keyDown(linksTab, { key: 'ArrowRight' })
    expect(backlinksTab.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(backlinksTab)

    fireEvent.keyDown(backlinksTab, { key: 'End' })
    expect(temporalTab.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(temporalTab)

    fireEvent.keyDown(temporalTab, { key: 'Home' })
    expect(linksTab.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(linksTab)

    fireEvent.keyDown(linksTab, { key: 'ArrowLeft' })
    expect(temporalTab.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(temporalTab)
  })
})
