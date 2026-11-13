import { useCallback, useEffect, useId, useState } from 'react'
import { parseBaseProfile } from '../../core/base-profile'
import { parseCanvas } from '../../core/canvas'
import { resolveNoteEmbed } from '../../core/note-embeds'
import type { NoteNavigationTarget } from '../../core/note-navigation'
import type { CompiledPathAliases } from '../../core/path-aliases'
import { basenameRelative, dirnameRelative, joinRelative, validateRelativePath } from '../../core/paths'
import type { CanvasData } from '../../shared/canvas'
import type { PropertyDeclaredType } from '../../shared/property-changes'
import type { NoteDocument, VaultAttachment } from '../../shared/types'
import { evaluateBaseInWorker } from '../base-worker-client'
import BaseTableView, { type BaseTableState } from './BaseTableView'
import CanvasView from './CanvasView'
import MarkdownPreview from './MarkdownPreview'
import './VaultEmbed.css'

export interface VaultEmbedContext {
  vaultPath: string
  notes: readonly NoteDocument[]
  attachments: readonly VaultAttachment[]
  pathAliases?: CompiledPathAliases
  declaredTypes?: Record<string, PropertyDeclaredType>
  onOpenCanvas?(path: string): void
  onOpenBase?(path: string): void
  onNavigate?(target: NoteNavigationTarget): void
  onWikiLink?(target: string): void
  ancestors?: readonly string[]
  budget?: number
  scopeRevision?: string | number
  documentRevision?: object
}

const MAX_DEPTH = 6
const MAX_EMBEDS = 64
const ancestryKey = (path: string): string => `${path.toLocaleLowerCase()}#`
const depthMessage = '循環参照または埋め込みの深さの上限です。'

interface EmbedProps {
  target: string
  label: string
  hostPath: string
  hostContent: string
  context: VaultEmbedContext
  exactPath?: boolean
}

type FileContent = { kind: 'canvas'; path: string; data: CanvasData }
  | { kind: 'base'; state: Extract<BaseTableState, { status: 'ready' }> }
  | { kind: 'error'; message: string }

function resolveListedPath(target: string, hostPath: string, paths: string[], kind: string, exactPath: boolean): string {
  const candidates = exactPath ? [target] : [target, joinRelative(dirnameRelative(hostPath), target)]
  for (const candidate of candidates) {
    const exact = paths.find(path => path.toLocaleLowerCase() === candidate.toLocaleLowerCase())
    if (exact) return exact
  }
  const named = exactPath ? [] : paths.filter(path => basenameRelative(path).toLocaleLowerCase() === target.toLocaleLowerCase())
  if (named.length === 1) return named[0]
  throw new Error(named.length > 1 ? `同名の${kind}が複数あります。Vault内のパスを指定してください。` : `${kind}が見つかりません。`)
}

function FileEmbed({ target, label, hostPath, hostContent, context, exactPath = false, canvas }: EmbedProps & { canvas: boolean }): React.JSX.Element {
  const kind = canvas ? 'Canvas' : 'Base'
  const { vaultPath, notes, attachments, declaredTypes, scopeRevision, documentRevision } = context
  const ancestorKey = JSON.stringify(context.ancestors ?? [])
  const [loaded, setLoaded] = useState<FileContent | null>(null)
  const [selection, setSelection] = useState<{ target: string; index: number }>()
  const [reload, setReload] = useState(0)
  const resolveImage = useCallback(async (path: string): Promise<string | null> => {
    if (!attachments.some(attachment => attachment.path === path)) return null
    const result = await window.tsuzune.readVaultImage(path)
    return result.ok ? result.value : null
  }, [attachments])
  const selectedIndex = selection?.target === target ? selection.index : undefined

  useEffect(() => {
    const abort = new AbortController()
    const current = () => !abort.signal.aborted
    setLoaded(null)
    void (async () => {
      const separator = target.indexOf('#')
      const subpath = separator < 0 ? undefined : target.slice(separator + 1)
      const validated = validateRelativePath(separator < 0 ? target : target.slice(0, separator))
      if (!validated.valid || !validated.normalized) throw new Error(`${kind}のパスが不正です。`)
      if (canvas && subpath !== undefined) throw new Error('Canvasの見出し・ブロック限定は未対応です。')
      if (subpath?.startsWith('^')) throw new Error('Baseのブロック参照は利用できません。')
      if (!vaultPath) throw new Error('Vaultを開いてから表示してください。')
      const listed = await (canvas ? window.tsuzune.listCanvases(vaultPath) : window.tsuzune.listBases(vaultPath))
      if (!current()) return
      if (!listed.ok) throw new Error(listed.error.message)
      const path = resolveListedPath(validated.normalized, hostPath, listed.value, kind, exactPath)
      const ancestors: string[] = JSON.parse(ancestorKey)
      if (ancestors.includes(ancestryKey(path))) throw new Error(depthMessage)
      if (canvas) {
        const document = await window.tsuzune.readCanvas(path, vaultPath)
        if (!current()) return
        if (!document.ok) throw new Error(document.error.message)
        setLoaded({ kind: 'canvas', path, data: parseCanvas(document.value.content) })
        return
      }

      const document = await window.tsuzune.readBase(path, vaultPath)
      if (!current()) return
      if (!document.ok) throw new Error(document.error.message)
      const parsed = parseBaseProfile(document.value.content)
      if (!parsed.ok) throw new Error(parsed.diagnostics.map(item => item.message).join(' '))
      const matches = parsed.profile.views?.flatMap((view, index) => view.name === subpath ? [index] : []) ?? []
      if (subpath !== undefined && matches.length !== 1) throw new Error(matches.length
        ? `「${subpath}」という名前のビューが複数あります。` : `「${subpath}」という名前のビューが見つかりません。`)
      const viewIndex = selectedIndex !== undefined && selectedIndex < (parsed.profile.views?.length ?? 1)
        ? selectedIndex : matches[0] ?? 0
      const host = notes.find(note => note.path === hostPath)
      const evaluation = await evaluateBaseInWorker(parsed.profile, [...notes], viewIndex, {
        propertyTypes: declaredTypes,
        signal: abort.signal,
        thisFile: { ...host, path: hostPath, content: hostContent, modifiedAt: host?.modifiedAt ?? 0,
          name: basenameRelative(hostPath), size: new TextEncoder().encode(hostContent).length }
      })
      if (current()) setLoaded({ kind: 'base', state: { status: 'ready', path, profile: parsed.profile, evaluation, viewIndex } })
    })().catch(error => {
      if (current()) setLoaded({ kind: 'error', message: error instanceof Error ? error.message : '読み込みに失敗しました。' })
    })
    return () => abort.abort()
  }, [target, hostPath, hostContent, vaultPath, notes, attachments, declaredTypes, scopeRevision, documentRevision, ancestorKey, canvas, exactPath, kind, selectedIndex, reload])

  const open = canvas ? context.onOpenCanvas : context.onOpenBase
  const path = loaded?.kind === 'canvas' ? loaded.path : loaded?.kind === 'base' ? loaded.state.path : null
  return <section className={`note-embed ${canvas ? 'canvas-embed' : 'base-embed'}`} role="group" aria-label={`埋め込み: ${label}`}>
    <div className="note-embed-source">{label}
      {path && open && <button type="button" onClick={() => open(path)}>{kind}を開く</button>}
    </div>
    {!loaded ? <p role="status">{kind}を読み込み中…</p>
      : loaded.kind === 'error' ? <p className="note-embed-error" role="status">{kind}を表示できません: {loaded.message}</p>
      : loaded.kind === 'canvas' ? <EmbeddedCanvas data={loaded.data} path={loaded.path} context={context} />
      : <BaseTableView state={loaded.state} editingDisabled localImagesOnly onResolveImage={resolveImage}
          onOpenNote={path => context.onNavigate?.({ kind: 'wiki', status: 'resolved', path })}
          onSelectView={index => setSelection({ target, index })}
          onReload={() => { setSelection(undefined); setReload(value => value + 1) }} />}
  </section>
}

export function canvasEmbedContent(data: CanvasData, path: string, context: VaultEmbedContext) {
  const { notes, attachments, pathAliases } = context
  const ancestors = [...(context.ancestors ?? []), ancestryKey(path)]
  const budget = context.budget ?? MAX_EMBEDS
  const branches = data.nodes.filter(node => node.type === 'file' || node.type === 'text')
  const permitted = new Set(branches.slice(0, budget).map(node => node.id))
  const branchBudget = Math.floor((budget - permitted.size) / Math.max(permitted.size, 1))
  const next = { ...context, ancestors, budget: branchBudget }
  return {
    renderText: (text: string, id?: string) => text && (id && permitted.has(id) ? <MarkdownPreview content={text} notePath={path}
      notes={notes} attachments={attachments} pathAliases={pathAliases} onWikiLink={context.onWikiLink ?? (() => {})}
      onNavigate={context.onNavigate} embedContext={next} localImagesOnly /> : <p>{text}</p>),
    renderFile: (file: string, subpath?: string, id?: string) => {
      if (!id || !permitted.has(id)) return null
      if (attachments.some(item => item.path === file) && /\.(png|jpe?g|gif|bmp|svg|webp|avif)$/i.test(file)) {
        return <MarkdownPreview content={`![](#/vault-asset/${encodeURIComponent(file)})`} notePath={path}
          attachments={attachments} onWikiLink={() => {}} localImagesOnly />
      }
      if (!/\.(?:md|base|canvas)$/i.test(file)) return null
      if (/\.md$/i.test(file) && !notes.some(note => note.path === file)) return null
      const target = `${file}${subpath ? (subpath.startsWith('#') ? subpath : `#${subpath}`) : ''}`
      return <VaultEmbed key={target} target={target} label={basenameRelative(file)}
        hostPath={path} hostContent="" context={next} exactPath />
    }
  }
}

function EmbeddedCanvas({ data, path, context }: { data: CanvasData; path: string; context: VaultEmbedContext }): React.JSX.Element {
  const openFile = (file: string): void => {
    if (/\.canvas$/i.test(file)) context.onOpenCanvas?.(file)
    else if (/\.base$/i.test(file)) context.onOpenBase?.(file)
    else if (context.notes.some(note => note.path === file) || context.attachments.some(item => item.path === file)) {
      context.onNavigate?.({ kind: 'wiki', status: 'resolved', path: file })
    }
  }
  return <CanvasView data={data} status="saved" readOnly disabled={false} filePaths={[]} onOpenFile={openFile} onChange={() => {}} onSave={() => {}}
    {...canvasEmbedContent(data, path, context)} />
}

export default function VaultEmbed({ target, label, hostPath, hostContent, context, exactPath }: EmbedProps): React.JSX.Element {
  const id = useId()
  const ancestors = context.ancestors ?? [ancestryKey(hostPath)]
  const next = { ...context, ancestors }
  const unavailable = (reason: string) => <aside className="note-embed note-embed-error" role="group"
    aria-label={`埋め込み: ${label}`}>{label}: {reason}</aside>
  if ((context.budget ?? MAX_EMBEDS) < 0) return unavailable('埋め込み表示数の上限です。')
  if (ancestors.length >= MAX_DEPTH) return unavailable(depthMessage)
  if (/\.(?:canvas|base)(?:#|$)/i.test(target)) {
    return <FileEmbed key={`${context.vaultPath}:${hostPath}:${target}`} target={target} label={label} hostPath={hostPath}
      hostContent={hostContent} context={next} exactPath={exactPath} canvas={/\.canvas(?:#|$)/i.test(target)} />
  }

  const resolved = resolveNoteEmbed(target, hostPath, hostContent, context.notes, context.pathAliases)
  if (resolved.status !== 'resolved') return unavailable(resolved.reason)
  if (ancestors.includes(resolved.key)) return unavailable(depthMessage)
  return <section className="note-embed" role="group" aria-label={`埋め込み: ${label}`}>
    <button className="note-embed-source" type="button" onClick={() => {
      if (context.onNavigate) context.onNavigate(resolved.navigation)
      else context.onWikiLink?.(target)
    }}>{label}</button>
    <MarkdownPreview content={resolved.content} sourceContent={resolved.sourceContent} notePath={resolved.path}
      attachments={context.attachments} notes={context.notes} pathAliases={context.pathAliases} onNavigate={context.onNavigate}
      onWikiLink={context.onWikiLink ?? (() => {})} embedContext={{ ...next, ancestors: [...ancestors, resolved.key] }}
      headingPrefix={`${id}-`} localImagesOnly />
  </section>
}
