import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildNoteCreationPath,
  findLinkImpact,
  getBacklinks,
  getOutgoingLinks,
  resolveWikiLink
} from '../core/links'
import {
  buildWikiGraph,
  buildWikiGraphForView,
  getLocalWikiGraph,
  getVaultWikiGraph,
  type WikiGraphScope
} from '../core/graph'
import {
  basenameRelative,
  dirnameRelative,
  formatPathForCopy,
  isPathInsideOrEqual,
  joinRelative,
  withMarkdownExtension,
  withoutMarkdownExtension
} from '../core/paths'
import type { CopyPathFormat } from '../core/paths'
import { compilePathAliases, resolvePathAlias } from '../core/path-aliases'
import { searchNotes } from '../core/search'
import { getNoteFreshness } from '../core/freshness'
import {
  DAILY_TEMPLATE_PATH,
  dailyNoteLocation,
  IDEA_TEMPLATE_PATH,
  ideaNoteLocation,
  listTemplates,
  parseDailyNote,
  parseIdeaNote,
  renderDailyNote,
  renderIdeaNote,
  renderPlainNote,
  renderTemplate,
  TEMPLATE_DIRECTORY
} from '../core/templates'
import type {
  AppError,
  AiWriteReviewProposal,
  AppUpdateStatus,
  DriveRemoteVault,
  DriveSyncPreview,
  GoogleDriveStatus,
  GraphDisplaySettings,
  GraphFilterSettings,
  GraphForceSettings,
  GraphGroup,
  GraphViewState,
  GraphViewStates,
  NoteDocument,
  VaultAttachment,
  VaultChangeEvent,
  VaultSnapshot
} from '../shared/types'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../shared/graph-settings'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../shared/graph-display'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../shared/graph-view-state'
import { createExcludedFileMatcher } from '../shared/excluded-files'
import FileTree, { type TreeSelection } from './components/FileTree'
import AttachmentPreview from './components/AttachmentPreview'
import HumanNoteCaptureDialog, {
  type HumanNoteCaptureSubmission
} from './components/HumanNoteCaptureDialog'
import Icon from './components/Icon'
import MarkdownEditor from './components/MarkdownEditor'
import MarkdownPreview from './components/MarkdownPreview'
import BookmarkDialog from './components/BookmarkDialog'
import MoveDialog from './components/MoveDialog'
import RenameDialog from './components/RenameDialog'
import RelatedNotes from './components/RelatedNotes'
import TemporalDetails from './components/TemporalDetails'
import WikiGraphView from './components/WikiGraphView'
import tsuzuneMark from './assets/tsuzune-app-icon.png'

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'

const isNormalDiscoveryExcluded = createExcludedFileMatcher(['50_履歴'])

type WorkspaceTab =
  | {
      id: number
      kind: 'note' | 'attachment'
      path: string
    }
  | {
      id: number
      kind: 'linked-view'
      path: string
    }
  | {
      id: number
      kind: 'global-graph'
    }

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
const EXTERNAL_CHANGE_DELAY_MS = 100

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

function withoutFileExtension(value: string): string {
  const name = basenameRelative(value)
  const separator = name.lastIndexOf('.')
  return separator > 0 ? name.slice(0, separator) : name
}

function workspaceTabLabel(tab: WorkspaceTab): string {
  if (tab.kind === 'global-graph') {
    return 'グラフビュー'
  }
  if (tab.kind === 'linked-view') {
    return `${withoutFileExtension(tab.path)} へのバックリンク`
  }
  return tab.kind === 'note'
    ? withoutMarkdownExtension(basenameRelative(tab.path))
    : basenameRelative(tab.path)
}

function localCalendarDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function restoredLastNote(
  notes: NoteDocument[],
  lastNotePath: string,
  pathAliases: VaultSnapshot['pathAliases']
): NoteDocument | null {
  const pathKey = lastNotePath.toLocaleLowerCase()
  const exact = notes.find(
    (note) => note.path.toLocaleLowerCase() === pathKey
  )
  if (exact) {
    return exact
  }

  try {
    const canonicalPath = resolvePathAlias(
      compilePathAliases(pathAliases ?? {}),
      lastNotePath
    )
    const canonicalKey = canonicalPath.toLocaleLowerCase()
    return (
      notes.find((note) => note.path.toLocaleLowerCase() === canonicalKey) ?? null
    )
  } catch {
    return null
  }
}

export default function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null)
  const snapshotRef = useRef<VaultSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const selectedPathRef = useRef<string | null>(null)
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([])
  const [activeTabId, setActiveTabId] = useState<number | null>(null)
  const [activeAttachmentPath, setActiveAttachmentPath] = useState<string | null>(null)
  const [activeLinkedViewPath, setActiveLinkedViewPath] = useState<string | null>(null)
  const nextTabIdRef = useRef(1)
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
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'graph'>('edit')
  const [graphScope, setGraphScope] = useState<WikiGraphScope>('local')
  const [graphFilters, setGraphFilters] = useState<GraphFilterSettings>(
    DEFAULT_GRAPH_FILTER_SETTINGS
  )
  const [graphForces, setGraphForces] = useState<GraphForceSettings>(
    DEFAULT_GRAPH_FORCE_SETTINGS
  )
  const [graphDisplay, setGraphDisplay] = useState<GraphDisplaySettings>(
    DEFAULT_GRAPH_DISPLAY_SETTINGS
  )
  const [graphGroups, setGraphGroups] = useState<GraphGroup[]>(
    DEFAULT_GRAPH_GROUPS
  )
  const [graphViewStates, setGraphViewStates] = useState<GraphViewStates>(
    DEFAULT_GRAPH_VIEW_STATES
  )
  const [userIgnoreFilters, setUserIgnoreFilters] = useState<string[]>([])
  const [aiImmutablePaths, setAiImmutablePaths] = useState<string[]>([])
  const [aiReviewPaths, setAiReviewPaths] = useState<string[]>([])
  const [aiReviewProposals, setAiReviewProposals] = useState<AiWriteReviewProposal[]>([])
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [excludedFilesDraft, setExcludedFilesDraft] = useState('')
  const [aiImmutablePathsDraft, setAiImmutablePathsDraft] = useState('')
  const [aiReviewPathsDraft, setAiReviewPathsDraft] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTemplatePath, setSelectedTemplatePath] = useState('')
  const [captureKind, setCaptureKind] = useState<'note' | 'daily' | 'idea' | null>(null)
  const [captureEditPath, setCaptureEditPath] = useState<string | null>(null)
  const [noteCreationTemplate, setNoteCreationTemplate] = useState<NoteDocument | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const conflictRef = useRef<ConflictState | null>(null)
  const [movePath, setMovePath] = useState<string | null>(null)
  const [renameRequest, setRenameRequest] = useState<{
    selection: TreeSelection
    currentName: string
  } | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [bookmarkPath, setBookmarkPath] = useState<string | null>(null)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus>({
    phase: 'disabled',
    currentVersion: '',
    availableVersion: null,
    downloadPercent: null,
    message: null
  })
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleAdvancedOpen, setGoogleAdvancedOpen] = useState(false)
  const [googleStatus, setGoogleStatus] = useState<GoogleDriveStatus | null>(null)
  const [drivePreview, setDrivePreview] = useState<DriveSyncPreview | null>(null)
  const [driveVaults, setDriveVaults] = useState<DriveRemoteVault[]>([])
  const [selectedDriveVaultId, setSelectedDriveVaultId] = useState('')
  const settingsDialogRef = useRef<HTMLElement | null>(null)
  const settingsDialogPreviousFocusRef = useRef<HTMLElement | null>(null)
  const googleDialogRef = useRef<HTMLElement | null>(null)
  const googleDialogPreviousFocusRef = useRef<HTMLElement | null>(null)
  const busyRef = useRef(false)
  const captureDirtyRef = useRef(false)
  const vaultGenerationRef = useRef(0)
  const vaultSwitchingRef = useRef(false)
  const snapshotRequestRef = useRef(0)
  const committedSnapshotRequestRef = useRef(0)
  const pendingExternalEventsRef = useRef<VaultChangeEvent[]>([])
  const queuedExternalEventsRef = useRef<Map<string, VaultChangeEvent>>(new Map())
  const externalChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const externalChangeHandlerRef = useRef<(events: VaultChangeEvent[]) => Promise<void>>(
    async () => undefined
  )
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const handleCaptureDirtyChange = useCallback((dirty: boolean): void => {
    captureDirtyRef.current = dirty
  }, [])

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

  const persistGraphForces = async (next: GraphForceSettings): Promise<void> => {
    const result = await window.tsuzune.setGraphForces(next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const persistGraphDisplay = async (
    next: GraphDisplaySettings
  ): Promise<void> => {
    const result = await window.tsuzune.setGraphDisplay(next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const persistGraphFilters = async (
    next: GraphFilterSettings
  ): Promise<void> => {
    const result = await window.tsuzune.setGraphFilters(next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const persistGraphGroups = async (next: GraphGroup[]): Promise<void> => {
    const result = await window.tsuzune.setGraphGroups(next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const persistGraphViewState = async (
    scope: WikiGraphScope,
    next: GraphViewState
  ): Promise<void> => {
    setGraphViewStates((current) => ({ ...current, [scope]: next }))
    const result = await window.tsuzune.setGraphViewState(scope, next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
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
    if (pending.length > 0) {
      queueMicrotask(() => {
        void externalChangeHandlerRef.current(pending)
      })
    }
  }

  const loadNoteState = (
    note: NoteDocument | null,
    persistLastNote = true
  ): void => {
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
    setActiveAttachmentPath(null)
    setActiveLinkedViewPath(null)
    if (path) {
      setTreeSelection({ kind: 'note', path })
    }
    if (persistLastNote) {
      void window.tsuzune.setLastNote(path)
    }
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

  const activateNoteWorkspace = (path: string): void => {
    if (activeTabId === null) {
      return
    }
    const activeTab = workspaceTabs.find((tab) => tab.id === activeTabId)
    if (activeTab?.kind === 'global-graph') {
      const existing = workspaceTabs.find(
        (tab) => tab.kind === 'note' && tab.path === path
      )
      if (existing) {
        setActiveTabId(existing.id)
      } else {
        const nextTab: WorkspaceTab = {
          id: nextTabIdRef.current++,
          kind: 'note',
          path
        }
        setWorkspaceTabs([...workspaceTabs, nextTab])
        setActiveTabId(nextTab.id)
      }
      setViewMode('edit')
      return
    }
    setWorkspaceTabs((current) =>
      current.map((tab) =>
        tab.id === activeTabId ? { ...tab, kind: 'note', path } : tab
      )
    )
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
        activateNoteWorkspace(path)
        return
      }

      const result = await window.tsuzune.readNote(path)
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      loadNoteState(result.value)
      activateNoteWorkspace(path)
    } finally {
      finishOperation()
    }
  }

  const handleExternalChanges = async (
    events: VaultChangeEvent[]
  ): Promise<void> => {
    if (events.length === 0) {
      return
    }
    if (vaultSwitchingRef.current) {
      return
    }
    if (busyRef.current) {
      pendingExternalEventsRef.current.push(...events)
      return
    }

    const generation = vaultGenerationRef.current
    const currentPath = selectedPathRef.current
    const wasDirty = dirtyRef.current || savingRef.current
    const refreshed = await refreshSnapshot(generation)
    const selectedEvent = currentPath
      ? [...events].reverse().find((event) => event.path === currentPath)
      : undefined

    if (
      !refreshed ||
      generation !== vaultGenerationRef.current ||
      vaultSwitchingRef.current ||
      busyRef.current ||
      !currentPath ||
      !selectedEvent ||
      selectedPathRef.current !== currentPath
    ) {
      if (
        busyRef.current &&
        generation === vaultGenerationRef.current &&
        !vaultSwitchingRef.current
      ) {
        pendingExternalEventsRef.current.push(...events)
      }
      return
    }

    if (selectedEvent.type === 'change' || selectedEvent.type === 'add') {
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
          pendingExternalEventsRef.current.push(...events)
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

    if (selectedEvent.type === 'unlink') {
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
  externalChangeHandlerRef.current = handleExternalChanges

  const queueExternalChange = (event: VaultChangeEvent): void => {
    queuedExternalEventsRef.current.set(event.path, event)
    if (externalChangeTimerRef.current) {
      clearTimeout(externalChangeTimerRef.current)
    }
    externalChangeTimerRef.current = setTimeout(() => {
      externalChangeTimerRef.current = null
      const events = [...queuedExternalEventsRef.current.values()]
      queuedExternalEventsRef.current.clear()
      void externalChangeHandlerRef.current(events)
    }, EXTERNAL_CHANGE_DELAY_MS)
  }

  useEffect(() => {
    let disposed = false

    const initialize = async (): Promise<void> => {
      const [settingsResult, vaultResult, updateResult] = await Promise.all([
        window.tsuzune.getSettings(),
        window.tsuzune.openLastVault(),
        window.tsuzune.getUpdateStatus()
      ])

      if (disposed) {
        return
      }

      if (settingsResult.ok) {
        setUserIgnoreFilters(settingsResult.value.userIgnoreFilters)
        setExcludedFilesDraft(settingsResult.value.userIgnoreFilters.join('\n'))
        setAiImmutablePaths(settingsResult.value.aiImmutablePaths ?? [])
        setAiImmutablePathsDraft(
          (settingsResult.value.aiImmutablePaths ?? []).join('\n')
        )
        setAiReviewPaths(settingsResult.value.aiReviewPaths ?? [])
        setAiReviewPathsDraft((settingsResult.value.aiReviewPaths ?? []).join('\n'))
        setGraphForces(settingsResult.value.graphForces)
        setGraphDisplay(settingsResult.value.graphDisplay)
        setGraphFilters(settingsResult.value.graphFilters)
        setGraphGroups(settingsResult.value.graphGroups)
        setGraphViewStates(settingsResult.value.graphViewStates)
      }

      if (!vaultResult.ok) {
        setMessage(errorMessage(vaultResult.error))
      } else if (vaultResult.value) {
        setCurrentSnapshot(vaultResult.value)
        if (settingsResult.ok && settingsResult.value.lastNotePath) {
          const previous = restoredLastNote(
            vaultResult.value.notes,
            settingsResult.value.lastNotePath,
            vaultResult.value.pathAliases
          )
          if (previous) {
            loadNoteState(previous, false)
          }
        }
      }
      if (updateResult.ok) {
        setUpdateStatus(updateResult.value)
      }
      setLoading(false)
    }

    void initialize()

    const unsubscribeVault = window.tsuzune.onVaultChanged(queueExternalChange)
    const unsubscribeClose = window.tsuzune.onRequestClose(() => {
      if (busyRef.current) {
        setMessage('処理が終わってからアプリを閉じてください。')
        window.tsuzune.confirmClose(false)
        return
      }
      if (
        captureDirtyRef.current &&
        !window.confirm(
          '入力フォームに未保存の内容があります。破棄してアプリを閉じますか？'
        )
      ) {
        window.tsuzune.confirmClose(false)
        return
      }
      void flushSave().then((saved) => {
        window.tsuzune.confirmClose(saved)
      })
    })
    const unsubscribeUpdate = window.tsuzune.onUpdateStatus((status) => {
      setUpdateStatus(status)
    })

    return () => {
      disposed = true
      unsubscribeVault()
      unsubscribeClose()
      unsubscribeUpdate()
      clearSaveTimer()
      if (externalChangeTimerRef.current) {
        clearTimeout(externalChangeTimerRef.current)
        externalChangeTimerRef.current = null
      }
      queuedExternalEventsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!settingsDialogOpen) {
      return
    }

    settingsDialogRef.current?.focus()
    return () => {
      const previousFocus = settingsDialogPreviousFocusRef.current
      if (previousFocus?.isConnected) {
        previousFocus.focus()
      }
    }
  }, [settingsDialogOpen])

  useEffect(() => {
    if (!googleDialogOpen) {
      return
    }

    googleDialogRef.current?.focus()
    return () => {
      const previousFocus = googleDialogPreviousFocusRef.current
      if (previousFocus?.isConnected) {
        previousFocus.focus()
      }
    }
  }, [googleDialogOpen])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const savedNotes = snapshot?.notes ?? []
  const normalDiscoveryNotes = useMemo(
    () => savedNotes.filter((note) => !isNormalDiscoveryExcluded(note.path)),
    [savedNotes]
  )
  const pathAliases = useMemo(
    () => compilePathAliases(snapshot?.pathAliases ?? {}),
    [snapshot?.pathAliases]
  )
  const bookmarkedPaths = useMemo(
    () => new Set((snapshot?.bookmarks ?? []).map((bookmark) => bookmark.path)),
    [snapshot?.bookmarks]
  )
  const bookmarkGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<VaultSnapshot['bookmarks']>>()
    for (const bookmark of snapshot?.bookmarks ?? []) {
      const group = bookmark.group?.trim() || '未分類'
      const items = groups.get(group) ?? []
      items.push(bookmark)
      groups.set(group, items)
    }
    return [...groups]
  }, [snapshot?.bookmarks])
  const templates = useMemo(() => listTemplates(savedNotes), [savedNotes])
  useEffect(() => {
    if (templates.some((template) => template.path === selectedTemplatePath)) {
      return
    }
    setSelectedTemplatePath(templates[0]?.path ?? '')
  }, [selectedTemplatePath, templates])
  const graphNotes = useMemo(() => {
    if (viewMode !== 'graph' || !selectedPath) {
      return normalDiscoveryNotes
    }
    return normalDiscoveryNotes.map((note) =>
      note.path === selectedPath ? { ...note, content } : note
    )
  }, [normalDiscoveryNotes, selectedPath, content, viewMode])

  const outgoing = useMemo(
    () =>
      selectedPath ? getOutgoingLinks(content, savedNotes, pathAliases) : [],
    [selectedPath, content, savedNotes, pathAliases]
  )
  const backlinks = useMemo(
    () =>
      selectedPath
        ? getBacklinks(selectedPath, normalDiscoveryNotes, pathAliases)
        : [],
    [selectedPath, normalDiscoveryNotes, pathAliases]
  )
  const searchResults = useMemo(
    () => searchNotes(normalDiscoveryNotes, query),
    [normalDiscoveryNotes, query]
  )
  const selectedNote = useMemo(
    () =>
      selectedPath
        ? savedNotes.find((note) => note.path === selectedPath) ?? null
        : null,
    [savedNotes, selectedPath]
  )
  const selectedFreshness = useMemo(
    () =>
      selectedPath
        ? getNoteFreshness({ content, modifiedAt })
        : null,
    [content, modifiedAt, selectedPath]
  )
  const structuredCapture = useMemo((): HumanNoteCaptureSubmission | null => {
    if (!selectedPath) {
      return null
    }
    if (/^02_デイリー\/\d{4}-\d{2}-\d{2}\.md$/.test(selectedPath)) {
      const values = parseDailyNote(content)
      return values ? { kind: 'daily', ...values, memo: values.memo ?? '' } : null
    }
    if (selectedPath.startsWith('01_受信箱/アイデア/')) {
      const values = parseIdeaNote(content)
      return values ? { kind: 'idea', ...values, memo: values.memo ?? '' } : null
    }
    return null
  }, [content, selectedPath])
  const wikiGraph = useMemo(
    () =>
      buildWikiGraphForView(graphNotes, viewMode, {
        includeUnresolved: !graphFilters.existingFilesOnly,
        includeTags: graphFilters.showTags,
        includeAttachments: graphFilters.showAttachments,
        attachments: snapshot?.attachments ?? [],
        pathAliases
      }),
    [
      graphNotes,
      graphFilters.existingFilesOnly,
      graphFilters.showAttachments,
      graphFilters.showTags,
      pathAliases,
      snapshot?.attachments,
      viewMode
    ]
  )
  const visibleGraph = useMemo(() => {
    if (graphScope === 'local') {
      return selectedPath
      ? getLocalWikiGraph(wikiGraph, selectedPath, graphFilters)
        : { nodes: [], edges: [] }
    }
    return getVaultWikiGraph(
      wikiGraph,
      selectedPath,
      graphFilters.showOrphans
    )
  }, [wikiGraph, selectedPath, graphScope, graphFilters])
  const linkedViewBacklinks = useMemo(() => {
    if (!activeLinkedViewPath) {
      return []
    }
    const linkedViewGraph = buildWikiGraph(normalDiscoveryNotes, {
      includeAttachments: true,
      attachments: snapshot?.attachments ?? [],
      pathAliases
    })
    const sourcePaths = new Set(
      linkedViewGraph.edges
        .filter((edge) => edge.targetPath === activeLinkedViewPath)
        .map((edge) => edge.sourcePath)
    )
    return normalDiscoveryNotes.filter((note) => sourcePaths.has(note.path))
  }, [activeLinkedViewPath, normalDiscoveryNotes, pathAliases, snapshot?.attachments])
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
    if (externalChangeTimerRef.current) {
      clearTimeout(externalChangeTimerRef.current)
      externalChangeTimerRef.current = null
    }
    queuedExternalEventsRef.current.clear()
    pendingExternalEventsRef.current.length = 0
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

  const ensureDirectory = async (directory: string): Promise<boolean> => {
    const known = new Set(snapshotRef.current?.directories ?? [])
    let parent = ''
    for (const name of directory.split('/').filter(Boolean)) {
      const path = joinRelative(parent, name)
      if (!known.has(path)) {
        const result = await window.tsuzune.createDirectory({ parent, name })
        if (!result.ok && result.error.code !== 'ALREADY_EXISTS') {
          const error = errorMessage(result.error)
          setMessage(error)
          setCaptureError(error)
          return false
        }
        known.add(path)
      }
      parent = path
    }
    return true
  }

  const availableNoteName = (directory: string, preferredName: string): string => {
    const baseName = withoutMarkdownExtension(preferredName.trim()) || '無題のノート'
    const paths = new Set(
      (snapshotRef.current?.notes ?? []).map((note) => note.path.toLocaleLowerCase())
    )
    for (let suffix = 0; ; suffix += 1) {
      const name = suffix === 0 ? baseName : `${baseName} ${suffix}`
      const path = joinRelative(directory, withMarkdownExtension(name)).toLocaleLowerCase()
      if (!paths.has(path)) {
        return name
      }
    }
  }

  const createAndOpenNote = async (
    directory: string,
    preferredName: string,
    content?: string | ((name: string) => string)
  ): Promise<void> => {
    if (!snapshot || !beginOperation()) {
      return
    }
    try {
      if (!(await flushSave()) || !(await ensureDirectory(directory))) {
        return
      }
      const name = availableNoteName(directory, preferredName)
      const renderedContent = typeof content === 'function' ? content(name) : content
      const result = await window.tsuzune.createNote({
        directory,
        name,
        content: renderedContent
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (note) {
        loadNoteState(note)
        setViewMode('edit')
      }
    } finally {
      finishOperation()
    }
  }

  const createNoteInDirectory = async (directory: string): Promise<void> => {
    await createAndOpenNote(directory, '無題のノート')
  }

  const createNote = async (): Promise<void> => {
    await createNoteInDirectory(targetDirectory())
  }

  const createFromTemplate = async (template: NoteDocument): Promise<void> => {
    const now = new Date()
    if (template.path === DAILY_TEMPLATE_PATH) {
      const location = dailyNoteLocation(now)
      const existing = snapshotRef.current?.notes.find(
        (note) => note.path === location.path
      )
      if (existing) {
        await openNote(existing.path)
        setViewMode('edit')
        return
      }
      await createAndOpenNote(location.directory, location.name, (name) =>
        renderTemplate(template.content, { title: name, now })
      )
      return
    }

    const selectedDirectory = targetDirectory()
    const directory =
      template.path === IDEA_TEMPLATE_PATH
        ? '01_受信箱/アイデア'
        : selectedDirectory === TEMPLATE_DIRECTORY ||
            selectedDirectory.startsWith(`${TEMPLATE_DIRECTORY}/`)
          ? ''
          : selectedDirectory
    await createAndOpenNote(directory, template.name, (name) =>
      renderTemplate(template.content, { title: name, now })
    )
  }

  const addTemplate = async (): Promise<void> => {
    await createAndOpenNote(
      TEMPLATE_DIRECTORY,
      '新しいテンプレート',
      '# {{title}}\n\n'
    )
  }

  const createCapturedNote = async (
    submission: HumanNoteCaptureSubmission
  ): Promise<boolean> => {
    setCaptureError(null)
    if (!snapshot) {
      return false
    }

    const now = new Date()
    const capturedDailyDate = captureEditPath?.match(
      /^02_デイリー\/(\d{4})-(\d{2})-(\d{2})\.md$/
    )
    const dailyDate = capturedDailyDate
      ? new Date(
          Number(capturedDailyDate[1]),
          Number(capturedDailyDate[2]) - 1,
          Number(capturedDailyDate[3]),
          12
        )
      : now
    const content =
      submission.kind === 'note'
        ? noteCreationTemplate
          ? (() => {
              const template = renderTemplate(noteCreationTemplate.content, {
                title: submission.title,
                now
              })
              return submission.body.trim()
                ? `${template.trimEnd()}\n\n${submission.body}${submission.body.endsWith('\n') ? '' : '\n'}`
                : template
            })()
          : submission.body.trim()
            ? renderPlainNote(submission)
            : undefined
        : submission.kind === 'daily'
          ? renderDailyNote({ now: dailyDate, ...submission })
          : renderIdeaNote(submission)

    if (captureEditPath) {
      if (
        selectedPathRef.current !== captureEditPath ||
        content === undefined ||
        !(await flushSave())
      ) {
        return false
      }
      handleContentChange(content)
      if (!(await flushSave())) {
        return false
      }
      setCaptureKind(null)
      setCaptureEditPath(null)
      setViewMode('preview')
      return true
    }

    const location =
      submission.kind === 'daily'
        ? dailyNoteLocation(now)
        : submission.kind === 'idea'
          ? ideaNoteLocation(submission.title)
          : null
    const existing = location
      ? snapshotRef.current?.notes.find((note) => note.path === location.path)
      : null
    if (existing) {
      const error =
        submission.kind === 'idea'
          ? `同名のアイデア「${submission.title.trim()}」は既にあります。タイトルを変えてください。`
          : '今日のノートは既にあります。入力内容を残したまま保存を中止しました。'
      setMessage(error)
      setCaptureError(error)
      return false
    }
    if (!beginOperation()) {
      return false
    }

    try {
      if (!(await flushSave())) {
        return false
      }

      const selectedDirectory = targetDirectory()
      const directory =
        submission.kind === 'note'
          ? noteCreationTemplate &&
            (selectedDirectory === TEMPLATE_DIRECTORY ||
              selectedDirectory.startsWith(`${TEMPLATE_DIRECTORY}/`))
            ? ''
            : selectedDirectory
          : location?.directory ?? ''
      if (!(await ensureDirectory(directory))) {
        return false
      }

      const name = submission.kind === 'note' ? submission.title : location?.name ?? ''
      const result = await window.tsuzune.createNote({ directory, name, content })
      if (!result.ok) {
        const error = errorMessage(result.error)
        setMessage(error)
        setCaptureError(error)
        return false
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (note) {
        loadNoteState(note)
        setViewMode(submission.kind === 'note' ? 'edit' : 'preview')
      }
      setCaptureKind(null)
      setCaptureEditPath(null)
      setNoteCreationTemplate(null)
      return true
    } finally {
      finishOperation()
    }
  }

  const createDirectoryIn = async (parent: string): Promise<void> => {
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
        parent,
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

  const createDirectory = async (): Promise<void> => {
    await createDirectoryIn(targetDirectory())
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

    for (const note of savedNotes) {
      if (isPathInsideOrEqual(note.path, selection.path)) {
        changes.set(note.path, `${newPath}${note.path.slice(selection.path.length)}`)
      }
    }
    return changes
  }

  const confirmLinkImpact = (changes: ReadonlyMap<string, string>): boolean => {
    const impact = findLinkImpact(savedNotes, changes, pathAliases)
    if (impact.affectedCount === 0) {
      return true
    }
    const examples = impact.sourcePaths.slice(0, 3).join('\n')
    return window.confirm(
      `この操作により、${impact.affectedCount}件の参照元でWikiリンクが未作成または曖昧になります。\n\n${examples}\n\nそのまま続けますか？`
    )
  }

  const openRename = (selection: TreeSelection | null): void => {
    if (!snapshot || !selection || selection.path === '') {
      return
    }
    const currentName =
      selection.kind === 'note'
        ? withoutMarkdownExtension(basenameRelative(selection.path))
        : basenameRelative(selection.path)
    setRenameError(null)
    setRenameRequest({ selection, currentName })
  }

  const renameSelected = (): void => openRename(treeSelection)

  const confirmRename = async (requestedName: string): Promise<void> => {
    const request = renameRequest
    if (!request || !snapshot) {
      return
    }
    const nextName = requestedName.trim()
    if (!nextName) {
      setRenameError('新しい名前を入力してください。')
      return
    }
    if (nextName === request.currentName) {
      setRenameError('現在と異なる名前を入力してください。')
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
        request.selection.kind === 'note'
          ? withMarkdownExtension(nextName)
          : nextName
      const newPath = joinRelative(
        dirnameRelative(request.selection.path),
        finalName
      )
      const changes = pathChangesForRename(request.selection, newPath)
      if (!confirmLinkImpact(changes)) {
        return
      }

      const result = await window.tsuzune.renameEntry({
        path: request.selection.path,
        newName: nextName
      })
      if (!result.ok) {
        setRenameError(errorMessage(result.error))
        return
      }

      const previousSelectionPath = request.selection.path
      const next = await refreshSnapshot()
      setTreeSelection({ kind: request.selection.kind, path: result.value.path })
      setRenameRequest(null)
      setRenameError(null)

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

  const moveSelectedFile = async (destinationDirectory: string): Promise<void> => {
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
      setWorkspaceTabs((current) =>
        current.map((tab) =>
          tab.kind !== 'global-graph' && tab.path === path
            ? { ...tab, path: result.value.path }
            : tab
        )
      )
      setActiveAttachmentPath((current) =>
        current === path ? result.value.path : current
      )
      setTreeSelection((current) =>
        current?.kind === 'note' && current.path === path
          ? { ...current, path: result.value.path }
          : current
      )
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

  const saveGraphBookmark = async (title: string, group: string): Promise<void> => {
    if (!bookmarkPath) {
      return
    }
    const result = await window.tsuzune.saveBookmark({
      path: bookmarkPath,
      title,
      group
    })
    if (!result.ok) {
      setMessage(errorMessage(result.error))
      return
    }
    await refreshSnapshot()
    setBookmarkPath(null)
  }

  const removeGraphBookmark = async (): Promise<void> => {
    if (!bookmarkPath) {
      return
    }
    const result = await window.tsuzune.removeBookmark(bookmarkPath)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
      return
    }
    await refreshSnapshot()
    setBookmarkPath(null)
  }

  const trashPath = async (path: string): Promise<void> => {
    const affected = Boolean(
      selectedPathRef.current &&
        isPathInsideOrEqual(selectedPathRef.current, path)
    )

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
      setTreeSelection((current) =>
        current && isPathInsideOrEqual(current.path, path)
          ? { kind: 'directory', path: '' }
          : current
      )
    } finally {
      finishOperation()
    }
  }

  const trashSelected = async (): Promise<void> => {
    if (!treeSelection || treeSelection.path === '') {
      return
    }
    await trashPath(treeSelection.path)
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
    const resolved = resolveWikiLink(target, savedNotes, pathAliases)
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

  const openGraphNode = (path: string): void => {
    const node = visibleGraph.nodes.find((candidate) => candidate.path === path)
    if (!node || node.kind === 'tag') {
      return
    }
    if (node.exists === false) {
      void createMissingLink(withoutMarkdownExtension(path))
      return
    }
    if (node.kind === 'attachment') {
      void window.tsuzune.openVaultFile(path).then((result) => {
        if (!result.ok) {
          setMessage(errorMessage(result.error))
        }
      })
      return
    }
    void openNote(path)
  }

  const openBookmark = (path: string): void => {
    if (snapshot?.notes.some((note) => note.path === path)) {
      void openNote(path)
      return
    }
    if (snapshot?.attachments?.some((attachment) => attachment.path === path)) {
      void window.tsuzune.openVaultFile(path).then((result) => {
        if (!result.ok) {
          setMessage(errorMessage(result.error))
        }
      })
      return
    }
    setMessage(`ブックマーク先「${path}」が見つかりません。`)
  }

  const revealVaultEntry = (path: string): void => {
    void window.tsuzune.revealVaultFile(path).then((result) => {
      if (!result.ok) {
        setMessage(errorMessage(result.error))
      }
    })
  }

  const revealGraphNodeInFolder = (path: string): void => {
    const node = visibleGraph.nodes.find((candidate) => candidate.path === path)
    if (
      !node ||
      (node.kind !== 'note' && node.kind !== 'attachment') ||
      node.exists === false
    ) {
      return
    }
    revealVaultEntry(path)
  }

  const openGraphNodeLinkedView = async (path: string): Promise<void> => {
    const node = visibleGraph.nodes.find((candidate) => candidate.path === path)
    if (!node || node.kind === 'tag' || node.exists === false || !beginOperation()) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }

      const existing = workspaceTabs.find(
        (tab) => tab.kind === 'linked-view' && tab.path === path
      )
      if (existing) {
        setActiveTabId(existing.id)
      } else {
        const currentTabs = workspaceTabs.length > 0
          ? workspaceTabs
          : viewMode === 'graph' && graphScope === 'vault'
            ? [{ id: nextTabIdRef.current++, kind: 'global-graph' as const }]
            : selectedPathRef.current
              ? [{
                  id: nextTabIdRef.current++,
                  kind: 'note' as const,
                  path: selectedPathRef.current
                }]
              : []
        const nextTab: WorkspaceTab = {
          id: nextTabIdRef.current++,
          kind: 'linked-view',
          path
        }
        setWorkspaceTabs([...currentTabs, nextTab])
        setActiveTabId(nextTab.id)
      }

      loadNoteState(null, false)
      setActiveLinkedViewPath(path)
      setMessage(null)
    } finally {
      finishOperation()
    }
  }

  const loadWorkspaceTab = async (tab: WorkspaceTab): Promise<boolean> => {
    if (!beginOperation()) {
      return false
    }
    try {
      if (!(await flushSave())) {
        return false
      }
      if (tab.kind === 'global-graph') {
        setActiveTabId(tab.id)
        setActiveAttachmentPath(null)
        setActiveLinkedViewPath(null)
        setGraphScope('vault')
        setViewMode('graph')
        setMessage(null)
        return true
      }
      if (tab.kind === 'attachment') {
        setActiveTabId(tab.id)
        setActiveAttachmentPath(tab.path)
        setActiveLinkedViewPath(null)
        setMessage(null)
        return true
      }
      if (tab.kind === 'linked-view') {
        setActiveTabId(tab.id)
        loadNoteState(null, false)
        setActiveLinkedViewPath(tab.path)
        setMessage(null)
        return true
      }
      const note = snapshotRef.current?.notes.find(
        (candidate) => candidate.path === tab.path
      )
      if (!note) {
        setMessage('このノートは現在のVaultにありません。')
        return false
      }
      setActiveTabId(tab.id)
      loadNoteState(note)
      setViewMode('edit')
      return true
    } finally {
      finishOperation()
    }
  }

  const openGlobalGraphWorkspace = (): void => {
    const existing = workspaceTabs.find((tab) => tab.kind === 'global-graph')
    if (existing) {
      setActiveTabId(existing.id)
    } else {
      const currentTabs = workspaceTabs.length > 0
        ? workspaceTabs
        : selectedPathRef.current
          ? [{ id: nextTabIdRef.current++, kind: 'note' as const, path: selectedPathRef.current }]
          : []
      const graphTab: WorkspaceTab = {
        id: nextTabIdRef.current++,
        kind: 'global-graph'
      }
      setWorkspaceTabs([...currentTabs, graphTab])
      setActiveTabId(graphTab.id)
    }
    setActiveAttachmentPath(null)
    setActiveLinkedViewPath(null)
    setGraphScope('vault')
    setViewMode('graph')
  }

  const openVaultEntryInNewTab = async (
    path: string,
    kind: 'note' | 'attachment'
  ): Promise<void> => {
    if (!beginOperation()) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }

      const currentTabs = workspaceTabs.length > 0
        ? workspaceTabs
        : viewMode === 'graph' && graphScope === 'vault'
          ? [{ id: nextTabIdRef.current++, kind: 'global-graph' as const }]
          : selectedPathRef.current
            ? [{ id: nextTabIdRef.current++, kind: 'note' as const, path: selectedPathRef.current }]
            : []
      const nextTab: WorkspaceTab = {
        id: nextTabIdRef.current++,
        kind,
        path
      }
      setWorkspaceTabs([...currentTabs, nextTab])
      setActiveTabId(nextTab.id)
      setActiveLinkedViewPath(null)

      if (nextTab.kind === 'attachment') {
        setActiveAttachmentPath(path)
        setMessage(null)
        return
      }
      const note = snapshotRef.current?.notes.find((candidate) => candidate.path === path)
      if (!note) {
        setMessage('このノートは現在のVaultにありません。')
        return
      }
      loadNoteState(note)
      setActiveTabId(nextTab.id)
      setViewMode('edit')
    } finally {
      finishOperation()
    }
  }

  const openGraphNodeInNewTab = async (path: string): Promise<void> => {
    const node = visibleGraph.nodes.find((candidate) => candidate.path === path)
    if (
      !node ||
      (node.kind !== 'note' && node.kind !== 'attachment') ||
      node.exists === false
    ) {
      return
    }
    await openVaultEntryInNewTab(path, node.kind)
  }

  const openGraphNodeInNewWindow = async (path: string): Promise<void> => {
    if (!(await flushSave())) {
      return
    }
    const result = await window.tsuzune.openVaultFileWindow(path)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const copyGraphNodePath = async (
    path: string,
    format: CopyPathFormat
  ): Promise<void> => {
    if (!snapshot) {
      return
    }
    const result = await window.tsuzune.copyText(
      formatPathForCopy(snapshot.rootPath, snapshot.rootName, path, format)
    )
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const closeWorkspaceTab = async (tabId: number): Promise<void> => {
    const index = workspaceTabs.findIndex((tab) => tab.id === tabId)
    if (index < 0) {
      return
    }
    const remaining = workspaceTabs.filter((tab) => tab.id !== tabId)
    if (tabId !== activeTabId) {
      setWorkspaceTabs(remaining)
      return
    }
    const next = remaining[Math.min(index, remaining.length - 1)]
    if (next) {
      if (await loadWorkspaceTab(next)) {
        setWorkspaceTabs(remaining)
      }
      return
    }
    if (!beginOperation()) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }
      setWorkspaceTabs(remaining)
      setActiveTabId(null)
      setActiveAttachmentPath(null)
      setActiveLinkedViewPath(null)
      if (workspaceTabs[index].kind === 'global-graph') {
        setViewMode('edit')
      }
    } finally {
      finishOperation()
    }
  }

  const activeAttachment: VaultAttachment | null = activeAttachmentPath
    ? snapshot?.attachments?.find((item) => item.path === activeAttachmentPath) ?? null
    : null

  const searchGraphTag = (tag: string): void => {
    setQuery(`tag:${tag}`)
  }

  const openSettingsDialog = async (): Promise<void> => {
    settingsDialogPreviousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setExcludedFilesDraft(userIgnoreFilters.join('\n'))
    setAiImmutablePathsDraft(aiImmutablePaths.join('\n'))
    setAiReviewPathsDraft(aiReviewPaths.join('\n'))
    setSettingsDialogOpen(true)
    const proposals = await window.tsuzune.listAiReviewProposals()
    if (proposals.ok) setAiReviewProposals(proposals.value)
    else setMessage(errorMessage(proposals.error))
  }

  const saveExcludedFiles = async (): Promise<void> => {
    const nextFilters = excludedFilesDraft
      .split(/\r?\n/)
      .map((filter) => filter.trim())
      .filter(Boolean)
    const nextAiImmutablePaths = aiImmutablePathsDraft
      .split(/\r?\n/)
      .map((path) => path.trim())
      .filter(Boolean)
    const nextAiReviewPaths = aiReviewPathsDraft
      .split(/\r?\n/)
      .map((path) => path.trim())
      .filter(Boolean)

    setSettingsBusy(true)
    try {
      const result = await window.tsuzune.setUserIgnoreFilters(nextFilters)
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      const immutableResult = await window.tsuzune.setAiImmutablePaths(
        nextAiImmutablePaths
      )
      if (!immutableResult.ok) {
        setMessage(errorMessage(immutableResult.error))
        return
      }
      const reviewResult = await window.tsuzune.setAiReviewPaths(nextAiReviewPaths)
      if (!reviewResult.ok) {
        setMessage(errorMessage(reviewResult.error))
        return
      }
      setUserIgnoreFilters(nextFilters)
      setAiImmutablePaths(nextAiImmutablePaths)
      setAiReviewPaths(nextAiReviewPaths)
      await refreshSnapshot()
      setSettingsDialogOpen(false)
    } finally {
      setSettingsBusy(false)
    }
  }

  const resolveAiReviewProposal = async (
    proposal: AiWriteReviewProposal,
    approve: boolean
  ): Promise<void> => {
    setSettingsBusy(true)
    try {
      const result = approve
        ? await window.tsuzune.approveAiReviewProposal(proposal.id)
        : await window.tsuzune.cancelAiReviewProposal(proposal.id)
      if (!result.ok) {
        setMessage(errorMessage(result.error))
      }
      const proposals = await window.tsuzune.listAiReviewProposals()
      if (proposals.ok) setAiReviewProposals(proposals.value)
      if (approve && result.ok) await refreshSnapshot()
    } finally {
      setSettingsBusy(false)
    }
  }

  const openGoogleDialog = async (): Promise<void> => {
    googleDialogPreviousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setGoogleAdvancedOpen(false)
    setGoogleError(null)
    setGoogleDialogOpen(true)
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.getGoogleDriveStatus()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setGoogleStatus(result.value)
    } finally {
      setGoogleBusy(false)
    }
  }

  const handleGoogleDialogKeyDown = (
    event: React.KeyboardEvent<HTMLElement>
  ): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setGoogleDialogOpen(false)
      return
    }
    if (event.key !== 'Tab') {
      return
    }

    const dialog = googleDialogRef.current
    if (!dialog) {
      return
    }
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
    )
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || active === dialog)) {
      event.preventDefault()
      first.focus()
    } else if (!(active instanceof Node) || !dialog.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }

  const chooseGoogleConfig = async (): Promise<void> => {
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.chooseGoogleOAuthConfig()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      if (result.value) {
        setGoogleStatus(result.value)
        setMessage('Google OAuth設定を読み込みました。')
      }
    } finally {
      setGoogleBusy(false)
    }
  }

  const connectGoogle = async (): Promise<void> => {
    setGoogleBusy(true)
    setGoogleError(null)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.connectGoogle()
      if (!result.ok) {
        const nextError = errorMessage(result.error)
        setGoogleError(nextError)
        setMessage(nextError)
        return
      }
      setGoogleStatus(result.value)
      setMessage(`${result.value.account?.email ?? 'Googleアカウント'}に接続しました。`)
    } finally {
      setGoogleBusy(false)
    }
  }

  const authorizeGoogleCalendar = async (): Promise<void> => {
    setGoogleBusy(true)
    setGoogleError(null)
    try {
      const result = await window.tsuzune.authorizeGoogleCalendar()
      if (!result.ok) {
        const nextError = errorMessage(result.error)
        setGoogleError(nextError)
        setMessage(nextError)
        return
      }
      setGoogleStatus(result.value)
      setMessage('Google Calendarの読取権限を有効にしました。')
    } finally {
      setGoogleBusy(false)
    }
  }

  const disconnectGoogle = async (): Promise<void> => {
    if (!window.confirm('この端末からGoogle接続情報を削除しますか？')) {
      return
    }
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.disconnectGoogle()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setGoogleStatus(result.value)
      setDriveVaults([])
      setSelectedDriveVaultId('')
      setMessage('Googleアカウントとの接続を解除しました。Drive上のファイルは残ります。')
    } finally {
      setGoogleBusy(false)
    }
  }

  const listRemoteDriveVaults = async (): Promise<void> => {
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.listDriveVaults()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setDriveVaults(result.value)
      setSelectedDriveVaultId(result.value[0]?.rootFolderId ?? '')
      setMessage(
        result.value.length > 0
          ? `${result.value.length}件のDrive Vaultが見つかりました。`
          : '接続できる既存のDrive Vaultはありません。'
      )
    } finally {
      setGoogleBusy(false)
    }
  }

  const pairRemoteDriveVault = async (): Promise<void> => {
    const selected = driveVaults.find(
      (candidate) => candidate.rootFolderId === selectedDriveVaultId
    )
    if (!selected) {
      return
    }
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.pairDriveVault({
        rootFolderId: selected.rootFolderId,
        vaultId: selected.vaultId
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setGoogleStatus(result.value)
      setMessage('Drive Vaultを接続しました。')
    } finally {
      setGoogleBusy(false)
    }
  }

  const previewGoogleDriveSync = async (): Promise<void> => {
    if (!snapshot || !beginOperation()) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.previewDriveSync()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setDrivePreview(result.value)
    } finally {
      finishOperation()
    }
  }

  const applyGoogleDriveSync = async (): Promise<void> => {
    if (
      !drivePreview ||
      !window.confirm(
        '表示中の同期内容を適用しますか？削除は伝播せず、競合は別ノートとして残します。'
      ) ||
      !beginOperation()
    ) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.applyDriveSync(drivePreview.planId)
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      const currentPath = selectedPathRef.current
      const next = await refreshSnapshot()
      if (currentPath) {
        loadNoteState(
          next?.notes.find((note) => note.path === currentPath) ?? null
        )
      }
      setDrivePreview(null)
      const status = await window.tsuzune.getGoogleDriveStatus()
      if (status.ok) {
        setGoogleStatus(status.value)
      }
      setMessage(
        `Drive同期完了: 送信${result.value.uploaded} / 受信${result.value.downloaded} / 移動${result.value.moved} / 競合${result.value.conflicts} / 保持${result.value.preserved}`
      )
    } finally {
      finishOperation()
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

  const updateActionLabel = (): string => {
    const version = updateStatus.availableVersion
    switch (updateStatus.phase) {
      case 'available':
        return version ? `TSUZUNE ${version}を取得` : '更新を取得'
      case 'downloading':
        return `更新 ${Math.round(updateStatus.downloadPercent ?? 0)}%`
      case 'downloaded':
        return version ? `TSUZUNE ${version}を適用` : '更新を適用'
      case 'checking':
        return '確認中…'
      default:
        return '更新を確認'
    }
  }

  const handleUpdateAction = async (): Promise<void> => {
    if (updateBusy || updateStatus.phase === 'disabled') {
      return
    }

    setUpdateBusy(true)
    try {
      if (updateStatus.phase === 'downloaded') {
        if (!(await flushSave())) {
          setMessage('編集中のノートを保存できなかったため、更新を中止しました。')
          return
        }
        const result = await window.tsuzune.installUpdate()
        if (!result.ok) {
          setMessage(errorMessage(result.error))
        }
        return
      }

      const result =
        updateStatus.phase === 'available'
          ? await window.tsuzune.downloadUpdate()
          : await window.tsuzune.checkForUpdates()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setUpdateStatus(result.value)
      if (result.value.message) {
        setMessage(result.value.message)
      }
    } finally {
      setUpdateBusy(false)
    }
  }

  const workspaceTabBar = workspaceTabs.length > 0 ? (
    <div className="workspace-tabs" role="tablist" aria-label="開いているタブ">
      {workspaceTabs.map((tab) => (
        <div className="workspace-tab" key={tab.id}>
          <button
            type="button"
            role="tab"
            aria-selected={tab.id === activeTabId}
            className={tab.id === activeTabId ? 'is-active' : ''}
            onClick={() => void loadWorkspaceTab(tab)}
          >
            {workspaceTabLabel(tab)}
          </button>
          <button
            type="button"
            className="workspace-tab-close"
            aria-label={`${workspaceTabLabel(tab)}を閉じる`}
            onClick={() => void closeWorkspaceTab(tab.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  ) : null

  if (loading) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <img src={tsuzuneMark} alt="TSUZUNE" />
        <span>Vaultを整えています…</span>
      </div>
    )
  }

  const modalOpen =
    settingsDialogOpen ||
    googleDialogOpen ||
    Boolean(movePath) ||
    Boolean(renameRequest) ||
    Boolean(bookmarkPath) ||
    Boolean(captureKind)

  return (
    <div className={`app-shell${busy ? ' is-busy' : ''}`} aria-busy={busy}>
      {busy && (
        <div className="operation-overlay" role="status" aria-live="polite">
          <img src={tsuzuneMark} alt="" aria-hidden="true" />
          <span>処理中…</span>
        </div>
      )}
      <header className="app-header" inert={busy || modalOpen}>
        <div className="brand">
          <img className="brand-mark" src={tsuzuneMark} alt="" aria-hidden="true" />
          <div className="brand-copy">
            <strong>TSUZUNE</strong>
            <span>書いて、つないで、あとで尋ねる。</span>
          </div>
        </div>
        <div className="vault-summary">
          <span>{snapshot ? `Vault: ${snapshot.rootName}` : 'Vault未選択'}</span>
          {updateStatus.phase !== 'disabled' && (
            <button
              type="button"
              className="secondary-button update-button"
              title={updateStatus.message ?? undefined}
              disabled={
                updateBusy ||
                updateStatus.phase === 'checking' ||
                updateStatus.phase === 'downloading'
              }
              onClick={() => void handleUpdateAction()}
            >
              <Icon name="refresh" />
              {updateActionLabel()}
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={openSettingsDialog}
          >
            <Icon name="settings" />
            設定
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void openGoogleDialog()}
          >
            <Icon name="cloud" />
            Google / 同期
          </button>
          <button type="button" className="secondary-button" onClick={() => void chooseVault()}>
            <Icon name="folder-open" />
            Vaultを開く
          </button>
        </div>
      </header>

      {message && (
        <div className="message-banner" role="status" inert={busy || modalOpen}>
          <span>{message}</span>
          {saveStatus === 'error' && (
            <button type="button" onClick={() => void flushSave()}>
              再試行
            </button>
          )}
          <button type="button" aria-label="通知を閉じる" onClick={() => setMessage(null)}>
            <Icon name="x" />
          </button>
        </div>
      )}

      {conflict?.kind === 'changed' && (
        <div className="conflict-banner" role="alert" inert={busy || modalOpen}>
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
        <div className="conflict-banner" role="alert" inert={busy || modalOpen}>
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
        <main className="welcome" inert={busy || modalOpen}>
          <div>
            <img className="welcome-mark" src={tsuzuneMark} alt="" aria-hidden="true" />
            <p className="eyebrow">LOCAL MARKDOWN NOTEBOOK</p>
            <h1>最初のVaultを開きましょう</h1>
            <p>
              ローカルフォルダを選ぶと、Markdownノートを作成してWikiリンクでつなげられます。
            </p>
            <button type="button" className="primary-button" onClick={() => void chooseVault()}>
              <Icon name="folder-open" />
              Vaultを開く
            </button>
          </div>
        </main>
      ) : (
        <main className="workspace" inert={busy || modalOpen}>
          <aside className="left-panel">
            <label className="search-field">
              <span className="sr-only">Vaultを検索</span>
              <Icon name="search" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  if (event.target.value) {
                    setBookmarksOpen(false)
                  }
                }}
                placeholder="Vaultを検索"
                title="Vaultを検索（Ctrl+K）"
              />
            </label>

            <div className="tree-toolbar">
              <button type="button" onClick={() => void createNote()}>
                <Icon name="note" />
                ノート
              </button>
              <button type="button" onClick={() => void createDirectory()}>
                <Icon name="folder" />
                フォルダ
              </button>
              <button
                type="button"
                className="graph-view-entry"
                onClick={openGlobalGraphWorkspace}
              >
                <Icon name="graph" />
                グラフビュー
              </button>
              <button
                type="button"
                className="bookmark-view-entry"
                aria-pressed={bookmarksOpen}
                onClick={() => {
                  setQuery('')
                  setBookmarksOpen((current) => !current)
                }}
              >
                <Icon name="bookmark" />
                ブックマーク
              </button>
              <div className="template-create">
                <label>
                  <span className="sr-only">テンプレート</span>
                  <select
                    aria-label="テンプレート"
                    value={selectedTemplatePath}
                    onChange={(event) => setSelectedTemplatePath(event.target.value)}
                    title={`${TEMPLATE_DIRECTORY}内のMarkdownを雛形として使います`}
                  >
                    {templates.length === 0 ? (
                      <option value="">テンプレートなし</option>
                    ) : (
                      templates.map((template) => (
                        <option key={template.path} value={template.path}>
                          {withoutMarkdownExtension(
                            template.path.slice(`${TEMPLATE_DIRECTORY}/`.length)
                          )}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!selectedTemplatePath}
                  onClick={() => {
                    const template = templates.find(
                      (candidate) => candidate.path === selectedTemplatePath
                    )
                    if (template) {
                      void createFromTemplate(template)
                    }
                  }}
                >
                  テンプレートから作成
                </button>
                <button type="button" onClick={() => void addTemplate()}>
                  テンプレートを追加
                </button>
              </div>
            </div>

            {bookmarksOpen ? (
              <section className="bookmark-panel" aria-label="ブックマーク一覧">
                {bookmarkGroups.length === 0 ? (
                  <p className="sidebar-empty">ブックマークはありません。</p>
                ) : (
                  bookmarkGroups.map(([group, bookmarks]) => (
                    <section className="bookmark-group" key={group}>
                      <h2>{group}</h2>
                      {bookmarks.map((bookmark) => {
                        const exists =
                          snapshot.notes.some((note) => note.path === bookmark.path) ||
                          snapshot.attachments?.some(
                            (attachment) => attachment.path === bookmark.path
                          )
                        return (
                          <button
                            type="button"
                            className="bookmark-row"
                            key={bookmark.path}
                            onClick={() => openBookmark(bookmark.path)}
                            onContextMenu={(event) => {
                              event.preventDefault()
                              setBookmarkPath(bookmark.path)
                            }}
                            title="右クリックで編集"
                          >
                            <strong>{bookmark.title || basenameRelative(bookmark.path)}</strong>
                            <span>{bookmark.path}</span>
                            {!exists && <small>見つかりません</small>}
                          </button>
                        )
                      })}
                    </section>
                  ))
                )}
              </section>
            ) : (
              <FileTree
                snapshot={snapshot}
                selectedNotePath={selectedPath}
                treeSelection={treeSelection}
                searchResults={searchResults}
                query={query}
                onSelectNote={(path) => void openNote(path)}
                onSelectEntry={setTreeSelection}
                onRename={openRename}
                onMove={setMovePath}
                onTrash={(path) => void trashPath(path)}
                bookmarkedPaths={bookmarkedPaths}
                onOpenInNewTab={(path) => void openVaultEntryInNewTab(path, 'note')}
                onReveal={revealVaultEntry}
                onCopyPath={(path) => void copyGraphNodePath(path, 'vault-relative')}
                onBookmark={setBookmarkPath}
                onCreateNote={(directory) => void createNoteInDirectory(directory)}
                onCreateDirectory={(directory) => void createDirectoryIn(directory)}
              />
            )}

            {!bookmarksOpen && (
              <div className="entry-toolbar" aria-label="選択項目の操作">
                <button
                  type="button"
                  disabled={!treeSelection || treeSelection.path === ''}
                  onClick={renameSelected}
                >
                  <Icon name="rename" />
                  名前変更
                </button>
                <button
                  type="button"
                  disabled={treeSelection?.kind !== 'note'}
                  onClick={() =>
                    treeSelection?.kind === 'note' && setMovePath(treeSelection.path)
                  }
                >
                  <Icon name="move" />
                  移動
                </button>
                <button
                  type="button"
                  disabled={!treeSelection || treeSelection.path === ''}
                  onClick={() => void trashSelected()}
                >
                  <Icon name="trash" />
                  ごみ箱
                </button>
              </div>
            )}
          </aside>

          <section className="note-panel">
            {activeLinkedViewPath ? (
              <>
                <div className="note-top">
                  {workspaceTabBar}
                  <header className="note-header">
                    <div>
                      <strong>{workspaceTabLabel({
                        id: 0,
                        kind: 'linked-view',
                        path: activeLinkedViewPath
                      })}</strong>
                      <span>{activeLinkedViewPath}</span>
                    </div>
                  </header>
                </div>
                <section
                  className="linked-view-panel"
                  role="region"
                  aria-label="バックリンクビュー"
                >
                  <h2>バックリンク</h2>
                  {linkedViewBacklinks.length > 0 ? (
                    <div className="linked-view-list">
                      {linkedViewBacklinks.map((note) => (
                        <button
                          key={note.path}
                          type="button"
                          className="related-link"
                          aria-label={note.path}
                          onClick={() => void openNote(note.path)}
                        >
                          <strong>{note.name}</strong>
                          <span>{note.path}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="related-empty">バックリンクはありません。</p>
                  )}
                </section>
                <footer className="note-footer">
                  <span>{linkedViewBacklinks.length}件のバックリンク</span>
                  <span>{activeLinkedViewPath}</span>
                </footer>
              </>
            ) : !selectedPath && viewMode === 'graph' && graphScope === 'vault' ? (
              <>
                <div className="note-top">{workspaceTabBar}</div>
                <WikiGraphView
                  graph={visibleGraph}
                  notes={graphNotes}
                  currentPath={null}
                  scope="vault"
                  includeOrphans={graphFilters.showOrphans}
                  filterSettings={graphFilters}
                  forceSettings={graphForces}
                  displaySettings={graphDisplay}
                  groups={graphGroups}
                  viewState={graphViewStates.vault}
                  onScopeChange={setGraphScope}
                  onIncludeOrphansChange={(showOrphans) =>
                    setGraphFilters((current) => ({
                      ...current,
                      showOrphans
                    }))
                  }
                  onFilterSettingsChange={setGraphFilters}
                  onFilterSettingsCommit={(next) =>
                    void persistGraphFilters(next)
                  }
                  onForceSettingsChange={setGraphForces}
                  onForceSettingsCommit={(next) => void persistGraphForces(next)}
                  onDisplaySettingsChange={setGraphDisplay}
                  onDisplaySettingsCommit={(next) =>
                    void persistGraphDisplay(next)
                  }
                  onGroupsChange={setGraphGroups}
                  onGroupsCommit={(next) => void persistGraphGroups(next)}
                  onViewStateCommit={(next) =>
                    void persistGraphViewState('vault', next)
                  }
                  onSearchTag={searchGraphTag}
                  onMove={setMovePath}
                  bookmarkedPaths={bookmarkedPaths}
                  onBookmark={setBookmarkPath}
                  onCopyPath={copyGraphNodePath}
                  onTrash={(path) => void trashPath(path)}
                  onOpen={openGraphNode}
                  onOpenInNewTab={(path) => void openGraphNodeInNewTab(path)}
                  onOpenInNewWindow={(path) => void openGraphNodeInNewWindow(path)}
                  onOpenLinkedView={(path) => void openGraphNodeLinkedView(path)}
                  onRevealInFolder={revealGraphNodeInFolder}
                />
              </>
            ) : activeAttachment ? (
              <>
                <div className="note-top">
                  {workspaceTabBar}
                  <header className="note-header">
                    <div>
                      <strong>{activeAttachment.name}</strong>
                      <span>{activeAttachment.path}</span>
                    </div>
                  </header>
                </div>
                <AttachmentPreview
                  attachment={activeAttachment}
                  onOpenExternally={() => void openGraphNode(activeAttachment.path)}
                />
                <footer className="note-footer">
                  <span>{activeAttachment.size.toLocaleString()} bytes</span>
                  <span>
                    更新: {new Date(activeAttachment.modifiedAt).toLocaleString('ja-JP')}
                  </span>
                </footer>
              </>
            ) : selectedPath ? (
              <>
                <div className="note-top">
                  {workspaceTabBar}
                  <header className="note-header">
                    <div>
                      <strong>{withoutMarkdownExtension(basenameRelative(selectedPath))}</strong>
                      <span>{selectedPath}</span>
                    </div>
                    <div className="note-actions">
                    <span
                      className={`save-status is-${saveStatus}`}
                      role="status"
                      aria-live="polite"
                    >
                      <span className="save-status-dot" aria-hidden="true" />
                      {saveStatusLabel(saveStatus)}
                    </span>
                    {structuredCapture && (
                      <button
                        type="button"
                        onClick={() => {
                          setCaptureEditPath(selectedPath)
                          setCaptureError(null)
                          setCaptureKind(structuredCapture.kind)
                        }}
                      >
                        <Icon name="edit" />
                        内容を編集
                      </button>
                    )}
                    <button
                      type="button"
                      className={viewMode === 'edit' ? 'is-active' : ''}
                      aria-pressed={viewMode === 'edit'}
                      onClick={() => setViewMode('edit')}
                    >
                      <Icon name="edit" />
                      {structuredCapture ? 'Markdownソース' : '編集'}
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'preview' ? 'is-active' : ''}
                      aria-pressed={viewMode === 'preview'}
                      onClick={() => setViewMode('preview')}
                    >
                      <Icon name="preview" />
                      プレビュー
                    </button>
                    <button
                      type="button"
                      className={
                        viewMode === 'graph' && graphScope === 'local'
                          ? 'is-active'
                          : ''
                      }
                      aria-pressed={viewMode === 'graph' && graphScope === 'local'}
                      onClick={() => {
                        setGraphScope('local')
                        setViewMode('graph')
                      }}
                    >
                      <Icon name="graph" />
                      ローカルグラフ
                    </button>
                    <button
                      type="button"
                      className={
                        viewMode === 'graph' && graphScope === 'vault'
                          ? 'is-active'
                          : ''
                      }
                      aria-pressed={viewMode === 'graph' && graphScope === 'vault'}
                      onClick={openGlobalGraphWorkspace}
                    >
                      <Icon name="graph" />
                      グラフビュー
                    </button>
                    </div>
                  </header>
                </div>
                {viewMode === 'edit' ? (
                  <MarkdownEditor
                    value={content}
                    onChange={handleContentChange}
                    readOnly={busy}
                    notes={savedNotes.filter((note) => note.path !== selectedPath)}
                  />
                ) : viewMode === 'preview' ? (
                  <MarkdownPreview
                    content={content}
                    notePath={selectedPath}
                    attachments={snapshot.attachments ?? []}
                    onWikiLink={handleWikiLink}
                  />
                ) : (
                  <WikiGraphView
                    graph={visibleGraph}
                    notes={graphNotes}
                    currentPath={selectedPath}
                    scope={graphScope}
                    includeOrphans={graphFilters.showOrphans}
                    filterSettings={graphFilters}
                    forceSettings={graphForces}
                    displaySettings={graphDisplay}
                    groups={graphGroups}
                    viewState={graphViewStates[graphScope]}
                    onScopeChange={setGraphScope}
                    onIncludeOrphansChange={(showOrphans) =>
                      setGraphFilters((current) => ({
                        ...current,
                        showOrphans
                      }))
                    }
                    onFilterSettingsChange={setGraphFilters}
                    onFilterSettingsCommit={(next) =>
                      void persistGraphFilters(next)
                    }
                    onForceSettingsChange={setGraphForces}
                    onForceSettingsCommit={(next) => void persistGraphForces(next)}
                    onDisplaySettingsChange={setGraphDisplay}
                    onDisplaySettingsCommit={(next) =>
                      void persistGraphDisplay(next)
                    }
                    onGroupsChange={setGraphGroups}
                    onGroupsCommit={(next) => void persistGraphGroups(next)}
                    onViewStateCommit={(next) =>
                      void persistGraphViewState(graphScope, next)
                    }
                    onSearchTag={searchGraphTag}
                    onMove={setMovePath}
                    bookmarkedPaths={bookmarkedPaths}
                    onBookmark={setBookmarkPath}
                    onCopyPath={copyGraphNodePath}
                    onTrash={(path) => void trashPath(path)}
                    onOpen={openGraphNode}
                    onOpenInNewTab={(path) => void openGraphNodeInNewTab(path)}
                    onOpenInNewWindow={(path) => void openGraphNodeInNewWindow(path)}
                    onOpenLinkedView={(path) => void openGraphNodeLinkedView(path)}
                    onRevealInFolder={revealGraphNodeInFolder}
                  />
                )}
                <footer className="note-footer">
                  <span>{content.length.toLocaleString()}文字</span>
                  <span>
                    更新: {modifiedAt ? new Date(modifiedAt).toLocaleString('ja-JP') : '—'}
                    {selectedFreshness
                      ? ` · ${selectedFreshness.statusLabel}（${selectedFreshness.relativeLabel}）`
                      : ''}
                  </span>
                </footer>
              </>
            ) : (
              <div className="note-empty">
                <img src={tsuzuneMark} alt="" aria-hidden="true" />
                <p>左の一覧からノートを選ぶか、新しいノートを作成してください。</p>
                <button type="button" className="primary-button" onClick={() => void createNote()}>
                  <Icon name="note" />
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
                    notes={savedNotes}
                    asOf={temporalAsOf}
                    pathAliases={pathAliases}
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
        <MoveDialog
          notePath={movePath}
          directories={snapshot.directories}
          currentDirectory={dirnameRelative(movePath)}
          onCancel={() => setMovePath(null)}
          onConfirm={(directory) => void moveSelectedFile(directory)}
        />
      )}

      {renameRequest && (
        <RenameDialog
          entryPath={renameRequest.selection.path}
          entryKind={renameRequest.selection.kind}
          currentName={renameRequest.currentName}
          error={renameError}
          busy={busy}
          onCancel={() => {
            if (!busy) {
              setRenameRequest(null)
              setRenameError(null)
            }
          }}
          onConfirm={(name) => void confirmRename(name)}
        />
      )}

      {bookmarkPath && snapshot && (
        <BookmarkDialog
          path={bookmarkPath}
          bookmark={snapshot.bookmarks?.find(
            (bookmark) => bookmark.path === bookmarkPath
          )}
          onCancel={() => setBookmarkPath(null)}
          onSave={saveGraphBookmark}
          onDelete={removeGraphBookmark}
        />
      )}

      {captureKind && snapshot && (
        <HumanNoteCaptureDialog
          key={`${captureKind}:${captureEditPath ?? noteCreationTemplate?.path ?? ''}`}
          kind={captureKind}
          error={captureError}
          dateLabel={
            captureEditPath?.match(/^02_デイリー\/(\d{4}-\d{2}-\d{2})\.md$/)?.[1] ??
            localCalendarDate(new Date())
          }
          initialTitle={captureKind === 'note' ? '無題のノート' : undefined}
          initialValues={captureEditPath ? structuredCapture ?? undefined : undefined}
          notes={savedNotes}
          onCancel={() => {
            captureDirtyRef.current = false
            setCaptureKind(null)
            setCaptureEditPath(null)
            setNoteCreationTemplate(null)
            setCaptureError(null)
          }}
          onDirtyChange={handleCaptureDirtyChange}
          onSubmit={createCapturedNote}
        />
      )}

      {settingsDialogOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            ref={settingsDialogRef}
            className="modal app-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-settings-title"
            aria-busy={settingsBusy}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !settingsBusy) {
                event.preventDefault()
                setSettingsDialogOpen(false)
              }
            }}
          >
            <div className="google-sync-heading">
              <div>
                <h2 id="app-settings-title">設定</h2>
                <p>Vault全体に適用する設定です。</p>
              </div>
              <button
                type="button"
                aria-label="設定を閉じる"
                disabled={settingsBusy}
                onClick={() => setSettingsDialogOpen(false)}
              >
                ×
              </button>
            </div>

            <section className="app-settings-section" aria-labelledby="files-links-title">
              <h3 id="files-links-title">ファイルとリンク</h3>
              <label>
                <span>除外するファイル</span>
                <textarea
                  aria-label="除外するファイル"
                  value={excludedFilesDraft}
                  disabled={settingsBusy}
                  placeholder={'例: 90_Archive\n/\\.private\\.md$/'}
                  onChange={(event) => setExcludedFilesDraft(event.target.value)}
                />
              </label>
              <p>
                1行に1つ、パスの一部または /正規表現/ を指定します。対象は一覧・検索・リンク・グラフから除外されます。
              </p>
              <label>
                <span>AIから変更させないパス</span>
                <textarea
                  aria-label="AIから変更させないパス"
                  value={aiImmutablePathsDraft}
                  disabled={settingsBusy}
                  placeholder="例: Private"
                  onChange={(event) =>
                    setAiImmutablePathsDraft(event.target.value)
                  }
                />
              </label>
              <p>
                40_情報源 と 50_履歴 は常に保護されます。追加するノートまたはフォルダを1行に1つ指定します。
              </p>
              <label>
                <span>AI変更を承認制にするパス</span>
                <textarea
                  aria-label="AI変更を承認制にするパス"
                  value={aiReviewPathsDraft}
                  disabled={settingsBusy}
                  placeholder="例: 30_知識"
                  onChange={(event) => setAiReviewPathsDraft(event.target.value)}
                />
              </label>
              <p>
                対象ではAIの作成・更新を即時反映せず、ここで承認または取り消します。変更禁止の指定が優先されます。
              </p>
              <section aria-labelledby="ai-review-proposals-title">
                <h4 id="ai-review-proposals-title">承認待ちのAI変更案</h4>
                {aiReviewProposals.length === 0 ? (
                  <p>承認待ちの変更案はありません。</p>
                ) : (
                  aiReviewProposals.map((proposal) => {
                    const current = snapshot?.notes.find(
                      (note) => note.path.toLowerCase() === proposal.path.toLowerCase()
                    )
                    return (
                      <article key={proposal.id} className="ai-review-proposal">
                        <strong>{proposal.path}</strong>
                        <p>{proposal.reason}</p>
                        <p>操作: {proposal.operation === 'create' ? '作成' : '更新'}</p>
                        <p>
                          作成時刻: {new Date(proposal.createdAt).toLocaleString('ja-JP')}
                        </p>
                        <p>
                          出典: {proposal.sourceRefs.length > 0 ? proposal.sourceRefs.join('、') : 'なし'}
                        </p>
                        <div className="ai-review-comparison">
                          <div>
                            <span>現在</span>
                            <pre>{current?.content ?? '（新規ノート）'}</pre>
                          </div>
                          <div>
                            <span>変更案</span>
                            <pre>{proposal.content}</pre>
                          </div>
                        </div>
                        <div className="modal-actions">
                          <button
                            type="button"
                            disabled={settingsBusy}
                            onClick={() => void resolveAiReviewProposal(proposal, false)}
                          >
                            取り消す
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={settingsBusy}
                            onClick={() => void resolveAiReviewProposal(proposal, true)}
                          >
                            承認して反映
                          </button>
                        </div>
                      </article>
                    )
                  })
                )}
              </section>
            </section>

            <div className="modal-actions">
              <button
                type="button"
                disabled={settingsBusy}
                onClick={() => setSettingsDialogOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={settingsBusy}
                onClick={() => void saveExcludedFiles()}
              >
                設定を保存
              </button>
            </div>
          </section>
        </div>
      )}

      {googleDialogOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            ref={googleDialogRef}
            className="modal google-sync-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-sync-title"
            aria-busy={googleBusy || busy}
            tabIndex={-1}
            onKeyDown={handleGoogleDialogKeyDown}
          >
            <div className="google-sync-heading">
              <div>
                <h2 id="google-sync-title">Google Drive同期</h2>
                <p>ローカルMarkdownを原本として、確認してから手動同期します。</p>
              </div>
              <button
                type="button"
                aria-label="Google Drive同期を閉じる"
                disabled={googleBusy || busy}
                onClick={() => setGoogleDialogOpen(false)}
              >
                ×
              </button>
            </div>

            {googleBusy && <p className="google-sync-progress">Googleの処理を待っています…</p>}
            {googleError && (
              <p className="google-sync-error" role="alert">
                {googleError}
              </p>
            )}

            {!googleStatus?.configured ? (
              <div className="google-sync-step">
                <strong>Google OAuth設定が必要です</strong>
                <p>
                  Google Cloudで作成した「デスクトップアプリ」のOAuthクライアントJSONを選びます。
                </p>
                <button
                  type="button"
                  className="primary-button"
                  disabled={googleBusy}
                  onClick={() => void chooseGoogleConfig()}
                >
                  OAuth JSONを選ぶ
                </button>
              </div>
            ) : !googleStatus.connected ? (
              <div className="google-sync-step">
                <strong>Googleアカウントへ接続</strong>
                <p>
                  基本プロフィールと、TSUZUNEが作成するDriveファイルだけを扱う権限を求めます。
                </p>
                <div className="google-sync-buttons">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={googleBusy}
                    onClick={() => void connectGoogle()}
                  >
                    Googleでログイン
                  </button>
                  <button
                    type="button"
                    disabled={googleBusy}
                    aria-expanded={googleAdvancedOpen}
                    onClick={() => setGoogleAdvancedOpen((open) => !open)}
                  >
                    {googleAdvancedOpen ? '詳細設定を閉じる' : '詳細設定を開く'}
                  </button>
                </div>
                {googleAdvancedOpen && (
                  <div className="google-sync-advanced">
                    <p>
                      自分のGoogle Cloud設定を使う場合だけ、Desktop OAuth
                      JSONを選択します。
                    </p>
                    <button
                      type="button"
                      disabled={googleBusy}
                      onClick={() => void chooseGoogleConfig()}
                    >
                      独自のOAuth JSONを選ぶ
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="google-account-card">
                  <div>
                    <strong>{googleStatus.account?.name ?? 'Googleアカウント'}</strong>
                    <span>{googleStatus.account?.email}</span>
                  </div>
                  <button
                    type="button"
                    disabled={googleBusy || busy}
                    onClick={() => void disconnectGoogle()}
                  >
                    接続解除
                  </button>
                </div>

                <div className="google-sync-step">
                  <strong>Google読取機能</strong>
                  <p>
                    Calendarはここでは読取権限だけを準備します。予定の確認と取込は次の段階で追加します。
                  </p>
                  <p>
                    Drive同期:{' '}
                    {googleStatus.authorizedFeatures.includes('drive_sync')
                      ? '許可済み'
                      : '未許可'}
                  </p>
                  <p>
                    Calendar読取:{' '}
                    {googleStatus.authorizedFeatures.includes('calendar_read')
                      ? '許可済み'
                      : '未許可'}
                  </p>
                  {!googleStatus.authorizedFeatures.includes(
                    'calendar_read'
                  ) && (
                    <button
                      type="button"
                      disabled={googleBusy || busy}
                      onClick={() => void authorizeGoogleCalendar()}
                    >
                      Calendar読取を有効にする
                    </button>
                  )}
                </div>

                <div className="google-sync-meta">
                  <span>
                    最終同期:{' '}
                    {googleStatus.lastSyncAt
                      ? new Date(googleStatus.lastSyncAt).toLocaleString('ja-JP')
                      : '未実行'}
                  </span>
                  {googleStatus.vaultFolderUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        void window.tsuzune.openExternal(
                          googleStatus.vaultFolderUrl as string
                        )
                      }
                    >
                      Driveフォルダを開く
                    </button>
                  )}
                </div>

                <div className="google-sync-step">
                  <strong>既存のDrive Vaultへ接続</strong>
                  <p>
                    別端末で作成した空のローカルVaultへ、TSUZUNEが以前作成したDrive Vaultを接続できます。
                  </p>
                  <div className="google-sync-buttons">
                    <button
                      type="button"
                      disabled={!snapshot || googleBusy || busy}
                      onClick={() => void listRemoteDriveVaults()}
                    >
                      既存のDrive Vaultを探す
                    </button>
                  </div>
                  {driveVaults.length > 0 && (
                    <div className="drive-vault-picker">
                      <label>
                        <span>接続先</span>
                        <select
                          aria-label="接続するDrive Vault"
                          value={selectedDriveVaultId}
                          onChange={(event) =>
                            setSelectedDriveVaultId(event.target.value)
                          }
                        >
                          {driveVaults.map((vault) => (
                            <option
                              key={vault.rootFolderId}
                              value={vault.rootFolderId}
                            >
                              {vault.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={!selectedDriveVaultId || googleBusy || busy}
                        onClick={() => void pairRemoteDriveVault()}
                      >
                        このDrive Vaultを使う
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="primary-button"
                  disabled={!snapshot || googleBusy || busy}
                  onClick={() => void previewGoogleDriveSync()}
                >
                  同期内容を確認
                </button>

                {drivePreview && (
                  <div className="sync-preview">
                    <div className="sync-counts" aria-label="同期件数">
                      <span>送信 {drivePreview.counts.upload}</span>
                      <span>受信 {drivePreview.counts.download}</span>
                      <span>移動 {drivePreview.counts.move}</span>
                      <span>競合 {drivePreview.counts.conflict}</span>
                      <span>保持 {drivePreview.counts.preserve}</span>
                    </div>
                    {drivePreview.items.length > 0 ? (
                      <ul className="sync-preview-list">
                        {drivePreview.items.map((item) => (
                          <li key={`${item.action}:${item.path}`}>
                            <span className={`sync-action is-${item.action}`}>
                              {item.action === 'upload'
                                ? '送信'
                                : item.action === 'download'
                                  ? '受信'
                                  : item.action === 'move'
                                    ? '移動'
                                  : item.action === 'conflict'
                                    ? '競合'
                                    : '保持'}
                            </span>
                            <span>
                              {item.oldPath ? `${item.oldPath} → ${item.path}` : item.path}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="sync-no-changes">同期が必要な変更はありません。</p>
                    )}
                    {drivePreview.items.length > 0 && (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={googleBusy || busy}
                        onClick={() => void applyGoogleDriveSync()}
                      >
                        この内容で同期
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            <p className="google-sync-boundary">
              広告プロファイル、Google検索履歴、他アプリのDriveファイルは取得しません。
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
