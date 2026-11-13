import { useCallback, useReducer, useRef } from 'react'
import { parseCanvas, serializeCanvas } from '../core/canvas'
import type { CanvasData, CanvasDocument, CanvasScope } from '../shared/canvas'

export interface CanvasDraft {
  path: string
  scope: CanvasScope
  document: CanvasDocument | null
  data: CanvasData | null
  dirty: boolean
  status: 'loading' | 'saved' | 'dirty' | 'saving' | 'error'
  message: string | null
}

const messageOf = (error: unknown): string => error instanceof Error ? error.message : 'Canvasを保存できませんでした。'
const keyOf = (scope: CanvasScope, path: string): string => JSON.stringify([scope.rootPath, scope.rootRevision, path.toLocaleLowerCase()])
const sameScope = (left: CanvasScope, right: CanvasScope): boolean => left.rootPath === right.rootPath && left.rootRevision === right.rootRevision

export function useCanvasDocuments(scope: CanvasScope | null) {
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const drafts = useRef(new Map<string, CanvasDraft>())
  const queue = useRef<Promise<boolean>>(Promise.resolve(true))
  const [, refresh] = useReducer((value: number) => value + 1, 0)

  const documents: Record<string, CanvasDraft> = {}
  for (const draft of drafts.current.values()) {
    if (scope && sameScope(scope, draft.scope)) documents[draft.path] = draft
  }

  const get = useCallback((path: string): CanvasDraft | undefined => {
    const current = scopeRef.current
    return current ? drafts.current.get(keyOf(current, path)) : undefined
  }, [])

  const open = useCallback(async (path: string): Promise<boolean> => {
    const captured = scopeRef.current
    if (!captured) return false
    const key = keyOf(captured, path)
    const previous = drafts.current.get(key)
    if (previous?.data) return true
    if (previous?.status === 'loading' || previous?.status === 'saving') return false
    const pending: CanvasDraft = { path, scope: captured, document: previous?.document ?? null, data: null,
      dirty: false, status: 'loading', message: null }
    drafts.current.set(key, pending)
    refresh()
    try {
      const result = await window.tsuzune.readCanvas(path, captured.rootPath)
      if (!scopeRef.current || !sameScope(scopeRef.current, captured) || drafts.current.get(key) !== pending) return false
      if (!result.ok) throw new Error(result.error.message)
      const data = parseCanvas(result.value.content)
      drafts.current.set(key, { path: result.value.path, scope: captured, document: result.value, data, dirty: false, status: 'saved', message: null })
      return true
    } catch (error) {
      if (drafts.current.get(key) === pending) drafts.current.set(key, { ...pending, status: 'error', message: messageOf(error) })
      return false
    } finally { refresh() }
  }, [])

  const create = useCallback(async (path: string): Promise<boolean> => {
    const captured = scopeRef.current
    if (!captured) return false
    const key = keyOf(captured, path)
    try {
      const result = await window.tsuzune.createCanvas({ scope: captured, path, content: serializeCanvas({ nodes: [], edges: [] }) })
      if (!scopeRef.current || !sameScope(scopeRef.current, captured)) return false
      if (!result.ok) throw new Error(result.error.message)
      drafts.current.set(keyOf(captured, result.value.path), { path: result.value.path, scope: captured, document: result.value,
        data: parseCanvas(result.value.content), dirty: false, status: 'saved', message: null })
      refresh()
      return true
    } catch (error) {
      if (!drafts.current.has(key)) drafts.current.set(key, { path, scope: captured, document: null, data: null,
        dirty: false, status: 'error', message: messageOf(error) })
      refresh()
      return false
    }
  }, [])

  const change = useCallback((path: string, data: CanvasData): void => {
    const current = get(path)
    if (!current?.document || !current.data || current.status === 'loading' || current.status === 'saving') return
    try {
      const dirty = serializeCanvas(data) !== serializeCanvas(parseCanvas(current.document.content))
      drafts.current.set(keyOf(current.scope, path), { ...current, data, dirty, status: dirty ? 'dirty' : 'saved', message: null })
    } catch (error) {
      drafts.current.set(keyOf(current.scope, path), { ...current, message: messageOf(error) })
    }
    refresh()
  }, [get])

  const save = useCallback(async (path: string): Promise<boolean> => {
    const current = get(path)
    if (!current?.document || !current.data || !current.dirty) return true
    if (current.status === 'saving') return false
    const key = keyOf(current.scope, path)
    const content = serializeCanvas(current.data)
    const saving = { ...current, status: 'saving' as const, message: null }
    drafts.current.set(key, saving)
    refresh()
    try {
      const result = await window.tsuzune.saveCanvas({ scope: current.scope, path, expectedRevision: current.document.revision, content })
      if (!scopeRef.current || !sameScope(scopeRef.current, current.scope)) return false
      if (!result.ok) throw new Error(result.error.message)
      const latest = drafts.current.get(key)
      if (!latest?.data || latest.document?.revision !== current.document.revision) return false
      const dirty = serializeCanvas(latest.data) !== content
      drafts.current.set(key, { ...latest, document: result.value, dirty, status: dirty ? 'dirty' : 'saved', message: null })
      return !dirty
    } catch (error) {
      const latest = drafts.current.get(key)
      if (latest) drafts.current.set(key, { ...latest, status: 'error', message: messageOf(error) })
      return false
    } finally { refresh() }
  }, [get])

  const flush = useCallback((): Promise<boolean> => {
    const operation = async (): Promise<boolean> => {
      for (const draft of drafts.current.values()) {
        if (!draft.dirty) continue
        if (!scopeRef.current || !sameScope(scopeRef.current, draft.scope)) continue
        if (!(await save(draft.path))) return false
      }
      return true
    }
    const next = queue.current.then(operation, operation)
    queue.current = next
    return next
  }, [save])

  const reload = useCallback(async (path: string): Promise<boolean> => {
    const current = get(path)
    if (current?.status === 'saving') return false
    if (current) drafts.current.delete(keyOf(current.scope, path))
    return open(path)
  }, [get, open])

  const forget = useCallback((path: string): void => {
    const current = get(path)
    if (current) { drafts.current.delete(keyOf(current.scope, path)); refresh() }
  }, [get])

  return { documents, get, open, create, change, save, reload, flush, forget }
}
