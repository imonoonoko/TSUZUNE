import { useEffect, useMemo, useRef, useState } from 'react'
import { addTodo, changeTodo, readTodos, TODO_PATH, type TodoItem } from '../../core/todos'
import { buildWikiLinkIndex, extractNoteLinks, resolveIndexedNoteLink } from '../../core/links'
import type { CompiledPathAliases } from '../../core/path-aliases'
import type { NoteDocument } from '../../shared/types'

interface TodoPanelProps {
  notes?: NoteDocument[]
  pathAliases?: CompiledPathAliases
  onOpenNote?: (path: string) => void
  beforeSave?: () => Promise<boolean>
  afterSave?: () => void
  onSaved?: (note: NoteDocument) => void
}

export default function TodoPanel({ notes = [], pathAliases, onOpenNote, beforeSave, afterSave, onSaved }: TodoPanelProps): React.JSX.Element {
  const [note, setNote] = useState<NoteDocument | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const saving = useRef(false)
  const alive = useRef(true)
  const index = useMemo(() => buildWikiLinkIndex(notes, pathAliases), [notes, pathAliases])
  const snapshotNote = notes.find(item => item.path === TODO_PATH)
  const snapshotContent = snapshotNote?.content
  const snapshotModifiedAt = snapshotNote?.modifiedAt
  const observedSnapshot = useRef({ content: snapshotContent, modifiedAt: snapshotModifiedAt })

  const load = async (): Promise<void> => {
    if (saving.current) return
    saving.current = true; setBusy(true); setReady(false); setError(null)
    try {
      const result = await window.tsuzune.readNote(TODO_PATH)
      if (!alive.current) return
      if (result.ok) { setNote(result.value); setReady(true) }
      else if (result.error.code === 'NOT_FOUND') { setNote(null); setReady(true) }
      else setError(result.error.message)
    } catch (cause) { if (alive.current) setError(String(cause)) }
    finally { saving.current = false; if (alive.current) setBusy(false) }
  }

  useEffect(() => {
    alive.current = true
    void load()
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    if (busy || (observedSnapshot.current.content === snapshotContent &&
      observedSnapshot.current.modifiedAt === snapshotModifiedAt)) return
    observedSnapshot.current = { content: snapshotContent, modifiedAt: snapshotModifiedAt }
    if (note?.content !== snapshotContent || note?.modifiedAt !== snapshotModifiedAt) void load()
  }, [busy, note, snapshotContent, snapshotModifiedAt])

  const save = async (mutation: (content: string) => string, clearTitle = false): Promise<void> => {
    if (saving.current || !ready) return
    let content: string
    try { content = mutation(note?.content ?? '# ToDo\n\n') }
    catch (cause) { setError((cause as Error).message); return }
    saving.current = true; setBusy(true); setError(null)
    let acquired = false
    try {
      if (beforeSave) {
        acquired = await beforeSave()
        if (!acquired) { if (alive.current) setError('ノートの未保存の編集を保存してから再試行してください。'); return }
      }
      if (!alive.current) return
      const result = note
        ? await window.tsuzune.saveNote({ path: TODO_PATH, content, expectedModifiedAt: note.modifiedAt, expectedContent: note.content })
        : await window.tsuzune.createNote({ directory: '', name: 'ToDo', content })
      if (!alive.current) return
      if (!result.ok) {
        setError(result.error.message)
        if (['FILE_CHANGED', 'ALREADY_EXISTS', 'NOT_FOUND'].includes(result.error.code)) setReady(false)
        return
      }
      if (clearTitle) setTitle('')
      const saved = await window.tsuzune.readNote(TODO_PATH)
      if (!alive.current) return
      if (!saved.ok) { setReady(false); setError(`保存後の内容を確認できませんでした。${saved.error.message}`); return }
      setNote(saved.value)
      if (saved.value.content !== content) setError('保存後に内容が変更されました。現在の内容を表示しています。')
      onSaved?.(saved.value)
    } catch (cause) { if (alive.current) setError(String(cause)) }
    finally {
      saving.current = false
      if (alive.current) setBusy(false)
      if (acquired) afterSave?.()
      if (clearTitle && alive.current) requestAnimationFrame(() => input.current?.focus())
    }
  }

  const items = useMemo(() => readTodos(note?.content ?? ''), [note?.content])
  const noteLinks = useMemo(() => new Map(items.map(item => [item.from,
    extractNoteLinks(item.title, TODO_PATH).flatMap(link => {
      const resolved = resolveIndexedNoteLink(link, index)
      return resolved.status === 'resolved' ? [{ path: resolved.path, label: link.alias ?? link.target }] : []
    })])), [items, index])
  const pending = items.filter(item => !item.done), completed = items.filter(item => item.done)
  const renderItems = (tasks: TodoItem[]): React.JSX.Element => <ul className="todo-list">{tasks.map(item => {
    const links = noteLinks.get(item.from) ?? []
    return <li key={item.from}>
      <div className="todo-item-content">
        <label><input type="checkbox" checked={item.done} disabled={busy || !ready}
          onChange={() => void save(content => changeTodo(content, item, 'toggle'))} /><span title={item.title}>{item.title}</span></label>
        {onOpenNote && links.length > 0 && <div className="todo-note-links">{links.map((link, i) => <button type="button" key={i}
          disabled={busy} onClick={() => onOpenNote(link.path)}>{link.label}を開く</button>)}</div>}
      </div>
      <button type="button" className="todo-delete" disabled={busy || !ready} aria-label={`${item.title}を削除`}
        onClick={() => void save(content => changeTodo(content, item, 'delete'))}>削除</button>
    </li>
  })}</ul>

  return <section className="daily-profile-card todo-panel" aria-labelledby="todo-title" aria-busy={busy}>
    <header className="todo-panel-heading"><div><h2 id="todo-title">ToDo</h2><p className="muted">未完了 {pending.length} · 完了 {completed.length}</p></div>
      <div className="todo-panel-actions"><button type="button" disabled={busy} onClick={() => void load()}>再読込</button>
        {onOpenNote && <button type="button" disabled={busy || !note} onClick={() => onOpenNote(TODO_PATH)}>ToDoノートを開く</button>}</div>
    </header>
    <form className="todo-add-form" onSubmit={event => { event.preventDefault(); void save(content => addTodo(content, title), true) }}>
      <label htmlFor="todo-new-title" className="sr-only">新しいToDo</label>
      <input id="todo-new-title" ref={input} value={title} disabled={busy || !ready} maxLength={1000} placeholder="新しいToDoを入力"
        autoComplete="off" onChange={event => setTitle(event.target.value)} />
      <button type="submit" className="primary-button" disabled={busy || !ready}>追加</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {busy && !ready && <p role="status">ToDoを読み込んでいます。</p>}
    {ready && <><h3 className="sr-only">未完了のToDo</h3>
      {pending.length ? renderItems(pending) : <p className="todo-empty">{completed.length ? '未完了のToDoはありません。' : 'ToDoはまだありません。上の入力欄から追加できます。'}</p>}
      {completed.length > 0 && <details className="todo-completed"><summary>完了済み ({completed.length})</summary>{renderItems(completed)}</details>}
    </>}
  </section>
}
