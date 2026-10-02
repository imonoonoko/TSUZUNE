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
  type FrontmatterProperty
} from '../../core/frontmatter'
import { readPropertyAsDeclared, transformProperty, type PropertyTransformResult } from '../../core/property-changes'
import { renderTemplate } from '../../core/templates'
import type { CompiledPathAliases } from '../../core/path-aliases'
import type { NoteNavigationTarget } from '../../core/note-navigation'
import type { PropertyDeclaredType, PropertyValue } from '../../shared/property-changes'
import type { NoteDocument, VaultAttachment } from '../../shared/types'
import { MAX_PASTED_IMAGE_BYTES } from '../../shared/image-paste'
import { livePreviewExtension, type LivePreviewContext } from './LivePreview'
import PropertyValueFields from './PropertyValueFields'

export interface MarkdownEditorHandle {
  scrollToOffset: (offset: number) => void
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  propertiesReadOnly?: boolean
  declaredTypes?: Record<string, PropertyDeclaredType>
  notes?: NoteDocument[]
  templates?: NoteDocument[]
  noteTitle?: string
  templateDirectory?: string
  onImportAttachments?: () => Promise<string[]>
  onPasteImage?: (image: File) => Promise<string | null>
  deprioritizedPaths?: ReadonlySet<string>
  onCompositionChange?: (composing: boolean) => void
  livePreview?: boolean
  notePath?: string
  attachments?: readonly VaultAttachment[]
  pathAliases?: CompiledPathAliases
  onNavigate?: (target: NoteNavigationTarget) => void
  onWikiLink?: (target: string) => void
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  propertiesReadOnly = false,
  declaredTypes = {},
  notes = [],
  templates = [],
  noteTitle,
  templateDirectory = '90_テンプレート',
  onImportAttachments,
  onPasteImage,
  deprioritizedPaths,
  onCompositionChange,
  livePreview = false,
  notePath = '',
  attachments = [],
  pathAliases,
  onNavigate,
  onWikiLink
}: MarkdownEditorProps, ref): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onCompositionChangeRef = useRef(onCompositionChange)
  const onPasteImageRef = useRef(onPasteImage)
  onPasteImageRef.current = onPasteImage
  const pendingPastesRef = useRef(new Set<{ from: number; to: number; invalid: boolean }>())
  const [pasteError, setPasteError] = useState<string | null>(null)
  const applyingValueRef = useRef(false)
  const compositionEndPendingRef = useRef(false)
  const composingRef = useRef(false)
  const readOnlyCompartmentRef = useRef(new Compartment())
  const livePreviewCompartmentRef = useRef(new Compartment())
  const livePreviewContextRef = useRef<LivePreviewContext>({
    notePath, attachments, notes, pathAliases, onNavigate, onWikiLink,
    isComposing: () => composingRef.current
  })
  livePreviewContextRef.current = {
    notePath, attachments, notes, pathAliases, onNavigate, onWikiLink,
    isComposing: () => composingRef.current
  }
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
  const [newProperty, setNewProperty] = useState<PropertyValue>({ type: 'text', value: '' })
  const [propertyError, setPropertyError] = useState<string | null>(null)
  const [editingProperty, setEditingProperty] = useState<string | null>(null)
  const [propertyDraft, setPropertyDraft] = useState<PropertyValue>({ type: 'text', value: '' })
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
  onCompositionChangeRef.current = onCompositionChange

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
        livePreviewCompartmentRef.current.of([]),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            if (view.state.readOnly || composingRef.current || !onPasteImageRef.current) return false
            const images = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'))
            if (images.length === 0) return false
            event.preventDefault()
            setPasteError(null)
            if (images.some(file => file.size === 0 || file.size > MAX_PASTED_IMAGE_BYTES)) {
              setPasteError('画像は20MB以下で貼り付けてください。')
              return true
            }
            const selection = view.state.selection.main
            const pending = { from: selection.from, to: selection.to, invalid: false }
            pendingPastesRef.current.add(pending)
            const saveImage = onPasteImageRef.current
            void (async () => {
              const paths: string[] = []
              try {
                for (const file of images) {
                  if (viewRef.current !== view || view.state.readOnly) return
                  const path = await saveImage(file)
                  if (path) paths.push(path)
                }
                if (viewRef.current !== view || paths.length === 0) return
                if (view.state.readOnly || pending.invalid) {
                  setPasteError('貼り付け位置が変更されたため挿入を停止しました。保存した画像はファイル一覧から確認できます。')
                  return
                }
                const insert = paths.map(path => `![[${path}]]`).join('\n')
                // Use one normal editor transaction so Undo only removes the inserted links.
                pendingPastesRef.current.delete(pending)
                view.dispatch({ changes: { from: pending.from, to: pending.to, insert },
                  selection: { anchor: pending.from + insert.length }, userEvent: 'input.paste' })
              } catch (error) {
                if (viewRef.current === view) setPasteError(error instanceof Error ? error.message : '画像を貼り付けられませんでした。')
              } finally {
                pendingPastesRef.current.delete(pending)
              }
            })()
            return true
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) for (const pending of pendingPastesRef.current) {
            update.changes.iterChangedRanges((from, to) => {
              if (from < pending.to && to > pending.from) pending.invalid = true
            })
            const empty = pending.from === pending.to
            pending.from = update.changes.mapPos(pending.from, 1)
            pending.to = update.changes.mapPos(pending.to, empty ? 1 : -1)
          }
          if (update.docChanged && !applyingValueRef.current) {
            onChangeRef.current(update.state.doc.toString())
            if (compositionEndPendingRef.current) {
              compositionEndPendingRef.current = false
              composingRef.current = false
              onCompositionChangeRef.current?.(false)
              queueMicrotask(() => viewRef.current?.dispatch({}))
            }
          }
        })
      ]
    })

    const handleCompositionStart = (): void => {
      compositionEndPendingRef.current = false
      if (composingRef.current) return
      composingRef.current = true
      onCompositionChangeRef.current?.(true)
    }
    const handleCompositionEnd = (): void => {
      compositionEndPendingRef.current = true
      queueMicrotask(() => {
        if (!compositionEndPendingRef.current) return
        compositionEndPendingRef.current = false
        composingRef.current = false
        onCompositionChangeRef.current?.(false)
        viewRef.current?.dispatch({})
      })
    }
    view.dom.addEventListener('compositionstart', handleCompositionStart)
    view.dom.addEventListener('compositionend', handleCompositionEnd)

    viewRef.current = view
    return () => {
      view.dom.removeEventListener('compositionstart', handleCompositionStart)
      view.dom.removeEventListener('compositionend', handleCompositionEnd)
      if (composingRef.current) onCompositionChangeRef.current?.(false)
      compositionEndPendingRef.current = false
      composingRef.current = false
      view.destroy()
      pendingPastesRef.current.clear()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: livePreviewCompartmentRef.current.reconfigure(
      livePreview ? livePreviewExtension(() => livePreviewContextRef.current) : []
    ) })
  }, [livePreview])

  useEffect(() => {
    if (livePreview) viewRef.current?.dispatch({})
  }, [livePreview, notePath, attachments, notes, pathAliases])

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

  const applyPropertyResult = (result: PropertyTransformResult | ReturnType<typeof setFrontmatterProperty>, focusAddButton = true): void => {
    if (propertiesDisabled) return
    if (!result.ok) {
      setPropertyError('issue' in result ? result.issue.message : result.message)
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
    applyPropertyResult(transformProperty(value, { kind: 'set', property: name, value: newProperty }))
  }

  return (
    <div className="markdown-editor-shell">
      <details
        className="markdown-properties markdown-properties-editor"
        aria-label="プロパティ編集"
        open={frontmatterMalformed || undefined}
      >
        <summary>プロパティ <span>{properties.length}件</span>{frontmatterMalformed ? ' · YAMLの確認が必要' : ''}</summary>
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
                if (!propertiesDisabled) applyPropertyResult(transformProperty(value, { kind: 'set', property: name, value: propertyDraft }))
              }}>
                <PropertyValueFields value={propertyDraft} onChange={setPropertyDraft} label={`${name}の値`} disabled={propertiesDisabled} autoFocus />
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
                {inspected.ok && inspected.property ? <span className="markdown-property-hint">{declaredTypes[name] === 'date' && inspected.property.type === 'text' ? '日付' : declaredTypes[name] === 'datetime' && inspected.property.type === 'text' ? '日時' : inspected.property.type === 'checkbox' ? 'チェックボックス' : inspected.property.type === 'number' ? '数値' : inspected.property.type === 'list' ? 'リスト' : '文字列'}</span> : null}
                {(!inspected.ok || inspected.property?.type !== 'checkbox') ? <button type="button" aria-label={`${name}を編集`} disabled={propertiesDisabled || !inspected.ok} onClick={() => {
                  if (!inspected.ok || !inspected.property) return
                  setEditingProperty(name)
                  setPropertyDraft(readPropertyAsDeclared(inspected.property, declaredTypes[name] ?? inspected.property.type) ?? inspected.property)
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
            <PropertyValueFields value={newProperty} onChange={setNewProperty} label="新しいプロパティ値" disabled={propertiesDisabled} />
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
      </details>
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
      {pasteError ? <p role="alert">{pasteError}</p> : null}
    </div>
  )
})

export default MarkdownEditor
