// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PropertyChangePanel from '../src/renderer/components/PropertyChangePanel'
import type { PropertyApplyResult, PropertyPreviewResult } from '../src/shared/property-changes'

afterEach(cleanup)

const scope = { rootPath: 'C:/Vault', rootRevision: 4 }
const previewResult = (paths: string[]): PropertyPreviewResult => ({ items: paths.map((path) => ({ path, expectedRevision: `rev:${path}`, before: { type: 'text', value: 'old' }, after: { type: 'text', value: 'new' }, changed: true })) })
const applyResult = (saved: string[], failed: string[] = [], notAttempted: string[] = []): PropertyApplyResult => ({ saved, unchanged: [], failed: failed.map((path) => ({ path, code: 'FAIL', message: 'failed' })), notAttempted })

describe('PropertyChangePanel', () => {
  it('requires explicit bulk selection and invalidates preview when selection or operation changes', async () => {
    const onPreview = vi.fn(async (_operation, paths: string[]) => previewResult(paths))
    const onApply = vi.fn(async () => applyResult(['A.md']))
    render(<PropertyChangePanel scope={scope} paths={['A.md', 'B.md']} property="status" onPreview={onPreview} onApply={onApply} />)
    const preview = screen.getByRole('button', { name: '変更をプレビュー' })
    expect((preview as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'A.mdを対象にする' }))
    fireEvent.click(preview)
    await screen.findByRole('region', { name: '変更プレビュー' })
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ kind: 'convert', property: 'status' }), ['A.md'])
    expect((screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('checkbox', { name: 'B.mdを対象にする' }))
    expect(screen.queryByRole('region', { name: '変更プレビュー' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: '名前を変更' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しい名前' }), { target: { value: 'state' } })
    fireEvent.click(screen.getByRole('button', { name: '変更をプレビュー' }))
    await screen.findByRole('region', { name: '変更プレビュー' })
    fireEvent.change(screen.getByRole('textbox', { name: '新しい名前' }), { target: { value: 'phase' } })
    expect(screen.queryByRole('region', { name: '変更プレビュー' })).toBeNull()
  })

  it('blocks save when selected preview items contain issues and reports partial apply results', async () => {
    const onPreview = vi.fn(async (_operation, paths: string[]) => ({ ...previewResult(paths), items: previewResult(paths).items.map((item, index) => index ? { ...item, issue: { code: 'BAD', message: 'invalid value' } } : item) }))
    const onApply = vi.fn(async () => applyResult(['A.md'], ['B.md'], ['C.md']))
    render(<PropertyChangePanel scope={scope} paths={['A.md', 'B.md', 'C.md']} property="status" onPreview={onPreview} onApply={onApply} />)
    for (const path of ['A.md', 'B.md']) fireEvent.click(screen.getByRole('checkbox', { name: `${path}を対象にする` }))
    fireEvent.click(screen.getByRole('button', { name: '変更をプレビュー' }))
    await screen.findByText('invalid value')
    expect((screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: 'B.mdを対象にする' }))
    fireEvent.click(screen.getByRole('button', { name: '変更をプレビュー' }))
    await waitFor(() => expect((screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    await screen.findByRole('status', { name: '変更結果' })
    expect(screen.getByText('保存: A.md')).toBeTruthy()
    expect(screen.getByText('失敗: B.md: failed')).toBeTruthy()
    expect(screen.getByText('未実行: C.md')).toBeTruthy()
    expect((screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '失敗・未実行を再試行' }))
    expect((screen.getByRole('checkbox', { name: 'A.mdを対象にする' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('checkbox', { name: 'B.mdを対象にする' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('checkbox', { name: 'C.mdを対象にする' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByRole('button', { name: '変更を保存' })).toBeNull()
  })

  it('uses single mode defaults, current typed value, and requires a fresh preview after editing', async () => {
    const onPreview = vi.fn(async (_operation, paths: string[]) => previewResult(paths))
    const onApply = vi.fn(async () => applyResult(['A.md']))
    render(<PropertyChangePanel scope={scope} paths={['A.md']} property="priority" declaredType="number" initialValue={{ type: 'number', value: '7' }} single onPreview={onPreview} onApply={onApply} />)
    expect((screen.getByRole('checkbox', { name: 'A.mdを対象にする' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('textbox', { name: '設定値' }) as HTMLTextAreaElement).value).toBe('7')
    fireEvent.change(screen.getByRole('textbox', { name: '設定値' }), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: '変更をプレビュー' }))
    await screen.findByRole('region', { name: '変更プレビュー' })
    expect(onPreview).toHaveBeenCalledWith({ kind: 'set', property: 'priority', value: { type: 'number', value: '8' } }, ['A.md'])
  })
})
