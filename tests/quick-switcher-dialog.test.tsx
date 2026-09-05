// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NoteDocument } from '../src/shared/types'
import QuickSwitcherDialog from '../src/renderer/components/QuickSwitcherDialog'

const note = (path: string, name = path.replace(/\.md$/, '')): NoteDocument => ({
  path,
  name,
  content: `${name} の本文`,
  modifiedAt: 1,
  size: 1
})

afterEach(() => {
  cleanup()
})

describe('QuickSwitcherDialog', () => {
  it('keeps excluded candidates but places them after ordinary candidates', () => {
    const hidden = {
      ...note('80_excluded/Hidden.md', 'Hidden'),
      content: 'shared-token'
    }
    const visible = {
      ...note('Visible.md', 'Visible'),
      content: 'shared-token'
    }

    render(
      <QuickSwitcherDialog
        notes={[hidden, visible]}
        recentPaths={[hidden.path, visible.path]}
        deprioritizedPaths={new Set([hidden.path])}
        onOpen={vi.fn()}
        onOpenInNewTab={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const optionNames = () =>
      screen
        .getAllByRole('option')
        .map((item) => item.querySelector('.quick-switcher-option-name')?.textContent)

    expect(optionNames()).toEqual(['Visible', 'Hidden'])
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'shared-token' }
    })
    expect(optionNames()).toEqual(['Visible', 'Hidden'])
  })

  it('limits rendered search results while keeping deterministic rank order', () => {
    const notes = Array.from({ length: 80 }, (_, index) =>
      note(`notes/Result-${String(index).padStart(2, '0')}.md`, `Result ${index}`)
    )

    render(
      <QuickSwitcherDialog
        notes={notes}
        recentPaths={[]}
        onOpen={vi.fn()}
        onOpenInNewTab={vi.fn()}
        onClose={vi.fn()}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Result' } })

    expect(screen.getAllByRole('option')).toHaveLength(50)
    expect(screen.getAllByRole('option')[0].textContent).toContain('Result 0')
  })

  it('keeps focus inside the no-match dialog and closes from the create action with Escape', async () => {
    const onClose = vi.fn()
    render(
      <QuickSwitcherDialog
        notes={[note('one.md', 'One')]}
        recentPaths={[]}
        onOpen={vi.fn()}
        onOpenInNewTab={vi.fn()}
        onClose={onClose}
        onCreate={vi.fn()}
      />
    )

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'missing' } })
    const create = screen.getByRole('button', { name: '新規ノートを作成' })
    create.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(input)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(create)
    fireEvent.keyDown(create, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('focuses the combobox and shows deduplicated existing recents in order', () => {
    const notes = [note('one.md', 'One'), note('two.md', 'Two')]
    render(
      <QuickSwitcherDialog
        notes={notes}
        recentPaths={['missing.md', 'two.md', 'two.md', 'one.md']}
        onOpen={vi.fn()}
        onOpenInNewTab={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const input = screen.getByRole('combobox')
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-label')).toBe('ノートを検索')
    expect(screen.getByRole('dialog').className).toBe('modal quick-switcher-modal')
    expect(screen.getByTestId('quick-switcher-backdrop').className).toBe(
      'modal-backdrop quick-switcher-backdrop'
    )
    expect(
      screen
        .getAllByRole('option')
        .map((item) => item.querySelector('.quick-switcher-option-name')?.textContent)
    ).toEqual(['Two', 'One'])
    expect(screen.getAllByRole('option').map((item) => item.textContent)).toEqual([
      'Twotwo.md',
      'Oneone.md'
    ])
  })

  it('closes only when the true backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <QuickSwitcherDialog
        notes={[note('one.md', 'One')]}
        recentPaths={[]}
        onOpen={vi.fn()}
        onOpenInNewTab={vi.fn()}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('quick-switcher-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('uses the renderer ranker for title, path, and content queries', () => {
    render(
      <QuickSwitcherDialog
        notes={[
          note('notes/Design.md', 'Design'),
          { ...note('notes/Inbox.md', 'Inbox'), content: 'contains Quick Switcher' }
        ]}
        recentPaths={[]}
        onOpen={vi.fn()}
        onOpenInNewTab={vi.fn()}
        onClose={vi.fn()}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Quick Switcher' } })
    expect(
      screen
        .getAllByRole('option')
        .map((item) => item.querySelector('.quick-switcher-option-name')?.textContent)
    ).toEqual(['Inbox'])
  })

  it('supports navigation, opening, new-tab opening, and escape', () => {
    const onOpen = vi.fn()
    const onOpenInNewTab = vi.fn()
    const onClose = vi.fn()
    render(
      <QuickSwitcherDialog
        notes={[note('one.md', 'One'), note('two.md', 'Two'), note('three.md', 'Three')]}
        recentPaths={['one.md', 'two.md', 'three.md']}
        onOpen={onOpen}
        onOpenInNewTab={onOpenInNewTab}
        onClose={onClose}
      />
    )

    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe('quick-switcher-option-two.md')
    fireEvent.keyDown(input, { key: 'End' })
    expect(input.getAttribute('aria-activedescendant')).toBe('quick-switcher-option-three.md')
    fireEvent.keyDown(input, { key: 'Home' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledWith('one.md')
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    expect(onOpenInNewTab).toHaveBeenCalledWith('two.md')
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('keeps the background inert and shows an explicit create action for no matches', () => {
    const onCreate = vi.fn()
    const onClose = vi.fn()
    render(
      <QuickSwitcherDialog
        notes={[note('one.md', 'One')]}
        recentPaths={[]}
        onOpen={vi.fn()}
        onOpenInNewTab={vi.fn()}
        onClose={onClose}
        onCreate={onCreate}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'New idea' } })
    expect(screen.getByText('該当するノートはありません')).toBeTruthy()
    expect(screen.getByText('保存先は作成前に確認します。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '新規ノートを作成' }))
    expect(onCreate).toHaveBeenCalledWith('New idea')
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disambiguates duplicate titles by showing each path and scrolls the active option', () => {
    const first = note('projects/Plan.md', 'Plan')
    const second = note('archive/Plan.md', 'Plan')
    render(
      <QuickSwitcherDialog
        notes={[first, second]}
        recentPaths={['projects/Plan.md', 'archive/Plan.md']}
        onOpen={vi.fn()}
        onOpenInNewTab={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const options = screen.getAllByRole('option')
    expect(options[0].textContent).toContain('projects/Plan.md')
    expect(options[1].textContent).toContain('archive/Plan.md')
    const scrollIntoView = vi.fn()
    options[1].scrollIntoView = scrollIntoView
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    expect(scrollIntoView).toHaveBeenCalled()
  })

})
