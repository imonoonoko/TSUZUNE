// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DailyCalendar from '../src/renderer/components/DailyCalendar'
import type { NoteDocument } from '../src/shared/types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DailyCalendar', () => {
  it('navigates across years and keeps local daily-note dates aligned', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 15, 12))
    const januaryNote: NoteDocument = {
      path: '02_デイリー/2027-01-31.md',
      name: '2027-01-31',
      content: '# 2027-01-31',
      modifiedAt: 1,
      size: 12
    }
    const onSelectDate = vi.fn()

    render(
      <DailyCalendar
        notes={[januaryNote]}
        selectedPath={januaryNote.path}
        onSelectDate={onSelectDate}
        onOpenNote={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: '2026年12月' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: '2026年12月15日、ノートなし' }).getAttribute('aria-current')
    ).toBe('date')

    fireEvent.click(screen.getByRole('button', { name: '次の月を表示' }))
    expect(screen.getByRole('heading', { name: '2027年1月' })).toBeTruthy()
    const january31 = screen.getByRole('button', { name: '2027年1月31日、ノートあり' })
    expect(january31.classList.contains('is-selected')).toBe(true)
    fireEvent.click(january31)
    expect(onSelectDate).toHaveBeenCalledTimes(1)
    expect(onSelectDate.mock.calls[0][0]).toEqual(new Date(2027, 0, 31))

    fireEvent.click(screen.getByRole('button', { name: '次の月を表示' }))
    expect(screen.getByRole('heading', { name: '2027年2月' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2027年2月28日、ノートなし' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '2027年2月29日、ノートなし' })).toBeNull()
  })

  it('shows created and updated notes for a day and keeps the daily-note action separate', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 29, 12))
    const notes: NoteDocument[] = [
      {
        path: '10_プロジェクト/New Project.md',
        name: 'New Project',
        content: '# New Project',
        createdAt: new Date(2026, 7, 17, 9).getTime(),
        modifiedAt: new Date(2026, 7, 17, 11).getTime(),
        size: 13
      },
      {
        path: '30_知識/Updated Note.md',
        name: 'Updated Note',
        content: '# Updated Note',
        createdAt: new Date(2026, 6, 1, 9).getTime(),
        modifiedAt: new Date(2026, 7, 17, 18).getTime(),
        size: 14
      },
      {
        path: '02_デイリー/2026-08-17.md',
        name: '2026-08-17',
        content: '# 2026-08-17',
        createdAt: new Date(2026, 7, 15, 9).getTime(),
        modifiedAt: new Date(2026, 7, 16, 18).getTime(),
        size: 12
      },
      {
        path: '50_履歴/AI更新/Hidden.md',
        name: 'Hidden',
        content: '# Hidden',
        createdAt: new Date(2026, 7, 17, 8).getTime(),
        modifiedAt: new Date(2026, 7, 17, 8).getTime(),
        size: 8
      }
    ]
    const onSelectDate = vi.fn()
    const onOpenNote = vi.fn()

    render(
      <DailyCalendar
        notes={notes}
        selectedPath="02_デイリー/2026-08-17.md"
        onSelectDate={onSelectDate}
        onOpenNote={onOpenNote}
      />
    )

    const legend = screen.getByLabelText('ノート活動の見方')
    expect(legend.textContent).toContain('作成')
    expect(legend.textContent).toContain('更新')
    expect(legend.textContent).toContain('日付の印を押すと一覧')

    const activity = screen.getByRole('button', {
      name: '8月17日: 作成1件、最終更新2件'
    })
    fireEvent.click(activity)

    let dialog = screen.getByRole('dialog', { name: '2026年8月17日のノート活動' })
    expect(within(dialog).getByText('作成 1')).toBeTruthy()
    expect(within(dialog).getByText('最終更新 2')).toBeTruthy()
    expect(within(dialog).getByText('New Project')).toBeTruthy()
    expect(within(dialog).getByText('Updated Note')).toBeTruthy()
    expect(within(dialog).queryByText('Hidden')).toBeNull()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Updated Noteを開く' }))
    expect(onOpenNote).toHaveBeenCalledWith('30_知識/Updated Note.md')
    expect(screen.queryByRole('dialog', { name: '2026年8月17日のノート活動' })).toBeNull()

    fireEvent.click(activity)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog', { name: '2026年8月17日のノート活動' })).toBeNull()

    fireEvent.click(activity)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '2026年8月17日のノート活動' })).toBeNull()

    const dailyButton = screen.getByRole('button', {
      name: '2026年8月17日、ノートあり'
    })
    fireEvent.click(dailyButton)
    expect(onSelectDate).toHaveBeenCalledWith(new Date(2026, 7, 17))
  })
})
