import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  formatMarkdownSelection,
  insertWikiLink,
  type MarkdownFormat
} from '../../core/markdown-edit'
import type { NoteDocument } from '../../shared/types'

export type HumanNoteCaptureSubmission =
  | {
      kind: 'daily'
      completed: string
      insight: string
      memo: string
      next: string
    }
  | {
      kind: 'idea'
      title: string
      body: string
      reason: string
      projectPath: string
      memo: string
      next: string
    }

interface HumanNoteCaptureDialogProps {
  kind: 'daily' | 'idea'
  dateLabel: string
  error: string | null
  initialValues?: HumanNoteCaptureSubmission
  notes: NoteDocument[]
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onSubmit: (submission: HumanNoteCaptureSubmission) => Promise<boolean>
}

interface FriendlyTextareaProps {
  label: string
  value: string
  disabled: boolean
  notes: NoteDocument[]
  onChange: (value: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  required?: boolean
  allowHeading?: boolean
}

function FriendlyTextarea({
  label,
  value,
  disabled,
  notes,
  onChange,
  inputRef,
  required = false,
  allowHeading = false
}: FriendlyTextareaProps): React.JSX.Element {
  const ownRef = useRef<HTMLTextAreaElement | null>(null)
  const textareaRef = inputRef ?? ownRef

  const apply = (format: MarkdownFormat): void => {
    const textarea = textareaRef.current
    if (!textarea || disabled) {
      return
    }
    const result = formatMarkdownSelection(
      value,
      textarea.selectionStart,
      textarea.selectionEnd,
      format
    )
    onChange(result.value)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  const addLink = (path: string): void => {
    const textarea = textareaRef.current
    if (!textarea || !path || disabled) {
      return
    }
    const result = insertWikiLink(
      value,
      textarea.selectionStart,
      textarea.selectionEnd,
      path
    )
    onChange(result.value)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  return (
    <div className="capture-friendly-field">
      <label>
        <span>{label}</span>
        <textarea
          ref={textareaRef}
          value={value}
          required={required}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <div
        className="capture-format-toolbar"
        role="toolbar"
        aria-label={`${label}の書式`}
      >
        {allowHeading && (
          <button
            type="button"
            aria-label={`${label}を見出しにする`}
            disabled={disabled}
            onClick={() => apply('heading')}
          >
            見出し
          </button>
        )}
        <button
          type="button"
          aria-label={`${label}を太字にする`}
          disabled={disabled}
          onClick={() => apply('bold')}
        >
          太字
        </button>
        <button
          type="button"
          aria-label={`${label}を箇条書きにする`}
          disabled={disabled}
          onClick={() => apply('list')}
        >
          箇条書き
        </button>
        <button
          type="button"
          aria-label={`${label}をチェック項目にする`}
          disabled={disabled}
          onClick={() => apply('task')}
        >
          チェック
        </button>
        <select
          aria-label={`${label}に関連ノートを挿入`}
          value=""
          disabled={disabled}
          onChange={(event) => addLink(event.target.value)}
        >
          <option value="">関連ノートを挿入…</option>
          {notes.map((note) => (
            <option key={note.path} value={note.path}>
              {note.path.replace(/\.md$/i, '')}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function HumanNoteCaptureDialog({
  kind,
  dateLabel,
  error,
  initialValues,
  notes,
  onCancel,
  onDirtyChange,
  onSubmit
}: HumanNoteCaptureDialogProps): React.JSX.Element {
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(
    initialValues?.kind === 'daily' ? initialValues.completed : ''
  )
  const [insight, setInsight] = useState(
    initialValues?.kind === 'daily' ? initialValues.insight : ''
  )
  const [memo, setMemo] = useState(
    initialValues?.kind === 'daily' || initialValues?.kind === 'idea'
      ? initialValues.memo
      : ''
  )
  const [next, setNext] = useState(
    initialValues?.kind === 'daily' || initialValues?.kind === 'idea'
      ? initialValues.next
      : ''
  )
  const [title, setTitle] = useState(
    initialValues?.kind === 'idea' ? initialValues.title : ''
  )
  const [body, setBody] = useState(
    initialValues?.kind === 'idea' ? initialValues.body : ''
  )
  const [reason, setReason] = useState(
    initialValues?.kind === 'idea' ? initialValues.reason : ''
  )
  const [projectPath, setProjectPath] = useState(
    initialValues?.kind === 'idea' ? initialValues.projectPath : ''
  )
  const initialFormRef = useRef({
    completed,
    insight,
    memo,
    next,
    title,
    body,
    reason,
    projectPath
  })
  const projectNotes = notes.filter((note) => note.path.startsWith('10_プロジェクト/'))

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    const initial = initialFormRef.current
    onDirtyChange(
      completed !== initial.completed ||
        insight !== initial.insight ||
        memo !== initial.memo ||
        next !== initial.next ||
        title !== initial.title ||
        body !== initial.body ||
        reason !== initial.reason ||
        projectPath !== initial.projectPath
    )
  }, [body, completed, insight, memo, next, onDirtyChange, projectPath, reason, title])

  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (submitting) {
      return
    }
    setSubmitting(true)
    try {
      const saved = await onSubmit(
        kind === 'daily'
          ? { kind, completed, insight, memo, next }
          : { kind, title, body, reason, projectPath, memo, next }
      )
      if (saved) {
        onDirtyChange(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const titleId = `${kind}-capture-title`

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel()
      }}
    >
      <section
        className="modal human-note-capture-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !submitting) {
            event.preventDefault()
            onCancel()
          }
        }}
      >
        <form onSubmit={(event) => void submit(event)}>
          <div className="capture-heading">
            <div>
              <h2 id={titleId}>
                {kind === 'daily' ? '今日のノート' : 'アイデアを追加'}
              </h2>
              <p>
                {kind === 'daily'
                  ? `${dateLabel}の記録です。空欄はノートに追加しません。`
                  : '項目を入力するだけで、通常のノートとして保存します。'}
              </p>
            </div>
            <button
              type="button"
              aria-label="入力を閉じる"
              disabled={submitting}
              onClick={onCancel}
            >
              ×
            </button>
          </div>

          {error && (
            <p className="google-sync-error" role="alert" aria-live="assertive">
              {error}
            </p>
          )}

          {kind === 'daily' ? (
            <div className="capture-fields">
              <FriendlyTextarea
                label="今日やったこと"
                value={completed}
                disabled={submitting}
                notes={notes}
                inputRef={firstInputRef as React.RefObject<HTMLTextAreaElement | null>}
                onChange={setCompleted}
              />
              <FriendlyTextarea
                label="気づき"
                value={insight}
                disabled={submitting}
                notes={notes}
                onChange={setInsight}
              />
              <FriendlyTextarea
                label="メモ"
                value={memo}
                disabled={submitting}
                notes={notes}
                onChange={setMemo}
              />
              <label>
                <span>次にすること</span>
                <textarea
                  aria-label="次にすること"
                  value={next}
                  disabled={submitting}
                  onChange={(event) => setNext(event.target.value)}
                />
                <small>1行につき1件、チェック項目として保存します。</small>
              </label>
            </div>
          ) : (
            <div className="capture-fields">
              <label>
                <span>タイトル</span>
                <input
                  ref={firstInputRef as React.RefObject<HTMLInputElement | null>}
                  value={title}
                  required
                  disabled={submitting}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <FriendlyTextarea
                label="内容"
                value={body}
                required
                disabled={submitting}
                notes={notes}
                onChange={setBody}
              />
              <FriendlyTextarea
                label="思いついた理由"
                value={reason}
                disabled={submitting}
                notes={notes}
                onChange={setReason}
              />
              <label>
                <span>関連プロジェクト</span>
                <select
                  value={projectPath}
                  disabled={submitting}
                  onChange={(event) => setProjectPath(event.target.value)}
                >
                  <option value="">関連付けない</option>
                  {projectNotes.map((note) => (
                    <option key={note.path} value={note.path}>
                      {note.path.replace(/\.md$/i, '')}
                    </option>
                  ))}
                </select>
              </label>
              <FriendlyTextarea
                label="メモ"
                value={memo}
                disabled={submitting}
                notes={notes}
                onChange={setMemo}
              />
              <label>
                <span>次の一歩</span>
                <textarea
                  aria-label="次の一歩"
                  value={next}
                  disabled={submitting}
                  onChange={(event) => setNext(event.target.value)}
                />
                <small>1行につき1件、チェック項目として保存します。</small>
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" disabled={submitting} onClick={onCancel}>
              キャンセル
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? '保存中…' : '保存して開く'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
