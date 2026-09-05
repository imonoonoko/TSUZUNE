import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { Compartment, EditorState } from '@codemirror/state'
import {
  formatMarkdownSelection,
  insertWikiLink,
  type MarkdownFormat
} from '../../core/markdown-edit'
import {
  deleteFrontmatterProperty,
  inspectFrontmatterProperty,
  parseFrontmatter,
  setFrontmatterProperty,
  type FrontmatterEditResult,
  type FrontmatterAtom,
  type FrontmatterProperty
} from '../../core/frontmatter'
import { renderTemplate } from '../../core/templates'
import type { NoteDocument } from '../../shared/types'

export interface MarkdownEditorHandle {
  scrollToOffset: (offset: number) => void
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  propertiesReadOnly?: boolean
  notes?: NoteDocument[]
  templates?: NoteDocument[]
  noteTitle?: string
  templateDirectory?: string
  onImportAttachments?: () => Promise<string[]>
  deprioritizedPaths?: ReadonlySet<string>
}

function PropertyValueFields({ property, onChange, label, disabled, autoFocus = false }: {
  property: FrontmatterProperty
  onChange: (property: FrontmatterProperty) => void
  label: string
  disabled: boolean
  autoFocus?: boolean
}): React.JSX.Element {
  const addItemRef = useRef<HTMLButtonElement>(null)
  if (property.type === 'checkbox') {
    return <input type="checkbox" aria-label={label} checked={property.value} disabled={disabled}
      autoFocus={autoFocus} onChange={(event) => onChange({ type: 'checkbox', value: event.target.checked })} />
  }
  if (property.type !== 'list') {
    return <textarea aria-label={label} rows={2} value={property.value} disabled={disabled}
      autoFocus={autoFocus} aria-describedby={property.type === 'number' ? 'property-number-help' : undefined}
      onChange={(event) => onChange({ ...property, value: event.target.value })} />
  }
  const changeItem = (index: number, item: FrontmatterAtom): void => {
    onChange({ type: 'list', value: property.value.map((current, position) => position === index ? item : current) })
  }
  return (
    <div className="markdown-property-items">
      {property.value.map((item, index) => (
        <div className="markdown-property-item" key={index}>
          <select aria-label={`${label}の項目${index + 1}の型`} value={item.type} disabled={disabled}
            onChange={(event) => changeItem(index, { ...item, type: event.target.value as FrontmatterAtom['type'] })}>
            <option value="text">文字列</option>
            <option value="number">数値</option>
          </select>
          <textarea aria-label={`${label}の項目${index + 1}`} rows={2} value={item.value} disabled={disabled}
            autoFocus={autoFocus && index === 0}
            onChange={(event) => changeItem(index, { ...item, value: event.target.value })} />
          <button type="button" aria-label={`${label}の項目${index + 1}を削除`} disabled={disabled} onClick={() => {
            onChange({ type: 'list', value: property.value.filter((_, position) => position !== index) })
            addItemRef.current?.focus()
          }}>項目を削除</button>
        </div>
      ))}
      {property.value.length === 0 ? <span className="markdown-property-hint">空のリスト</span> : null}
      <button ref={addItemRef} type="button" aria-label={`${label}に項目を追加`} disabled={disabled}
        onClick={() => onChange({ type: 'list', value: [...property.value, { type: 'text', value: '' }] })}>項目を追加</button>
    </div>
  )
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  propertiesReadOnly = false,
  notes = [],
  templates = [],
  noteTitle,
  templateDirectory = '90_テンプレート',
  onImportAttachments,
  deprioritizedPaths
}: MarkdownEditorProps, ref): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const applyingValueRef = useRef(false)
  const readOnlyCompartmentRef = useRef(new Compartment())
  const orderedNotes = useMemo(
    () =>
      deprioritizedPaths?.size
        ? [
            ...notes.filter((note) => !deprioritizedPaths.has(note.path)),
            ...notes.filter((note) => deprioritizedPaths.has(note.path))
          ]
        : notes,
    [deprioritizedPaths, notes]
  )
  const frontmatter = useMemo(() => parseFrontmatter(value), [value])
  const frontmatterMalformed =
    frontmatter.found && frontmatter.warnings.length > 0
  const [addingProperty, setAddingProperty] = useState(false)
  const [newPropertyName, setNewPropertyName] = useState('')
  const [newProperty, setNewProperty] = useState<FrontmatterProperty>({ type: 'text', value: '' })
  const [propertyError, setPropertyError] = useState<string | null>(null)
  const [editingProperty, setEditingProperty] = useState<string | null>(null)
  const [propertyDraft, setPropertyDraft] = useState<FrontmatterProperty>({ type: 'text', value: '' })
  const addPropertyRef = useRef<HTMLButtonElement>(null)
  const propertiesDisabled = readOnly || propertiesReadOnly
  const properties = useMemo(
    () => frontmatterMalformed ? [] : Object.entries(frontmatter.attributes).map(([name, rawValue]) => ({
      name,
      rawValue,
      inspected: inspectFrontmatterProperty(value, name)
    })),
    [frontmatter, frontmatterMalformed, value]
  )

  useEffect(() => {
    setAddingProperty(false)
    setEditingProperty(null)
    setNewPropertyName('')
    setNewProperty({ type: 'text', value: '' })
    setPropertyError(null)
  }, [value])

  onChangeRef.current = onChange

  useImperativeHandle(ref, () => ({
    scrollToOffset: (offset) => {
      const view = viewRef.current
      if (!view) return
      const clamped = Math.max(0, Math.min(offset, view.state.doc.length))
      const line = view.state.doc.lineAt(clamped)
      view.dispatch({
        selection: { anchor: clamped },
        effects: EditorView.scrollIntoView(line.from, { y: 'start' })
      })
      view.focus()
    }
  }), [])

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

  const importAttachments = async (): Promise<void> => {
    const view = viewRef.current
    if (!view || readOnly || !onImportAttachments) return
    const paths = await onImportAttachments()
    if (paths.length === 0) return
    const selection = view.state.selection.main
    const insert = `${paths.map((path) => `![[${path}]]`).join('\n')}\n`
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: { anchor: selection.from + insert.length }
    })
    view.focus()
  }

  const applyPropertyResult = (result: FrontmatterEditResult, focusAddButton = true): void => {
    if (propertiesDisabled) return
    if (!result.ok) {
      setPropertyError(result.message)
      return
    }

    setAddingProperty(false)
    setEditingProperty(null)
    setNewPropertyName('')
    setNewProperty({ type: 'text', value: '' })
    setPropertyError(null)
    if (result.markdown !== value) onChange(result.markdown)
    if (focusAddButton) addPropertyRef.current?.focus()
  }

  const addProperty = (): void => {
    if (propertiesDisabled) return
    const name = newPropertyName.trim()
    if (Object.hasOwn(frontmatter.attributes, name)) {
      setPropertyError('同じ名前のプロパティがあります。既存の行から編集してください。')
      return
    }
    applyPropertyResult(setFrontmatterProperty(value, name, newProperty))
  }

  return (
    <div className="markdown-editor-shell">
      <section
        className="markdown-properties markdown-properties-editor"
        aria-label="プロパティ編集"
      >
        <div className="markdown-properties-editor-header">
          <span className="markdown-properties-title">プロパティ</span>
          <button
            ref={addPropertyRef}
            type="button"
            disabled={propertiesDisabled || frontmatterMalformed}
            onClick={() => {
              setAddingProperty(true)
              setEditingProperty(null)
              setPropertyError(null)
            }}
          >
            プロパティを追加
          </button>
        </div>
        {frontmatterMalformed ? (
          <p className="markdown-properties-warning" role="alert">
            YAMLを安全に読み取れないため、Markdownソースで修正してください。
          </p>
        ) : null}
        {properties.map(({ name, rawValue, inspected }) => (
          <div className="markdown-property-edit-row" key={name}>
            <span className="markdown-property-name">{name}</span>
            {editingProperty === name && inspected.ok ? (
              <form className="markdown-property-value-form" onSubmit={(event) => {
                event.preventDefault()
                if (!propertiesDisabled) applyPropertyResult(setFrontmatterProperty(value, name, propertyDraft))
              }}>
                <PropertyValueFields property={propertyDraft} onChange={setPropertyDraft} label={`${name}の値`} disabled={propertiesDisabled} autoFocus />
                <button type="submit" disabled={propertiesDisabled} aria-label={`${name}の変更を確定`}>変更を確定</button>
                <button type="button" onClick={() => {
                  setEditingProperty(null)
                  setPropertyError(null)
                  addPropertyRef.current?.focus()
                }}>キャンセル</button>
              </form>
            ) : (
              <>
                {inspected.ok && inspected.property?.type === 'checkbox' ? (
                  <input type="checkbox" aria-label={name} checked={inspected.property.value} disabled={readOnly} aria-disabled={propertiesReadOnly || undefined}
                    onChange={(event) => {
                      if (!propertiesDisabled) applyPropertyResult(setFrontmatterProperty(value, name, { type: 'checkbox', value: event.target.checked }), false)
                    }} />
                ) : <span className="markdown-property-value">{inspected.ok && inspected.property
                  ? inspected.property.type === 'list'
                    ? inspected.property.value.map((item) => `${item.type === 'number' ? '数値' : '文字列'}: ${item.value || '（空文字）'}`).join('\n') || '（空のリスト）'
                    : inspected.property.value || '（空文字）'
                  : rawValue ?? '（複合値）'}</span>}
                {inspected.ok && inspected.property ? <span className="markdown-property-hint">{inspected.property.type === 'checkbox' ? 'チェックボックス' : inspected.property.type === 'number' ? '数値' : inspected.property.type === 'list' ? 'リスト' : '文字列'}</span> : null}
                {(!inspected.ok || inspected.property?.type !== 'checkbox') ? <button type="button" aria-label={`${name}を編集`} disabled={propertiesDisabled || !inspected.ok} onClick={() => {
                  if (!inspected.ok || !inspected.property) return
                  setEditingProperty(name)
                  setPropertyDraft(inspected.property)
                  setAddingProperty(false)
                  setPropertyError(null)
                }}>編集</button> : null}
                <button type="button" aria-label={`${name}を削除`} disabled={propertiesDisabled || !inspected.ok} onClick={() => {
                  if (!propertiesDisabled) applyPropertyResult(deleteFrontmatterProperty(value, name))
                }}>削除</button>
                {!inspected.ok ? <span className="markdown-property-hint">ソースで編集</span> : null}
              </>
            )}
          </div>
        ))}
        {addingProperty && !frontmatterMalformed ? (
          <form
            className="markdown-property-form"
            onSubmit={(event) => {
              event.preventDefault()
              addProperty()
            }}
          >
            <input
              aria-label="新しいプロパティ名"
              value={newPropertyName}
              disabled={propertiesDisabled}
              autoFocus
              onChange={(event) => setNewPropertyName(event.target.value)}
            />
            <select aria-label="新しいプロパティの型" value={newProperty.type} disabled={propertiesDisabled} onChange={(event) => {
              const type = event.target.value as FrontmatterProperty['type']
              setNewProperty(type === 'list' ? { type, value: [] } : type === 'checkbox' ? { type, value: false } : { type, value: '' })
            }}>
              <option value="text">文字列</option>
              <option value="number">数値</option>
              <option value="list">リスト</option>
              <option value="checkbox">チェックボックス</option>
            </select>
            <PropertyValueFields property={newProperty} onChange={setNewProperty} label="新しいプロパティ値" disabled={propertiesDisabled} />
            <button type="submit" disabled={propertiesDisabled}>
              追加を確定
            </button>
            <button
              type="button"
              disabled={propertiesDisabled}
              onClick={() => {
                setAddingProperty(false)
                setPropertyError(null)
                setNewPropertyName('')
                setNewProperty({ type: 'text', value: '' })
                addPropertyRef.current?.focus()
              }}
            >
              キャンセル
            </button>
          </form>
        ) : null}
        {(addingProperty && (newProperty.type === 'number' || newProperty.type === 'list')) || (editingProperty && (propertyDraft.type === 'number' || propertyDraft.type === 'list')) ? (
          <p id="property-number-help" className="markdown-property-hint">数値は 12、-0.5 のように入力してください。指数表記などはソースで編集できます。</p>
        ) : null}
        {propertyError ? <p role="alert">{propertyError}</p> : null}
      </section>
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
        {onImportAttachments ? (
          <button type="button" disabled={readOnly} onClick={() => void importAttachments()}>
            添付ファイルを挿入
          </button>
        ) : null}
        <select
          aria-label="関連ノートを挿入"
          value=""
          disabled={readOnly}
          onChange={(event) => addLink(event.target.value)}
        >
          <option value="">既存ノートを選ぶ…</option>
          {orderedNotes.map((note) => (
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
})

export default MarkdownEditor
