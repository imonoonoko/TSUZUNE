import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { CalendarPluginSettings } from '../../shared/calendar-plugin-settings'
import type { VaultSnapshot } from '../../shared/types'

export interface CalendarPluginFrameHandle {
  runCommand: (id: string) => void
}

export interface CalendarPluginFrameProps {
  sessionId: string
  snapshot: VaultSnapshot
  settings: CalendarPluginSettings
  selectedPath: string | null
  daily?: { format?: string; folder?: string; template?: string }
  onOpenNote: (path: string, newSplit: boolean) => Promise<unknown> | unknown
  onCreateNote: (payload: { path: string; content: string }) => Promise<unknown> | unknown
  onCreateDirectory: (path: string) => Promise<unknown> | unknown
  onSaveSettings: (settings: CalendarPluginSettings) => Promise<unknown> | unknown
  onTrashNote: (path: string) => Promise<unknown> | unknown
  onActivated?: (value: unknown) => void
  onError?: (message: string) => void
}

const allowedActions = new Set(['open-note', 'create-note', 'create-directory', 'save-settings', 'trash-note'])

const CalendarPluginFrame = forwardRef<CalendarPluginFrameHandle, CalendarPluginFrameProps>(function CalendarPluginFrame(props, ref) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const previousSnapshotRef = useRef<VaultSnapshot | null>(null)

  const post = useCallback((message: unknown) => {
    frameRef.current?.contentWindow?.postMessage(
      message,
      'tsuzune-calendar://host'
    )
  }, [])

  const sendInit = useCallback(() => {
    const current = propsRef.current
    post({
      channel: 'tsuzune-calendar',
      session: current.sessionId,
      type: 'init',
      payload: {
        snapshot: current.snapshot,
        settings: current.settings,
        selectedPath: current.selectedPath,
        daily: {
          format: 'YYYY-MM-DD',
          folder: '02_デイリー',
          template: '',
          ...current.daily
        }
      }
    })
    previousSnapshotRef.current = current.snapshot
  }, [post])

  useImperativeHandle(ref, () => ({
    runCommand: (id) => post({ channel: 'tsuzune-calendar', session: propsRef.current.sessionId, type: 'run-command', payload: { id } })
  }), [post])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current
      const message = event.data
      if (!frame || event.source !== frame.contentWindow || !message || message.channel !== 'tsuzune-calendar' || message.session !== propsRef.current.sessionId) return
      if (message.type === 'host-ready' || message.type === 'activated') {
        if (message.type === 'activated') propsRef.current.onActivated?.(message.payload)
        if (message.type === 'host-ready') sendInit()
        return
      }
      if (message.type === 'error') { propsRef.current.onError?.(String(message.payload?.message || 'Calendar plugin error')); return }
      if (message.type !== 'request') return
      const { requestId, action, payload } = message.payload || {}
      if (typeof requestId !== 'string' || !allowedActions.has(action)) {
        post({ channel: 'tsuzune-calendar', session: propsRef.current.sessionId, type: 'response', payload: { requestId, ok: false, error: 'Unsupported Calendar action' } })
        return
      }
      const current = propsRef.current
      const callback = action === 'open-note' ? () => current.onOpenNote(String(payload?.path || ''), Boolean(payload?.newSplit))
        : action === 'create-note' ? () => current.onCreateNote({ path: String(payload?.path || ''), content: String(payload?.content || '') })
          : action === 'create-directory' ? () => current.onCreateDirectory(String(payload?.path || ''))
            : action === 'save-settings' ? () => current.onSaveSettings(payload?.settings ?? payload)
              : () => current.onTrashNote(String(payload?.path || payload || ''))
      Promise.resolve().then(callback).then((value) => post({ channel: 'tsuzune-calendar', session: current.sessionId, type: 'response', payload: { requestId, ok: true, value } }), (error) => post({ channel: 'tsuzune-calendar', session: current.sessionId, type: 'response', payload: { requestId, ok: false, error: error instanceof Error ? error.message : String(error) } }))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [post, sendInit])

  useEffect(() => {
    const previous = previousSnapshotRef.current
    if (!previous) return
    const before = new Map(previous.notes.map((note) => [note.path, note]))
    const after = new Map(props.snapshot.notes.map((note) => [note.path, note]))
    const events: Array<{ type: 'add' | 'change' | 'unlink'; path: string }> = []
    for (const [path, note] of after) {
      const old = before.get(path)
      if (!old) events.push({ type: 'add', path })
      else if (
        old.createdAt !== note.createdAt ||
        old.modifiedAt !== note.modifiedAt ||
        old.size !== note.size ||
        old.content !== note.content
      ) events.push({ type: 'change', path })
    }
    for (const path of before.keys()) {
      if (!after.has(path)) events.push({ type: 'unlink', path })
    }
    previousSnapshotRef.current = props.snapshot
    for (const event of events) {
      post({
        channel: 'tsuzune-calendar',
        session: props.sessionId,
        type: 'snapshot',
        payload: {
          snapshot: props.snapshot,
          selectedPath: props.selectedPath,
          event
        }
      })
    }
  }, [post, props.selectedPath, props.sessionId, props.snapshot])

  useEffect(() => {
    post({
      channel: 'tsuzune-calendar',
      session: props.sessionId,
      type: 'selected-path',
      payload: { path: props.selectedPath }
    })
  }, [post, props.selectedPath, props.sessionId])

  useEffect(() => {
    post({
      channel: 'tsuzune-calendar',
      session: props.sessionId,
      type: 'settings',
      payload: { settings: props.settings }
    })
  }, [post, props.sessionId, props.settings])

  return <iframe ref={frameRef} title="Calendar" src={`tsuzune-calendar://host/?session=${encodeURIComponent(props.sessionId)}`} sandbox="allow-scripts allow-same-origin" onLoad={sendInit} />
})

export default CalendarPluginFrame
