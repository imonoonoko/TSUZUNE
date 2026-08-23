import { useEffect, useRef } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { Compartment, EditorState } from '@codemirror/state'
import {
  formatMarkdownSelection,
  insertWikiLink,
  type MarkdownFormat
} from '../../core/markdown-edit'
import { renderTemplate } from '../../core/templates'
import type { NoteDocument } from '../../shared/types'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  notes?: NoteDocument[]
  templates?: NoteDocument[]
  noteTitle?: string
  templateDirectory?: string
}

export default function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  notes = [],
  templates = [],
  noteTitle,
  templateDirectory = '90_テンプレート'
}: MarkdownEditorProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const applyingValueRef = useRef(false)
  const readOnlyCompartmentRef = useRef(new Compartment())

  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const view = new EditorView({
      parent: hostRef.current,
      doc: value,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        readOnlyCompartmentRef.current.of([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly)
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingValueRef.current) {
            onChangeRef.current(update.state.doc.toString())
          }
        })
      ]
    })

    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) {
      return
    }

    const current = view.state.doc.toString()
    if (current !== value) {
      applyingValueRef.current = true
      try {
        view.dispatch({
          changes: {
            from: 0,
            to: current.length,
            insert: value
          }
        })
      } finally {
        applyingValueRef.current = false
      }
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) {
      return
    }
    const current = view.state.doc.toString()
    applyingValueRef.current = true
    try {
      view.dispatch({
        changes:
          readOnly && current !== value
            ? {
                from: 0,
                to: current.length,
                insert: value
              }
            : undefined,
        effects: readOnlyCompartmentRef.current.reconfigure([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly)
        ])
      })
    } finally {
      applyingValueRef.current = false
    }
  }, [readOnly])

  const applyFormat = (format: MarkdownFormat): void => {
    const view = viewRef.current
    if (!view || readOnly) {
      return
    }
    const selection = view.state.selection.main
    const result = formatMarkdownSelection(
      view.state.doc.toString(),
      selection.from,
      selection.to,
      format
    )
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: result.value
      },
      selection: {
        anchor: result.selectionStart,
        head: result.selectionEnd
      }
    })
    view.focus()
  }

  const addLink = (path: string): void => {
    const view = viewRef.current
    if (!view || !path || readOnly) {
      return
    }
    const selection = view.state.selection.main
    const result = insertWikiLink(
      view.state.doc.toString(),
      selection.from,
      selection.to,
      path
    )
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: result.value
      },
      selection: {
        anchor: result.selectionStart,
        head: result.selectionEnd
      }
    })
    view.focus()
  }

  const insertTemplate = (path: string): void => {
    const view = viewRef.current
    if (!view || !path || readOnly) {
      return
    }
    const template = templates.find((candidate) => candidate.path === path)
    if (!template) {
      return
    }
    const rendered = renderTemplate(template.content, {
      title: noteTitle?.trim() || '無題のノート',
      now: new Date()
    }).trimEnd()
    if (!rendered) {
      return
    }
    const selection = view.state.selection.main
    const insert = `${rendered}\n`
    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert
      },
      selection: {
        anchor: selection.from + insert.length
      }
    })
    view.focus()
  }

  return (
    <div className="markdown-editor-shell">
      <div className="markdown-format-toolbar" role="toolbar" aria-label="書式ツール">
        <button type="button" disabled={readOnly} onClick={() => applyFormat('heading')}>
          見出し
        </button>
        <button type="button" disabled={readOnly} onClick={() => applyFormat('bold')}>
          太字
        </button>
        <button type="button" disabled={readOnly} onClick={() => applyFormat('list')}>
          箇条書き
        </button>
        <button type="button" disabled={readOnly} onClick={() => applyFormat('task')}>
          チェック
        </button>
        <button type="button" disabled={readOnly} onClick={() => applyFormat('link')}>
          ノートリンク
        </button>
        <select
          aria-label="関連ノートを挿入"
          value=""
          disabled={readOnly}
          onChange={(event) => addLink(event.target.value)}
        >
          <option value="">既存ノートを選ぶ…</option>
          {notes.map((note) => (
            <option key={note.path} value={note.path}>
              {note.path.replace(/\.md$/i, '')}
            </option>
          ))}
        </select>
        <select
          aria-label="テンプレートを挿入"
          value=""
          disabled={readOnly}
          onChange={(event) => insertTemplate(event.target.value)}
        >
          <option value="">テンプレートを挿入…</option>
          {templates.map((template) => (
            <option key={template.path} value={template.path}>
              {template.path
                .slice(`${templateDirectory}/`.length)
                .replace(/\.md$/i, '')}
            </option>
          ))}
        </select>
      </div>
      <div
        className="markdown-editor"
        ref={hostRef}
        aria-label="Markdown編集欄"
        aria-busy={readOnly}
      />
    </div>
  )
}
