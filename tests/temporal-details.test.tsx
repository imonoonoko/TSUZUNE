// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { NoteDocument } from '../src/shared/types'
import TemporalDetails from '../src/renderer/components/TemporalDetails'

function note(path: string, content: string): NoteDocument {
  return {
    path,
    name: path.split('/').at(-1)?.replace(/\.md$/i, '') ?? path,
    content,
    modifiedAt: 0,
    size: content.length
  }
}

afterEach(cleanup)

describe('TemporalDetails', () => {
  it('shows the selected subject timeline with current, historical, future, review-due and superseded labels', () => {
    const selected = note(
      '10_プロジェクト/TSUZUNE.md',
      '# TSUZUNE'
    )
    const notes = [
      selected,
      note(
        '50_履歴/TSUZUNE-旧状態.md',
        [
          '---',
          'kind: state',
          'subject: "[[10_プロジェクト/TSUZUNE]]"',
          'status: planning',
          'valid_from: 2026-07-01',
          'valid_to: 2026-07-20',
          '---',
          '# 計画中'
        ].join('\n')
      ),
      note(
        '50_履歴/TSUZUNE-現在.md',
        [
          '---',
          'kind: state',
          'subject: "[[10_プロジェクト/TSUZUNE]]"',
          'status: active',
          'valid_from: 2026-07-20',
          'review_after: 2026-07-30',
          'supersedes: "[[50_履歴/TSUZUNE-旧状態]]"',
          '---',
          '# 開発中'
        ].join('\n')
      ),
      note(
        '50_履歴/TSUZUNE-次状態.md',
        [
          '---',
          'kind: state',
          'subject: "[[10_プロジェクト/TSUZUNE]]"',
          'status: dogfood',
          'valid_from: 2026-08-10',
          '---',
          '# Dogfood予定'
        ].join('\n')
      )
    ]

    render(
      <TemporalDetails
        selectedNote={selected}
        notes={notes}
        asOf="2026-07-31"
      />
    )

    const inspector = screen.getByRole('region', { name: '時間情報' })
    expect(within(inspector).getByText('現在')).toBeTruthy()
    expect(within(inspector).getByText('過去')).toBeTruthy()
    expect(within(inspector).getByText('未来')).toBeTruthy()
    expect(within(inspector).getByText('再確認期限超過')).toBeTruthy()
    expect(within(inspector).getByText('置き換え済み')).toBeTruthy()
    expect(within(inspector).getByText('TSUZUNE-現在')).toBeTruthy()
    expect(within(inspector).getByText('基準日 2026-07-31')).toBeTruthy()
  })

  it('explains incomplete metadata as a read-only warning', () => {
    const selected = note(
      '50_履歴/不完全な状態.md',
      [
        '---',
        'kind: state',
        'subject: "[[10_プロジェクト/TSUZUNE]]"',
        'status: active',
        'valid_from: someday',
        '---',
        '# 本文'
      ].join('\n')
    )

    render(
      <TemporalDetails
        selectedNote={selected}
        notes={[selected]}
        asOf="2026-07-31"
      />
    )

    const inspector = screen.getByRole('region', { name: '時間情報' })
    const warnings = within(inspector).getByRole('list', {
      name: '時間情報の警告'
    })
    expect(
      within(warnings).getByText(
        'valid_from: 日付またはタイムゾーン付き時刻の形式が正しくありません。'
      )
    ).toBeTruthy()
    expect(within(inspector).queryByRole('button')).toBeNull()
  })
})
