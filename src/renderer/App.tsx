import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildNoteCreationPath,
  findLinkImpact,
  getBacklinks,
  getOutgoingLinks,
  resolveWikiLink
} from '../core/links'
import {
  basenameRelative,
  dirnameRelative,
  isPathInsideOrEqual,
  joinRelative,
  withMarkdownExtension,
  withoutMarkdownExtension
} from '../core/paths'
import { searchNotes } from '../core/search'
import type {
  AppError,
  NoteDocument,
  VaultChangeEvent,
  VaultSnapshot
} from '../shared/types'
import FileTree, { type TreeSelection } from './components/FileTree'
import MarkdownEditor from './components/MarkdownEditor'
import MarkdownPreview from './components/MarkdownPreview'
import MoveDialog from './components/MoveDialog'
import RelatedNotes from './components/RelatedNotes'
import TemporalDetails from './components/TemporalDetails'

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'

type ConflictState =
  | {
      kind: 'changed'
      externalContent: string
      externalModifiedAt: number
      externalSize: number
      localHeld: boolean
    }
  | {
      kind: 'missing'
    }

const SAVE_DELAY_MS = 600

function saveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case 'dirty':
      return '未保存'
    case 'saving':
      return '保存中…'
    case 'error':
      return '保存失敗'
    case 'conflict':
      return '外部変更あり'
    default:
      return '保存済み'
  }
}

function errorMessage(error: AppError): string {
  return error.message || '操作を完了できませんでした。'
}

function localCalendarDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null)
  const snapshotRef = useRef<VaultSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const selectedPathRef = useRef<string | null>(null)
  const [treeSelection, setTreeSelection] = useState<TreeSelection | null>(null)
  const [content, setContent] = useState('')
  const contentRef = useRef('')
  const [modifiedAt, setModifiedAt] = useState(0)
  const modifiedAtRef = useRef(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const versionRef = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const conflictRef = useRef<ConflictState | null>(null)
  const [movePath, setMovePath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const vaultGenerationRef = useRef(0)
  const vaultSwitchingRef = useRef(false)
  const snapshotRequestRef = useRef(0)
  const committedSnapshotRequestRef = useRef(0)
  const pendingExternalEventsRef = useRef<VaultChangeEvent[]>([])
  const externalChangeHandlerRef = useRef<(event: VaultChangeEvent) => Promise<void>>(
    async () => undefined
  )

  const setCurrentSnapshot = (next: VaultSnapshot | null): void => {
    snapshotRef.current = next
    setSnapshot(next)
  }

  const clearSaveTimer = (): void => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }

  const setCurrentConflict = (next: ConflictState | null): void => {
    conflictRef.current = next
    setConflict(next)
  }

  const beginOperation = (): boolean => {
    if (busyRef.current) {
      return false
    }
    busyRef.current = true
    setBusy(true)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    return true
  }

  const finishOperation = (): void => {
    busyRef.current = false
    setBusy(false)
    const pending = pendingExternalEventsRef.current.splice(0)
    queueMicrotask(() => {
      for (const event of pending) {
        void externalChangeHandlerRef.current(event)
      }
    })
  }

  const loadNoteState = (note: NoteDocument | null): void => {
    clearSaveTimer()
    const path = note?.path ?? null
    selectedPathRef.current = path
    setSelectedPath(path)
    contentRef.current = note?.content ?? ''
    setContent(note?.content ?? '')
    modifiedAtRef.current = note?.modifiedAt ?? 0
    setModifiedAt(note?.modifiedAt ?? 0)
    versionRef.current += 1
    dirtyRef.current = false
    savingRef.current = false
    setSaveStatus('saved')
    setCurrentConflict(null)
    setMessage(null)
    if (path) {
      setTreeSelection({ kind: 'note', path })
    }
    void window.tsuzune.setLastNote(path)
  }

  const updateSnapshotNote = (
    path: string,
    nextContent: string,
    nextModifiedAt: number,
    nextSize: number
  ): void => {
    const current = snapshotRef.current
    if (!current) {
      return
    }
    const next = {
      ...current,
      notes: current.notes.map((note) =>
        note.path === path
          ? {
              ...note,
              content: nextContent,
              modifiedAt: nextModifiedAt,
              size: nextSize
            }
          : note
      )
    }
    setCurrentSnapshot(next)
  }

  const flushSave = (force = false): Promise<boolean> => {
    clearSaveTimer()

    const operation = async (): Promise<boolean> => {
      const path = selectedPathRef.current
      if (!path || !dirtyRef.current) {
        return true
      }

      if (conflictRef.current && !force) {
        setSaveStatus('conflict')
        setMessage('外部変更を解決してから別の操作へ進んでください。')
        return false
      }

      const capturedContent = contentRef.current
      const capturedVersion = versionRef.current
      savingRef.current = true
      setSaveStatus('saving')

      const result = await window.tsuzune.saveNote({
        path,
        content: capturedContent,
        expectedModifiedAt: modifiedAtRef.current,
        force
      })

      savingRef.current = false
      if (!result.ok) {
        dirtyRef.current = true
        if (result.error.code === 'FILE_CHANGED') {
          const nextConflict: ConflictState = {
            kind: 'changed',
            externalContent: result.error.currentContent ?? '',
            externalModifiedAt: result.error.currentModifiedAt ?? modifiedAtRef.current,
            externalSize: new TextEncoder().encode(
              result.error.currentContent ?? ''
            ).byteLength,
            localHeld: false
          }
          setCurrentConflict(nextConflict)
          setSaveStatus('conflict')
        } else if (result.error.code === 'NOT_FOUND') {
          setCurrentConflict({ kind: 'missing' })
          setSaveStatus('conflict')
          setMessage(
            '編集中のノートが見つかりません。別名で保存するか、内容を破棄してください。'
          )
          return false
        } else {
          setSaveStatus('error')
        }
        setMessage(errorMessage(result.error))
        return false
      }

      modifiedAtRef.current = result.value.modifiedAt
      setModifiedAt(result.value.modifiedAt)
      updateSnapshotNote(
        path,
        capturedContent,
        result.value.modifiedAt,
        result.value.size
      )

      const fullySaved =
        selectedPathRef.current === path &&
        versionRef.current === capturedVersion &&
        contentRef.current === capturedContent
      if (fullySaved) {
        dirtyRef.current = false
        setSaveStatus('saved')
      } else {
        dirtyRef.current = true
        setSaveStatus('dirty')
      }
      setMessage(null)
      return fullySaved
    }

    const next = saveQueueRef.current.then(operation, operation)
    saveQueueRef.current = next
    return next
  }

  const scheduleSave = (): void => {
    clearSaveTimer()
    if (conflictRef.current) {
      return
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void flushSave()
    }, SAVE_DELAY_MS)
  }

  const handleContentChange = (nextContent: string): void => {
    if (busyRef.current) {
      return
    }
    contentRef.current = nextContent
    setContent(nextContent)
    versionRef.current += 1
    dirtyRef.current = true
    setSaveStatus(conflictRef.current ? 'conflict' : 'dirty')
    scheduleSave()
  }

  const refreshSnapshot = async (
    generation = vaultGenerationRef.current
  ): Promise<VaultSnapshot | null> => {
    const requestId = ++snapshotRequestRef.current
    const result = await window.tsuzune.getSnapshot()
    if (
      generation !== vaultGenerationRef.current ||
      vaultSwitchingRef.current ||
      requestId < committedSnapshotRequestRef.current
    ) {
      return null
    }
    if (!result.ok) {
      setMessage(errorMessage(result.error))
      return null
    }
    committedSnapshotRequestRef.current = requestId
    setCurrentSnapshot(result.value)
    return result.value
  }

  const openNote = async (path: string): Promise<void> => {
    if (path === selectedPathRef.current || !beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }

      const note = snapshotRef.current?.notes.find((candidate) => candidate.path === path)
      if (note) {
        loadNoteState(note)
        return
      }

      const result = await window.tsuzune.readNote(path)
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      loadNoteState(result.value)
    } finally {
      finishOperation()
    }
  }

  const handleExternalChange = async (event: VaultChangeEvent): Promise<void> => {
    if (vaultSwitchingRef.current) {
      return
    }
    if (busyRef.current) {
      pendingExternalEventsRef.current.push(event)
      return
    }

    const generation = vaultGenerationRef.current
    const currentPath = selectedPathRef.current
    const wasDirty = dirtyRef.current || savingRef.current
    const refreshed = await refreshSnapshot(generation)

    if (
      !refreshed ||
      generation !== vaultGenerationRef.current ||
      vaultSwitchingRef.current ||
      busyRef.current ||
      !currentPath ||
      event.path !== currentPath ||
      selectedPathRef.current !== currentPath
    ) {
      if (
        busyRef.current &&
        generation === vaultGenerationRef.current &&
        !vaultSwitchingRef.current
      ) {
        pendingExternalEventsRef.current.push(event)
      }
      return
    }

    if (event.type === 'change') {
      const result = await window.tsuzune.readNote(currentPath)
      if (
        generation !== vaultGenerationRef.current ||
        vaultSwitchingRef.current ||
        busyRef.current ||
        selectedPathRef.current !== currentPath
      ) {
        if (
          busyRef.current &&
          generation === vaultGenerationRef.current &&
          !vaultSwitchingRef.current
        ) {
          pendingExternalEventsRef.current.push(event)
        }
        return
      }
      if (!result.ok) {
        if (result.error.code === 'NOT_FOUND') {
          clearSaveTimer()
          if (wasDirty || dirtyRef.current || savingRef.current) {
            setCurrentConflict({ kind: 'missing' })
            setSaveStatus('conflict')
          } else {
            loadNoteState(null)
          }
          setMessage('開いていたノートは外部で削除または移動されました。')
          return
        }
        setMessage(errorMessage(result.error))
        return
      }

      if (wasDirty || dirtyRef.current || savingRef.current) {
        clearSaveTimer()
        const nextConflict: ConflictState = {
          kind: 'changed',
          externalContent: result.value.content,
          externalModifiedAt: result.value.modifiedAt,
          externalSize: result.value.size,
          localHeld: false
        }
        setCurrentConflict(nextConflict)
        setSaveStatus('conflict')
      } else {
        loadNoteState(result.value)
      }
      return
    }

    if (event.type === 'unlink') {
      clearSaveTimer()
      if (wasDirty || dirtyRef.current || savingRef.current) {
        setCurrentConflict({ kind: 'missing' })
        setSaveStatus('conflict')
        setMessage('開いていたノートは外部で削除または移動されました。')
      } else {
        loadNoteState(null)
        setMessage('開いていたノートは外部で削除または移動されました。')
      }
    }
  }
  externalChangeHandlerRef.current = handleExternalChange

  useEffect(() => {
    let disposed = false

    const initialize = async (): Promise<void> => {
      const [settingsResult, vaultResult] = await Promise.all([
        window.tsuzune.getSettings(),
        window.tsuzune.openLastVault()
      ])

      if (disposed) {
        return
      }

      if (!vaultResult.ok) {
        setMessage(errorMessage(vaultResult.error))
      } else if (vaultResult.value) {
        setCurrentSnapshot(vaultResult.value)
        if (settingsResult.ok && settingsResult.value.lastNotePath) {
          const previous = vaultResult.value.notes.find(
            (note) => note.path === settingsResult.value.lastNotePath
          )
          if (previous) {
            loadNoteState(previous)
          }
        }
      }
      setLoading(false)
    }

    void initialize()

    const unsubscribeVault = window.tsuzune.onVaultChanged((event) => {
      void handleExternalChange(event)
    })
    const unsubscribeClose = window.tsuzune.onRequestClose(() => {
      if (busyRef.current) {
        setMessage('処理が終わってからアプリを閉じてください。')
        window.tsuzune.confirmClose(false)
        return
      }
      void flushSave().then((saved) => {
        window.tsuzune.confirmClose(saved)
      })
    })

    return () => {
      disposed = true
      unsubscribeVault()
      unsubscribeClose()
      clearSaveTimer()
    }
  }, [])

  const effectiveNotes = useMemo(() => {
    if (!snapshot || !selectedPath) {
      return snapshot?.notes ?? []
    }
    return snapshot.notes.map((note) =>
      note.path === selectedPath ? { ...note, content } : note
    )
  }, [snapshot, selectedPath, content])

  const outgoing = useMemo(
    () => (selectedPath ? getOutgoingLinks(content, effectiveNotes) : []),
    [selectedPath, content, effectiveNotes]
  )
  const backlinks = useMemo(
    () => (selectedPath ? getBacklinks(selectedPath, effectiveNotes) : []),
    [selectedPath, effectiveNotes]
  )
  const searchResults = useMemo(
    () => searchNotes(effectiveNotes, query),
    [effectiveNotes, query]
  )
  const selectedNote = useMemo(
    () =>
      selectedPath
        ? effectiveNotes.find((note) => note.path === selectedPath) ?? null
        : null,
    [effectiveNotes, selectedPath]
  )
  const temporalAsOf = useMemo(() => localCalendarDate(new Date()), [])

  const targetDirectory = (): string => {
    if (treeSelection?.kind === 'directory') {
      return treeSelection.path
    }
    if (treeSelection?.kind === 'note') {
      return dirnameRelative(treeSelection.path)
    }
    return selectedPath ? dirnameRelative(selectedPath) : ''
  }

  const chooseVault = async (): Promise<void> => {
    if (!beginOperation()) {
      return
    }

    vaultGenerationRef.current += 1
    vaultSwitchingRef.current = true
    try {
      if (!(await flushSave())) {
        vaultSwitchingRef.current = false
        await refreshSnapshot(vaultGenerationRef.current)
        return
      }
      const result = await window.tsuzune.chooseVault()
      if (!result.ok) {
        vaultSwitchingRef.current = false
        await refreshSnapshot(vaultGenerationRef.current)
        setMessage(errorMessage(result.error))
        return
      }
      if (result.value) {
        setCurrentSnapshot(result.value)
        loadNoteState(null)
        setTreeSelection({ kind: 'directory', path: '' })
        setQuery('')
      } else {
        vaultSwitchingRef.current = false
        await refreshSnapshot(vaultGenerationRef.current)
      }
    } finally {
      vaultSwitchingRef.current = false
      pendingExternalEventsRef.current.length = 0
      finishOperation()
    }
  }

  const createNote = async (): Promise<void> => {
    if (!snapshot) {
      return
    }
    const name = window.prompt('新しいノート名', '無題のノート')
    if (!name) {
      return
    }
    if (!beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.createNote({
        directory: targetDirectory(),
        name
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (note) {
        loadNoteState(note)
      }
    } finally {
      finishOperation()
    }
  }

  const createDirectory = async (): Promise<void> => {
    if (!snapshot) {
      return
    }
    const name = window.prompt('新しいフォルダ名', '新しいフォルダ')
    if (!name) {
      return
    }
    if (!beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.createDirectory({
        parent: targetDirectory(),
        name
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      await refreshSnapshot()
      setTreeSelection({ kind: 'directory', path: result.value.path })
    } finally {
      finishOperation()
    }
  }

  const pathChangesForRename = (
    selection: TreeSelection,
    newPath: string
  ): Map<string, string> => {
    const changes = new Map<string, string>()
    if (selection.kind === 'note') {
      changes.set(selection.path, newPath)
      return changes
    }

    for (const note of effectiveNotes) {
      if (isPathInsideOrEqual(note.path, selection.path)) {
        changes.set(note.path, `${newPath}${note.path.slice(selection.path.length)}`)
      }
    }
    return changes
  }

  const confirmLinkImpact = (changes: ReadonlyMap<string, string>): boolean => {
    const impact = findLinkImpact(effectiveNotes, changes)
    if (impact.affectedCount === 0) {
      return true
    }
    const examples = impact.sourcePaths.slice(0, 3).join('\n')
    return window.confirm(
      `この操作により、${impact.affectedCount}件の参照元でWikiリンクが未作成または曖昧になります。\n\n${examples}\n\nそのまま続けますか？`
    )
  }

  const renameSelected = async (): Promise<void> => {
    if (!snapshot || !treeSelection || treeSelection.path === '') {
      return
    }
    const selection = treeSelection

    const currentName =
      selection.kind === 'note'
        ? withoutMarkdownExtension(basenameRelative(selection.path))
        : basenameRelative(selection.path)
    const nextName = window.prompt('新しい名前', currentName)
    if (!nextName || nextName === currentName) {
      return
    }

    if (!beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }

      const finalName =
        selection.kind === 'note' ? withMarkdownExtension(nextName) : nextName
      const newPath = joinRelative(dirnameRelative(selection.path), finalName)
      const changes = pathChangesForRename(selection, newPath)
      if (!confirmLinkImpact(changes)) {
        return
      }

      const result = await window.tsuzune.renameEntry({
        path: selection.path,
        newName: nextName
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }

      const previousSelectionPath = selection.path
      const next = await refreshSnapshot()
      setTreeSelection({ kind: selection.kind, path: result.value.path })

      if (
        selectedPathRef.current &&
        isPathInsideOrEqual(selectedPathRef.current, previousSelectionPath)
      ) {
        const mapped =
          result.value.path +
          selectedPathRef.current.slice(previousSelectionPath.length)
        const note = next?.notes.find((candidate) => candidate.path === mapped)
        if (note) {
          loadNoteState(note)
        }
      }
    } finally {
      finishOperation()
    }
  }

  const moveSelectedNote = async (destinationDirectory: string): Promise<void> => {
    const path = movePath
    setMovePath(null)
    if (!path || !snapshot) {
      return
    }

    if (dirnameRelative(path) === destinationDirectory) {
      return
    }

    if (!beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }

      const newPath = joinRelative(destinationDirectory, basenameRelative(path))
      const changes = new Map([[path, newPath]])
      if (!confirmLinkImpact(changes)) {
        return
      }

      const result = await window.tsuzune.moveNote({
        path,
        destinationDirectory
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }

      const next = await refreshSnapshot()
      setTreeSelection({ kind: 'note', path: result.value.path })
      if (selectedPathRef.current === path) {
        const note = next?.notes.find((candidate) => candidate.path === result.value.path)
        if (note) {
          loadNoteState(note)
        }
      }
    } finally {
      finishOperation()
    }
  }

  const trashSelected = async (): Promise<void> => {
    if (!treeSelection || treeSelection.path === '') {
      return
    }

    const path = treeSelection.path
    const affected =
      selectedPathRef.current &&
      isPathInsideOrEqual(selectedPathRef.current, path)

    if (
      !window.confirm(
        `「${path}」をVault内の.trashへ移動しますか？`
      )
    ) {
      return
    }

    if (!beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.trashEntry(path)
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }

      await refreshSnapshot()
      if (affected) {
        loadNoteState(null)
      }
      setTreeSelection({ kind: 'directory', path: '' })
    } finally {
      finishOperation()
    }
  }

  const createMissingLink = async (target: string): Promise<void> => {
    if (!snapshot) {
      return
    }

    const path = buildNoteCreationPath(selectedPathRef.current, target)
    if (!path) {
      setMessage('このWikiリンクは有効なノートパスではありません。')
      return
    }

    const directory = dirnameRelative(path)
    if (!snapshot.directories.includes(directory)) {
      setMessage('リンク先のフォルダがありません。先にフォルダを作成してください。')
      return
    }

    if (!window.confirm(`「${path}」を作成しますか？`)) {
      return
    }
    if (!beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.createNote({
        directory,
        name: basenameRelative(path)
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (note) {
        loadNoteState(note)
      }
    } finally {
      finishOperation()
    }
  }

  const handleWikiLink = (target: string): void => {
    const resolved = resolveWikiLink(target, effectiveNotes)
    if (resolved.status === 'resolved' && resolved.resolvedPath) {
      void openNote(resolved.resolvedPath)
    } else if (resolved.status === 'missing') {
      void createMissingLink(target)
    } else if (resolved.status === 'ambiguous') {
      setMessage('同名ノートが複数あります。右側の候補から選んでください。')
    } else {
      setMessage(resolved.reason ?? 'このWikiリンクは無効です。')
    }
  }

  const loadExternalVersion = (): void => {
    if (conflict?.kind !== 'changed') {
      return
    }
    if (!window.confirm('TSUZUNE内の未保存変更を破棄して外部版を読み込みますか？')) {
      return
    }

    contentRef.current = conflict.externalContent
    setContent(conflict.externalContent)
    modifiedAtRef.current = conflict.externalModifiedAt
    setModifiedAt(conflict.externalModifiedAt)
    const path = selectedPathRef.current
    if (path) {
      updateSnapshotNote(
        path,
        conflict.externalContent,
        conflict.externalModifiedAt,
        conflict.externalSize
      )
    }
    versionRef.current += 1
    dirtyRef.current = false
    setCurrentConflict(null)
    setSaveStatus('saved')
    setMessage(null)
  }

  const keepLocalVersion = (): void => {
    if (conflict?.kind !== 'changed') {
      return
    }
    setCurrentConflict({ ...conflict, localHeld: true })
    setMessage('自動保存を停止しています。明示的に上書き保存してください。')
  }

  const overwriteExternal = async (): Promise<void> => {
    if (!window.confirm('外部版を現在の編集中内容で上書きしますか？')) {
      return
    }
    if (!beginOperation()) {
      return
    }
    try {
      setCurrentConflict(null)
      dirtyRef.current = true
      await flushSave(true)
    } finally {
      finishOperation()
    }
  }

  const saveMissingAsNew = async (): Promise<void> => {
    const oldPath = selectedPathRef.current
    if (!oldPath || !snapshot) {
      return
    }
    const name = window.prompt(
      '別名で保存するノート名',
      `${withoutMarkdownExtension(basenameRelative(oldPath))}-復元`
    )
    if (!name) {
      return
    }
    if (!beginOperation()) {
      return
    }
    const oldDirectory = dirnameRelative(oldPath)
    const directory = snapshot.directories.includes(oldDirectory) ? oldDirectory : ''
    try {
      const result = await window.tsuzune.createNote({
        directory,
        name,
        content: contentRef.current
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (note) {
        loadNoteState(note)
      }
    } finally {
      finishOperation()
    }
  }

  const discardMissing = (): void => {
    if (!window.confirm('編集中の内容を破棄して閉じますか？')) {
      return
    }
    loadNoteState(null)
  }

  if (loading) {
    return <div className="app-loading">TSUZUNEを準備しています…</div>
  }

  return (
    <div className={`app-shell${busy ? ' is-busy' : ''}`} aria-busy={busy}>
      {busy && (
        <div className="operation-overlay" role="status" aria-live="polite">
          処理中…
        </div>
      )}
      <header className="app-header" inert={busy}>
        <div className="brand">
          <strong>TSUZUNE</strong>
          <span>書いて、つないで、あとで尋ねる。</span>
        </div>
        <div className="vault-summary">
          <span>{snapshot ? `Vault: ${snapshot.rootName}` : 'Vault未選択'}</span>
          <button type="button" className="secondary-button" onClick={() => void chooseVault()}>
            Vaultを開く
          </button>
        </div>
      </header>

      {message && (
        <div className="message-banner" role="status" inert={busy}>
          <span>{message}</span>
          {saveStatus === 'error' && (
            <button type="button" onClick={() => void flushSave()}>
              再試行
            </button>
          )}
          <button type="button" aria-label="通知を閉じる" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      )}

      {conflict?.kind === 'changed' && (
        <div className="conflict-banner" role="alert" inert={busy}>
          <strong>このノートは別のアプリでも変更されました。</strong>
          {!conflict.localHeld ? (
            <div>
              <button type="button" onClick={loadExternalVersion}>
                外部版を読み込む
              </button>
              <button type="button" onClick={keepLocalVersion}>
                編集中の内容を保持
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void overwriteExternal()}>
              こちらの内容で上書き保存
            </button>
          )}
        </div>
      )}

      {conflict?.kind === 'missing' && (
        <div className="conflict-banner" role="alert" inert={busy}>
          <strong>このノートは外部で削除または移動されました。</strong>
          <div>
            <button type="button" onClick={() => void saveMissingAsNew()}>
              別名で保存
            </button>
            <button type="button" onClick={discardMissing}>
              破棄して閉じる
            </button>
          </div>
        </div>
      )}

      {!snapshot ? (
        <main className="welcome" inert={busy}>
          <div>
            <p className="eyebrow">LOCAL MARKDOWN NOTEBOOK</p>
            <h1>最初のVaultを開きましょう</h1>
            <p>
              ローカルフォルダを選ぶと、Markdownノートを作成してWikiリンクでつなげられます。
            </p>
            <button type="button" className="primary-button" onClick={() => void chooseVault()}>
              Vaultを開く
            </button>
          </div>
        </main>
      ) : (
        <main className="workspace" inert={busy}>
          <aside className="left-panel">
            <label className="search-field">
              <span className="sr-only">Vaultを検索</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Vaultを検索"
              />
            </label>

            <div className="tree-toolbar">
              <button type="button" onClick={() => void createNote()}>
                ＋ ノート
              </button>
              <button type="button" onClick={() => void createDirectory()}>
                ＋ フォルダ
              </button>
            </div>

            <FileTree
              snapshot={snapshot}
              selectedNotePath={selectedPath}
              treeSelection={treeSelection}
              searchResults={searchResults}
              query={query}
              onSelectNote={(path) => void openNote(path)}
              onSelectEntry={setTreeSelection}
            />

            <div className="entry-toolbar" aria-label="選択項目の操作">
              <button
                type="button"
                disabled={!treeSelection || treeSelection.path === ''}
                onClick={() => void renameSelected()}
              >
                名前変更
              </button>
              <button
                type="button"
                disabled={treeSelection?.kind !== 'note'}
                onClick={() =>
                  treeSelection?.kind === 'note' && setMovePath(treeSelection.path)
                }
              >
                移動
              </button>
              <button
                type="button"
                disabled={!treeSelection || treeSelection.path === ''}
                onClick={() => void trashSelected()}
              >
                .trashへ
              </button>
            </div>
          </aside>

          <section className="note-panel">
            {selectedPath ? (
              <>
                <header className="note-header">
                  <div>
                    <strong>{withoutMarkdownExtension(basenameRelative(selectedPath))}</strong>
                    <span>{selectedPath}</span>
                  </div>
                  <div className="note-actions">
                    <span className={`save-status is-${saveStatus}`}>
                      {saveStatusLabel(saveStatus)}
                    </span>
                    <button
                      type="button"
                      className={viewMode === 'edit' ? 'is-active' : ''}
                      onClick={() => setViewMode('edit')}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'preview' ? 'is-active' : ''}
                      onClick={() => setViewMode('preview')}
                    >
                      プレビュー
                    </button>
                  </div>
                </header>
                {viewMode === 'edit' ? (
                  <MarkdownEditor
                    value={content}
                    onChange={handleContentChange}
                    readOnly={busy}
                  />
                ) : (
                  <MarkdownPreview content={content} onWikiLink={handleWikiLink} />
                )}
                <footer className="note-footer">
                  <span>{content.length.toLocaleString()}文字</span>
                  <span>
                    更新: {modifiedAt ? new Date(modifiedAt).toLocaleString('ja-JP') : '—'}
                  </span>
                </footer>
              </>
            ) : (
              <div className="note-empty">
                <p>左の一覧からノートを選ぶか、新しいノートを作成してください。</p>
                <button type="button" className="primary-button" onClick={() => void createNote()}>
                  最初のノートを作る
                </button>
              </div>
            )}
          </section>

          {selectedPath ? (
            <RelatedNotes
              outgoing={outgoing}
              backlinks={backlinks}
              temporal={
                selectedNote ? (
                  <TemporalDetails
                    selectedNote={selectedNote}
                    notes={effectiveNotes}
                    asOf={temporalAsOf}
                  />
                ) : null
              }
              onOpen={(path) => void openNote(path)}
              onMissing={(target) => void createMissingLink(target)}
            />
          ) : (
            <aside className="related-panel related-empty-panel">関連ノート</aside>
          )}
        </main>
      )}

      {movePath && snapshot && (
        <div inert={busy}>
          <MoveDialog
            notePath={movePath}
            directories={snapshot.directories}
            currentDirectory={dirnameRelative(movePath)}
            onCancel={() => setMovePath(null)}
            onConfirm={(directory) => void moveSelectedNote(directory)}
          />
        </div>
      )}
    </div>
  )
}
