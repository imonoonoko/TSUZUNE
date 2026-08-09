import { useEffect, useRef, useState } from 'react'
import type { NoteDocument } from '../../shared/types'

export type HumanNoteCaptureSubmission =
  | {
      kind: 'note'
      title: string
    }
  | {
      kind: 'daily'
      completed: string
      insight: string
      next: string
    }
  | {
      kind: 'idea'
      title: string
      body: string
      reason: string
      projectPath: string
      next: string
    }

interface HumanNoteCaptureDialogProps {
  kind: 'note' | 'daily' | 'idea'
  dateLabel: string
  initialTitle?: string
  initialValues?: HumanNoteCaptureSubmission
  projectNotes: NoteDocument[]
  onCancel: () => void
  onSubmit: (submission: HumanNoteCaptureSubmission) => Promise<boolean>
}

export default function HumanNoteCaptureDialog({
  kind,
  dateLabel,
  initialTitle = '',
  initialValues,
  projectNotes,
  onCancel,
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
  const [next, setNext] = useState(
    initialValues?.kind === 'daily' || initialValues?.kind === 'idea'
      ? initialValues.next
      : ''
  )
  const [title, setTitle] = useState(
    initialValues?.kind === 'note' || initialValues?.kind === 'idea'
      ? initialValues.title
      : initialTitle
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

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (submitting) {
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(
        kind === 'note'
          ? { kind, title }
          : kind === 'daily'
            ? { kind, completed, insight, next }
            : { kind, title, body, reason, projectPath, next }
      )
    } finally {
      setSubmitting(false)
    }
  }

  const titleId = `${kind}-capture-title`

  return (
    <div className="modal-backdrop" role="presentation">
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
                {kind === 'note'
                  ? '新しいノート'
                  : kind === 'daily'
                    ? '今日のノート'
                    : 'アイデアを追加'}
              </h2>
              <p>
                {kind === 'note'
                  ? 'ノート名を入力してください。'
                  : kind === 'daily'
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

          {kind === 'note' ? (
            <div className="capture-fields">
              <label>
                <span>ノート名</span>
                <input
                  ref={firstInputRef as React.RefObject<HTMLInputElement | null>}
                  value={title}
                  required
                  disabled={submitting}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
            </div>
          ) : kind === 'daily' ? (
            <div className="capture-fields">
              <label>
                <span>今日やったこと</span>
                <textarea
                  ref={firstInputRef as React.RefObject<HTMLTextAreaElement | null>}
                  value={completed}
                  disabled={submitting}
                  onChange={(event) => setCompleted(event.target.value)}
                />
              </label>
              <label>
                <span>気づき</span>
                <textarea
                  value={insight}
                  disabled={submitting}
                  onChange={(event) => setInsight(event.target.value)}
                />
              </label>
              <label>
                <span>次にすること</span>
                <input
                  value={next}
                  disabled={submitting}
                  onChange={(event) => setNext(event.target.value)}
                />
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
              <label>
                <span>内容</span>
                <textarea
                  value={body}
                  required
                  disabled={submitting}
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>
              <label>
                <span>思いついた理由</span>
                <textarea
                  value={reason}
                  disabled={submitting}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
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
                      {note.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>次の一歩</span>
                <input
                  value={next}
                  disabled={submitting}
                  onChange={(event) => setNext(event.target.value)}
                />
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
