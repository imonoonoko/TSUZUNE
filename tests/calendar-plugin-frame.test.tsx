// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CalendarPluginFrame from '../src/renderer/components/CalendarPluginFrame'
import { DEFAULT_CALENDAR_PLUGIN_SETTINGS } from '../src/shared/calendar-plugin-settings'
import type { VaultSnapshot } from '../src/shared/types'

const snapshot: VaultSnapshot = { rootPath: 'x', rootName: 'x', directories: [], notes: [] }
const props = { sessionId: 's1', snapshot, settings: DEFAULT_CALENDAR_PLUGIN_SETTINGS, selectedPath: null, onOpenNote: vi.fn(), onCreateNote: vi.fn(), onCreateDirectory: vi.fn(), onSaveSettings: vi.fn(), onTrashNote: vi.fn() }

describe('CalendarPluginFrame', () => {
  it('rejects wrong source/session and unknown actions', () => {
    const { container } = render(<CalendarPluginFrame {...props} />)
    const frame = container.querySelector('iframe')!
    const post = vi.spyOn(frame.contentWindow!, 'postMessage')
    const emit = (source: EventTarget, data: unknown) => {
      const event = new MessageEvent('message', { data })
      Object.defineProperty(event, 'source', { value: source })
      window.dispatchEvent(event)
    }
    emit(window, { channel: 'tsuzune-calendar', session: 's1', type: 'request', payload: { requestId: 'x', action: 'unknown' } })
    expect(post).not.toHaveBeenCalled()
    emit(frame.contentWindow!, { channel: 'tsuzune-calendar', session: 'other', type: 'request', payload: { requestId: 'x', action: 'unknown' } })
    expect(post).not.toHaveBeenCalled()
    emit(frame.contentWindow!, { channel: 'tsuzune-calendar', session: 's1', type: 'request', payload: { requestId: 'x', action: 'unknown' } })
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'response', payload: expect.objectContaining({ ok: false }) }), 'tsuzune-calendar://host')
  })

  it('sends a snapshot change when only a note creation timestamp changes', () => {
    const note = {
      path: '30_知識/Created.md',
      name: 'Created',
      content: '# Created',
      createdAt: 100,
      modifiedAt: 300,
      size: 9
    }
    const initialSnapshot: VaultSnapshot = {
      rootPath: 'x',
      rootName: 'x',
      directories: ['30_知識'],
      notes: [note]
    }
    const { container, rerender } = render(
      <CalendarPluginFrame {...props} snapshot={initialSnapshot} />
    )
    const frame = container.querySelector('iframe')!
    const post = vi.spyOn(frame.contentWindow!, 'postMessage')
    const ready = new MessageEvent('message', {
      data: { channel: 'tsuzune-calendar', session: 's1', type: 'host-ready' }
    })
    Object.defineProperty(ready, 'source', { value: frame.contentWindow })
    window.dispatchEvent(ready)
    post.mockClear()

    rerender(
      <CalendarPluginFrame
        {...props}
        snapshot={{
          ...initialSnapshot,
          notes: [{ ...note, createdAt: 200 }]
        }}
      />
    )

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'snapshot',
        payload: expect.objectContaining({
          event: { type: 'change', path: note.path }
        })
      }),
      'tsuzune-calendar://host'
    )
  })
})
