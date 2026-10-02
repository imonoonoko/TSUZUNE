import { useEffect, useMemo, useRef, useState } from 'react'
import type { NoteDocument, VaultAttachment, BaseDocument } from '../../shared/types'
import type { SavedWorkspaceTab, WorkspaceScope } from '../../shared/workspace-state'
import type { PropertyDeclaredType } from '../../shared/property-changes'
import type { CompiledPathAliases } from '../../core/path-aliases'
import { buildWikiGraph, getVaultWikiGraph } from '../../core/graph'
import { buildPropertyInventory } from '../../core/property-inventory'
import { basenameRelative } from '../../core/paths'
import { parseBaseProfile } from '../../core/base-profile'
import { evaluateBaseInWorker } from '../base-worker-client'
import AttachmentPreview from './AttachmentPreview'
import BaseTableView, { type BaseTableState } from './BaseTableView'
import PropertyInventoryView from './PropertyInventoryView'
import WikiGraphView from './WikiGraphView'

export interface PaneAuxiliaryContentProps {
  tab: SavedWorkspaceTab
  notes: NoteDocument[]
  attachments: VaultAttachment[]
  pathAliases?: CompiledPathAliases
  scope: WorkspaceScope | null
  declaredTypes: Record<string, PropertyDeclaredType>
  userExcluded?: (path: string) => boolean
  onOpenNote?: (path: string) => void
  onEditCell?: (path: string, property: string) => void
  onDeclare?: (name: string, type: PropertyDeclaredType | null) => Promise<void>
  onNavigateParent?: () => void
  editingDisabled?: boolean
}

export default function PaneAuxiliaryContent(props: PaneAuxiliaryContentProps): React.JSX.Element {
  const { tab, notes, attachments, pathAliases, onOpenNote = () => undefined, onDeclare, editingDisabled, userExcluded } = props
  const visibleNotes = useMemo(() => userExcluded ? notes.filter(note => !userExcluded(note.path)) : notes, [notes, userExcluded])
  const visibleAttachments = useMemo(() => userExcluded ? attachments.filter(item => !userExcluded(item.path)) : attachments, [attachments, userExcluded])
  const needsGraph = tab.kind === 'global-graph' || tab.kind === 'linked-view'
  const graph = useMemo(() => needsGraph
    ? buildWikiGraph(visibleNotes, { pathAliases, attachments: visibleAttachments, includeAttachments: true })
    : { nodes: [], edges: [] }, [needsGraph, visibleNotes, visibleAttachments, pathAliases])
  const [orphans, setOrphans] = useState(true)
  if ('path' in tab && userExcluded?.(tab.path)) return <p role="status">このファイルは表示対象から除外されています。</p>
  if (tab.kind === 'base') return <AuxiliaryBase key={`${props.scope?.rootRevision}:${tab.path}`} {...props} notes={visibleNotes} path={tab.path} />
  if (tab.kind === 'attachment') {
    const attachment = visibleAttachments.find(item => item.path === tab.path)
    return attachment ? <AttachmentPreview key={`${props.scope?.rootRevision}:${attachment.path}`} attachment={attachment} onOpenExternally={() => { void window.tsuzune.openVaultFile(attachment.path) }} />
      : <p role="status">添付ファイルが見つかりません。{tab.path}</p>
  }
  if (tab.kind === 'linked-view') {
    const paths = new Set(graph.edges.filter(edge => edge.targetPath === tab.path).map(edge => edge.sourcePath))
    const backlinks = visibleNotes.filter(note => paths.has(note.path))
    return <section className="linked-view-panel" aria-label="バックリンクビュー"><h2>バックリンク</h2><p>{tab.path}</p>
      {backlinks.length ? <div className="linked-view-list">{backlinks.map(note => <button key={note.path} type="button" className="related-link" onClick={() => onOpenNote(note.path)}><strong>{note.name}</strong><span>{note.path}</span></button>)}</div> : <p>バックリンクはありません。</p>}
    </section>
  }
  if (tab.kind === 'global-properties') return <PropertyInventoryView inventory={buildPropertyInventory(visibleNotes)} notes={visibleNotes} declaredTypes={props.declaredTypes} onDeclare={onDeclare} disabled={editingDisabled || !onDeclare} onOpenNote={onOpenNote} />
  if (tab.kind === 'global-graph') return <WikiGraphView graph={getVaultWikiGraph(graph, null, orphans)} notes={visibleNotes} currentPath={null} scope="vault" includeOrphans={orphans}
    onScopeChange={() => props.onNavigateParent?.()} onIncludeOrphansChange={setOrphans} onOpen={path => { if (visibleNotes.some(note => note.path === path)) onOpenNote(path) }} />
  return <p role="status">ノートの表示を選択してください。</p>
}

function AuxiliaryBase({ path, notes, scope, declaredTypes, onOpenNote = () => undefined, onEditCell, editingDisabled }: PaneAuxiliaryContentProps & { path: string }): React.JSX.Element {
  const [state, setState] = useState<BaseTableState>({ status: 'loading', path })
  const [index, setIndex] = useState(0)
  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [saving, setSaving] = useState(false)
  const document = useRef<BaseDocument | null>(null)
  const evaluation = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const acceptedPreview = useRef<string | null>(null)
  const disabled = useRef(editingDisabled)
  disabled.current = editingDisabled
  useEffect(() => {
    const current = ++generation.current
    const controller = new AbortController()
    evaluation.current?.abort(); evaluation.current = controller
    document.current = null; acceptedPreview.current = null; setMessage(''); setEvaluating(false); setSaving(false)
    setState({ status: 'loading', path })
    const active = () => generation.current === current && !controller.signal.aborted
    void (async () => {
      try {
        const result = await window.tsuzune.readBase(path)
        if (!active()) return
        if (!result.ok) { setState({ status: result.error.code === 'NOT_FOUND' ? 'missing' : 'error', path, message: result.error.message }); return }
        document.current = result.value
        const parsed = parseBaseProfile(result.value.content)
        if (!parsed.ok) { setState({ status: 'diagnostic', path, diagnostics: parsed.diagnostics }); return }
        setEvaluating(true)
        const resultEvaluation = await evaluateBaseInWorker(parsed.profile, notes, index, { propertyTypes: declaredTypes, signal: controller.signal,
          thisFile: { ...result.value, name: basenameRelative(path), size: new TextEncoder().encode(result.value.content).length } })
        if (active()) setState({ status: 'ready', path, profile: parsed.profile, evaluation: resultEvaluation, content: result.value.content,
          modifiedAt: result.value.modifiedAt, notes, declaredTypes, viewIndex: index })
      } catch (error) { if (generation.current === current) setState({ status: 'error', path, message: error instanceof Error ? error.message : 'Baseを読み込めませんでした。' }) }
      finally { if (generation.current === current) setEvaluating(false) }
    })()
    return () => { generation.current++; controller.abort(); evaluation.current?.abort() }
  }, [path, notes, declaredTypes, scope?.rootPath, scope?.rootRevision, index, reload])
  const preview = async (source: string, viewIndex: number): Promise<boolean> => {
    const original = document.current
    const current = generation.current
    acceptedPreview.current = null
    if (disabled.current || saving || !original?.revision || !scope) return false
    const parsed = parseBaseProfile(source)
    if (!parsed.ok) { setMessage(parsed.diagnostics.map(item => item.message).join(' ')); return false }
    const controller = new AbortController()
    evaluation.current?.abort(); evaluation.current = controller; setEvaluating(true)
    try {
      const result = await window.tsuzune.previewBaseChanges({ scope, path, expectedRevision: original.revision, content: source })
      if (generation.current !== current || disabled.current) return false
      if (!result.ok) { setMessage(result.error.message); return false }
      const evaluated = await evaluateBaseInWorker(parsed.profile, notes, viewIndex, { signal: controller.signal, propertyTypes: declaredTypes,
        thisFile: { ...original, content: source, name: basenameRelative(path), size: new TextEncoder().encode(source).length } })
      if (generation.current !== current || disabled.current || document.current !== original) return false
      setState({ status: 'ready', path, profile: parsed.profile, evaluation: evaluated, content: original.content, modifiedAt: original.modifiedAt, notes, declaredTypes, viewIndex })
      acceptedPreview.current = source
      return true
    } catch (error) { if (generation.current === current) setMessage(error instanceof Error ? error.message : '評価できませんでした。'); return false }
    finally { if (generation.current === current) setEvaluating(false) }
  }
  const save = async (source: string): Promise<void> => {
    const original = document.current
    const current = generation.current
    if (disabled.current || saving || !original?.revision || !scope || acceptedPreview.current !== source) return
    setSaving(true)
    try {
      const result = await window.tsuzune.applyBaseChanges({ scope, path, expectedRevision: original.revision, content: source })
      if (generation.current !== current) return
      if (!result.ok) { setMessage(result.error.message); return }
      acceptedPreview.current = null; setReload(value => value + 1)
    } catch (error) { if (generation.current === current) setMessage(error instanceof Error ? error.message : '設定を保存できませんでした。') }
    finally { if (generation.current === current) setSaving(false) }
  }
  return <><BaseTableView state={state} onReload={() => setReload(value => value + 1)} onOpenNote={onOpenNote} onEditCell={onEditCell}
    editingDisabled={editingDisabled || saving || !scope} onSelectView={setIndex} onPreviewProfile={preview} onSaveProfile={source => { void save(source) }}
    evaluating={evaluating} onStopEvaluation={() => evaluation.current?.abort()} onResolveImage={async path => { const result = await window.tsuzune.readVaultImage(path); return result.ok ? result.value : null }} />
    {message && <p role="alert">{message}</p>}</>
}
