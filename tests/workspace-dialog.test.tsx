// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorkspaceDialog from '../src/renderer/components/WorkspaceDialog'
import type { VaultWorkspacesV1 } from '../src/shared/workspace-state'

const snapshot = {
  tabs: [],
  activeIndex: null,
  noteView: 'edit' as const,
  left: { open: true, view: 'files' as const, query: '' },
  right: { open: false, view: 'links' as const }
}

const named: VaultWorkspacesV1['named'] = [
  { name: '調査', savedAt: '2026-09-06T06:00:00.000Z', snapshot },
  { name: '執筆', savedAt: '2026-09-05T22:10:00.000Z', snapshot }
]

afterEach(cleanup)

describe('WorkspaceDialog', () => {
  it('validates names and requires an explicit update for an exact same-name save', () => {
    const onSave = vi.fn()
    render(<WorkspaceDialog named={named} mode="save" busy={false} error={null}
      onSave={onSave} onLoad={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    const name = screen.getByRole('textbox', { name: 'ワークスペース名' })

    fireEvent.change(name, { target: { value: ' \n ' } })
    expect(screen.getByText('名前は1〜80文字で入力してください。')).toBeTruthy()
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(name, { target: { value: '調査' } })
    expect(screen.getByRole('button', { name: 'この名前で更新' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'この名前で更新' }))
    expect(onSave).toHaveBeenCalledWith('調査', true)
  })

  it('ignores IME confirmation and loads or confirms deletion with keyboard-accessible controls', () => {
    const onSave = vi.fn()
    const onLoad = vi.fn()
    const onDelete = vi.fn()
    const { rerender } = render(<WorkspaceDialog named={named} mode="save" busy={false} error={null}
      onSave={onSave} onLoad={onLoad} onDelete={onDelete} onClose={vi.fn()} />)

    const saveName = screen.getByRole('textbox', { name: 'ワークスペース名' })
    fireEvent.change(saveName, { target: { value: '新規' } })
    fireEvent.keyDown(saveName, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(saveName, { key: 'Process' })
    expect(onSave).not.toHaveBeenCalled()

    rerender(<WorkspaceDialog named={named} mode="open" busy={false} error={null}
      onSave={onSave} onLoad={onLoad} onDelete={onDelete} onClose={vi.fn()} />)
    expect(screen.queryByRole('textbox', { name: 'ワークスペース名' })).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: '開く' })[0])
    expect(onLoad).toHaveBeenCalledWith(snapshot, '調査')
    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0])
    expect(screen.getByRole('dialog', { name: '調査を削除' })).toBeTruthy()
    expect(screen.getByText('ノートは削除されません。')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBe(document.activeElement)
    fireEvent.click(screen.getByRole('button', { name: '削除する' }))
    expect(onDelete).toHaveBeenCalledWith('調査')
  })

  it('traps dialog focus and restores the launch control when closed', async () => {
    const launch = document.createElement('button')
    document.body.append(launch)
    launch.focus()
    const onClose = vi.fn()
    render(<WorkspaceDialog named={named} mode="open" busy={false} error={null}
      onSave={vi.fn()} onLoad={vi.fn()} onDelete={vi.fn()} onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: 'ワークスペース' })
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
    buttons.at(-1)!.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(buttons[0])
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))
    await Promise.resolve()
    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(launch)
    launch.remove()
  })

  it('focuses the close control when opening an empty saved-workspace list', () => {
    render(<WorkspaceDialog named={[]} mode="open" busy={false} error={null}
      onSave={vi.fn()} onLoad={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '閉じる' }))
  })
})
