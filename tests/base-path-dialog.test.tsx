// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BasePathDialog from '../src/renderer/components/BasePathDialog'

const candidates = ['projects/ＡＢＣ.base', 'projects/企画/一覧.base', 'archive/企画/一覧.base']

function dialog(overrides: Partial<React.ComponentProps<typeof BasePathDialog>> = {}) {
  return <BasePathDialog
    candidates={candidates}
    loading={false}
    listError={null}
    onRefresh={vi.fn()}
    onCancel={vi.fn()}
    onConfirm={vi.fn()}
    {...overrides}
  />
}

afterEach(cleanup)

describe('BasePathDialog', () => {
  it('filters with NFKC whitespace AND matching while preserving duplicate filenames and their paths', () => {
    render(dialog())
    const search = screen.getByRole('combobox', { name: 'Baseを検索' })

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'ＡＢＣ.baseprojects/ＡＢＣ.base',
      '一覧.baseprojects/企画/一覧.base',
      '一覧.basearchive/企画/一覧.base'
    ])
    fireEvent.change(search, { target: { value: '企画　 一覧' } })
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      '一覧.baseprojects/企画/一覧.base',
      '一覧.basearchive/企画/一覧.base'
    ])
    fireEvent.change(search, { target: { value: 'abc' } })
    expect(screen.getByRole('option').textContent).toContain('ＡＢＣ.base')
  })

  it('keeps the selected path across refresh if it survives, and resets selection when the query changes', () => {
    const onConfirm = vi.fn()
    const { rerender } = render(dialog({ onConfirm }))
    const search = screen.getByRole('combobox', { name: 'Baseを検索' })
    const second = screen.getAllByRole('option')[1]
    fireEvent.click(second)
    expect(search.getAttribute('aria-activedescendant')).toBe('base-path-option-projects%2F%E4%BC%81%E7%94%BB%2F%E4%B8%80%E8%A6%A7.base')

    rerender(dialog({ onConfirm, loading: true, candidates: [] }))
    expect(screen.getByText('Baseを探しています')).toBeTruthy()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    rerender(dialog({ onConfirm, candidates: ['projects/企画/一覧.base', 'new/Other.base'] }))
    expect(search.getAttribute('aria-activedescendant')).toBe('base-path-option-projects%2F%E4%BC%81%E7%94%BB%2F%E4%B8%80%E8%A6%A7.base')

    fireEvent.change(search, { target: { value: 'other' } })
    expect(search.getAttribute('aria-activedescendant')).toBe('base-path-option-new%2FOther.base')
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('new/Other.base', 'list')
  })

  it('keeps list and manual confirmations separate and validates a manual path', () => {
    const onConfirm = vi.fn()
    render(dialog({ onConfirm }))
    fireEvent.click(screen.getByRole('button', { name: 'パスを入力して開く' }))
    expect(screen.queryByRole('option')).toBeNull()
    const input = screen.getByRole('textbox', { name: 'Vault相対の.baseパス' })
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: '.hidden/base.base' } })
    expect((screen.getByRole('button', { name: '開く' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'views\\projects.BASE' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('views/projects.BASE', 'manual')

    fireEvent.click(screen.getByRole('button', { name: '一覧から選ぶ' }))
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Baseを検索' }))
    fireEvent.click(screen.getByRole('button', { name: '開く' }))
    expect(onConfirm).toHaveBeenLastCalledWith('projects/ＡＢＣ.base', 'list')
  })

  it('supports keyboard selection, confirmation, and visible-control focus trapping', () => {
    const onConfirm = vi.fn()
    render(dialog({ onConfirm }))
    const search = screen.getByRole('combobox', { name: 'Baseを検索' })
    expect(document.activeElement).toBe(search)
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('projects/企画/一覧.base', 'list')

    fireEvent.keyDown(search, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '開く' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(search)
  })

  it('does not confirm or cancel during list or manual IME composition', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(dialog({ onConfirm, onCancel }))
    const search = screen.getByRole('combobox', { name: 'Baseを検索' })

    fireEvent.compositionStart(search)
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(search, { key: 'Escape', isComposing: true })
    fireEvent.submit(search.closest('form')!)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.compositionEnd(search)
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'パスを入力して開く' }))
    const manualInput = screen.getByRole('textbox', { name: 'Vault相対の.baseパス' })
    fireEvent.change(manualInput, { target: { value: 'views/ime.base' } })
    expect(fireEvent.keyDown(manualInput, { key: 'Enter', isComposing: true })).toBe(false)
    fireEvent.keyDown(manualInput, { key: 'ArrowDown', isComposing: true })
    fireEvent.keyDown(manualInput, { key: 'Escape', isComposing: true })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()

    fireEvent.compositionStart(manualInput)
    fireEvent.submit(manualInput.closest('form')!)
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.compositionEnd(manualInput)
    fireEvent.keyDown(manualInput, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('views/ime.base', 'manual')
  })

  it('keeps cancel and manual entry available while loading, but disables every operation while busy', () => {
    const onCancel = vi.fn()
    const { rerender } = render(dialog({ loading: true, onCancel }))
    expect(screen.getByText('Baseを探しています')).toBeTruthy()
    expect((screen.getByRole('button', { name: '一覧を更新' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'キャンセル' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'パスを入力して開く' }) as HTMLButtonElement).disabled).toBe(false)

    rerender(dialog({ busy: true, onCancel }))
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('distinguishes list failure, empty candidates, and an empty filter result', () => {
    const { rerender } = render(dialog({ listError: 'Vaultを確認してください。' }))
    expect(screen.getByText(/一覧を取得できませんでした/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'パスを入力して開く' }) as HTMLButtonElement).disabled).toBe(false)

    rerender(dialog({ candidates: [] }))
    expect(screen.getByRole('status').textContent).toContain('一覧に表示できるBaseがありません。')
    rerender(dialog({ candidates: ['projects/base.base'] }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Baseを検索' }), { target: { value: 'missing' } })
    expect(screen.getByText('一致するBaseがありません')).toBeTruthy()
  })
})
