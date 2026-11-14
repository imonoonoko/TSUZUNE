import { useEffect, useMemo, useRef, useState } from 'react'
import { readNoteTasks, type NoteTask } from '../../core/note-tasks'
import type { NoteDocument } from '../../shared/types'

interface NoteTasksPanelProps {
  notes: NoteDocument[]
  onTask: (note: NoteDocument, task: NoteTask, toggle: boolean) => Promise<string | null>
  onReload: () => Promise<boolean>
}

export default function NoteTasksPanel({ notes, onTask, onReload }: NoteTasksPanelProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const rows = useMemo(() => notes.flatMap(note => readNoteTasks(note.content).map(task => ({ note, task,
    line: note.content.slice(0, task.from).split(/\r\n|\n|\r/).length }))), [notes])
  const pending = rows.filter(row => !row.task.done), completed = rows.filter(row => row.task.done)
  const run = async (action: () => Promise<string | null>): Promise<void> => {
    if (running.current) return
    running.current = true; setBusy(true)
    try { const message = await action(); if (alive.current) setError(message) }
    catch (cause) { if (alive.current) setError(String(cause)) }
    finally { running.current = false; if (alive.current) setBusy(false) }
  }
  const renderRows = (items: typeof rows): React.JSX.Element => <ul className="todo-list">{items.map(({ note, task, line }) =>
    <li key={`${note.path}:${task.from}`}><div className="todo-item-content">
      <label><input type="checkbox" checked={task.done} disabled={busy || Boolean(error)}
        onChange={() => void run(() => onTask(note, task, true))} /><span>{task.title}</span></label>
      <div className="todo-note-links"><button type="button" disabled={busy || Boolean(error)}
        onClick={() => void run(() => onTask(note, task, false))}>{note.path} · {line}行目</button></div>
    </div></li>)}</ul>
  return <section className="daily-profile-card note-tasks-panel" aria-labelledby="note-tasks-title" aria-busy={busy}>
    <header className="todo-panel-heading"><div><h2 id="note-tasks-title">ノートのタスク</h2>
      <p className="muted">未完了 {pending.length} · ノートの行を開くか、チェックして完了できます。</p></div>
      <button type="button" disabled={busy} onClick={() => void run(async () => await onReload() ? null : '再読込できませんでした。もう一度お試しください。')}>再読込</button>
    </header>
    {error && <p role="alert">{error}</p>}
    {pending.length ? renderRows(pending) : <p className="todo-empty">未完了のタスクはありません。</p>}
    {completed.length > 0 && <details className="todo-completed"><summary>完了済み ({completed.length})</summary>{renderRows(completed)}</details>}
  </section>
}
