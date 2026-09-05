// @vitest-environment jsdom

import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HumanNoteCaptureDialog from '../src/renderer/components/HumanNoteCaptureDialog'

afterEach(cleanup)

describe('HumanNoteCaptureDialog', () => {
  it('dismisses from the backdrop only while idle', async () => {
    const onCancel = vi.fn()
    let resolveSubmit: (saved: boolean) => void = () => undefined
    const onSubmit = vi.fn(
      () => new Promise<boolean>((resolve) => { resolveSubmit = resolve })
    )
    render(
      <HumanNoteCaptureDialog
        kind="daily"
        dateLabel="2026-08-27"
        error={null}
        notes={[]}
        onCancel={onCancel}
        onDirtyChange={vi.fn()}
        onSubmit={onSubmit}
      />
    )
    const backdrop = document.querySelector('.modal-backdrop') as HTMLElement
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledOnce()

    onCancel.mockClear()
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement)
    expect(onSubmit).toHaveBeenCalledOnce()
    fireEvent.click(backdrop)
    expect(onCancel).not.toHaveBeenCalled()
    await act(async () => {
      resolveSubmit(true)
      await Promise.resolve()
    })
  })
})
