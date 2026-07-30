import { useEffect, useRef } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { Compartment, EditorState } from '@codemirror/state'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export default function MarkdownEditor({
  value,
  onChange,
  readOnly = false
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

  return (
    <div
      className="markdown-editor"
      ref={hostRef}
      aria-label="Markdown編集欄"
      aria-busy={readOnly}
    />
  )
}
